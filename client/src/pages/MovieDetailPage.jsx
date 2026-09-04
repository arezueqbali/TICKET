import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getMovie, getShowtimesForMovie } from '../api'
import { formatMoney, formatShowDate, formatShowTime } from '../format'
import './MovieDetailPage.css'

export default function MovieDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [movie, setMovie] = useState(null)
  const [showtimes, setShowtimes] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setMovie(null)
    setShowtimes(null)
    setError(null)

    Promise.all([getMovie(id), getShowtimesForMovie(id)])
      .then(([movieData, showtimeData]) => {
        if (cancelled) return
        setMovie(movieData)
        setShowtimes(showtimeData)
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <div className="page">
        <p className="state-message error">
          {error.status === 404 ? 'Movie not found.' : `Couldn't load this movie: ${error.message}`}
        </p>
        <Link to="/" className="btn btn-secondary">Back to movies</Link>
      </div>
    )
  }

  if (!movie || !showtimes) {
    return (
      <div className="page">
        <p className="state-message">Loading&hellip;</p>
      </div>
    )
  }

  const byCinema = showtimes.reduce((acc, st) => {
    const key = st.cinemaId
    if (!acc[key]) acc[key] = { cinemaName: st.cinemaName, items: [] }
    acc[key].items.push(st)
    return acc
  }, {})

  return (
    <div className="page">
      <div className="movie-detail">
        <img className="detail-poster" src={movie.posterUrl} alt={`${movie.title} poster`} />
        <div className="detail-info">
          <h1 className="detail-title">{movie.title}</h1>
          <div className="detail-meta">
            <span className="pill">{movie.rating}</span>
            <span>{movie.genre}</span>
            <span aria-hidden="true">&bull;</span>
            <span>{movie.durationMinutes} min</span>
          </div>
          <p className="detail-description">{movie.description}</p>
        </div>
      </div>

      <h2 className="showtimes-heading">Showtimes</h2>
      {showtimes.length === 0 && <p className="state-message">No showtimes scheduled right now.</p>}

      {Object.values(byCinema).map((group) => (
        <div key={group.cinemaName} className="cinema-group card">
          <h3 className="cinema-name">{group.cinemaName}</h3>
          <div className="showtime-list">
            {group.items
              .slice()
              .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
              .map((st) => (
                <button
                  key={st.id}
                  className="showtime-btn"
                  onClick={() => navigate(`/showtimes/${st.id}/seats`)}
                >
                  <span className="showtime-date">{formatShowDate(st.startTime)}</span>
                  <span className="showtime-time">{formatShowTime(st.startTime)}</span>
                  <span className="showtime-price">{formatMoney(st.price)}</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
