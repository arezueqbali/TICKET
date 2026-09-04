import { Router } from 'express';
import {
  getMovies,
  getMovie,
  getCinemas,
  getShowtimesForMovie,
  getShowtimeDetail,
  getBookingByReference,
  createBooking,
} from './store.js';

export const router = Router();

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

router.post('/bookings', (req, res) => {
  const { showtimeId, seatIds, customer } = req.body || {};
  if (typeof showtimeId !== 'string' || !showtimeId) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'showtimeId (string) is required.' });
  }
  const result = createBooking({ showtimeId, seatIds, customer });
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
