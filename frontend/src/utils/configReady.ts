export type SelectedCamera = { source: 'usb' | 'go2'; index?: number } | null

export function getSelectedCameraFromConfig(
  config: Record<string, unknown>,
): SelectedCamera {
  const device = (config.device || {}) as Record<string, unknown>
  const source = device.camera_source
  if (source !== 'usb' && source !== 'go2') return null
  if (source === 'go2') return { source: 'go2' }
  const index = device.camera_index
  if (index === undefined || index === null || index === '') return null
  return { source: 'usb', index: Number(index) }
}

/** True when server/transmission params are persisted in settings.yaml. */
export function isServerConfigReady(config: Record<string, unknown>): boolean {
  const server = (config.server || {}) as Record<string, unknown>
  const device = (config.device || {}) as Record<string, unknown>
  const channels = (config.channels || []) as Record<string, unknown>[]

  const host = String(server.host ?? '').trim()
  const deviceType = String(device.type ?? '').trim()
  const rtspPort = Number(server.rtsp_port)

  if (!host || !deviceType || !Number.isFinite(rtspPort) || rtspPort <= 0) {
    return false
  }

  return channels.some((ch) => String(ch.stream_path ?? '').trim())
}

/** @deprecated use isServerConfigReady + getSelectedCameraFromConfig */
export function isConfigReady(
  config: Record<string, unknown>,
  cameraSource: 'usb' | 'go2',
): boolean {
  return (
    getSelectedCameraFromConfig(config)?.source === cameraSource &&
    isServerConfigReady(config)
  )
}
