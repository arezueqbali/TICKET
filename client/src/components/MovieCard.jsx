import { Link } from 'react-router-dom'
import './MovieCard.css'

export default function MovieCard({ movie }) {
  return (
    <Link to={`/movies/${movie.id}`} className="movie-card card">
      <div className="movie-poster-wrap">
        <img className="movie-poster" src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" />
        <span className="movie-rating">{movie.rating}</span>
      </div>
      <div className="movie-card-body">
        <h3 className="movie-title">{movie.title}</h3>
        <div className="movie-meta">
          <span>{movie.genre}</span>
          <span aria-hidden="true">&bull;</span>
          <span>{movie.durationMinutes} min</span>
        </div>
      </div>
    </Link>
  )
}
