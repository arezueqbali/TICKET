import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="page">
      <p className="state-message">Page not found.</p>
      <Link to="/" className="btn btn-secondary">Back to movies</Link>
    </div>
  )
}
