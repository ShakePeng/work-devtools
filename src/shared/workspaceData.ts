import {
  CURRENT_VERSION,
  type CookieData,
  type DevAddressesData,
  type WorkDevToolsData,
} from './types'
import {
  createDefaultDevAddressesData,
  isDevAddressesData,
  normalizeDevAddressesData,
} from './devAddresses'

function hasCookieDataShape(value: unknown): value is CookieData {
  if (!value || typeof value != 'object') return false
  const data = value as Record<string, unknown>
  if (!Array.isArray(data.persons)) return false

  for (const personValue of data.persons) {
    if (!personValue || typeof personValue != 'object') return false
    const person = personValue as Record<string, unknown>
    if (typeof person.id != 'string' || typeof person.name != 'string') return false
    if (!Array.isArray(person.platforms)) return false

    for (const platformValue of person.platforms) {
      if (!platformValue || typeof platformValue != 'object') return false
      const platform = platformValue as Record<string, unknown>
      if (typeof platform.id != 'string' || typeof platform.name != 'string') return false
      if (!Array.isArray(platform.cookies)) return false

      for (const cookieValue of platform.cookies) {
        if (!cookieValue || typeof cookieValue != 'object') return false
        const cookie = cookieValue as Record<string, unknown>
        if (typeof cookie.id != 'string') return false
      }
    }
  }

  return (!data.deviceProfiles || Array.isArray(data.deviceProfiles))
    && (!data.bridgeProviders || Array.isArray(data.bridgeProviders))
    && (!data.bridgeMethods || Array.isArray(data.bridgeMethods))
    && (!data.cookiePresetGroups || Array.isArray(data.cookiePresetGroups))
    && (!data.cookiePresets || Array.isArray(data.cookiePresets))
}

function hasCompatibleWorkDevToolsShape(value: unknown): boolean {
  if (!value || typeof value != 'object') return false
  const data = value as Record<string, unknown>
  if (typeof data.version != 'number' || typeof data.updatedAt != 'number') return false
  if (!data.tools || typeof data.tools != 'object') return false
  const tools = data.tools as Record<string, unknown>
  return hasCookieDataShape(tools.cookieInjector)
    && (typeof tools.devAddresses == 'undefined' || isDevAddressesData(tools.devAddresses))
}

/** 当前完整结构；旧版缺少 devAddresses 时由 resolveWorkDevToolsData 补全。 */
export function isWorkDevToolsData(value: unknown): value is WorkDevToolsData {
  if (!hasCompatibleWorkDevToolsShape(value)) return false
  const tools = (value as { tools: Record<string, unknown> }).tools
  return tools.devAddresses != undefined
}

export function isLegacyCookieData(value: unknown): value is CookieData & {
  version?: number
  updatedAt?: number
  platforms?: unknown[]
  cookies?: unknown[]
} {
  if (!value || typeof value != 'object') return false
  const data = value as Record<string, unknown>
  return Array.isArray(data.persons)
}

export function createWorkDevToolsData(
  cookieInjector: CookieData,
  updatedAt = 0,
  devAddresses: DevAddressesData = createDefaultDevAddressesData()
): WorkDevToolsData {
  return {
    version: CURRENT_VERSION,
    updatedAt,
    tools: { cookieInjector, devAddresses },
  }
}

/** 新结构直接返回；旧扁平 CookieData 仅在迁移和导入时包裹到 tools 下。 */
export function resolveWorkDevToolsData(
  value: unknown,
  allowLegacyCookieData = false
): WorkDevToolsData | null {
  if (hasCompatibleWorkDevToolsShape(value)) {
    const data = value as {
      version: number
      updatedAt: number
      tools: Record<string, unknown> & { cookieInjector: CookieData }
    }
    return {
      ...data,
      tools: {
        ...data.tools,
        cookieInjector: data.tools.cookieInjector,
        devAddresses: normalizeDevAddressesData(data.tools.devAddresses),
      },
    }
  }
  if (!allowLegacyCookieData || !isLegacyCookieData(value)) return null
  const legacy = value as CookieData & { version?: number; updatedAt?: number }
  const { version: _version, updatedAt, ...cookieInjector } = legacy
  return createWorkDevToolsData(
    cookieInjector as CookieData,
    typeof updatedAt == 'number' ? updatedAt : 0
  )
}
