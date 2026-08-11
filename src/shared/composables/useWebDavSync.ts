import { computed, ref, type Ref } from 'vue'
import type {
  SyncResult,
  SyncStatus,
  WebDavSyncConfig,
  WorkDevToolsData,
} from '@shared/types'
import {
  WEBDAV_FILE_NAME,
  isLegacyWebDavEndpoint,
  normalizeWebDavEndpoint,
  readWebDavFile,
  testWebDavConnection,
  writeWebDavFile,
} from '@shared/webdav-client'
import { STORAGE_KEYS } from '@shared/storageKeys'

const STORAGE_KEY_SYNC_CONFIG = STORAGE_KEYS.webDav.config
const LEGACY_STORAGE_KEY_SYNC_CONFIG = 'webdav_sync_config'
const LEGACY_GIST_CONFIG_KEY = 'gist_sync_config'

/** 示例地址：首次配置时请替换为自己的 WebDAV 专用目录。 */
export const DEFAULT_WEBDAV_ENDPOINT = 'https://webdav.example.com/webdav/work-devtools-sync/'

const DEFAULT_CONFIG: WebDavSyncConfig = {
  endpoint: DEFAULT_WEBDAV_ENDPOINT,
  username: '',
  password: '',
  enabled: false,
}

function stripSensitive(source: WorkDevToolsData): WorkDevToolsData {
  const cloned = JSON.parse(JSON.stringify(source)) as WorkDevToolsData
  if (cloned.tools.imageCompressor?.settings) {
    delete (cloned.tools.imageCompressor.settings as unknown as Record<string, unknown>).tinifyApiKeys
  }
  return cloned
}

async function isSensitiveExportEnabled(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.sensitiveExportEnabled)
    return result[STORAGE_KEYS.sensitiveExportEnabled] == true
  } catch {
    return false
  }
}

export function useWebDavSync(
  data: Ref<WorkDevToolsData>,
  saveDataImmediate: (
    nextData: WorkDevToolsData,
    options?: { preserveUpdatedAt?: boolean }
  ) => Promise<void>
) {
  const config = ref<WebDavSyncConfig>({ ...DEFAULT_CONFIG })
  const status = ref<SyncStatus>({
    syncing: false,
    lastSyncAt: null,
    lastError: null,
    remoteUpdatedAt: null,
  })
  const remoteFileExists = ref<boolean | null>(null)
  const localUpdatedAt = computed(() => data.value.updatedAt || null)

  function isConfigured(): boolean {
    return config.value.enabled
      && !!config.value.endpoint
      && !!config.value.username
      && !!config.value.password
  }

  async function loadConfig(): Promise<WebDavSyncConfig> {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEY_SYNC_CONFIG,
        LEGACY_STORAGE_KEY_SYNC_CONFIG,
      ])
      const currentSaved = result[STORAGE_KEY_SYNC_CONFIG] as Partial<WebDavSyncConfig> | undefined
      const legacySaved = result[LEGACY_STORAGE_KEY_SYNC_CONFIG] as Partial<WebDavSyncConfig> | undefined
      const saved = currentSaved || legacySaved
      if (saved) {
        let endpoint = DEFAULT_WEBDAV_ENDPOINT
        try {
          endpoint = normalizeWebDavEndpoint(
            typeof saved.endpoint == 'string' ? saved.endpoint : DEFAULT_WEBDAV_ENDPOINT
          )
        } catch {
          // 已保存的旧地址无效时回退到默认地址，等待用户重新配置。
        }
        const username = typeof saved.username == 'string' ? saved.username : ''
        const password = typeof saved.password == 'string' ? saved.password : ''
        if (isLegacyWebDavEndpoint(endpoint)) {
          config.value = { ...DEFAULT_CONFIG }
          await chrome.storage.local.remove([
            STORAGE_KEY_SYNC_CONFIG,
            LEGACY_STORAGE_KEY_SYNC_CONFIG,
          ])
        } else {
          config.value = {
            endpoint,
            username,
            password,
            enabled: saved.enabled == true && !!username && !!password,
          }
          if (!currentSaved && legacySaved) {
            await chrome.storage.local.set({ [STORAGE_KEY_SYNC_CONFIG]: config.value })
          }
          if (legacySaved) {
            await chrome.storage.local.remove(LEGACY_STORAGE_KEY_SYNC_CONFIG)
          }
        }
      }

      // 迁移到 WebDAV 后清除本机遗留的 GitHub Token。
      await chrome.storage.local.remove(LEGACY_GIST_CONFIG_KEY)
    } catch (error) {
      console.error('[WebDavSync] loadConfig error:', error)
    }
    return config.value
  }

  async function saveConfig(nextConfig: WebDavSyncConfig): Promise<void> {
    config.value = { ...nextConfig }
    await chrome.storage.local.set({ [STORAGE_KEY_SYNC_CONFIG]: config.value })
  }

  async function testConnection(
    endpoint: string,
    username: string,
    password: string
  ): Promise<SyncResult> {
    status.value.syncing = true
    status.value.lastError = null
    try {
      const candidate = {
        endpoint: normalizeWebDavEndpoint(endpoint),
        username: username.trim(),
        password,
      }
      if (!candidate.username) throw new Error('WebDAV 用户名不能为空')
      if (!candidate.password) throw new Error('WebDAV 密码不能为空')
      await testWebDavConnection(candidate)
      return { success: true, action: 'skip' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      status.value.lastError = message
      console.error('[WebDavSync] testConnection error:', error)
      return { success: false, action: 'skip', error: message }
    } finally {
      status.value.syncing = false
    }
  }

  /** 验证成功后只保存连接，不自动推送或拉取。 */
  async function connect(
    endpoint: string,
    username: string,
    password: string
  ): Promise<SyncResult> {
    status.value.syncing = true
    status.value.lastError = null
    try {
      const nextConfig: WebDavSyncConfig = {
        endpoint: normalizeWebDavEndpoint(endpoint),
        username: username.trim(),
        password,
        enabled: true,
      }
      if (!nextConfig.username) throw new Error('WebDAV 用户名不能为空')
      if (!nextConfig.password) throw new Error('WebDAV 密码不能为空')

      await testWebDavConnection(nextConfig)
      await saveConfig(nextConfig)
      remoteFileExists.value = null
      status.value.remoteUpdatedAt = null
      return { success: true, action: 'skip' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      status.value.lastError = message
      console.error('[WebDavSync] connect error:', error)
      return { success: false, action: 'skip', error: message }
    } finally {
      status.value.syncing = false
    }
  }

  async function refreshRemote(): Promise<SyncResult> {
    if (!isConfigured()) {
      return { success: false, action: 'skip', error: '尚未配置 WebDAV 连接' }
    }

    status.value.syncing = true
    status.value.lastError = null
    try {
      const remote = await readWebDavFile(config.value)
      remoteFileExists.value = !!remote
      status.value.remoteUpdatedAt = remote?.data.updatedAt || null
      return { success: true, action: 'skip' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      status.value.lastError = message
      console.error('[WebDavSync] refreshRemote error:', error)
      return { success: false, action: 'skip', error: message }
    } finally {
      status.value.syncing = false
    }
  }

  async function push(force = false): Promise<SyncResult> {
    if (!isConfigured()) {
      return { success: false, action: 'push', error: '尚未配置 WebDAV 连接' }
    }

    status.value.syncing = true
    status.value.lastError = null
    try {
      const remote = await readWebDavFile(config.value)
      remoteFileExists.value = !!remote
      status.value.remoteUpdatedAt = remote?.data.updatedAt || null

      const localUpdatedAt = data.value.updatedAt || Date.now()
      if (!force && remote && remote.data.updatedAt > localUpdatedAt) {
        return { success: true, action: 'skip', error: '远端数据更新，已跳过推送' }
      }

      const nextData: WorkDevToolsData = {
        ...data.value,
        updatedAt: localUpdatedAt,
      }
      let payload = nextData
      if (!(await isSensitiveExportEnabled())) {
        payload = stripSensitive(nextData)
      }
      await writeWebDavFile(config.value, payload, remote)
      remoteFileExists.value = true
      status.value.lastSyncAt = Date.now()
      status.value.remoteUpdatedAt = localUpdatedAt
      return { success: true, action: 'push' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      status.value.lastError = message
      console.error('[WebDavSync] push error:', error)
      return { success: false, action: 'push', error: message }
    } finally {
      status.value.syncing = false
    }
  }

  async function pull(force = false): Promise<SyncResult> {
    if (!isConfigured()) {
      return { success: false, action: 'pull', error: '尚未配置 WebDAV 连接' }
    }

    status.value.syncing = true
    status.value.lastError = null
    try {
      const remote = await readWebDavFile(config.value)
      remoteFileExists.value = !!remote
      if (!remote) {
        status.value.remoteUpdatedAt = null
        return { success: false, action: 'pull', error: 'WebDAV 中暂无同步文件，请先推送' }
      }

      status.value.remoteUpdatedAt = remote.data.updatedAt
      const localUpdatedAt = data.value.updatedAt || 0
      if (!force && remote.data.updatedAt <= localUpdatedAt) {
        return { success: true, action: 'skip' }
      }

      await saveDataImmediate(
        remote.data,
        { preserveUpdatedAt: true }
      )
      status.value.lastSyncAt = Date.now()
      return { success: true, action: 'pull' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      status.value.lastError = message
      console.error('[WebDavSync] pull error:', error)
      return { success: false, action: 'pull', error: message }
    } finally {
      status.value.syncing = false
    }
  }

  async function disconnect(): Promise<void> {
    await chrome.storage.local.remove([
      STORAGE_KEY_SYNC_CONFIG,
      LEGACY_STORAGE_KEY_SYNC_CONFIG,
    ])
    config.value = { ...DEFAULT_CONFIG }
    remoteFileExists.value = null
    status.value = {
      syncing: false,
      lastSyncAt: null,
      lastError: null,
      remoteUpdatedAt: null,
    }
  }

  async function init(): Promise<void> {
    await loadConfig()
  }

  async function checkRemoteNewer(): Promise<boolean> {
    if (!isConfigured()) return false
    const remote = await readWebDavFile(config.value)
    remoteFileExists.value = !!remote
    status.value.remoteUpdatedAt = remote?.data.updatedAt || null
    return !!remote && remote.data.updatedAt > (data.value.updatedAt || 0)
  }

  async function checkLocalNewer(): Promise<boolean> {
    if (!isConfigured()) return false
    const remote = await readWebDavFile(config.value)
    remoteFileExists.value = !!remote
    status.value.remoteUpdatedAt = remote?.data.updatedAt || null
    return !!remote && (data.value.updatedAt || 0) > remote.data.updatedAt
  }

  return {
    config,
    status,
    remoteFileExists,
    localUpdatedAt,
    remoteFileName: WEBDAV_FILE_NAME,
    testConnection,
    connect,
    disconnect,
    push,
    pull,
    init,
    refreshRemote,
    checkRemoteNewer,
    checkLocalNewer,
  }
}

export type WebDavSyncApi = ReturnType<typeof useWebDavSync>
