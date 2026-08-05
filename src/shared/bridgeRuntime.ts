import type { RuntimeBridgeMock } from './types'
import { STORAGE_KEYS } from './storageKeys'

export const BRIDGE_SESSION_STORAGE_KEY = STORAGE_KEYS.cookieInjector.bridgeRuntimeSession

/** 刷新前写入页面会话，供 document_start 的主世界脚本同步读取。 */
export interface BridgeRuntimeSession {
  bridges: RuntimeBridgeMock[]
  userAgent?: string
}
