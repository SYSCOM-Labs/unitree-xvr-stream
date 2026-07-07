import { useEffect, useState } from 'react'
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle, Trash2, X, ArrowLeft, RefreshCw } from 'lucide-react'
import { api, type LicenseInfo, type RemoteLicenseCheckResult } from '../api'
import { toast } from './Toast'
import { reloadPage } from '../utils/reloadPage'

interface LicenseViewProps {
  licenseInfo: LicenseInfo
  onBack: () => void
}

export function LicenseView({ licenseInfo, onBack }: LicenseViewProps) {
  const [showUnlink, setShowUnlink] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [remoteStatus, setRemoteStatus] = useState<RemoteLicenseCheckResult | null>(null)
  const [checkingRemote, setCheckingRemote] = useState(false)

  useEffect(() => {
    api.getRemoteLicenseStatus().then(setRemoteStatus).catch(() => {})
  }, [])

  const handleRemoteCheck = async () => {
    setCheckingRemote(true)
    try {
      const check = await api.checkRemoteLicense()
      setRemoteStatus(check)
      if (check.revoked || check.license_info?.valid === false) {
        toast('info', 'La licencia ya no está activa en SYSCOM. Redirigiendo a activación...')
        reloadPage()
      }
    } catch {
      toast('error', 'No se pudo consultar el portal SYSCOM')
    } finally {
      setCheckingRemote(false)
    }
  }

  const remoteResult = remoteStatus?.result
  const remoteStatusCode = remoteResult?.status

  const remoteStatusDescription = (() => {
    if (remoteResult?.skipped) {
      return 'Sin conexión al portal (licencia local sin cambios)'
    }
    if (remoteResult?.error) {
      return `Error al consultar portal: ${remoteResult.error}`
    }
    switch (remoteStatusCode) {
      case 'activa':
        return 'Licencia reconocida como activa en portal SYSCOM'
      case 'not_found':
        return 'Sin licencia registrada para este Hardware ID en SYSCOM'
      case 'revocada':
        return 'Licencia revocada en portal SYSCOM'
      case 'expirada':
        return 'Licencia expirada en portal SYSCOM'
      default:
        return remoteResult?.status_label || remoteResult?.status || 'Sin datos'
    }
  })()

  const handleUnlink = async () => {
    setUnlinking(true)
    try {
      const res = await api.unlinkLicense(confirmText, understood)
      if (res.success) {
        reloadPage()
        return
      } else {
        toast('error', res.message)
        setUnlinking(false)
      }
    } catch {
      toast('error', 'Error de conexión al desvincular')
      setUnlinking(false)
    }
  }

  return (
    <main className="page page-narrow">
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm mb-4">
        <ArrowLeft className="w-4 h-4" />
        Volver al Dashboard
      </button>

      <section className="card xvr-section">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Licencia del Sistema</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Información de la licencia activa en este robot.
          {licenseInfo.is_lifetime
            ? ' Esta licencia es vitalicia.'
            : licenseInfo.expires && licenseInfo.expires !== '—'
              ? ` Vigencia hasta ${licenseInfo.expires}.`
              : ' Consulte el plan y la vigencia con su integrador SYSCOM.'}
        </p>
        {licenseInfo.valid && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className="bg-muted border border-border rounded-xl p-4 text-center">
              <ShieldCheck className="w-5 h-5 text-green-500 mx-auto mb-1.5" />
              <div className="text-xs text-muted-foreground">Estado</div>
              <div className="text-sm font-semibold text-green-600 dark:text-green-400">Activa</div>
            </div>
            <div className="bg-muted border border-border rounded-xl p-4 text-center">
              <Shield className="w-5 h-5 text-primary mx-auto mb-1.5" />
              <div className="text-xs text-muted-foreground">Plan</div>
              <div className="text-sm font-semibold text-foreground">{licenseInfo.type_label || '—'}</div>
            </div>
            <div className="bg-muted border border-border rounded-xl p-4 text-center">
              <Shield className="w-5 h-5 text-primary mx-auto mb-1.5" />
              <div className="text-xs text-muted-foreground">Vigencia</div>
              <div className="text-sm font-semibold text-foreground">{licenseInfo.expires || '—'}</div>
            </div>
          </div>
        )}

        <div className="border border-border rounded-xl p-4 bg-muted/40 mb-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="text-sm font-semibold text-foreground">Sincronización con portal SYSCOM</h3>
            <button
              type="button"
              onClick={handleRemoteCheck}
              disabled={checkingRemote}
              className="btn btn-ghost btn-sm"
            >
              <RefreshCw className={`w-4 h-4 ${checkingRemote ? 'animate-spin' : ''}`} />
              Verificar ahora
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            La consulta al portal corre en el robot (no en el navegador). Este panel muestra el último resultado.
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <div><span className="font-medium text-foreground">Portal:</span> {remoteStatus?.portal_url || '—'}</div>
            <div><span className="font-medium text-foreground">Hardware ID:</span> {remoteStatus?.hw_id || '—'}</div>
            <div><span className="font-medium text-foreground">Última consulta:</span> {remoteStatus?.checked_at || 'Aún no'}</div>
            <div><span className="font-medium text-foreground">Estado remoto:</span> {remoteStatusDescription}</div>
            <div>
              <span className="font-medium text-foreground">Guardián en segundo plano:</span>{' '}
              {remoteStatus?.guard_running ? 'Activo' : 'Inactivo o pendiente'}
            </div>
          </div>
        </div>

        {!showUnlink ? (
          <div className="border border-red-200 dark:border-red-800 rounded-xl p-4 bg-red-50 dark:bg-red-900/10">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Desvincular licencia
            </h3>
            <ul className="text-xs text-muted-foreground space-y-1 mb-4 list-disc list-inside">
              <li>El puente de transmisión dejará de funcionar inmediatamente.</li>
              <li>La licencia está ligada a este Hardware ID y <strong>no podrá usarse en otro robot</strong>.</li>
              <li>Podrá reactivar con la <strong>misma licencia</strong> en este robot cuando lo necesite.</li>
            </ul>
            <button
              onClick={() => setShowUnlink(true)}
              className="flex items-center gap-2 bg-destructive text-destructive-foreground text-sm font-semibold rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
            >
              <Trash2 className="w-4 h-4" />
              Desvincular licencia de este robot
            </button>
          </div>
        ) : (
          <div className="border border-red-200 dark:border-red-800 rounded-xl p-4 bg-red-50 dark:bg-red-900/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Confirmar desvinculación
              </h3>
              <button onClick={() => setShowUnlink(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <ul className="text-xs text-muted-foreground space-y-1 mb-4 list-disc list-inside">
              <li>Perderá el acceso al puente de forma inmediata.</li>
              <li>Podrá reactivar la transmisión con la <strong>misma licencia</strong> si aún está vigente.</li>
              <li>El código de factura actual está asociado a este Hardware ID y no se puede transferir.</li>
            </ul>

            <div className="space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-ring"
                />
                <span className="text-xs text-foreground">
                  Entiendo que la transmisión se detendrá hasta que vuelva a activar una licencia válida.
                </span>
              </label>

              <div>
                <label htmlFor="unlink-confirm" className="text-xs font-medium text-foreground mb-1 block">
                  Escriba <strong>DESVINCULAR</strong> para confirmar
                </label>
                <input
                  id="unlink-confirm"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DESVINCULAR"
                  className="w-full bg-card border border-border rounded-lg px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUnlink(false)}
                  className="bg-secondary text-secondary-foreground text-sm font-semibold rounded-lg px-4 py-2 hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUnlink}
                  disabled={unlinking || confirmText !== 'DESVINCULAR' || !understood}
                  className="flex items-center gap-2 bg-destructive text-destructive-foreground text-sm font-semibold rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {unlinking ? 'Desvinculando...' : 'Desvincular'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
