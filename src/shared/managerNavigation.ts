export const MANAGER_NAV = {
  cookieData: 'cookie-injector:data',
  cookiePresets: 'cookie-injector:cookies',
  bridgePresets: 'cookie-injector:bridges',
  deviceProfiles: 'cookie-injector:devices',
  devAddressProjects: 'dev-addresses:projects',
  imageCompressor: 'image-compressor:compress',
  imageCompressorSettings: 'image-compressor:settings',
  backupSync: 'backup-sync',
} as const

export type ManagerNavKey = typeof MANAGER_NAV[keyof typeof MANAGER_NAV]

export const DEFAULT_MANAGER_NAV: ManagerNavKey = MANAGER_NAV.cookieData

const MANAGER_NAV_KEYS = new Set<string>(Object.values(MANAGER_NAV))

export function isManagerNavKey(value: unknown): value is ManagerNavKey {
  return typeof value == 'string' && MANAGER_NAV_KEYS.has(value)
}

export function parseManagerNav(search: string): ManagerNavKey {
  const value = new URLSearchParams(search).get('nav')
  return isManagerNavKey(value) ? value : DEFAULT_MANAGER_NAV
}

export function getManagerPagePath(nav: ManagerNavKey = DEFAULT_MANAGER_NAV): string {
  return `manager.html?nav=${nav}`
}
