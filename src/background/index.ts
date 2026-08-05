import type { DeviceProfile, InjectCookiesMessage, Cookie, RuntimeBridgeMock } from '../shared/types'
import { BRIDGE_SESSION_STORAGE_KEY, type BridgeRuntimeSession } from '../shared/bridgeRuntime'
import { shouldUseSecureCookie } from '../shared/cookieInjection'

const emulatedTabs = new Set<number>()

async function applyDeviceProfile(tabId: number, targetUrl: string, profile: DeviceProfile): Promise<void> {
  if (!/^https?:\/\//.test(targetUrl)) {
    throw new Error('UA 覆盖仅支持 HTTP/HTTPS 页面')
  }

  if (!emulatedTabs.has(tabId)) {
    await chrome.debugger.attach({ tabId }, '1.3')
    emulatedTabs.add(tabId)
  }

  await chrome.debugger.sendCommand({ tabId }, 'Emulation.setUserAgentOverride', {
    userAgent: profile.userAgent,
  })
}

async function clearDeviceProfile(tabId: number): Promise<void> {
  if (!emulatedTabs.has(tabId)) return
  emulatedTabs.delete(tabId)
  try { await chrome.debugger.detach({ tabId }) } catch { /* 标签关闭或 DevTools 接管时无需处理 */ }
}

async function setBridgeSession(tabId: number, bridges: RuntimeBridgeMock[], userAgent?: string): Promise<number> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'SET_BRIDGE_SESSION',
      bridges,
      userAgent,
    }) as { success?: boolean; count?: number; error?: string } | undefined
    if (!response?.success) throw new Error(response?.error || '页面注入脚本未响应')
    return response.count || 0
  } catch {
    try {
      const session: BridgeRuntimeSession = { bridges, userAgent }
      const serialized = bridges.length || userAgent ? JSON.stringify(session) : ''
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'ISOLATED',
        func: (storageKey: string, config: string) => {
          if (config) window.sessionStorage.setItem(storageKey, config)
          else window.sessionStorage.removeItem(storageKey)
        },
        args: [BRIDGE_SESSION_STORAGE_KEY, serialized],
      })
      return bridges.length
    } catch (error) {
      if (!bridges.length) return 0
      throw new Error(`Bridge 配置下发失败：${(error as Error).message}`)
    }
  }
}

/**
 * 向目标 URL 注入 cookies（自动使用当前标签页域名）
 */
async function injectCookies(cookies: Cookie[], targetUrl: string): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0
  let failed = 0
  const errors: string[] = []

  let secure: boolean
  try {
    secure = shouldUseSecureCookie(targetUrl)
  } catch (error) {
    return {
      success: 0,
      failed: cookies.length,
      errors: [(error as Error).message || '无法解析目标 URL'],
    }
  }

  for (const cookie of cookies) {
    try {
      await chrome.cookies.set({
        url: targetUrl,
        name: cookie.name,
        value: cookie.value,
        path: '/',
        secure,
        sameSite: 'lax' as const,
      })
      success++
    } catch (e) {
      failed++
      errors.push(`${cookie.name}: ${(e as Error).message}`)
    }
  }

  return { success, failed, errors }
}

export function startBackground(): void {
  chrome.tabs.onRemoved.addListener(tabId => { void clearDeviceProfile(tabId) })
  chrome.debugger.onDetach.addListener(source => {
    if (source.tabId != null) emulatedTabs.delete(source.tabId)
  })

  // 监听来自 Popup 的消息
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!message || typeof message != 'object' || !('type' in message)) {
      return false
    }
    const msg = message as InjectCookiesMessage

    if (msg.type == 'INJECT_COOKIES') {
      const tabId = msg.tabId ?? sender.tab?.id
      // 设备预设功能正在优化，忽略历史数据和外部消息中的 UA 配置。
      const activeProfile = undefined
      const prepareDevice = activeProfile && tabId != null
        ? applyDeviceProfile(tabId, msg.targetUrl, activeProfile)
        : activeProfile
          ? Promise.reject(new Error('无法获取当前标签页，不能应用设备UA预设'))
          : tabId != null
            ? clearDeviceProfile(tabId)
            : Promise.resolve()
      const prepareBridge = tabId != null
        ? setBridgeSession(tabId, msg.bridges || [])
        : msg.bridges?.length
          ? Promise.reject(new Error('无法获取当前标签页，不能下发 Bridge 配置'))
          : Promise.resolve(0)
      Promise.allSettled([prepareDevice, prepareBridge]).then(async ([deviceResult, bridgeResult]) => {
        if (bridgeResult.status == 'rejected') throw bridgeResult.reason
        const uaError = deviceResult.status == 'rejected' ? (deviceResult.reason as Error).message : undefined
        const result = await injectCookies(msg.cookies, msg.targetUrl)
        sendResponse({
          ...result,
          bridgeSuccess: bridgeResult.value,
          uaSuccess: !!activeProfile,
          uaError,
          errors: uaError ? [...result.errors, `UA 请求头覆盖失败：${uaError}`] : result.errors,
        })
      }).catch(error => {
        sendResponse({ success: 0, failed: msg.cookies.length, bridgeSuccess: 0, errors: [(error as Error).message] })
      })
      return true
    }

    return false
  })

  console.log('[Work DevTools][Cookie Injector] background service worker activated')
}
