import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTheme } from '../hooks/theme-provider'

function getResolvedTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [resolved, setResolved] = useState<'light' | 'dark'>(getResolvedTheme)

  useEffect(() => {
    setResolved(getResolvedTheme())
    const root = document.documentElement
    const observer = new MutationObserver(() => setResolved(getResolvedTheme()))
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [theme])

  const isDark = resolved === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="navbar-icon-btn"
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      aria-label={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
