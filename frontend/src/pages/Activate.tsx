import { useEffect, useState } from 'react'
import { Lock, Copy, Check, KeyRound, Shield } from 'lucide-react'
import { api } from '../api'
import { toast } from '../components/Toast'
import { copyToClipboard } from '../utils/clipboard'
import { reloadPage } from '../utils/reloadPage'

export function Activate() {
  const [hwId, setHwId] = useState('')
  const [licenseKey, setLicenseKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    api.getActivateInfo().then((d) => setHwId(d.hw_id)).catch(() => {})
  }, [])

  const copyHwId = async () => {
    if (!hwId) return
    const ok = await copyToClipboard(hwId)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast('error', 'No se pudo copiar. Selecciona el texto manualmente.')
    }
  }

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!licenseKey.trim()) return
    setActivating(true)
    try {
      const res = await api.activateLicense(licenseKey.trim())
      if (res.success) {
        reloadPage()
        return
      } else {
        toast('error', res.message)
        setActivating(false)
      }
    } catch {
      toast('error', 'Error de conexión con el servidor')
      setActivating(false)
    }
  }

  return (
    <div className="page-auth page-auth--activate">
      <div className="auth-center auth-center--activate">
        <div className="card login-card activate-card">
          <div className="activate-header">
            <div className="activate-icon">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="card-title">Activación de Licencia</h1>
            <p className="card-subtitle activate-subtitle">
              SYSCOM Bridge requiere una firma de licencia activa vinculada a tu robot para iniciar la transmisión de vídeo.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">1. Copia tu llave encriptada</label>
            <p className="form-hint form-hint--above">
              Utiliza esta llave en el portal web de SYSCOM para obtener tu firma criptográfica.
            </p>
            <div className="license-key license-key--activate">
              <div className="license-key-value">
                <Shield className="license-key-icon" />
                <code className="license-key-code">{hwId || 'Cargando...'}</code>
              </div>
              <button
                type="button"
                onClick={copyHwId}
                disabled={!hwId}
                className="btn btn-secondary btn-sm license-key-copy"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-500" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copiar llave
                  </>
                )}
              </button>
            </div>
          </div>

          <form onSubmit={handleActivate}>
            <div className="form-group">
              <label className="form-label">2. Pega tu Clave de Activación</label>
              <p className="form-hint form-hint--above">
                Introduce la firma criptográfica generada por el portal de licenciamiento de SYSCOM.
              </p>
              <textarea
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Pega aquí tu clave criptográfica de activación..."
                rows={4}
                className="form-input font-mono resize-none"
                required
              />
            </div>

            <button type="submit" disabled={activating || !licenseKey.trim()} className="btn btn-primary">
              {activating ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Activando...
                </span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" /> Activar Licencia del Sistema
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
