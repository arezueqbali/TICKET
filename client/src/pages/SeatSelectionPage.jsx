import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { getShowtime } from '../api'
import { formatMoney, formatShowDate, formatShowTime } from '../format'
import SeatMap from '../components/SeatMap'
import './SeatSelectionPage.css'

export default function SeatSelectionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [showtime, setShowtime] = useState(null)
  const [error, setError] = useState(null)
  const [selectedSeatIds, setSelectedSeatIds] = useState([])
  const [conflictMessage] = useState(location.state?.conflictMessage || null)

  const loadShowtime = useCallback(() => {
    setError(null)
    return getShowtime(id)
      .then((data) => {
        setShowtime(data)
        // Drop any previously selected seat that is no longer available.
        setSelectedSeatIds((prev) =>
          prev.filter((seatId) => {
            const seat = data.seats.find((s) => s.id === seatId)
            return seat && seat.status === 'available'
          }),
        )
      })
      .catch((err) => setError(err))
  }, [id])

  useEffect(() => {
    setShowtime(null)
    setSelectedSeatIds([])
    loadShowtime()
    // Clear the router state so a later refresh doesn't re-show a stale banner.
    if (location.state?.conflictMessage) {
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function toggleSeat(seat) {
    if (seat.status === 'booked') return
    setSelectedSeatIds((prev) =>
      prev.includes(seat.id) ? prev.filter((s) => s !== seat.id) : [...prev, seat.id],
    )
  }

  if (error) {
    return (
      <div className="page">
        <p className="state-message error">
          {error.status === 404 ? 'Showtime not found.' : `Couldn't load seats: ${error.message}`}
        </p>
        <Link to="/" className="btn btn-secondary">Back to movies</Link>
      </div>
    )
  }

  if (!showtime) {
    return (
      <div className="page">
        <p className="state-message">Loading seat map&hellip;</p>
      </div>
    )
  }

  const total = showtime.price * selectedSeatIds.length

  function handleContinue() {
    navigate(`/showtimes/${id}/checkout`, {
      state: { selectedSeatIds, price: showtime.price },
    })
  }

  return (
    <div className="page">
      <div className="seat-select-header">
        <h1 className="seat-select-title">{showtime.movie.title}</h1>
        <p className="seat-select-subtitle">
          {showtime.cinema.name} &bull; {formatShowDate(showtime.startTime)} at {formatShowTime(showtime.startTime)}
        </p>
      </div>

      {conflictMessage && (
        <div className="banner banner-error">
          {conflictMessage} The seat map below has been refreshed &mdash; please choose again.
        </div>
      )}

      <div className="seat-map-card card">
        <SeatMap seats={showtime.seats} selectedSeatIds={selectedSeatIds} onToggleSeat={toggleSeat} />
      </div>

      <div className="booking-bar card">
        <div className="booking-bar-info">
          <div className="booking-bar-seats">
            {selectedSeatIds.length === 0
              ? 'No seats selected'
              : `${selectedSeatIds.length} seat${selectedSeatIds.length > 1 ? 's' : ''} selected`}
          </div>
          <div className="booking-bar-total">{formatMoney(total)}</div>
        </div>
        <button
          className="btn btn-primary"
          disabled={selectedSeatIds.length === 0}
          onClick={handleContinue}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
