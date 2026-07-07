import { useState, useEffect, useCallback } from 'react'
import { Bot, CameraIcon, Radio, GitBranch, Check, Loader2, RefreshCw } from 'lucide-react'
import { api, type Camera as CameraDevice } from '../api'
import { toast } from './Toast'
import type { SelectedCamera } from '../utils/configReady'

const SCAN_INTERVAL_MS = 5000

interface ConfigSectionProps {
  config: Record<string, unknown>
  selectedCamera: SelectedCamera
  localIp: string
  bridgeStatus: 'running' | 'stopped'
  onCameraSelected: (camera: { source: 'usb' | 'go2'; index?: number }) => void
  onCameraSwitchStart: () => void
  onCameraSwitchEnd: () => void
  onCameraSwitchComplete: (result: {
    source: 'usb' | 'go2'
    index?: number
    bridgeStatus: 'running' | 'stopped'
    bridgeRestarted: boolean
  }) => void
  onServerFieldsChange: () => void
  onServerConfigConfirmed: () => void
  onConfigUpdate: () => Promise<void>
}

function isCameraActive(
  source: 'usb' | 'go2',
  index: number | undefined,
  selected: SelectedCamera,
): boolean {
  if (!selected) return false
  if (source === 'go2') return selected.source === 'go2'
  return selected.source === 'usb' && selected.index === index
}

function buildSavePayload(
  deviceType: string,
  onvifPort: number,
  serverHost: string,
  rtspPort: number,
  camera: { source: 'usb' | 'go2'; index?: number },
) {
  return {
    device_type: deviceType,
    camera_source: camera.source,
    onvif_port: onvifPort,
    camera_index: camera.source === 'usb' ? camera.index : undefined,
    network_interface: camera.source === 'go2' ? 'eth0' : '',
    server_host: serverHost,
    rtsp_port: rtspPort,
    ch_id_0: '101',
    ch_path_0: 'Streaming/Channels/101',
    ch_id_1: '102',
    ch_path_1: 'Streaming/Channels/102',
  }
}

export function ConfigSection({
  config,
  selectedCamera,
  localIp,
  bridgeStatus,
  onCameraSelected,
  onCameraSwitchStart,
  onCameraSwitchEnd,
  onCameraSwitchComplete,
  onServerFieldsChange,
  onServerConfigConfirmed,
  onConfigUpdate,
}: ConfigSectionProps) {
  const [confirming, setConfirming] = useState(false)
  const [cameraSaving, setCameraSaving] = useState(false)
  const [cameraTarget, setCameraTarget] = useState<string | null>(null)
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [scanning, setScanning] = useState(false)

  const device = (config.device || {}) as Record<string, unknown>
  const server = (config.server || {}) as Record<string, unknown>

  const [deviceType, setDeviceType] = useState((device.type as string) || 'onvif')
  const [onvifPort, setOnvifPort] = useState((device.onvif_port as number) || 8000)
  const [serverHost, setServerHost] = useState((server.host as string) || localIp || '')
  const [rtspPort, setRtspPort] = useState((server.rtsp_port as number) || 8554)

  useEffect(() => {
    const savedHost = String(server.host ?? '').trim()
    if (localIp && !savedHost) {
      setServerHost(localIp)
    }
  }, [localIp, server.host])

  useEffect(() => {
    setDeviceType((device.type as string) || 'onvif')
    setOnvifPort((device.onvif_port as number) || 8000)
    setServerHost((server.host as string) || localIp || '')
    setRtspPort((server.rtsp_port as number) || 8554)
  }, [config, device.type, device.onvif_port, server.host, server.rtsp_port, localIp])

  const scanCameras = useCallback(async () => {
    if (cameraSaving) return
    setScanning(true)
    try {
      const res = await api.listCameras()
      setCameras(res.cameras)
    } catch {
      // ignore transient scan errors
    } finally {
      setScanning(false)
    }
  }, [cameraSaving])

  useEffect(() => {
    scanCameras()
    const interval = setInterval(scanCameras, SCAN_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [scanCameras])

  const markServerDirty = () => onServerFieldsChange()

  const handleSelectCamera = async (source: 'usb' | 'go2', index?: number) => {
    if (cameraSaving) return
    if (isCameraActive(source, index, selectedCamera)) return

    const targetKey = source === 'go2' ? 'go2' : `usb-${index}`
    setCameraTarget(targetKey)
    setCameraSaving(true)

    const label = source === 'go2' ? 'Go2' : `USB indice ${index}`

    if (bridgeStatus === 'running') {
      onCameraSwitchStart()
      toast('info', `Cambiando a camara ${label}...`)
      try {
        const payload =
          source === 'go2'
            ? { camera_source: 'go2' as const, network_interface: 'eth0' }
            : { camera_source: 'usb' as const, camera_index: index }

        const res = await api.switchCamera(payload)
        if (res.success) {
          toast('success', res.message)
          onCameraSwitchComplete({
            source,
            index: source === 'usb' ? index : undefined,
            bridgeStatus: res.bridge_restarted ? 'running' : bridgeStatus,
            bridgeRestarted: Boolean(res.bridge_restarted),
          })
        } else {
          toast('error', res.message)
          onCameraSwitchEnd()
        }
      } catch {
        toast('error', 'Error de conexion al cambiar camara')
        onCameraSwitchEnd()
      }
    } else {
      toast('info', `Guardando camara ${label}...`)
      try {
        const res = await api.saveConfig(
          buildSavePayload(deviceType, onvifPort, serverHost, rtspPort, { source, index }),
        )
        if (res.success) {
          onCameraSelected({ source, index })
          toast('success', `Camara ${label} guardada`)
          await onConfigUpdate()
        } else {
          toast('error', res.message)
        }
      } catch {
        toast('error', 'Error de conexion al guardar camara')
      }
    }

    setCameraSaving(false)
    setCameraTarget(null)
  }

  const handleConfirmServer = async () => {
    if (!selectedCamera) {
      toast('warning', 'Selecciona una camara antes de confirmar la configuracion')
      return
    }
    setConfirming(true)
    try {
      const res = await api.saveConfig(
        buildSavePayload(deviceType, onvifPort, serverHost, rtspPort, selectedCamera),
      )
      if (res.success) {
        toast('success', 'Configuracion de transmision guardada')
        onServerConfigConfirmed()
        await onConfigUpdate()
      } else {
        toast('error', res.message)
      }
    } catch {
      toast('error', 'Error de conexion al guardar')
    } finally {
      setConfirming(false)
    }
  }

  const cardClass = (active: boolean, targetKey: string) =>
    `flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 min-w-[7rem] shrink-0 text-center transition-all disabled:opacity-50 ${
      active
        ? 'border-primary bg-primary/5 ring-1 ring-primary'
        : 'border-border bg-card hover:bg-accent'
    } ${cameraSaving && cameraTarget === targetKey ? 'opacity-70' : ''}`

  return (
    <section className="xvr-section" data-tour="config">
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="h-px flex-1 bg-border" />
        <h2 className="text-sm font-semibold text-foreground">Fuente de video</h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Selecciona una camara. El escaneo USB es automatico cada 5 s.
      </p>

      <div className="flex items-stretch gap-0 min-h-[5.5rem] mb-5">
        <div className="shrink-0 pr-4">
          <button
            type="button"
            onClick={() => handleSelectCamera('go2')}
            disabled={cameraSaving}
            className={cardClass(isCameraActive('go2', undefined, selectedCamera), 'go2')}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isCameraActive('go2', undefined, selectedCamera)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {cameraSaving && cameraTarget === 'go2' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
            <span className="text-xs font-semibold text-foreground">Camara nativa Go2</span>
            <span className="text-[10px] text-muted-foreground">eth0</span>
          </button>
        </div>

        <div className="w-px bg-border shrink-0 self-stretch" aria-hidden="true" />

        <div className="flex-1 min-w-0 pl-4">
          {cameras.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center px-2 gap-2">
              {scanning && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
              <p className="text-xs text-muted-foreground">Sin camaras USB detectadas</p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {cameras.map((cam) => {
                const targetKey = `usb-${cam.index}`
                const active = isCameraActive('usb', cam.index, selectedCamera)
                return (
                  <button
                    key={cam.index}
                    type="button"
                    onClick={() => handleSelectCamera('usb', cam.index)}
                    disabled={cameraSaving}
                    className={cardClass(active, targetKey)}
                    title={cam.device}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {cameraSaving && cameraTarget === targetKey ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CameraIcon className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-foreground">Indice {cam.index}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[6rem]">
                      {cam.device}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="h-px flex-1 bg-border" />
        <h2 className="text-sm font-semibold text-foreground shrink-0">Transmitir por:</h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
        <button
          onClick={() => {
            if (deviceType === 'rtsp_only') return
            markServerDirty()
            setDeviceType('rtsp_only')
          }}
          className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
            deviceType === 'rtsp_only'
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border bg-card hover:bg-accent'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              deviceType === 'rtsp_only'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">RTSP</div>
            <div className="text-xs text-muted-foreground">Transmision directa sin ONVIF</div>
          </div>
        </button>

        <button
          onClick={() => {
            if (deviceType !== 'rtsp_only') return
            markServerDirty()
            setDeviceType('onvif')
          }}
          className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
            deviceType !== 'rtsp_only'
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border bg-card hover:bg-accent'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              deviceType !== 'rtsp_only'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <GitBranch className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">ONVIF</div>
            <div className="text-xs text-muted-foreground">Recomendado — compatible con DVR/NVR</div>
          </div>
        </button>
      </div>

      <div className="xvr-config-panel mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {deviceType !== 'rtsp_only' && (
            <div className="min-w-0">
              <label htmlFor="onvif_port" className="form-label">
                Puerto ONVIF
              </label>
              <input
                id="onvif_port"
                type="number"
                value={onvifPort}
                onChange={(e) => {
                  markServerDirty()
                  setOnvifPort(parseInt(e.target.value) || 8000)
                }}
                className="form-input"
              />
            </div>
          )}
          <div className={`min-w-0 ${deviceType !== 'rtsp_only' ? 'sm:col-span-2' : ''}`}>
            <label htmlFor="server_host" className="form-label">
              IP del Host
            </label>
            <div className="xvr-host-row">
              <input
                id="server_host"
                type="text"
                value={serverHost}
                onChange={(e) => {
                  markServerDirty()
                  setServerHost(e.target.value)
                }}
                className="form-input font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  markServerDirty()
                  setServerHost(localIp)
                }}
                title="Usar IP local"
                className="btn btn-secondary btn-sm"
                aria-label="Restaurar IP local del dispositivo"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <p className="form-hint">IP local de esta maquina. Usa el boton para restaurar.</p>
          </div>
          <div className="min-w-0">
            <label htmlFor="rtsp_port" className="form-label">
              Puerto RTSP
            </label>
            <input
              id="rtsp_port"
              type="number"
              value={rtspPort}
              onChange={(e) => {
                markServerDirty()
                setRtspPort(parseInt(e.target.value) || 8554)
              }}
              className="form-input"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleConfirmServer}
        disabled={confirming || !selectedCamera}
        className="btn btn-primary btn-with-icon"
      >
        {confirming ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando...</>
        ) : (
          <><Check className="w-4 h-4" /> Confirmar configuracion</>
        )}
      </button>
      {!selectedCamera && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Selecciona una camara arriba para poder confirmar.
        </p>
      )}
      {deviceType === 'rtsp_only' && (
        <div className="mt-3 p-3 bg-muted/40 rounded-lg border border-border text-left">
          <p className="text-xs text-muted-foreground leading-normal mb-2">
            La configuración en el NVR/DVR debe ser configurada con los siguientes canales:
          </p>
          <div className="text-xs text-foreground font-mono bg-muted/60 p-2 rounded border border-border/50 space-y-1">
            <div>• <strong>MainStream:</strong> Streaming/Channels/101</div>
            <div>• <strong>SubStream:</strong> Streaming/Channels/102</div>
          </div>
        </div>
      )}
    </section>
  )
}
