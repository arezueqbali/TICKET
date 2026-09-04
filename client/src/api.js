// In dev (`vite`), the API runs separately on :4000. In every built/deployed form
// (Vercel, the Electron desktop app, or a plain `vite build` served by the Express
// server itself) the API is same-origin under /api, so a relative URL is correct
// and there's nothing to configure per-environment.
const BASE_URL = import.meta.env.DEV ? 'http://localhost:4000/api' : '/api'

/**
 * Wraps fetch, parses JSON, and throws an ApiError with the parsed body
 * attached for non-2xx responses so callers can inspect structured error
 * payloads (e.g. the 409 SEATS_UNAVAILABLE shape from POST /bookings).
 */
export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.message) || (body && body.error) || `Request failed with status ${status}`)
    this.status = status
    this.body = body
  }
}

async function request(path, options) {
  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new ApiError(0, { error: 'NETWORK_ERROR', message: 'Could not reach the server. Is the backend running?' })
  }

  const text = await res.text()
  const body = text ? JSON.parse(text) : null

  if (!res.ok) {
    throw new ApiError(res.status, body)
  }
  return body
}

export const getMovies = () => request('/movies')

export const getMovie = (id) => request(`/movies/${id}`)

export const getCinemas = () => request('/cinemas')

export const getShowtimesForMovie = (movieId) => request(`/movies/${movieId}/showtimes`)

export const getShowtime = (id) => request(`/showtimes/${id}`)

export const createPaymentIntent = ({ showtimeId, seatIds }) =>
  request('/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify({ showtimeId, seatIds }),
  })

export const createBooking = ({ showtimeId, seatIds, customer, paymentIntentId }) =>
  request('/bookings', {
    method: 'POST',
    body: JSON.stringify({ showtimeId, seatIds, customer, paymentIntentId }),
  })

export const getBooking = (reference) => request(`/bookings/${reference}`)
