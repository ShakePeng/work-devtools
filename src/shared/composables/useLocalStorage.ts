import { ref, shallowRef, type Ref, onUnmounted } from 'vue'
import type { ChunkMeta, CookieData, DevAddressesData, ImageCompressorData, WorkDevToolsData } from '@shared/types'
import { CURRENT_VERSION, LEGACY_COOKIE_DATA_VERSION } from '@shared/types'
import { normalizeDeviceProfiles } from '@shared/deviceProfiles'
import {
  normalizeBridgeMethods,
  normalizeBridgeProviders,
  normalizePersonBridgeMocks,
} from '@shared/bridgeProfiles'
import {
  normalizeCookiePresetGroups,
  normalizeCookiePresets,
  normalizePersonCookieConfigs,
} from '@shared/cookieProfiles'
import { STORAGE_KEYS } from '@shared/storageKeys'
import { normalizeDevAddressesData } from '@shared/devAddresses'
import { normalizeImageCompressorData } from '@shared/imageCompressor'
import {
  createWorkDevToolsData,
  isLegacyCookieData,
  isWorkDevToolsData,
  resolveWorkDevToolsData,
} from '@shared/workspaceData'

const STORAGE_KEY_SINGLE = STORAGE_KEYS.data
const STORAGE_KEY_LOCAL_MIGRATED = STORAGE_KEYS.localMigrated
const PREVIOUS_STORAGE_KEY_SINGLE = 'work_devtools.cookie_injector.data'
const PREVIOUS_STORAGE_KEY_LOCAL_MIGRATED = 'work_devtools.cookie_injector.local_migrated'
const LEGACY_STORAGE_KEY_META = 'cookie_data_meta'
const LEGACY_STORAGE_KEY_CHUNK = (i: number) => `cookie_data_chunk_${i}`
const LEGACY_STORAGE_KEY_SINGLE = 'cookie_data'
const LEGACY_STORAGE_KEY_LOCAL_MIGRATED = 'cookie_data_local_migrated'
const WRITE_DEBOUNCE_MS = 500

type LegacyCookieData = Partial<CookieData> & {
  version?: number
  updatedAt?: number
  platforms?: any[]
  cookies?: any[]
}

/** 读取旧版 storage.sync 分块数据，仅用于首次迁移。 */
async function readLegacySyncData(): Promise<LegacyCookieData | null> {
  const metaResult = await chrome.storage.sync.get(LEGACY_STORAGE_KEY_META)
  const meta = metaResult[LEGACY_STORAGE_KEY_META] as ChunkMeta | undefined

  if (meta && meta.chunks > 0) {
    const keys = Array.from({ length: meta.chunks }, (_, i) => LEGACY_STORAGE_KEY_CHUNK(i))
    const chunkResult = await chrome.storage.sync.get(keys)
    const fullJson = Array.from(
      { length: meta.chunks },
      (_, i) => chunkResult[LEGACY_STORAGE_KEY_CHUNK(i)] || ''
    ).join('')
    return JSON.parse(fullJson) as LegacyCookieData
  }

  const singleResult = await chrome.storage.sync.get(LEGACY_STORAGE_KEY_SINGLE)
  const singleData = singleResult[LEGACY_STORAGE_KEY_SINGLE]
  return singleData ? JSON.parse(singleData as string) as LegacyCookieData : null
}

async function removeLegacyLocalData(): Promise<void> {
  await chrome.storage.local.remove([
    PREVIOUS_STORAGE_KEY_SINGLE,
    PREVIOUS_STORAGE_KEY_LOCAL_MIGRATED,
    LEGACY_STORAGE_KEY_SINGLE,
    LEGACY_STORAGE_KEY_LOCAL_MIGRATED,
  ])
}

/** Work DevTools 业务数据只写本机，WebDAV 负责跨设备同步。 */
async function writeLocalData(value: WorkDevToolsData): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_SINGLE]: JSON.stringify(value),
    [STORAGE_KEY_LOCAL_MIGRATED]: true,
  })
}

function createDefaultData(): CookieData {
  const bridgeProviders = normalizeBridgeProviders(undefined)
  const cookiePresetGroups = normalizeCookiePresetGroups(undefined)
  return {
    persons: [],
    uaInjectionEnabled: false,
    deviceProfiles: normalizeDeviceProfiles(undefined),
    bridgeProviders,
    bridgeMethods: normalizeBridgeMethods(undefined, bridgeProviders),
    cookiePresetGroups,
    cookiePresets: normalizeCookiePresets(undefined, cookiePresetGroups),
  }
}

function normalizeCookieData(value: LegacyCookieData): CookieData {
  const sourceVersion = typeof value.version == 'number'
    ? value.version
    : LEGACY_COOKIE_DATA_VERSION
  let persons = Array.isArray(value.persons) ? value.persons : []

  // v1 的平台和 Cookie 是根级扁平数组，迁移后统一收进人员层级。
  if (sourceVersion < 2 && Array.isArray(value.platforms) && Array.isArray(value.cookies)) {
    const platformMap = new Map<string, any>()
    for (const platform of value.platforms) {
      platformMap.set(platform.id, {
        id: platform.id,
        name: platform.name,
        mode: platform.mode || 'cookie',
        createdAt: platform.createdAt,
        order: platform.order,
        cookies: [],
      })
    }
    for (const cookie of value.cookies) {
      const parent = platformMap.get(cookie.platformId)
      if (parent) parent.cookies.push({ id: cookie.id, name: cookie.name, value: cookie.value })
    }
    persons = persons.map((person: any) => ({
      id: person.id,
      name: person.name,
      createdAt: person.createdAt,
      order: person.order,
      platforms: value.platforms!
        .filter(platform => platform.personId == person.id)
        .map(platform => platformMap.get(platform.id))
        .filter(Boolean),
    }))
  }

  const deviceProfiles = normalizeDeviceProfiles(value.deviceProfiles)
  const bridgeProviders = normalizeBridgeProviders(value.bridgeProviders)
  const bridgeMethods = normalizeBridgeMethods(value.bridgeMethods, bridgeProviders)
  const cookiePresetGroups = normalizeCookiePresetGroups(value.cookiePresetGroups)
  const cookiePresets = normalizeCookiePresets(value.cookiePresets, cookiePresetGroups)

  return {
    persons: normalizePersonCookieConfigs(
      normalizePersonBridgeMocks(persons, bridgeMethods),
      cookiePresets
    ),
    // 设备 UA 功能仍在优化，保持原有行为：始终关闭注入。
    uaInjectionEnabled: false,
    deviceProfiles,
    bridgeProviders,
    bridgeMethods,
    cookiePresetGroups,
    cookiePresets,
  }
}

function normalizeWorkspaceData(
  value: WorkDevToolsData,
  preserveUpdatedAt = false
): WorkDevToolsData {
  return {
    ...value,
    version: CURRENT_VERSION,
    updatedAt: preserveUpdatedAt && value.updatedAt ? value.updatedAt : Date.now(),
    tools: {
      ...value.tools,
      cookieInjector: normalizeCookieData(value.tools.cookieInjector),
      devAddresses: normalizeDevAddressesData(value.tools.devAddresses),
      imageCompressor: normalizeImageCompressorData(value.tools.imageCompressor),
    },
  }
}

/**
 * Work DevTools 的 chrome.storage.local 读写封装。
 * 业务组件继续只消费 Cookie Injector 数据，持久化统一写入工作台根结构。
 */
export function useLocalStorage() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const defaultData = createDefaultData()
  const defaultWorkspace = createWorkDevToolsData(defaultData)
  const data: Ref<CookieData> = shallowRef(defaultData)
  const devAddresses: Ref<DevAddressesData> = shallowRef(defaultWorkspace.tools.devAddresses)
  const imageCompressor: Ref<ImageCompressorData> = shallowRef(defaultWorkspace.tools.imageCompressor)
  const workspaceData: Ref<WorkDevToolsData> = shallowRef(defaultWorkspace)

  let writeTimer: ReturnType<typeof setTimeout> | null = null
  let pendingWrite: CookieData | null = null
  let _writing = false
  let _stopWatch: (() => void) | null = null

  function startWatchExternal(): void {
    if (_stopWatch) return

    const handler = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName != 'local' || _writing || !changes[STORAGE_KEY_SINGLE]) return
      console.log('[LocalStorage] 检测到外部数据变更，自动刷新')
      loadData().catch(e => console.error('[LocalStorage] 外部刷新失败:', e))
    }

    chrome.storage.onChanged.addListener(handler)
    _stopWatch = () => chrome.storage.onChanged.removeListener(handler)
  }

  function stopWatchExternal(): void {
    _stopWatch?.()
    _stopWatch = null
  }

  onUnmounted(stopWatchExternal)

  /** 从新根键加载，并兼容两代扁平 Cookie Injector 本机键与旧 storage.sync。 */
  async function loadData(): Promise<CookieData> {
    loading.value = true
    error.value = null

    try {
      const localResult = await chrome.storage.local.get([
        STORAGE_KEY_SINGLE,
        STORAGE_KEY_LOCAL_MIGRATED,
        PREVIOUS_STORAGE_KEY_SINGLE,
        PREVIOUS_STORAGE_KEY_LOCAL_MIGRATED,
        LEGACY_STORAGE_KEY_SINGLE,
        LEGACY_STORAGE_KEY_LOCAL_MIGRATED,
      ])
      const currentRaw = localResult[STORAGE_KEY_SINGLE]
      const previousRaw = localResult[PREVIOUS_STORAGE_KEY_SINGLE]
      const legacyRaw = localResult[LEGACY_STORAGE_KEY_SINGLE]
      let rawValue: unknown = null
      let shouldPersist = false

      if (currentRaw) {
        rawValue = JSON.parse(currentRaw as string)
      } else if (previousRaw) {
        rawValue = JSON.parse(previousRaw as string)
        shouldPersist = true
      } else if (legacyRaw) {
        rawValue = JSON.parse(legacyRaw as string)
        shouldPersist = true
      } else if (
        !localResult[STORAGE_KEY_LOCAL_MIGRATED]
        && !localResult[PREVIOUS_STORAGE_KEY_LOCAL_MIGRATED]
        && !localResult[LEGACY_STORAGE_KEY_LOCAL_MIGRATED]
      ) {
        rawValue = await readLegacySyncData()
        shouldPersist = !!rawValue
      }

      const resolved = isLegacyCookieData(rawValue) && !isWorkDevToolsData(rawValue)
        ? createWorkDevToolsData(
            normalizeCookieData(rawValue as LegacyCookieData),
            typeof rawValue.updatedAt == 'number' ? rawValue.updatedAt : 0
          )
        : rawValue
          ? resolveWorkDevToolsData(rawValue)
          : createWorkDevToolsData(createDefaultData())
      if (!resolved) throw new Error('本机 Work DevTools 数据结构不正确')

      const normalized = normalizeWorkspaceData(resolved, true)
      const rawWasWorkspace = isWorkDevToolsData(rawValue)
      const normalizedJson = JSON.stringify(normalized)
      if (!rawWasWorkspace || JSON.stringify(rawValue) != normalizedJson) shouldPersist = true

      if (shouldPersist) {
        await writeLocalData(normalized)
        await removeLegacyLocalData()
        console.log('[LocalStorage] 已将本机数据迁移到 Work DevTools 根数据结构')
      } else if (currentRaw && (previousRaw || legacyRaw)) {
        await removeLegacyLocalData()
      }

      workspaceData.value = normalized
      data.value = normalized.tools.cookieInjector
      devAddresses.value = normalized.tools.devAddresses
      imageCompressor.value = normalized.tools.imageCompressor
      return data.value
    } catch (e) {
      error.value = `加载数据失败: ${(e as Error).message}`
      console.error('loadData error:', e)
      return data.value
    } finally {
      loading.value = false
    }
  }

  async function persistWorkspace(nextData: WorkDevToolsData): Promise<void> {
    workspaceData.value = nextData
    data.value = nextData.tools.cookieInjector
    devAddresses.value = nextData.tools.devAddresses
    imageCompressor.value = nextData.tools.imageCompressor
    try {
      _writing = true
      await writeLocalData(nextData)
    } finally {
      _writing = false
    }
  }

  /** Cookie Injector 业务写入（带防抖）。 */
  async function saveData(newData: CookieData): Promise<void> {
    pendingWrite = normalizeCookieData(newData)
    if (writeTimer) clearTimeout(writeTimer)

    return new Promise((resolve, reject) => {
      writeTimer = setTimeout(async () => {
        writeTimer = null
        const cookieInjector = pendingWrite!
        pendingWrite = null
        const nextWorkspace = normalizeWorkspaceData({
          ...workspaceData.value,
          tools: { ...workspaceData.value.tools, cookieInjector },
        })

        try {
          await persistWorkspace(nextWorkspace)
          resolve()
        } catch (e) {
          error.value = `保存数据失败: ${(e as Error).message}`
          console.error('saveData error:', e)
          reject(e)
        }
      }, WRITE_DEBOUNCE_MS)
    })
  }

  /** 立即写入完整工作台数据，用于导入和 WebDAV 拉取。 */
  async function saveWorkspaceDataImmediate(
    newData: WorkDevToolsData,
    options?: { preserveUpdatedAt?: boolean }
  ): Promise<void> {
    const normalized = normalizeWorkspaceData(newData, options?.preserveUpdatedAt)
    if (writeTimer) {
      clearTimeout(writeTimer)
      writeTimer = null
      pendingWrite = null
    }

    try {
      await persistWorkspace(normalized)
    } catch (e) {
      error.value = `保存数据失败: ${(e as Error).message}`
      console.error('saveData error:', e)
      throw e
    }
  }

  /** 立即写入 Cookie Injector 数据，保留现有业务组合式函数接口。 */
  async function saveDataImmediate(newData: CookieData): Promise<void> {
    await saveWorkspaceDataImmediate({
      ...workspaceData.value,
      tools: {
        ...workspaceData.value.tools,
        cookieInjector: newData,
      },
    })
  }

  /** 立即写入常用开发地址数据。 */
  async function saveDevAddressesImmediate(newData: DevAddressesData): Promise<void> {
    await saveWorkspaceDataImmediate({
      ...workspaceData.value,
      tools: {
        ...workspaceData.value.tools,
        devAddresses: newData,
      },
    })
  }

  /** 立即写入图片压缩设置数据。 */
  async function saveImageCompressorImmediate(newData: ImageCompressorData): Promise<void> {
    await saveWorkspaceDataImmediate({
      ...workspaceData.value,
      tools: {
        ...workspaceData.value.tools,
        imageCompressor: newData,
      },
    })
  }

  /** 清空完整工作台数据，同时阻止旧数据在下次加载时被重新迁回。 */
  async function clearAll(): Promise<void> {
    try {
      _writing = true
      await chrome.storage.local.set({ [STORAGE_KEY_LOCAL_MIGRATED]: true })
      await chrome.storage.local.remove([
        STORAGE_KEY_SINGLE,
        PREVIOUS_STORAGE_KEY_SINGLE,
        PREVIOUS_STORAGE_KEY_LOCAL_MIGRATED,
        LEGACY_STORAGE_KEY_SINGLE,
        LEGACY_STORAGE_KEY_LOCAL_MIGRATED,
      ])
    } finally {
      _writing = false
    }

    const emptyWorkspace = createWorkDevToolsData(createDefaultData(), Date.now())
    workspaceData.value = emptyWorkspace
    data.value = emptyWorkspace.tools.cookieInjector
    devAddresses.value = emptyWorkspace.tools.devAddresses
    imageCompressor.value = emptyWorkspace.tools.imageCompressor
  }

  return {
    data,
    devAddresses,
    imageCompressor,
    workspaceData,
    loading,
    error,
    loadData,
    saveData,
    saveDataImmediate,
    saveDevAddressesImmediate,
    saveImageCompressorImmediate,
    saveWorkspaceDataImmediate,
    clearAll,
    startWatchExternal,
    stopWatchExternal,
  }
}
