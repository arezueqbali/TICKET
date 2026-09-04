// In-memory data store for CineBook, mirrored to a JSON file on every write.
//
// Concurrency note (see SPEC.md "no seat double-books"): `createBooking` below is a
// single synchronous function with no `await`, timers, or I/O between reading seat
// state and committing the booking to memory. Node runs one JS call stack to completion
// per event-loop turn, so two `POST /bookings` requests arriving back-to-back cannot
// interleave inside this function — the second call only starts after the first has
// fully returned (and already mutated `bookedSeatsByShowtime` / `bookings`). The file
// mirror (`persist()`) happens synchronously too, but it runs *after* the in-memory
// commit is already final, so it is not part of the correctness-critical section.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeedData } from './seedData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// On Vercel the deployed filesystem is read-only except /tmp, and /tmp is only
// shared across requests hitting the *same* warm serverless instance — it is not
// durable storage. Locally (and in the Electron desktop build) this file lives
// next to the server and really does persist bookings across restarts, per
// SPEC.md. On Vercel, treat it as best-effort: it survives while an instance
// stays warm, and resets (back to seed data) whenever a fresh instance cold-starts.
const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'cinebook-data.json')
  : path.join(__dirname, '..', 'data.json');

const REF_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateReferenceCandidate() {
  let ref = 'CB-';
  for (let i = 0; i < 6; i++) {
    ref += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)];
  }
  return ref;
}

function loadInitialState() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.movies && parsed.cinemas && parsed.showtimes && parsed.seatsByShowtime) {
        return {
          movies: parsed.movies,
          cinemas: parsed.cinemas,
          showtimes: parsed.showtimes,
          seatsByShowtime: parsed.seatsByShowtime,
          bookings: parsed.bookings || [],
        };
      }
    } catch (err) {
      console.warn('[store] failed to read existing data.json, reseeding:', err.message);
    }
  }
  const seed = buildSeedData();
  return { ...seed, bookings: [] };
}

const state = loadInitialState();

// Fast-lookup index: showtimeId -> Set<seatId> already booked. Rebuilt from
// `state.bookings` at startup, then kept in sync on every successful booking.
const bookedSeatsByShowtime = new Map();
for (const booking of state.bookings) {
  if (!bookedSeatsByShowtime.has(booking.showtimeId)) {
    bookedSeatsByShowtime.set(booking.showtimeId, new Set());
  }
  const set = bookedSeatsByShowtime.get(booking.showtimeId);
  for (const seatId of booking.seatIds) set.add(seatId);
}

// bookings indexed by reference for O(1) lookup
const bookingsByReference = new Map(state.bookings.map((b) => [b.reference, b]));

// Stripe PaymentIntent ids already consumed by a booking, so the same successful
// payment can't be used to mint two bookings (replay of the same paymentIntentId).
const usedPaymentIntentIds = new Set(state.bookings.map((b) => b.paymentIntentId).filter(Boolean));

function persist() {
  // Best-effort: never let a filesystem hiccup (e.g. a stricter serverless sandbox)
  // take down a request that already succeeded in memory.
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          movies: state.movies,
          cinemas: state.cinemas,
          showtimes: state.showtimes,
          seatsByShowtime: state.seatsByShowtime,
          bookings: state.bookings,
        },
        null,
        2
      )
    );
  } catch (err) {
    console.warn('[store] failed to persist data.json:', err.message);
  }
}

// Write the seed (or reloaded) state out immediately so data.json always reflects
// what the server is actually serving, even before any booking is made.
persist();

export function getMovies() {
  return state.movies;
}

export function getMovie(id) {
  return state.movies.find((m) => m.id === id) || null;
}

export function getCinemas() {
  return state.cinemas;
}

export function getCinema(id) {
  return state.cinemas.find((c) => c.id === id) || null;
}

export function getShowtime(id) {
  return state.showtimes.find((s) => s.id === id) || null;
}

export function getShowtimesForMovie(movieId) {
  return state.showtimes
    .filter((s) => s.movieId === movieId)
    .map((s) => {
      const cinema = getCinema(s.cinemaId);
      return {
        id: s.id,
        movieId: s.movieId,
        cinemaId: s.cinemaId,
        cinemaName: cinema ? cinema.name : null,
        startTime: s.startTime,
        price: s.price,
      };
    });
}

export function getSeatsForShowtime(showtimeId) {
  return state.seatsByShowtime[showtimeId] || null;
}

// Full detail payload for the seat-selection screen, with derived seat status.
export function getShowtimeDetail(showtimeId) {
  const showtime = getShowtime(showtimeId);
  if (!showtime) return null;
  const movie = getMovie(showtime.movieId);
  const cinema = getCinema(showtime.cinemaId);
  const seats = getSeatsForShowtime(showtimeId) || [];
  const bookedSet = bookedSeatsByShowtime.get(showtimeId) || new Set();

  return {
    id: showtime.id,
    movie,
    cinema,
    startTime: showtime.startTime,
    price: showtime.price,
    seats: seats.map((seat) => ({
      id: seat.id,
      row: seat.row,
      number: seat.number,
      status: bookedSet.has(seat.id) ? 'booked' : 'available',
    })),
  };
}

export function getBookingByReference(reference) {
  return bookingsByReference.get(reference) || null;
}

/**
 * Validate that a showtime exists and every seatId belongs to it.
 * Returns { ok: true } or { ok: false, code, message }.
 * Pure / synchronous — safe to call as part of the booking critical section.
 */
export function validateShowtimeAndSeats(showtimeId, seatIds) {
  const showtime = getShowtime(showtimeId);
  if (!showtime) {
    return { ok: false, code: 'SHOWTIME_NOT_FOUND', message: `No showtime found with id "${showtimeId}".` };
  }
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return { ok: false, code: 'INVALID_SEATS', message: 'seatIds must be a non-empty array.' };
  }
  const validSeatIds = new Set((getSeatsForShowtime(showtimeId) || []).map((s) => s.id));
  const unknown = [...new Set(seatIds)].filter((id) => !validSeatIds.has(id));
  if (unknown.length > 0) {
    return {
      ok: false,
      code: 'INVALID_SEATS',
      message: `The following seat ids do not belong to showtime "${showtimeId}": ${unknown.join(', ')}.`,
    };
  }
  return { ok: true, showtime };
}

/**
 * Read-only availability check (no reservation), used before creating a Stripe
 * PaymentIntent so we don't charge a card for seats that are already gone.
 * This is best-effort/advisory only — the real, race-safe check happens again
 * inside createBooking's synchronous critical section below.
 */
export function checkSeatsAvailable(showtimeId, seatIds) {
  const validation = validateShowtimeAndSeats(showtimeId, seatIds);
  if (!validation.ok) return validation;
  const bookedSet = bookedSeatsByShowtime.get(showtimeId) || new Set();
  const unavailableSeatIds = [...new Set(seatIds)].filter((id) => bookedSet.has(id));
  if (unavailableSeatIds.length > 0) {
    return {
      ok: false,
      code: 'SEATS_UNAVAILABLE',
      message: `The following seats are no longer available: ${unavailableSeatIds.join(', ')}.`,
      unavailableSeatIds,
    };
  }
  return { ok: true, showtime: validation.showtime };
}

export function isPaymentIntentUsed(paymentIntentId) {
  return usedPaymentIntentIds.has(paymentIntentId);
}

/**
 * Create a booking. THIS FUNCTION MUST STAY FULLY SYNCHRONOUS.
 * No await / timers / I/O may be introduced between the availability check and the
 * in-memory commit below — that synchronicity is what prevents double-booking under
 * concurrent requests. `persist()` (file write) happens after commit, once the outcome
 * is already final, so it does not affect correctness.
 */
export function createBooking({ showtimeId, seatIds, customer, paymentIntentId }) {
  const validation = validateShowtimeAndSeats(showtimeId, seatIds);
  if (!validation.ok) {
    return { status: 400, body: { error: validation.code, message: validation.message } };
  }

  if (!customer || typeof customer.name !== 'string' || !customer.name.trim() ||
      typeof customer.email !== 'string' || !customer.email.trim()) {
    return {
      status: 400,
      body: { error: 'INVALID_CUSTOMER', message: 'customer.name and customer.email are required.' },
    };
  }

  if (typeof paymentIntentId !== 'string' || !paymentIntentId.trim()) {
    return {
      status: 400,
      body: { error: 'PAYMENT_REQUIRED', message: 'A confirmed paymentIntentId is required to create a booking.' },
    };
  }

  const dedupedSeatIds = [...new Set(seatIds)];
  const { showtime } = validation;

  // ---- Critical section start: read-then-write, synchronous, no yielding ----
  // (Stripe verification — retrieving/confirming the PaymentIntent — happens in the
  // route handler *before* this call, since that's network I/O. By the time we get
  // here, paymentIntentId has already been confirmed as 'succeeded' for the right
  // amount; this section only needs synchronous, in-memory checks.)
  if (usedPaymentIntentIds.has(paymentIntentId)) {
    return {
      status: 409,
      body: { error: 'PAYMENT_ALREADY_USED', message: 'This payment has already been applied to a booking.' },
    };
  }

  if (!bookedSeatsByShowtime.has(showtimeId)) {
    bookedSeatsByShowtime.set(showtimeId, new Set());
  }
  const bookedSet = bookedSeatsByShowtime.get(showtimeId);

  const unavailableSeatIds = dedupedSeatIds.filter((id) => bookedSet.has(id));
  if (unavailableSeatIds.length > 0) {
    return {
      status: 409,
      body: {
        error: 'SEATS_UNAVAILABLE',
        unavailableSeatIds,
        message: `The following seats are no longer available: ${unavailableSeatIds.join(', ')}.`,
      },
    };
  }

  let reference = generateReferenceCandidate();
  while (bookingsByReference.has(reference)) {
    reference = generateReferenceCandidate();
  }

  for (const id of dedupedSeatIds) bookedSet.add(id);
  usedPaymentIntentIds.add(paymentIntentId);

  const booking = {
    reference,
    showtimeId,
    seatIds: dedupedSeatIds,
    customer: { name: customer.name.trim(), email: customer.email.trim() },
    totalAmount: Math.round(showtime.price * dedupedSeatIds.length * 100) / 100,
    paymentIntentId,
    createdAt: new Date().toISOString(),
  };
  state.bookings.push(booking);
  bookingsByReference.set(reference, booking);
  // ---- Critical section end ----

  persist();

  return { status: 201, body: booking };
}
