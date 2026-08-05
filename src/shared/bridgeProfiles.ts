import type {
  BridgeAdapter,
  BridgeMethodDefinition,
  BridgeProvider,
  Person,
  JsonValue,
  PlatformBridgeMock,
  PlatformMode,
  RuntimeBridgeMock,
} from './types'

export const TC_APP_BRIDGE_PROVIDER_ID = 'builtin-tc-app'
export const TC_GET_DEVICE_INFO_METHOD_ID = 'builtin-tc-user-get-device-info'
export const TC_USER_LOGIN_METHOD_ID = 'builtin-tc-user-user-login'

const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor'])

export function createTcAppAdapter(): BridgeAdapter {
  return {
    delivery: 'callback',
    callbackKey: 'callback',
    wrapper: 'json-string-field',
    wrapperField: 'CBData',
    delayMs: 0,
  }
}

export function createDefaultBridgeProviders(now = Date.now()): BridgeProvider[] {
  return [{
    id: TC_APP_BRIDGE_PROVIDER_ID,
    name: '同程 App',
    adapter: createTcAppAdapter(),
    createdAt: now,
    updatedAt: now,
  }]
}

export function createDefaultBridgeMethods(now = Date.now()): BridgeMethodDefinition[] {
  return [
    {
      id: TC_GET_DEVICE_INFO_METHOD_ID,
      providerId: TC_APP_BRIDGE_PROVIDER_ID,
      objectPath: ['_tc_bridge_user'],
      method: 'get_device_info',
      defaultValue: {
        memberInfo: {
          memberId: '',
          unionId: '',
        },
        deviceInfo: {
          appVersionNumber: '11.4.1',
          appVersionType: 'ios',
          deviceId: '4A596205-76EA-465B-A8EA-FB328301599D',
        },
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: TC_USER_LOGIN_METHOD_ID,
      providerId: TC_APP_BRIDGE_PROVIDER_ID,
      objectPath: ['_tc_bridge_user'],
      method: 'user_login',
      defaultValue: {},
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value == null || typeof value == 'string' || typeof value == 'number' || typeof value == 'boolean') return true
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value != 'object') return false
  return Object.entries(value).every(([key, item]) => !FORBIDDEN_PATH_SEGMENTS.has(key) && isJsonValue(item))
}

export function isValidBridgePathSegment(value: unknown): value is string {
  return typeof value == 'string'
    && /^[A-Za-z_$][\w$]*$/.test(value)
    && !FORBIDDEN_PATH_SEGMENTS.has(value)
}

export function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function normalizeBridgeAdapter(value: unknown, fallback = createTcAppAdapter()): BridgeAdapter {
  if (!value || typeof value != 'object') return { ...fallback }
  const adapter = value as Record<string, unknown>
  const delivery = adapter.delivery
  const wrapper = adapter.wrapper
  if (!['callback', 'promise', 'return', 'void'].includes(String(delivery))) return { ...fallback }
  if (!['raw', 'json-string-field'].includes(String(wrapper))) return { ...fallback }
  return {
    delivery: delivery as BridgeAdapter['delivery'],
    callbackKey: typeof adapter.callbackKey == 'string' ? adapter.callbackKey : delivery == 'callback' ? 'callback' : undefined,
    wrapper: wrapper as BridgeAdapter['wrapper'],
    wrapperField: typeof adapter.wrapperField == 'string' ? adapter.wrapperField : wrapper == 'json-string-field' ? 'CBData' : undefined,
    delayMs: typeof adapter.delayMs == 'number' && adapter.delayMs >= 0 ? adapter.delayMs : 0,
  }
}

export function normalizeBridgeProviders(value: unknown): BridgeProvider[] {
  const defaults = createDefaultBridgeProviders()
  const valid = Array.isArray(value) ? value.flatMap(item => {
    if (!item || typeof item != 'object') return []
    const provider = item as Record<string, unknown>
    if (typeof provider.id != 'string' || typeof provider.name != 'string') return []
    return [{
      id: provider.id,
      name: provider.name,
      adapter: normalizeBridgeAdapter(provider.adapter),
      createdAt: typeof provider.createdAt == 'number' ? provider.createdAt : Date.now(),
      updatedAt: typeof provider.updatedAt == 'number' ? provider.updatedAt : Date.now(),
    }]
  }) : []
  const byId = new Map(valid.map(provider => [provider.id, provider]))
  defaults.forEach(provider => {
    if (!byId.has(provider.id)) byId.set(provider.id, provider)
  })
  return [...byId.values()]
}

export function normalizeBridgeMethods(value: unknown, providers: BridgeProvider[]): BridgeMethodDefinition[] {
  const providerIds = new Set(providers.map(provider => provider.id))
  const defaults = createDefaultBridgeMethods()
  const valid = Array.isArray(value) ? value.flatMap(item => {
    if (!item || typeof item != 'object') return []
    const method = item as Record<string, unknown>
    if (
      typeof method.id != 'string'
      || typeof method.providerId != 'string'
      || !providerIds.has(method.providerId)
      || !Array.isArray(method.objectPath)
      || !method.objectPath.length
      || !method.objectPath.every(isValidBridgePathSegment)
      || !isValidBridgePathSegment(method.method)
      || !isJsonValue(method.defaultValue)
    ) return []
    return [{
      id: method.id,
      providerId: method.providerId,
      objectPath: [...method.objectPath],
      method: method.method,
      defaultValue: cloneJsonValue(method.defaultValue),
      createdAt: typeof method.createdAt == 'number' ? method.createdAt : Date.now(),
      updatedAt: typeof method.updatedAt == 'number' ? method.updatedAt : Date.now(),
    }]
  }) : []
  const byId = new Map(valid.map(method => [method.id, method]))
  defaults.forEach(method => {
    if (!byId.has(method.id)) byId.set(method.id, method)
  })
  return [...byId.values()]
}

export function normalizePlatformBridges(value: unknown, methods: BridgeMethodDefinition[]): PlatformBridgeMock[] {
  if (!Array.isArray(value)) return []
  const methodIds = new Set(methods.map(method => method.id))
  const seen = new Set<string>()
  return value.flatMap(item => {
    if (!item || typeof item != 'object') return []
    const bridge = item as Record<string, unknown>
    if (
      typeof bridge.methodId != 'string'
      || seen.has(bridge.methodId)
      || !methodIds.has(bridge.methodId)
      || !isJsonValue(bridge.value)
    ) return []
    seen.add(bridge.methodId)
    return [{
      methodId: bridge.methodId,
      enabled: bridge.enabled != false,
      value: cloneJsonValue(bridge.value),
    }]
  })
}

export function resolveRuntimeBridges(
  selected: PlatformBridgeMock[] | undefined,
  providers: BridgeProvider[],
  methods: BridgeMethodDefinition[]
): RuntimeBridgeMock[] {
  const providerMap = new Map(providers.map(provider => [provider.id, provider]))
  const methodMap = new Map(methods.map(method => [method.id, method]))
  return (selected || []).flatMap(item => {
    if (!item.enabled) return []
    const method = methodMap.get(item.methodId)
    const provider = method ? providerMap.get(method.providerId) : undefined
    if (!method || !provider) return []
    return [{
      methodId: method.id,
      objectPath: [...method.objectPath],
      method: method.method,
      adapter: { ...provider.adapter },
      value: cloneJsonValue(item.value),
    }]
  })
}

export function normalizePersonBridgeMocks(persons: Person[], methods: BridgeMethodDefinition[]): Person[] {
  return persons.map(person => ({
    ...person,
    platforms: person.platforms.map(platform => {
      const mode = normalizePlatformMode(platform)
      return {
        ...platform,
        mode,
        bridges: mode == 'bridge' ? normalizePlatformBridges(platform.bridges, methods) : [],
      }
    }),
  }))
}

export function normalizePlatformMode(value: { mode?: unknown; bridges?: unknown }): PlatformMode {
  if (value.mode == 'cookie' || value.mode == 'bridge') return value.mode as PlatformMode
  return Array.isArray(value.bridges) && value.bridges.length ? 'bridge' : 'cookie'
}
