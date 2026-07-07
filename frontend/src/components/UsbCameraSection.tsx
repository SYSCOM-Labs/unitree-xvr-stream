import { useState } from 'react'
import {
  Search, CameraIcon, CheckCircle, XCircle,
  Loader2
} from 'lucide-react'
import { api, type Camera as CameraDevice } from '../api'
import { toast } from './Toast'

interface UsbCameraSectionProps {
  cameraIndex: number
  onIndexChange: (idx: number) => void
  onVerify: (verified: boolean) => void
}

export function UsbCameraSection({ cameraIndex, onIndexChange, onVerify }: UsbCameraSectionProps) {
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [scanPath, setScanPath] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detectResult, setDetectResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const handleScan = async () => {
    setScanning(true)
    setScanDone(false)
    setDetectResult(null)
    onVerify(false)
    try {
      const res = await api.listCameras()
      setCameras(res.cameras)
      setScanPath(res.scan_path)
      setScanDone(true)
      if (res.cameras.length === 0) {
        toast('info', 'No se encontraron cámaras')
      }
    } catch {
      toast('error', 'Error al escanear cámaras')
    } finally {
      setScanning(false)
    }
  }

  const selectCamera = async (idx: number) => {
    onIndexChange(idx)
    setDetectResult(null)
    setDetecting(true)
    try {
      const res = await api.detectCamera(idx)
      if (res.detected) {
        setDetectResult({
          ok: true,
          msg: `Índice ${idx} — ${res.width}×${res.height} px a ${res.fps} FPS`,
        })
        onVerify(true)
      } else {
        setDetectResult({ ok: false, msg: `Sin señal en el índice ${idx}` })
        onVerify(false)
      }
    } catch {
      setDetectResult({ ok: false, msg: 'Error de comunicación con el servidor' })
      onVerify(false)
    } finally {
      setDetecting(false)
    }
  }

  return (
    <section className="xvr-section" data-tour="camera">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-semibold text-foreground">Camara USB</h2>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Busca las camaras conectadas al sistema. Al seleccionar una, se verifica automaticamente.
      </p>

      <div className="space-y-4">
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {scanning ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Escaneando...</>
          ) : (
            <><Search className="w-4 h-4" /> Buscar camaras disponibles</>
          )}
        </button>

        {scanDone && (
          <div>
            {cameras.length === 0 ? (
              <div className="bg-muted border border-border rounded-lg p-4 text-center">
                <CameraIcon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No se encontro ninguna camara
                  {scanPath && <span className="text-xs block mt-1">({scanPath})</span>}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground mb-2">
                  {cameras.length} dispositivo{cameras.length !== 1 && 's'} encontrado{cameras.length !== 1 && 's'}.
                  Selecciona uno:
                </p>
                {cameras.map((cam) => (
                  <button
                    key={cam.index}
                    onClick={() => selectCamera(cam.index)}
                    disabled={detecting}
                    className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-all disabled:opacity-50 ${
                      cameraIndex === cam.index && detectResult?.ok
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CameraIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        Indice <strong>{cam.index}</strong>
                      </span>
                      <span className="text-xs text-muted-foreground truncate">{cam.device}</span>
                    </div>
                    {detecting && cameraIndex === cam.index ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                    ) : cameraIndex === cam.index && detectResult?.ok ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">Verificar</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {detectResult && (
          <div className={`flex items-start gap-3 rounded-lg border p-3.5 ${
            detectResult.ok
              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
              : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
          }`}>
            {detectResult.ok ? (
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">
                {detectResult.ok ? 'Camara disponible' : 'Sin senal'}
              </p>
              <p className="text-xs text-muted-foreground">{detectResult.msg}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
