import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { api, type DashboardData } from './api'
import { Navbar } from './components/Navbar'
import { Dashboard } from './pages/Dashboard'
import { Activate } from './pages/Activate'
import { LicenseView } from './components/LicenseView'
import { ToastContainer, toast } from './components/Toast'
import { hasCompletedTour } from './utils/tourStorage'

type AppView = 'loading' | 'activate' | 'dashboard' | 'license'

export default function App() {
  const [view, setView] = useState<AppView>('loading')
  const [data, setData] = useState<DashboardData | null>(null)
  const [startTour, setStartTour] = useState(false)

  const loadApp = useCallback(async (options?: { startTour?: boolean }) => {
    setView('loading')
    try {
      const d = await api.getDashboard()
      setData(d)
      if (d.license_info.valid) {
        setView('dashboard')
        if (options?.startTour || !hasCompletedTour()) {
          setStartTour(true)
        }
      } else {
        setView('activate')
        setStartTour(false)
      }
    } catch {
      setView('activate')
      setStartTour(false)
    }
  }, [])

  useEffect(() => {
    loadApp()
  }, [loadApp])

  useEffect(() => {
    if (view !== 'dashboard' && view !== 'license') return

    const syncRemoteLicense = async () => {
      try {
        const check = await api.checkRemoteLicense()
        if (check.revoked || check.license_info?.valid === false) {
          toast('info', 'La licencia ya no está activa en SYSCOM. Redirigiendo a activación...')
          await loadApp()
        }
      } catch {
        // ignore background sync errors
      }
    }

    syncRemoteLicense()
    const intervalId = window.setInterval(syncRemoteLicense, 120000)
    return () => window.clearInterval(intervalId)
  }, [view, loadApp])

  if (view === 'loading') {
    return (
      <div className="app-shell flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (view === 'activate') {
    return (
      <div className="app-shell">
        <Activate />
        <ToastContainer />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Navbar
        localIp={data?.local_ip || ''}
        onGuideClick={() => {
          setView('dashboard')
          setStartTour(true)
        }}
        onLicenseClick={() => setView('license')}
        activeView={view}
      />
      {view === 'dashboard' && data && (
        <Dashboard
          data={data}
          startTour={startTour}
          onTourDone={() => setStartTour(false)}
          onConfigUpdate={setData}
        />
      )}
      {view === 'license' && data && (
        <LicenseView
          licenseInfo={data.license_info}
          onBack={() => setView('dashboard')}
        />
      )}
      <ToastContainer />
    </div>
  )
}
