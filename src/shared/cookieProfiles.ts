import type {
  Cookie,
  CookiePresetDefinition,
  CookiePresetGroup,
  Person,
} from './types'

export const WECHAT_COOKIE_GROUP_ID = 'builtin-cookie-group-wechat'
export const TC_T_COOKIE_GROUP_ID = 'builtin-cookie-group-tc-t'
export const ELONG_T_COOKIE_GROUP_ID = 'builtin-cookie-group-elong-t'

const BUILTIN_COOKIE_KEYS = [
  ['builtin-cookie-cooperate-user', WECHAT_COOKIE_GROUP_ID, 'CooperateUser'],
  ['builtin-cookie-cooperate-wx-user', WECHAT_COOKIE_GROUP_ID, 'CooperateWxUser'],
  ['builtin-cookie-open-source', WECHAT_COOKIE_GROUP_ID, 'cookieOpenSource'],
  ['builtin-cookie-cooperate-tc-wx-user', WECHAT_COOKIE_GROUP_ID, 'CooperateTcWxUser'],
  ['builtin-cookie-wx-user', WECHAT_COOKIE_GROUP_ID, 'WxUser'],
  ['builtin-cookie-cn-user', TC_T_COOKIE_GROUP_ID, 'cnUser'],
  ['builtin-cookie-elong-user', ELONG_T_COOKIE_GROUP_ID, 'elongUser'],
] as const

export function createDefaultCookiePresetGroups(now = Date.now()): CookiePresetGroup[] {
  return [
    { id: WECHAT_COOKIE_GROUP_ID, name: '微信预设', createdAt: now, updatedAt: now },
    { id: TC_T_COOKIE_GROUP_ID, name: '同程 T 站预设', createdAt: now, updatedAt: now },
    { id: ELONG_T_COOKIE_GROUP_ID, name: '艺龙 T 站预设', createdAt: now, updatedAt: now },
  ]
}

export function createDefaultCookiePresets(now = Date.now()): CookiePresetDefinition[] {
  return BUILTIN_COOKIE_KEYS.map(([id, groupId, key]) => ({
    id,
    groupId,
    key,
    defaultValue: 'xxx',
    createdAt: now,
    updatedAt: now,
  }))
}

export function normalizeCookiePresetGroups(value: unknown): CookiePresetGroup[] {
  const valid = Array.isArray(value) ? value.flatMap(item => {
    if (!item || typeof item != 'object') return []
    const group = item as Record<string, unknown>
    if (typeof group.id != 'string' || typeof group.name != 'string' || !group.name.trim()) return []
    return [{
      id: group.id,
      name: group.name.trim(),
      createdAt: typeof group.createdAt == 'number' ? group.createdAt : Date.now(),
      updatedAt: typeof group.updatedAt == 'number' ? group.updatedAt : Date.now(),
    }]
  }) : []
  const byId = new Map(valid.map(group => [group.id, group]))
  createDefaultCookiePresetGroups().forEach(group => {
    if (!byId.has(group.id)) byId.set(group.id, group)
  })
  return [...byId.values()]
}

export function normalizeCookiePresets(
  value: unknown,
  groups: CookiePresetGroup[]
): CookiePresetDefinition[] {
  const groupIds = new Set(groups.map(group => group.id))
  const seenKeys = new Set<string>()
  const valid = Array.isArray(value) ? value.flatMap(item => {
    if (!item || typeof item != 'object') return []
    const preset = item as Record<string, unknown>
    if (
      typeof preset.id != 'string'
      || typeof preset.groupId != 'string'
      || !groupIds.has(preset.groupId)
      || typeof preset.key != 'string'
      || !preset.key.trim()
      || seenKeys.has(preset.key.trim())
      || typeof preset.defaultValue != 'string'
    ) return []
    const key = preset.key.trim()
    seenKeys.add(key)
    return [{
      id: preset.id,
      groupId: preset.groupId,
      key,
      defaultValue: preset.defaultValue,
      createdAt: typeof preset.createdAt == 'number' ? preset.createdAt : Date.now(),
      updatedAt: typeof preset.updatedAt == 'number' ? preset.updatedAt : Date.now(),
    }]
  }) : []
  const byId = new Map(valid.map(preset => [preset.id, preset]))
  createDefaultCookiePresets().forEach(preset => {
    if (!byId.has(preset.id) && !seenKeys.has(preset.key)) {
      byId.set(preset.id, preset)
      seenKeys.add(preset.key)
    }
  })
  return [...byId.values()]
}

export function normalizePlatformCookies(value: unknown, presets: CookiePresetDefinition[]): Cookie[] {
  if (!Array.isArray(value)) return []
  const presetById = new Map(presets.map(preset => [preset.id, preset]))
  const presetByKey = new Map(presets.map(preset => [preset.key, preset]))
  const seenNames = new Set<string>()
  return value.flatMap(item => {
    if (!item || typeof item != 'object') return []
    const cookie = item as Record<string, unknown>
    if (
      typeof cookie.id != 'string'
      || typeof cookie.name != 'string'
      || !cookie.name.trim()
      || typeof cookie.value != 'string'
    ) return []
    const selectedPreset = typeof cookie.presetId == 'string'
      ? presetById.get(cookie.presetId)
      : presetByKey.get(cookie.name.trim())
    const name = selectedPreset?.key || cookie.name.trim()
    if (seenNames.has(name)) return []
    seenNames.add(name)
    return [{
      id: cookie.id,
      name,
      value: cookie.value,
      enabled: cookie.enabled != false,
      presetId: selectedPreset?.key == name ? selectedPreset.id : undefined,
    }]
  })
}

export function normalizePersonCookieConfigs(
  persons: Person[],
  presets: CookiePresetDefinition[]
): Person[] {
  return persons.map(person => ({
    ...person,
    platforms: person.platforms.map(platform => ({
      ...platform,
      cookies: platform.mode == 'cookie' ? normalizePlatformCookies(platform.cookies, presets) : [],
    })),
  }))
}
