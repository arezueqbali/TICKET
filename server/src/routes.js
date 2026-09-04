import { Router } from 'express';
import {
  getMovies,
  getMovie,
  getCinemas,
  getShowtimesForMovie,
  getShowtimeDetail,
  getBookingByReference,
  createBooking,
  checkSeatsAvailable,
  isPaymentIntentUsed,
} from './store.js';
import { stripe } from './stripe.js';

export const router = Router();

// Stripe only accepts integer "smallest currency unit" amounts — cents for USD.
const toCents = (amount) => Math.round(amount * 100);

router.get('/movies', (req, res) => {
  res.json(getMovies());
});

router.get('/movies/:id', (req, res) => {
  const movie = getMovie(req.params.id);
  if (!movie) {
    return res.status(404).json({ error: 'MOVIE_NOT_FOUND', message: `No movie found with id "${req.params.id}".` });
  }
  res.json(movie);
});

router.get('/cinemas', (req, res) => {
  res.json(getCinemas());
});

router.get('/movies/:id/showtimes', (req, res) => {
  const movie = getMovie(req.params.id);
  if (!movie) {
    return res.status(404).json({ error: 'MOVIE_NOT_FOUND', message: `No movie found with id "${req.params.id}".` });
  }
  res.json(getShowtimesForMovie(req.params.id));
});

router.get('/showtimes/:id', (req, res) => {
  const detail = getShowtimeDetail(req.params.id);
  if (!detail) {
    return res
      .status(404)
      .json({ error: 'SHOWTIME_NOT_FOUND', message: `No showtime found with id "${req.params.id}".` });
  }
  res.json(detail);
});

// Step 1 of paid checkout: create a Stripe PaymentIntent for the seats the customer
// has selected. Does NOT reserve the seats (Stripe confirmation happens client-side,
// out of process) — availability is only advisory here and re-checked for real,
// atomically, inside createBooking once payment has actually succeeded.
router.post('/payments/create-intent', async (req, res) => {
  const { showtimeId, seatIds } = req.body || {};
  if (typeof showtimeId !== 'string' || !showtimeId) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'showtimeId (string) is required.' });
  }

  const availability = checkSeatsAvailable(showtimeId, seatIds);
  if (!availability.ok) {
    const status = availability.code === 'SEATS_UNAVAILABLE' ? 409 : 400;
    return res.status(status).json({
      error: availability.code,
      message: availability.message,
      unavailableSeatIds: availability.unavailableSeatIds,
    });
  }

  const dedupedSeatIds = [...new Set(seatIds)];
  const amount = toCents(availability.showtime.price * dedupedSeatIds.length);

  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { showtimeId, seatIds: dedupedSeatIds.join(',') },
    });
    res.status(201).json({ clientSecret: intent.client_secret, amount, currency: 'usd' });
  } catch (err) {
    console.error('[stripe] failed to create PaymentIntent:', err.message);
    res.status(502).json({ error: 'PAYMENT_INIT_FAILED', message: 'Could not initialize payment with Stripe.' });
  }
});

router.post('/bookings', async (req, res) => {
  const { showtimeId, seatIds, customer, paymentIntentId } = req.body || {};
  if (typeof showtimeId !== 'string' || !showtimeId) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'showtimeId (string) is required.' });
  }
  if (typeof paymentIntentId !== 'string' || !paymentIntentId) {
    return res.status(400).json({ error: 'PAYMENT_REQUIRED', message: 'paymentIntentId (string) is required.' });
  }
  if (isPaymentIntentUsed(paymentIntentId)) {
    return res.status(409).json({ error: 'PAYMENT_ALREADY_USED', message: 'This payment has already been applied to a booking.' });
  }

  // Verify the payment actually succeeded before touching seat state. This is
  // network I/O, so it happens *before* createBooking's synchronous critical
  // section, never inside it.
  let intent;
  try {
    intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    return res.status(400).json({ error: 'PAYMENT_INVALID', message: `Could not verify payment: ${err.message}` });
  }

  if (intent.status !== 'succeeded') {
    return res.status(402).json({
      error: 'PAYMENT_NOT_COMPLETED',
      message: `Payment has not completed (status: ${intent.status}).`,
    });
  }

  const dedupedSeatIds = [...new Set(Array.isArray(seatIds) ? seatIds : [])];
  const expectedShowtimeId = intent.metadata?.showtimeId;
  const expectedSeatIds = (intent.metadata?.seatIds || '').split(',').filter(Boolean);
  const seatsMatch =
    expectedShowtimeId === showtimeId &&
    expectedSeatIds.length === dedupedSeatIds.length &&
    expectedSeatIds.every((id) => dedupedSeatIds.includes(id));
  if (!seatsMatch) {
    return res.status(400).json({
      error: 'PAYMENT_MISMATCH',
      message: 'This payment does not match the requested showtime/seats.',
    });
  }

  const result = createBooking({ showtimeId, seatIds: dedupedSeatIds, customer, paymentIntentId });

  // The payment succeeded but the seats were taken by someone else in the tiny
  // window between payment confirmation and this request (or a duplicate submit) —
  // refund automatically so the customer is never charged without a booking.
  if (result.status === 409 && result.body?.error === 'SEATS_UNAVAILABLE') {
    try {
      await stripe.refunds.create({ payment_intent: paymentIntentId });
      result.body.message += ' Your payment has been automatically refunded.';
    } catch (err) {
      console.error('[stripe] auto-refund failed for', paymentIntentId, err.message);
      result.body.message += ' We could not auto-refund your payment; please contact support.';
    }
  }

  res.status(result.status).json(result.body);
});

router.get('/bookings/:reference', (req, res) => {
  const booking = getBookingByReference(req.params.reference);
  if (!booking) {
    return res
      .status(404)
      .json({ error: 'BOOKING_NOT_FOUND', message: `No booking found with reference "${req.params.reference}".` });
  }
  res.json(booking);
});
