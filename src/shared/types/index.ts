// ============ 核心数据模型（嵌套层级：Person → Platform → Cookie）============

/** 人员维度 */
export interface Person {
  id: string
  name: string
  createdAt: number
  order: number
  platforms: Platform[]
}

/** 平台维度 */
export type PlatformMode = 'cookie' | 'bridge'

export interface Platform {
  id: string
  name: string
  /** 创建时确定的数据模式，后续不可修改。 */
  mode: PlatformMode
  createdAt: number
  order: number
  cookies: Cookie[]
  /** 注入时在当前标签页模拟的设备预设；旧平台可为空。 */
  deviceProfileId?: string
  /** 当前业务平台启用的 Bridge 方法及其返回值。 */
  bridges?: PlatformBridgeMock[]
}

/** 与平台绑定的 User-Agent 预设。 */
export interface DeviceProfile {
  id: string
  name: string
  userAgent: string
  createdAt: number
  updatedAt: number
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

/** Bridge 系统统一定义的返回机制，业务平台无需选择。 */
export interface BridgeAdapter {
  delivery: 'callback' | 'promise' | 'return' | 'void'
  callbackKey?: string
  wrapper: 'raw' | 'json-string-field'
  wrapperField?: string
  delayMs?: number
}

/** 一套 Bridge 运行时，例如同程 App。 */
export interface BridgeProvider {
  id: string
  name: string
  adapter: BridgeAdapter
  createdAt: number
  updatedAt: number
}

/** Bridge 方法目录中的一个方法。 */
export interface BridgeMethodDefinition {
  id: string
  providerId: string
  objectPath: string[]
  method: string
  defaultValue: JsonValue
  createdAt: number
  updatedAt: number
}

/** 业务平台选中的 Bridge 方法，value 是选择时复制的默认值。 */
export interface PlatformBridgeMock {
  methodId: string
  enabled: boolean
  value: JsonValue
}

/** 下发到页面主世界的完整 Bridge Mock。 */
export interface RuntimeBridgeMock {
  methodId: string
  objectPath: string[]
  method: string
  adapter: BridgeAdapter
  value: JsonValue
}

/** Cookie 预设分组，例如微信预设、同程 T 站预设。 */
export interface CookiePresetGroup {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

/** Cookie 预设目录中的一个可独立选择的 Key。 */
export interface CookiePresetDefinition {
  id: string
  groupId: string
  key: string
  defaultValue: string
  createdAt: number
  updatedAt: number
}

/** Cookie 条目（精简版：仅 key + value） */
export interface Cookie {
  id: string
  name: string
  value: string
  /** 平台注入时是否启用。 */
  enabled: boolean
  /** 来源预设；自定义 Cookie 可为空。 */
  presetId?: string
}

// ============ 聚合数据容器 ============

/** Cookie Injector 工具数据，不包含工作台级元数据。 */
export interface CookieData {
  persons: Person[]
  /** 设备预设总开关；关闭后不展示、绑定或注入 UA。 */
  uaInjectionEnabled: boolean
  /** 会随导入导出和 WebDAV 同步的设备预设。 */
  deviceProfiles: DeviceProfile[]
  /** 会随导入导出和 WebDAV 同步的 Bridge 系统。 */
  bridgeProviders: BridgeProvider[]
  /** Bridge 方法目录。 */
  bridgeMethods: BridgeMethodDefinition[]
  /** Cookie 预设分组。 */
  cookiePresetGroups: CookiePresetGroup[]
  /** Cookie Key 预设目录。 */
  cookiePresets: CookiePresetDefinition[]
}

/** Work DevTools 持久化、导入导出和 WebDAV 共用的根数据结构。 */
export interface WorkDevToolsData {
  version: number
  /** 整个工作台数据的最后更新时间，用于跨设备同步冲突判断。 */
  updatedAt: number
  tools: {
    cookieInjector: CookieData
    [toolKey: string]: unknown
  }
}

export const CURRENT_VERSION = 1
export const LEGACY_COOKIE_DATA_VERSION = 7

// ============ 存储分块元数据 ============

export interface ChunkMeta {
  chunks: number
  version: number
  updatedAt: number
}

// ============ 导入结果 ============

export interface ImportPreview {
  persons: number
  platforms: number
  cookies: number
  data: WorkDevToolsData
}

export interface ImportResult {
  success: boolean
  imported: ImportPreview
  skipped: ImportPreview
  errors: string[]
}

// ============ 后台消息 ============

export interface InjectCookiesMessage {
  type: 'INJECT_COOKIES'
  cookies: Cookie[]
  targetUrl: string
  tabId?: number
  deviceProfile?: DeviceProfile
  bridges?: RuntimeBridgeMock[]
}

export interface InjectResultMessage {
  type: 'INJECT_RESULT'
  success: number
  failed: number
  errors: string[]
  bridgeSuccess?: number
  /** 页面脚本层 UA 已下发；网络请求头仍由 Chrome 调试器覆盖。 */
  uaSuccess?: boolean
  uaError?: string
}

export interface SetBridgeSessionMessage {
  type: 'SET_BRIDGE_SESSION'
  bridges: RuntimeBridgeMock[]
  userAgent?: string
}

export type BackgroundMessage = InjectCookiesMessage
export type PopupMessage = InjectResultMessage

// ============ 默认值工厂 ============

export function createDefaultCookie(): Cookie {
  return {
    id: '',
    name: '',
    value: '',
    enabled: true,
  }
}

// ============ WebDAV 同步相关 ============

/** 同步配置（存在 chrome.storage.local，不参与 sync 同步） */
export interface WebDavSyncConfig {
  /** 用于保存同步文件的 WebDAV 专用目录 */
  endpoint: string
  /** WebDAV 专用用户名 */
  username: string
  /** WebDAV 密码，仅保存在当前浏览器扩展的本地存储 */
  password: string
  /** 是否启用同步 */
  enabled: boolean
}

/** 同步运行时状态 */
export interface SyncStatus {
  /** 是否正在同步中 */
  syncing: boolean
  /** 上次成功同步的时间戳 */
  lastSyncAt: number | null
  /** 上次错误信息 */
  lastError: string | null
  /** 远端数据的 updatedAt（用于显示远端版本） */
  remoteUpdatedAt: number | null
}

/** 同步结果 */
export interface SyncResult {
  success: boolean
  /** 'push' 推送 / 'pull' 拉取 / 'skip' 跳过（无需同步） */
  action: 'push' | 'pull' | 'skip'
  error?: string
}
