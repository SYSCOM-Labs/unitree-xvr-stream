import { useState, useEffect, useCallback, useRef } from 'react'
import { Joyride, type EventData, EVENTS, STATUS } from 'react-joyride'
import { api, type DashboardData } from '../api'
import { toast } from '../components/Toast'
import { NetworkPreview } from '../components/NetworkPreview'
import { ConfigSection } from '../components/ConfigSection'
import { markTourCompleted } from '../utils/tourStorage'
import {
  getSelectedCameraFromConfig,
  isServerConfigReady,
  type SelectedCamera,
} from '../utils/configReady'

interface DashboardProps {
  data: DashboardData
  startTour: boolean
  onTourDone: () => void
  onConfigUpdate: (data: DashboardData) => void
}

const TOUR_STEPS = [
  {
    target: '[data-tour="config"]',
    content:
      'Selecciona una camara (Go2 o USB), confirma RTSP/ONVIF e IP, y luego inicia la transmision.',
    title: 'Configuracion',
    placement: 'left' as const,
  },
  {
    target: '[data-tour="preview"]',
    content:
      'Vista previa en baja calidad. El grabador recibe calidad completa. Puedes cambiar de camara en vivo.',
    title: 'Transmision',
    placement: 'right' as const,
  },
]

export function Dashboard({ data, startTour, onTourDone, onConfigUpdate }: DashboardProps) {
  const localIp = data.local_ip || ''

  const [selectedCamera, setSelectedCamera] = useState<SelectedCamera>(() =>
    getSelectedCameraFromConfig(data.config),
  )
  const [serverConfigConfirmed, setServerConfigConfirmed] = useState(() =>
    isServerConfigReady(data.config),
  )
  const [serverFieldsDirty, setServerFieldsDirty] = useState(false)
  const [bridgeStatus, setBridgeStatus] = useState<'running' | 'stopped'>('stopped')
  const [toggling, setToggling] = useState(false)
  const [cameraSwitching, setCameraSwitching] = useState(false)
  const [streamKey, setStreamKey] = useState(0)
  const [runTour, setRunTour] = useState(false)
  const [tourKey, setTourKey] = useState(0)
  const fastPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const transmissionReady =
    selectedCamera !== null && serverConfigConfirmed && !serverFieldsDirty

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.getStatus()
      setBridgeStatus(res.status)
    } catch {
      // ignore polling errors
    }
  }, [])

  const startFastPolling = useCallback(() => {
    if (fastPollRef.current) clearInterval(fastPollRef.current)
    fetchStatus()
    fastPollRef.current = setInterval(fetchStatus, 1000)
    window.setTimeout(() => {
      if (fastPollRef.current) {
        clearInterval(fastPollRef.current)
        fastPollRef.current = null
      }
    }, 10000)
  }, [fetchStatus])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => {
      clearInterval(interval)
      if (fastPollRef.current) clearInterval(fastPollRef.current)
    }
  }, [fetchStatus])

  useEffect(() => {
    setSelectedCamera(getSelectedCameraFromConfig(data.config))
    if (!serverFieldsDirty) {
      setServerConfigConfirmed(isServerConfigReady(data.config))
    }
  }, [data.config, serverFieldsDirty])

  useEffect(() => {
    if (startTour) {
      setTourKey((k) => k + 1)
      setRunTour(true)
      onTourDone()
    }
  }, [startTour, onTourDone])

  const refreshDashboard = async () => {
    try {
      const fresh = await api.getDashboard()
      onConfigUpdate(fresh)
    } catch {
      // non-fatal
    }
  }

  const handleCameraSelected = (camera: { source: 'usb' | 'go2'; index?: number }) => {
    setSelectedCamera(camera)
  }

  const handleCameraSwitchComplete = async (result: {
    source: 'usb' | 'go2'
    index?: number
    bridgeStatus: 'running' | 'stopped'
    bridgeRestarted: boolean
  }) => {
    setSelectedCamera({
      source: result.source,
      index: result.index,
    })
    setBridgeStatus(result.bridgeStatus)
    if (result.bridgeRestarted) {
      setStreamKey(Date.now())
      startFastPolling()
    }
    setCameraSwitching(false)
    await refreshDashboard()
  }

  const handleBridgeToggle = async () => {
    setToggling(true)
    try {
      if (bridgeStatus === 'running') {
        const res = await api.stopBridge()
        if (res.success) {
          setBridgeStatus('stopped')
          toast('success', res.message)
        } else {
          toast('error', res.message)
        }
      } else {
        const res = await api.startBridge()
        if (res.success) {
          setBridgeStatus('running')
          setStreamKey(Date.now())
          startFastPolling()
          toast('success', res.message)
        } else {
          toast('error', res.message)
        }
      }
    } catch {
      toast('error', 'Error de conexion al controlar el bridge')
    } finally {
      setToggling(false)
    }
  }

  const handleJoyrideCallback = (event: EventData) => {
    if (
      event.type === EVENTS.TOUR_STATUS &&
      (event.status === STATUS.FINISHED || event.status === STATUS.SKIPPED)
    ) {
      markTourCompleted()
      setRunTour(false)
    }
  }

  const serverConfig = (data.config.server || {}) as Record<string, unknown>
  const channels = (data.config.channels || []) as Record<string, unknown>[]
  const mainPath = (channels[0]?.stream_path as string) || ''
  const previewPath = (channels[1]?.stream_path as string) || mainPath

  const activeSource = selectedCamera?.source ?? 'usb'
  const activeIndex = selectedCamera?.index ?? 0

  return (
    <>
      <Joyride
        key={tourKey}
        run={runTour}
        steps={TOUR_STEPS}
        onEvent={handleJoyrideCallback}
        continuous
        options={{
          showProgress: true,
          buttons: ['back', 'close', 'primary'],
        }}
        styles={{
          buttonPrimary: {
            backgroundColor: 'var(--syscom-blue)',
            color: '#fff',
          },
          buttonSkip: {
            color: 'var(--slate-500)',
          },
          tooltip: {
            borderRadius: '10px',
          },
        }}
      />

      <main className="page page-full p-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <NetworkPreview
              status={bridgeStatus}
              host={window.location.hostname || (serverConfig.host as string) || localIp}
              previewStreamPath={previewPath}
              mainStreamPath={mainPath}
              cameraSource={activeSource}
              cameraIndex={activeIndex}
              cameraSelected={selectedCamera !== null}
              serverConfigConfirmed={serverConfigConfirmed}
              serverFieldsDirty={serverFieldsDirty}
              transmissionReady={transmissionReady}
              cameraSwitching={cameraSwitching}
              streamKey={streamKey}
              onToggleBridge={handleBridgeToggle}
              onStreamRetry={() => setStreamKey(Date.now())}
              toggling={toggling}
            />
          </div>

          <div className="lg:col-span-2 space-y-5">
            <ConfigSection
              config={data.config}
              selectedCamera={selectedCamera}
              localIp={localIp}
              bridgeStatus={bridgeStatus}
              onCameraSelected={handleCameraSelected}
              onCameraSwitchStart={() => setCameraSwitching(true)}
              onCameraSwitchEnd={() => setCameraSwitching(false)}
              onCameraSwitchComplete={handleCameraSwitchComplete}
              onServerFieldsChange={() => setServerFieldsDirty(true)}
              onServerConfigConfirmed={() => {
                setServerConfigConfirmed(true)
                setServerFieldsDirty(false)
              }}
              onConfigUpdate={refreshDashboard}
            />
          </div>
        </div>
      </main>
    </>
  )
}
