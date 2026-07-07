import { useEffect, useRef, useState, useCallback } from 'react'
import {
  MonitorPlay, Play, Square, Loader2, CheckCircle2, AlertCircle, Webcam, RefreshCw,
} from 'lucide-react'
import { api } from '../api'
import Hls from 'hls.js'

const HLS_START_DELAY_MS = 5000
const HLS_SUB_RETRY_MS = 3000
const HLS_SUB_MAX_WAIT_MS = 35000

interface NetworkPreviewProps {
  status: 'running' | 'stopped'
  host: string
  previewStreamPath: string
  mainStreamPath: string
  cameraSource: 'usb' | 'go2'
  cameraIndex: number
  cameraSelected: boolean
  serverConfigConfirmed: boolean
  serverFieldsDirty?: boolean
  transmissionReady: boolean
  cameraSwitching?: boolean
  streamKey?: number
  onToggleBridge: () => void
  onStreamRetry: () => void
  toggling: boolean
}

export function NetworkPreview({
  status, host, previewStreamPath, mainStreamPath,
  cameraSource, cameraIndex, cameraSelected, serverConfigConfirmed, serverFieldsDirty = false, transmissionReady,
  cameraSwitching = false, streamKey = 0,
  onToggleBridge, onStreamRetry, toggling,
}: NetworkPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const streamPlayingRef = useRef(false)
  const [cameraTesting, setCameraTesting] = useState(false)
  const [go2PreviewReady, setGo2PreviewReady] = useState(false)
  const [testError, setTestError] = useState(false)
  const [testErrorMsg, setTestErrorMsg] = useState('')
  const [streamLoading, setStreamLoading] = useState(false)
  const [streamError, setStreamError] = useState(false)
  const [streamPlaying, setStreamPlaying] = useState(false)
  const [usingSubStream, setUsingSubStream] = useState(true)

  const showGo2Placeholder = status === 'running' && cameraSource === 'go2'
  const useHlsPreview = status === 'running' && (previewStreamPath || mainStreamPath) && cameraSource === 'usb'

  async function probeHlsPath(path: string, cacheKey?: number): Promise<boolean> {
    try {
      const url = api.getHlsUrl(host, path, cacheKey)
      const res = await fetch(url, { method: 'GET', cache: 'no-store' })
      return res.ok
    } catch {
      return false
    }
  }

  async function resolvePreviewPath(cacheKey?: number): Promise<{ path: string; isSub: boolean } | null> {
    const subPath = previewStreamPath?.replace(/^\/+|\/+$/g, '') || ''
    const mainPath = mainStreamPath?.replace(/^\/+|\/+$/g, '') || ''
    const candidates: { path: string; isSub: boolean }[] = []

    if (subPath && subPath !== mainPath) {
      candidates.push({ path: subPath, isSub: true })
    }
    if (mainPath) {
      candidates.push({ path: mainPath, isSub: false })
    }

    const deadline = Date.now() + HLS_SUB_MAX_WAIT_MS
    while (Date.now() < deadline) {
      for (const candidate of candidates) {
        if (await probeHlsPath(candidate.path, cacheKey)) {
          return candidate
        }
      }
      await new Promise((r) => window.setTimeout(r, HLS_SUB_RETRY_MS))
    }
    return null
  }

  const clearStreamLoading = useCallback(() => {
    streamPlayingRef.current = true
    setStreamLoading(false)
    setStreamError(false)
    setStreamPlaying(true)
  }, [])

  useEffect(() => {
    if (status === 'running' && cameraTesting) {
      stopTest()
    }
  }, [status])

  useEffect(() => {
    if (cameraTesting) {
      stopTest()
    }
  }, [cameraSource])

  useEffect(() => {
    setStreamPlaying(false)
    streamPlayingRef.current = false
    const video = videoRef.current
    if (!video) return

    if (!useHlsPreview) {
      setStreamLoading(false)
      setStreamError(false)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      video.src = ''
      return
    }

    let cancelled = false
    let loadTimeout: ReturnType<typeof setTimeout> | null = null
    let startDelay: ReturnType<typeof setTimeout> | null = null
    let retries = 0
    const maxRetries = 20

    const cleanup = () => {
      cancelled = true
      if (loadTimeout) clearTimeout(loadTimeout)
      if (startDelay) clearTimeout(startDelay)
      video.removeEventListener('playing', onVideoPlaying)
      video.removeEventListener('canplay', onVideoPlaying)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }

    const onVideoPlaying = () => {
      if (!cancelled) clearStreamLoading()
    }

    const connectHls = (path: string, isSub: boolean) => {
      if (cancelled) return
      setUsingSubStream(isSub)
      streamPlayingRef.current = false
      setStreamLoading(true)
      setStreamError(false)
      setStreamPlaying(false)

      const src = api.getHlsUrl(host, path, streamKey || undefined)

      loadTimeout = setTimeout(() => {
        if (!cancelled && !streamPlayingRef.current) {
          setStreamLoading(false)
          setStreamError(true)
        }
      }, HLS_SUB_MAX_WAIT_MS)

      video.addEventListener('playing', onVideoPlaying)
      video.addEventListener('canplay', onVideoPlaying)

      if (Hls.isSupported()) {
        if (hlsRef.current) hlsRef.current.destroy()
        const hls = new Hls({
          liveSyncDuration: 1,
          liveMaxLatencyDuration: 5,
          manifestLoadingMaxRetry: 8,
          manifestLoadingRetryDelay: 1500,
        })
        hlsRef.current = hls
        hls.loadSource(src)
        hls.attachMedia(video)

        const onReady = () => {
          if (cancelled) return
          clearStreamLoading()
          video.muted = true
          video.play().catch(() => {})
        }

        hls.on(Hls.Events.MANIFEST_PARSED, onReady)
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (!cancelled) clearStreamLoading()
        })
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return
          if (retries < maxRetries) {
            retries += 1
            window.setTimeout(() => {
              if (cancelled || hlsRef.current !== hls) return
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                hls.startLoad()
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError()
              } else {
                hls.loadSource(src)
              }
            }, 1500)
          } else {
            setStreamLoading(false)
            setStreamError(true)
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
        video.muted = true
        video.play().then(() => clearStreamLoading()).catch(() => {})
        video.onerror = () => setStreamError(true)
      }
    }

    startDelay = setTimeout(async () => {
      const resolved = await resolvePreviewPath(streamKey || undefined)
      if (cancelled) return
      if (!resolved) {
        setStreamLoading(false)
        setStreamError(true)
        return
      }
      connectHls(resolved.path, resolved.isSub)
    }, HLS_START_DELAY_MS)

    return cleanup
  }, [useHlsPreview, host, previewStreamPath, mainStreamPath, streamKey, clearStreamLoading])

  const markGo2PreviewReady = useCallback(() => {
    setGo2PreviewReady(true)
    setTestError(false)
    setTestErrorMsg('')
  }, [])

  useEffect(() => {
    if (!cameraTesting || cameraSource !== 'go2' || go2PreviewReady) return

    const img = imgRef.current
    if (!img) return

    const checkReady = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        markGo2PreviewReady()
      }
    }

    img.addEventListener('load', checkReady)
    const interval = window.setInterval(checkReady, 300)

    return () => {
      img.removeEventListener('load', checkReady)
      window.clearInterval(interval)
    }
  }, [cameraTesting, cameraSource, go2PreviewReady, markGo2PreviewReady])

  const startTest = () => {
    setTestError(false)
    setTestErrorMsg('')
    setGo2PreviewReady(cameraSource !== 'go2')
    setCameraTesting(true)
    if (imgRef.current) {
      const feedUrl = cameraSource === 'go2'
        ? api.getGo2CameraFeedUrl()
        : api.getCameraFeedUrl(cameraIndex)
      imgRef.current.src = feedUrl
      imgRef.current.style.display = 'block'
    }
  }

  const stopTest = () => {
    setCameraTesting(false)
    setGo2PreviewReady(false)
    setTestError(false)
    setTestErrorMsg('')
    if (imgRef.current) {
      imgRef.current.src = ''
      imgRef.current.style.display = 'none'
    }
  }

  const toggleTest = () => {
    if (cameraTesting) stopTest()
    else startTest()
  }

  const showGo2TestLoading =
    cameraTesting && cameraSource === 'go2' && !go2PreviewReady && !testError

  const showLoadingOverlay =
    useHlsPreview && streamLoading && !streamError && !cameraSwitching && !streamPlaying

  return (
    <section className="xvr-section" data-tour="preview">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-foreground">Transmision</h2>
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            status === 'running'
              ? 'bg-green-500/15 text-green-600 dark:text-green-400'
              : 'bg-red-500/15 text-red-600 dark:text-red-400'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
          />
          {status === 'running' ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>

      <div className="relative bg-muted border border-border rounded-xl overflow-hidden mb-2 aspect-video flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />

        <img
          ref={imgRef}
          style={{
            display: 'none',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            inset: 0,
          }}
          alt="Test de Camara"
          onError={() => {
            if (cameraTesting) {
              setGo2PreviewReady(false)
              setTestError(true)
              if (!testErrorMsg) {
                setTestErrorMsg(
                  cameraSource === 'go2'
                    ? 'No se pudo cargar el preview Go2. Verifique que la transmision este detenida.'
                    : 'El stream de prueba se interrumpió antes de mostrar imagen.',
                )
              }
            }
          }}
          onLoad={() => {
            if (cameraTesting && cameraSource === 'go2') {
              markGo2PreviewReady()
            }
          }}
        />

        {status !== 'running' && !cameraTesting && !testError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground pointer-events-none">
            <MonitorPlay className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm">
              {cameraSource === 'go2'
                ? 'Use Probar camara para verificar la imagen del Go2'
                : 'Inicie la transmision para visualizar'}
            </p>
          </div>
        )}

        {showGo2Placeholder && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground px-6 text-center pointer-events-none">
            <CpuPlaceholder />
            <p className="text-sm font-medium text-foreground">Transmision activa — camara Go2</p>
            <p className="text-xs text-muted-foreground">
              El grabador recibe el video por RTSP. Use &quot;Probar camara&quot; antes de iniciar la transmision para verificar la imagen.
            </p>
          </div>
        )}

        {showGo2TestLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 pointer-events-none z-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Conectando preview Go2...</p>
            <p className="text-xs text-muted-foreground">Puede tardar unos segundos</p>
          </div>
        )}

        {testError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground px-4 text-center z-10">
            <AlertCircle className="w-8 h-8 text-amber-500" />
            <p className="text-sm whitespace-pre-line">
              {testErrorMsg ||
                (cameraSource === 'go2'
                  ? 'No se pudo cargar la prueba Go2.'
                  : 'No se pudo cargar la prueba de camara.')}
            </p>
            <button
              type="button"
              onClick={() => void startTest()}
              className="flex items-center gap-2 text-sm font-semibold rounded-lg px-4 py-2 bg-secondary text-secondary-foreground hover:bg-accent"
            >
              <RefreshCw className="w-4 h-4" /> Reintentar
            </button>
          </div>
        )}

        {cameraSwitching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 pointer-events-none z-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Cambiando camara...</p>
          </div>
        )}

        {showLoadingOverlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground pointer-events-none z-10">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/60" />
            <p className="text-sm">Conectando con el stream...</p>
          </div>
        )}

        {useHlsPreview && streamError && !cameraSwitching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground px-4 text-center z-10">
            <AlertCircle className="w-8 h-8 text-amber-500" />
            <p className="text-sm">No se pudo cargar la vista previa (HLS).</p>
            <button
              type="button"
              onClick={onStreamRetry}
              className="flex items-center gap-2 text-sm font-semibold rounded-lg px-4 py-2 bg-secondary text-secondary-foreground hover:bg-accent"
            >
              <RefreshCw className="w-4 h-4" /> Reintentar
            </button>
          </div>
        )}

        {cameraTesting && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            TEST ACTIVO
          </div>
        )}

        {useHlsPreview && streamPlaying && !cameraSwitching && (
          <div className="absolute bottom-3 left-3 right-3 flex justify-center pointer-events-none">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-medium bg-background/80 border border-border text-muted-foreground">
              {usingSubStream
                ? 'Vista previa en baja calidad — el grabador recibe calidad completa'
                : 'Vista previa en canal principal — el grabador recibe la misma senal'}
            </span>
          </div>
        )}
      </div>

      {useHlsPreview && (
        <p className="text-xs text-muted-foreground text-center mb-3">
          {usingSubStream
            ? 'Previsualizacion en sub-stream (320p). El DVR/NVR recibe calidad completa en el canal principal.'
            : 'Previsualizacion en canal principal. El sub-stream puede tardar unos segundos en estar listo.'}
        </p>
      )}

      {cameraTesting && cameraSource === 'go2' && !testError && (
        <p className="text-xs text-muted-foreground text-center mb-3">
          Vista previa de prueba en baja calidad (~1 FPS). La transmision al grabador usa go2_video_client en calidad completa.
        </p>
      )}

      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle2
            className={`w-3.5 h-3.5 ${cameraSelected ? 'text-green-500' : 'text-muted-foreground/40'}`}
          />
          <span className="text-muted-foreground">
            {cameraSelected ? 'Camara seleccionada' : 'Camara pendiente'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2
            className={`w-3.5 h-3.5 ${serverConfigConfirmed ? 'text-green-500' : 'text-muted-foreground/40'}`}
          />
          <span className="text-muted-foreground">
            {serverConfigConfirmed ? 'Transmision configurada' : 'Confirmar config'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        {status !== 'running' && cameraSelected && (
          <button
            onClick={toggleTest}
            className={`flex items-center gap-2 text-sm font-semibold rounded-lg px-4 py-2 transition-all ${
              cameraTesting
                ? 'bg-destructive text-destructive-foreground hover:opacity-90'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            {cameraTesting ? (
              <><Square className="w-4 h-4" /> Detener Test</>
            ) : (
              <><Webcam className="w-4 h-4" /> Probar Camara</>
            )}
          </button>
        )}

        {status === 'running' && cameraTesting && (
          <div className="flex items-center gap-2 text-amber-500 text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Test detenido por la transmision
          </div>
        )}

        <button
          onClick={onToggleBridge}
          disabled={toggling || (!transmissionReady && status !== 'running')}
          className={`flex items-center gap-2 text-sm font-semibold rounded-xl px-6 py-3 shadow-sm transition-all ${
            status === 'running'
              ? 'bg-destructive text-destructive-foreground hover:opacity-90'
              : 'bg-primary text-primary-foreground hover:opacity-90'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {toggling ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {status === 'running' ? 'Deteniendo...' : 'Iniciando...'}</>
          ) : status === 'running' ? (
            <><Square className="w-4 h-4" /> Detener Transmision</>
          ) : (
            <><Play className="w-4 h-4" /> Iniciar Transmision</>
          )}
        </button>
      </div>

      {status !== 'running' && !transmissionReady && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          {!cameraSelected && 'Selecciona una camara en el panel derecho. '}
          {cameraSelected && !serverConfigConfirmed && 'Confirma la configuracion de transmision (RTSP/ONVIF, IP, puertos). '}
          {cameraSelected && serverConfigConfirmed && serverFieldsDirty && 'Hay cambios sin confirmar en la configuracion de transmision. '}
        </p>
      )}
    </section>
  )
}

function CpuPlaceholder() {
  return (
    <svg
      className="w-10 h-10 text-muted-foreground/40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
    </svg>
  )
}
