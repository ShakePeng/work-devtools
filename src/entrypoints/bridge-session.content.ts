import type { SetBridgeSessionMessage } from '@shared/types'
import { BRIDGE_SESSION_STORAGE_KEY, type BridgeRuntimeSession } from '@shared/bridgeRuntime'

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  main() {
    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!message || typeof message != 'object' || !('type' in message)) return false
      const msg = message as SetBridgeSessionMessage
      if (msg.type != 'SET_BRIDGE_SESSION') return false

      try {
        if (msg.bridges.length || msg.userAgent) {
          const session: BridgeRuntimeSession = {
            bridges: msg.bridges,
            userAgent: msg.userAgent,
          }
          window.sessionStorage.setItem(BRIDGE_SESSION_STORAGE_KEY, JSON.stringify(session))
        } else {
          window.sessionStorage.removeItem(BRIDGE_SESSION_STORAGE_KEY)
        }
        sendResponse({ success: true, count: msg.bridges.length })
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message })
      }
      return false
    })
  },
})
