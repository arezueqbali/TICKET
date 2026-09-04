import { Link } from 'react-router-dom'
import './Header.css'

export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">CB</span>
          <span className="brand-name">CineBook</span>
        </Link>
      </div>
    </header>
  )
}
