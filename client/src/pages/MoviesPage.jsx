import { useEffect, useState } from 'react'
import { getMovies } from '../api'
import MovieCard from '../components/MovieCard'
import './MoviesPage.css'

export default function MoviesPage() {
  const [movies, setMovies] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getMovies()
      .then((data) => {
        if (!cancelled) setMovies(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="page">
        <p className="state-message error">
          Couldn't load movies: {error.message}
        </p>
      </div>
    )
  }

  if (!movies) {
    return (
      <div className="page">
        <p className="state-message">Loading movies&hellip;</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">Now Showing</h1>
      <div className="movie-grid">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </div>
  )
}
