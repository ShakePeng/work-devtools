import type { DeviceProfile } from './types'

const WECHAT_UA = 'mozilla/5.0 (iphone; cpu iphone os 11_0 like mac os x) applewebkit/604.1.28 (khtml, like gecko) mobile/15a5318g micromessenger/6.5.12 nettype/wifi language/zh_cn'
const TCTRAVEL_UA = 'mozilla/5.0 (iphone; cpu iphone os 11_0 like mac os x) applewebkit/604.1.31 (khtml, like gecko) mobile/15a5327g tctravel/8.3.4 qbwebviewtype/1'

/** 内置预设使用稳定 ID，便于跨设备同步和平台绑定。 */
export function createDefaultDeviceProfiles(now = Date.now()): DeviceProfile[] {
  return [
    { id: 'builtin-wechat-ios', name: '微信-UA', userAgent: WECHAT_UA, createdAt: now, updatedAt: now },
    { id: 'builtin-tctravel-ios', name: '同程App-UA', userAgent: TCTRAVEL_UA, createdAt: now, updatedAt: now },
  ]
}

export function normalizeDeviceProfiles(value: unknown): DeviceProfile[] {
  const defaults = createDefaultDeviceProfiles()
  if (!Array.isArray(value)) return defaults

  const valid = value.filter((item): item is DeviceProfile => {
    if (!item || typeof item != 'object') return false
    const profile = item as Record<string, unknown>
    return typeof profile.id == 'string'
      && typeof profile.name == 'string'
      && typeof profile.userAgent == 'string'
      && typeof profile.createdAt == 'number'
      && typeof profile.updatedAt == 'number'
  })

  const byId = new Map(valid.map(profile => {
    const defaultProfile = defaults.find(item => item.id == profile.id)
    const legacyName = profile.id == 'builtin-wechat-ios' ? '微信' : profile.id == 'builtin-tctravel-ios' ? '同程App' : null
    const normalized = {
      id: profile.id,
      name: defaultProfile && profile.name == legacyName ? defaultProfile.name : profile.name,
      userAgent: profile.userAgent,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    }
    return [profile.id, normalized] as const
  }))
  defaults.forEach(profile => {
    if (!byId.has(profile.id)) byId.set(profile.id, profile)
  })
  return [...byId.values()]
}
