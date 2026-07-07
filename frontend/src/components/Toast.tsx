import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
}

const borderStyles: Record<ToastType, string> = {
  success: 'border-green-300 dark:border-green-700',
  error: 'border-red-300 dark:border-red-700',
  warning: 'border-amber-300 dark:border-amber-700',
  info: 'border-blue-300 dark:border-blue-700',
}

let toastListeners: ((t: ToastMessage) => void)[] = []

function newToastId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // crypto.randomUUID requires secure context (HTTPS or localhost)
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function toast(type: ToastType, message: string) {
  const id = newToastId()
  toastListeners.forEach((fn) => fn({ id, type, message }))
}

function ToastItem({ t, onRemove }: { t: ToastMessage; onRemove: (id: string) => void }) {
  const startTime = useRef(Date.now())
  const DURATION = 4000

  useEffect(() => {
    const timer = setTimeout(() => onRemove(t.id), DURATION)
    return () => clearTimeout(timer)
  }, [t.id, onRemove])

  return (
    <div
      className={`relative flex items-start gap-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border ${borderStyles[t.type]} rounded-xl shadow-xl p-4 pr-3 min-w-[320px] max-w-md animate-in slide-in-from-right overflow-hidden`}
    >
      <span className="mt-0.5 shrink-0">{icons[t.type]}</span>
      <p className="text-sm text-gray-800 dark:text-gray-200 flex-1">{t.message}</p>
      <button onClick={() => onRemove(t.id)} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
        <X className="w-4 h-4" />
      </button>
      <ProgressBar startTime={startTime.current} duration={DURATION} borderStyles={borderStyles[t.type]} />
    </div>
  )
}

function ProgressBar({ startTime, duration, borderStyles }: { startTime: number; duration: number; borderStyles: string }) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const elapsed = Date.now() - startTime
    const remaining = Math.max(0, duration - elapsed)
    const fps = 60
    const interval = 1000 / fps
    const step = 100 / (duration / interval)

    setProgress((remaining / duration) * 100)

    const id = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step
        return next <= 0 ? 0 : next
      })
    }, interval)

    return () => clearInterval(id)
  }, [startTime, duration])

  const colorMap: Record<string, string> = {
    'border-green-300 dark:border-green-700': 'bg-green-500',
    'border-red-300 dark:border-red-700': 'bg-red-500',
    'border-amber-300 dark:border-amber-700': 'bg-amber-500',
    'border-blue-300 dark:border-blue-700': 'bg-blue-500',
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/5">
      <div
        className={`h-full ${colorMap[borderStyles] || 'bg-gray-400'} transition-all duration-[16ms] ease-linear`}
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const handler = (t: ToastMessage) => setToasts((prev) => [...prev, t])
    toastListeners.push(handler)
    return () => { toastListeners = toastListeners.filter((fn) => fn !== handler) }
  }, [])

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-3">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} onRemove={remove} />
      ))}
    </div>
  )
}
