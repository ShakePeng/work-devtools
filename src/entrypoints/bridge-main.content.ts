import type { BridgeAdapter, JsonValue, RuntimeBridgeMock } from '@shared/types'
import { BRIDGE_SESSION_STORAGE_KEY, type BridgeRuntimeSession } from '@shared/bridgeRuntime'
import { isJsonValue, isValidBridgePathSegment, normalizeBridgeAdapter } from '@shared/bridgeProfiles'

interface BridgeTreeNode {
  children: Map<string, BridgeTreeNode>
  methods: Map<string, RuntimeBridgeMock>
}

function createTreeNode(): BridgeTreeNode {
  return { children: new Map(), methods: new Map() }
}

function cloneValue(value: JsonValue): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

function wrapValue(value: JsonValue, adapter: BridgeAdapter): unknown {
  const cloned = cloneValue(value)
  if (adapter.wrapper == 'json-string-field') {
    return { [adapter.wrapperField || 'CBData']: JSON.stringify(cloned) }
  }
  return cloned
}

function createMockFunction(mock: RuntimeBridgeMock) {
  return (...args: unknown[]) => {
    const payload = wrapValue(mock.value, mock.adapter)
    if (mock.adapter.delivery == 'promise') return Promise.resolve(payload)
    if (mock.adapter.delivery == 'return') return payload
    if (mock.adapter.delivery == 'void') return undefined

    const callbackKey = mock.adapter.callbackKey || 'callback'
    const options = args.find(arg => arg && typeof arg == 'object' && typeof (arg as Record<string, unknown>)[callbackKey] == 'function') as Record<string, unknown> | undefined
    const callback = options?.[callbackKey] as ((value: unknown) => void) | undefined
      || args.find(arg => typeof arg == 'function') as ((value: unknown) => void) | undefined
    if (callback) {
      window.setTimeout(() => {
        try {
          callback(payload)
        } catch (error) {
          console.error(`[Work DevTools][Cookie Injector] Bridge callback 执行失败：${mock.objectPath.join('.')}.${mock.method}`, error)
        }
      }, mock.adapter.delayMs || 0)
    }
    return undefined
  }
}

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return !!value && (typeof value == 'object' || typeof value == 'function')
}

function createBridgeProxy(target: Record<PropertyKey, unknown>, node: BridgeTreeNode): Record<PropertyKey, unknown> {
  const childCache = new WeakMap<object, Record<PropertyKey, unknown>>()
  const methodCache = new Map<string, (...args: unknown[]) => unknown>()

  return new Proxy(target, {
    get(current, property, receiver) {
      if (typeof property == 'string') {
        const mock = node.methods.get(property)
        if (mock) {
          if (!methodCache.has(property)) methodCache.set(property, createMockFunction(mock))
          return methodCache.get(property)
        }

        const child = node.children.get(property)
        if (child) {
          let childTarget = Reflect.get(current, property, receiver)
          if (!isObject(childTarget)) {
            childTarget = {}
            Reflect.set(current, property, childTarget, receiver)
          }
          const childObject = childTarget as Record<PropertyKey, unknown>
          const cached = childCache.get(childObject)
          if (cached) return cached
          const proxy = createBridgeProxy(childObject, child)
          childCache.set(childObject, proxy)
          return proxy
        }
      }

      const value = Reflect.get(current, property, receiver)
      return typeof value == 'function' ? value.bind(current) : value
    },
    has(current, property) {
      return typeof property == 'string' && (node.methods.has(property) || node.children.has(property))
        ? true
        : Reflect.has(current, property)
    },
  })
}

function parseRuntimeSession(value: string | null): BridgeRuntimeSession {
  if (!value) return { bridges: [] }
  try {
    const parsed = JSON.parse(value)
    // 兼容早期仅保存 Bridge 数组的会话数据。
    const rawMocks = Array.isArray(parsed) ? parsed : parsed?.bridges
    if (!Array.isArray(rawMocks)) return { bridges: [] }
    const bridges = rawMocks.flatMap(item => {
      if (!item || typeof item != 'object') return []
      const mock = item as Partial<RuntimeBridgeMock>
      if (
        typeof mock.methodId != 'string'
        || !Array.isArray(mock.objectPath)
        || !mock.objectPath.length
        || !mock.objectPath.every(isValidBridgePathSegment)
        || !isValidBridgePathSegment(mock.method)
        || !isJsonValue(mock.value)
      ) return []
      return [{
        methodId: mock.methodId,
        objectPath: [...mock.objectPath],
        method: mock.method,
        adapter: normalizeBridgeAdapter(mock.adapter),
        value: mock.value,
      }]
    })
    return {
      bridges,
      userAgent: !Array.isArray(parsed) && typeof parsed?.userAgent == 'string' ? parsed.userAgent : undefined,
    }
  } catch {
    return { bridges: [] }
  }
}

function installUserAgentOverride(userAgent?: string) {
  if (!userAgent) return
  const descriptor = { configurable: true, get: () => userAgent }
  try {
    Object.defineProperty(Navigator.prototype, 'userAgent', descriptor)
  } catch {
    try {
      Object.defineProperty(window.navigator, 'userAgent', descriptor)
    } catch (error) {
      console.warn('[Work DevTools][Cookie Injector] 无法覆盖页面 User-Agent', error)
    }
  }
}

function installBridgeMocks(mocks: RuntimeBridgeMock[]) {
  const roots = new Map<string, BridgeTreeNode>()
  mocks.forEach(mock => {
    const [rootName, ...restPath] = mock.objectPath
    let node = roots.get(rootName)
    if (!node) {
      node = createTreeNode()
      roots.set(rootName, node)
    }
    restPath.forEach(segment => {
      let child = node!.children.get(segment)
      if (!child) {
        child = createTreeNode()
        node!.children.set(segment, child)
      }
      node = child
    })
    node.methods.set(mock.method, mock)
  })

  roots.forEach((node, rootName) => {
    const existing = (window as unknown as Record<string, unknown>)[rootName]
    const target: Record<PropertyKey, unknown> = isObject(existing) ? existing : {}
    const proxy = createBridgeProxy(target, node)
    try {
      Object.defineProperty(window, rootName, {
        configurable: true,
        enumerable: true,
        get: () => proxy,
        set: value => {
          if (!isObject(value) || value == proxy) return
          Reflect.ownKeys(value).forEach(key => {
            try {
              const descriptor = Object.getOwnPropertyDescriptor(value, key)
              if (descriptor) Object.defineProperty(target, key, descriptor)
            } catch {
              Reflect.set(target, key, Reflect.get(value, key))
            }
          })
        },
      })
    } catch (error) {
      console.warn(`[Work DevTools][Cookie Injector] 无法安装 Bridge Mock：${rootName}`, error)
    }
  })
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    try {
      const session = parseRuntimeSession(window.sessionStorage.getItem(BRIDGE_SESSION_STORAGE_KEY))
      installUserAgentOverride(session.userAgent)
      installBridgeMocks(session.bridges)
    } catch (error) {
      console.warn('[Work DevTools][Cookie Injector] Bridge Mock 初始化失败', error)
    }
  },
})
