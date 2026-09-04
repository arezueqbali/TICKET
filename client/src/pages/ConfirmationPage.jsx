import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getBooking, getShowtime } from '../api'
import { formatMoney, formatShowDate, formatShowTime, seatLabel } from '../format'
import './ConfirmationPage.css'

export default function ConfirmationPage() {
  const { reference } = useParams()
  const [booking, setBooking] = useState(null)
  const [showtime, setShowtime] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getBooking(reference)
      .then((b) => {
        if (cancelled) return
        setBooking(b)
        return getShowtime(b.showtimeId).then((st) => {
          if (!cancelled) setShowtime(st)
        })
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
    return () => {
      cancelled = true
    }
  }, [reference])

  if (error) {
    return (
      <div className="page">
        <p className="state-message error">
          {error.status === 404 ? `No booking found for reference ${reference}.` : `Couldn't load booking: ${error.message}`}
        </p>
        <Link to="/" className="btn btn-secondary">Back to movies</Link>
      </div>
    )
  }

  if (!booking || !showtime) {
    return (
      <div className="page">
        <p className="state-message">Loading your booking&hellip;</p>
      </div>
    )
  }

  const seats = showtime.seats.filter((s) => booking.seatIds.includes(s.id))

  return (
    <div className="page confirmation-page">
      <div className="confirmation-card card">
        <div className="confirmation-check">&#10003;</div>
        <h1 className="confirmation-title">Booking confirmed</h1>
        <p className="confirmation-sub">A confirmation was sent to {booking.customer.email}</p>

        <div className="reference-box">
          <span className="reference-label">Booking reference</span>
          <span className="reference-value">{booking.reference}</span>
        </div>

        <div className="confirmation-details">
          <div className="detail-row">
            <span>Movie</span>
            <span>{showtime.movie.title}</span>
          </div>
          <div className="detail-row">
            <span>Cinema</span>
            <span>{showtime.cinema.name}</span>
          </div>
          <div className="detail-row">
            <span>Showtime</span>
            <span>{formatShowDate(showtime.startTime)} at {formatShowTime(showtime.startTime)}</span>
          </div>
          <div className="detail-row">
            <span>Seats</span>
            <span>{seats.map(seatLabel).sort().join(', ')}</span>
          </div>
          <div className="detail-row">
            <span>Customer</span>
            <span>{booking.customer.name}</span>
          </div>
          <div className="detail-row total-row">
            <span>Total paid</span>
            <span>{formatMoney(booking.totalAmount)}</span>
          </div>
        </div>

        <Link to="/" className="btn btn-primary btn-block">Book another movie</Link>
      </div>
    </div>
  )
}
