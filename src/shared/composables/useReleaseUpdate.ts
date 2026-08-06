import { computed, ref } from 'vue'
import {
  checkReleaseUpdate,
  type ReleaseUpdateStatus,
} from '@shared/releaseUpdate'
import { STORAGE_KEYS } from '@shared/storageKeys'

export function useReleaseUpdate(currentVersion: string) {
  const status = ref<ReleaseUpdateStatus>({
    currentVersion,
    latestVersion: null,
    releaseUrl: null,
    hasUpdate: false,
  })
  const latestVersion = computed(() => status.value.latestVersion)
  const releaseUrl = computed(() => status.value.releaseUrl)
  const hasUpdate = computed(() => status.value.hasUpdate)

  async function check(): Promise<void> {
    try {
      status.value = await checkReleaseUpdate({
        storage: chrome.storage.local,
        storageKey: STORAGE_KEYS.system.releaseCheck,
        currentVersion,
      })
    } catch (error) {
      // 更新检查不应影响工具加载；保留控制台上下文方便排查浏览器 API 异常。
      console.warn('[ReleaseUpdate] 更新状态初始化失败:', error)
    }
  }

  return {
    currentVersion,
    latestVersion,
    releaseUrl,
    hasUpdate,
    check,
  }
}
