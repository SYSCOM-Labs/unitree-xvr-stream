import { Wifi, BookOpen, Shield } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import logo from '../assets/logo.png'

interface NavbarProps {
  localIp: string
  onGuideClick: () => void
  onLicenseClick: () => void
  activeView: 'dashboard' | 'license'
}

export function Navbar({ localIp, onGuideClick, onLicenseClick, activeView }: NavbarProps) {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo-link" aria-hidden="true">
          <img src={logo} alt="SYSCOM" className="navbar-logo-icon" />
        </div>
        <span className="navbar-divider" aria-hidden="true" />
        <div className="min-w-0">
          <div className="navbar-title">SYSCOM Bridge</div>
          <div className="text-[11px] text-white/60 truncate">UNITREE NVR</div>
        </div>
      </div>

      <nav className="navbar-nav navbar-actions" aria-label="Acciones del panel">
        <span className="navbar-ip-badge">
          <Wifi className="w-3 h-3" aria-hidden="true" />
          <span className="tabular-nums">{localIp}</span>
        </span>

        <a
          href="https://unitree.syscom.mx"
          target="_blank"
          rel="noopener noreferrer"
          className="navbar-link"
        >
          Tutoriales
        </a>

        <button
          type="button"
          onClick={onGuideClick}
          className="navbar-icon-btn"
          title="Guía interactiva"
          aria-label="Guía interactiva"
        >
          <BookOpen className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onLicenseClick}
          className={`navbar-icon-btn${activeView === 'license' ? ' active' : ''}`}
          title="Licencia"
          aria-label="Licencia"
        >
          <Shield className="w-4 h-4" />
        </button>

        <ThemeToggle />
      </nav>
    </header>
  )
}
