export interface Camera {
  index: number
  device: string
}

export interface DetectResult {
  detected: boolean
  width?: number
  height?: number
  fps?: number
}

export interface NetworkInterface {
  name: string
}

export interface LicenseInfo {
  valid: boolean
  type?: string
  plan_type?: string
  type_label?: string
  expires?: string
  is_lifetime?: boolean
  message?: string
}

export interface RemoteLicenseCheckResult {
  checked_at?: string | null
  portal_url?: string
  hw_id?: string
  guard_running?: boolean
  interval_sec?: number
  start_delay_sec?: number
  revoked?: boolean
  license_info?: LicenseInfo
  result?: {
    skipped?: boolean
    revoke?: boolean
    revoked?: boolean
    reason?: string
    error?: string
    status?: string
    status_label?: string
    portal_response?: Record<string, unknown>
  } | null
}

export interface StatusResponse {
  status: 'running' | 'stopped'
}

export interface BridgeResponse {
  success: boolean
  message: string
  warning?: boolean
}

export interface SwitchCameraResponse {
  success: boolean
  message: string
  bridge_restarted?: boolean
  camera_source?: 'usb' | 'go2'
  camera_index?: number | null
}

export interface DashboardData {
  config: Record<string, unknown>
  local_ip: string
  license_info: LicenseInfo
}

export interface ActivateData {
  hw_id: string
}

const NO_CACHE: RequestInit = {
  cache: 'no-store',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
}

async function r<T>(url: string, opts?: RequestInit): Promise<T> {
  const isGet = !opts?.method || opts.method === 'GET'
  const fetchUrl = isGet
    ? `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`
    : url

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(fetchUrl, {
      ...NO_CACHE,
      ...opts,
      signal: controller.signal,
      headers: {
        ...NO_CACHE.headers,
        ...(opts?.headers as Record<string, string> | undefined),
      },
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    return res.json()
  } finally {
    window.clearTimeout(timeout)
  }
}

export const api = {
  getDashboard: () => r<DashboardData>('/api/dashboard'),

  getStatus: () => r<StatusResponse>('/status'),

  startBridge: () => r<BridgeResponse>('/control/start'),
  stopBridge: () => r<BridgeResponse>('/control/stop'),

  listCameras: () => r<{ cameras: Camera[]; scan_path: string }>('/api/list-cameras'),
  detectCamera: (camera_index: number) =>
    r<DetectResult>('/api/detect-camera', {
      method: 'POST',
      body: JSON.stringify({ camera_index }),
    }),

  listInterfaces: () => r<{ interfaces: NetworkInterface[] }>('/api/list-interfaces'),

  getCameraFeedUrl: (camera_index: number) =>
    `/api/camera-test-feed?camera_index=${camera_index}&t=${Date.now()}`,

  getGo2CameraFeedUrl: () =>
    `/api/go2-camera-test-feed?t=${Date.now()}`,

  probeGo2Camera: async () => {
    const res = await fetch(`/api/go2-camera-test-probe?_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    })
    const data = await res.json().catch(() => ({})) as {
      ok?: boolean
      error?: string
      stderr?: string
      binary_path?: string
    }
    return {
      ok: res.ok && data.ok !== false,
      error: data.error,
      stderr: data.stderr,
      binary_path: data.binary_path,
      httpStatus: res.status,
    }
  },

  getHlsUrl: (host: string, path: string, cacheKey?: number) => {
    const cleanPath = path.replace(/^\/+|\/+$/g, '')
    const url = `http://${host}:8888/${cleanPath}/index.m3u8`
    return cacheKey ? `${url}?_k=${cacheKey}` : url
  },

  getActivateInfo: () => r<ActivateData>('/activate'),
  activateLicense: (license_key: string) =>
    r<{ success: boolean; message: string }>('/activate', {
      method: 'POST',
      body: JSON.stringify({ license_key }),
    }),

  saveConfig: (config: Record<string, unknown>) =>
    r<BridgeResponse>('/save', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  switchCamera: (payload: {
    camera_source: 'usb' | 'go2'
    camera_index?: number
    network_interface?: string
  }) =>
    r<SwitchCameraResponse>('/api/switch-camera', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  unlinkLicense: (confirm_text: string, understood: boolean) =>
    r<BridgeResponse>('/license/unlink', {
      method: 'POST',
      body: JSON.stringify({ confirm_text, understood }),
    }),

  getRemoteLicenseStatus: () =>
    r<RemoteLicenseCheckResult>('/api/license/remote-status'),

  checkRemoteLicense: () =>
    r<RemoteLicenseCheckResult>('/api/license/remote-check', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
}
