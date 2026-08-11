import { ref } from 'vue'
import type {
  CookieData,
  ImportPreview,
  ImportResult,
  Person,
  Platform,
  Cookie,
  WorkDevToolsData,
} from '@shared/types'
import { CURRENT_VERSION } from '@shared/types'
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
import {
  mergeDevAddressesData,
  regenerateDevAddressIds,
} from '@shared/devAddresses'
import {
  createDefaultImageCompressorData,
  normalizeImageCompressorData,
} from '@shared/imageCompressor'
import { STORAGE_KEYS } from '@shared/storageKeys'
import { nanoid } from 'nanoid'
import { resolveWorkDevToolsData } from '@shared/workspaceData'

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

export function useImportExport(data: { value: WorkDevToolsData }) {
  const importPreview = ref<ImportPreview | null>(null)
  const importError = ref<string | null>(null)

  /** 验证导入数据的基本结构 */
  function validateCookieData(obj: unknown): obj is CookieData {
    if (!obj || typeof obj != 'object') return false
    const d = obj as Record<string, unknown>
    if (!Array.isArray(d.persons)) return false

    // 验证 person
    for (const p of d.persons) {
      if (!p || typeof p != 'object') return false
      const person = p as Record<string, unknown>
      if (typeof person.id != 'string' || typeof person.name != 'string') return false

      // 验证嵌套的 platforms
      if (!Array.isArray(person.platforms)) return false
      for (const pl of person.platforms) {
        if (!pl || typeof pl != 'object') return false
        const platform = pl as Record<string, unknown>
        if (typeof platform.id != 'string' || typeof platform.name != 'string') return false

        // 验证嵌套的 cookies
        if (!Array.isArray(platform.cookies)) return false
        for (const c of platform.cookies) {
          if (!c || typeof c != 'object') return false
          const cookie = c as Record<string, unknown>
          if (typeof cookie.id != 'string') return false
        }
      }
    }

    return (!d.deviceProfiles || Array.isArray(d.deviceProfiles))
      && (!d.bridgeProviders || Array.isArray(d.bridgeProviders))
      && (!d.bridgeMethods || Array.isArray(d.bridgeMethods))
      && (!d.cookiePresetGroups || Array.isArray(d.cookiePresetGroups))
      && (!d.cookiePresets || Array.isArray(d.cookiePresets))
  }

  /** 新文件使用 Work DevTools 根结构；旧扁平备份仍允许导入并自动包裹。 */
  function validateStructure(obj: unknown): boolean {
    const resolved = resolveWorkDevToolsData(obj, true)
    return !!resolved && validateCookieData(resolved.tools.cookieInjector)
  }

  /** 解析 JSON 文件并产生预览 */
  function previewFile(json: string): ImportPreview | null {
    importError.value = null
    importPreview.value = null

    try {
      const parsed = JSON.parse(json)
      const resolved = resolveWorkDevToolsData(parsed, true)
      if (!resolved || !validateCookieData(resolved.tools.cookieInjector)) {
        importError.value = 'JSON 数据结构不合法，请检查文件格式'
        return null
      }

      const cookieInjector = resolved.tools.cookieInjector

      const preview: ImportPreview = {
        persons: cookieInjector.persons.length,
        platforms: cookieInjector.persons.reduce((sum: number, p: Person) => sum + (p.platforms?.length || 0), 0),
        cookies: cookieInjector.persons.reduce((sum: number, p: Person) =>
          sum + (p.platforms || []).reduce((s: number, pl: Platform) => s + (pl.cookies?.length || 0), 0)
        , 0),
        projects: resolved.tools.devAddresses.projects.length,
        pages: resolved.tools.devAddresses.projects.reduce(
          (sum, project) => sum + project.pages.length,
          0
        ),
        data: resolved,
      }

      importPreview.value = preview
      return preview
    } catch (e) {
      importError.value = `无法解析 JSON: ${(e as Error).message}`
      return null
    }
  }

  /** 执行覆盖导入：重新生成所有 ID */
  function buildOverwriteData(importData: WorkDevToolsData): WorkDevToolsData {
    const importedCookieData = importData.tools.cookieInjector
    const bridgeProviders = normalizeBridgeProviders(importedCookieData.bridgeProviders)
    const bridgeMethods = normalizeBridgeMethods(importedCookieData.bridgeMethods, bridgeProviders)
    const cookiePresetGroups = normalizeCookiePresetGroups(importedCookieData.cookiePresetGroups)
    const cookiePresets = normalizeCookiePresets(importedCookieData.cookiePresets, cookiePresetGroups)
    const persons: Person[] = normalizePersonCookieConfigs(
      normalizePersonBridgeMocks(importedCookieData.persons, bridgeMethods),
      cookiePresets
    ).map(p => ({
      ...p,
      id: nanoid(),
      platforms: (p.platforms || []).map(pl => ({
        ...pl,
        id: nanoid(),
        cookies: (pl.cookies || []).map(c => ({
          ...c,
          id: nanoid(),
        })),
      })),
    }))

    return {
      version: CURRENT_VERSION,
      updatedAt: Date.now(),
      tools: {
        ...importData.tools,
        cookieInjector: {
          persons,
          uaInjectionEnabled: false,
          deviceProfiles: normalizeDeviceProfiles(importedCookieData.deviceProfiles),
          bridgeProviders,
          bridgeMethods,
          cookiePresetGroups,
          cookiePresets,
        },
        devAddresses: regenerateDevAddressIds(importData.tools.devAddresses, nanoid),
        imageCompressor: normalizeImageCompressorData(importData.tools.imageCompressor),
      },
    }
  }

  /** 执行合并导入 */
  function mergeData(importData: WorkDevToolsData): WorkDevToolsData {
    const importOverwritten = buildOverwriteData(importData)
    const currentCookieData = data.value.tools.cookieInjector
    const importedCookieData = importOverwritten.tools.cookieInjector
    const bridgeProviders = mergeBridgeProviders(currentCookieData.bridgeProviders, importedCookieData.bridgeProviders)
    const bridgeMethods = mergeBridgeMethods(currentCookieData.bridgeMethods, importedCookieData.bridgeMethods, bridgeProviders)
    const cookiePresetGroups = mergeCookiePresetGroups(currentCookieData.cookiePresetGroups, importedCookieData.cookiePresetGroups)
    const cookiePresets = mergeCookiePresets(currentCookieData.cookiePresets, importedCookieData.cookiePresets, cookiePresetGroups)
    const devAddresses = mergeDevAddressesData(
      data.value.tools.devAddresses,
      importData.tools.devAddresses,
      nanoid
    )

    // 合并：保留现有数据，追加新数据（同名人员跳过，同名平台跳过）
    const existingPersonNames = new Set(currentCookieData.persons.map(p => p.name))

    const newPersons = importedCookieData.persons.filter(p => {
      const keep = !existingPersonNames.has(p.name)
      if (!keep) {
        // 同名人员：尝试合并其下的新平台
        const existing = currentCookieData.persons.find(ep => ep.name == p.name)
        if (existing) {
          const existingPlatformNames = new Set(existing.platforms.map(pl => pl.name))
          const newPlatforms = p.platforms.filter(pl => !existingPlatformNames.has(pl.name))
          existing.platforms.push(...newPlatforms)
        }
      }
      return keep
    })

    return {
      version: CURRENT_VERSION,
      updatedAt: Date.now(),
      tools: {
        ...data.value.tools,
        cookieInjector: {
          persons: [...currentCookieData.persons, ...newPersons],
          uaInjectionEnabled: false,
          deviceProfiles: mergeDeviceProfiles(
            currentCookieData.deviceProfiles,
            importData.tools.cookieInjector.deviceProfiles
          ),
          bridgeProviders,
          bridgeMethods,
          cookiePresetGroups,
          cookiePresets,
        },
        devAddresses,
        imageCompressor: normalizeImageCompressorData(importData.tools.imageCompressor),
      },
    }
  }

  function mergeDeviceProfiles(current: CookieData['deviceProfiles'], incoming: CookieData['deviceProfiles'] | undefined) {
    const profiles = new Map(normalizeDeviceProfiles(current).map(profile => [profile.id, profile]))
    normalizeDeviceProfiles(incoming).forEach(profile => {
      if (!profiles.has(profile.id)) profiles.set(profile.id, profile)
    })
    return [...profiles.values()]
  }

  function mergeBridgeProviders(current: CookieData['bridgeProviders'], incoming: CookieData['bridgeProviders'] | undefined) {
    const providers = new Map(normalizeBridgeProviders(current).map(provider => [provider.id, provider]))
    normalizeBridgeProviders(incoming).forEach(provider => {
      if (!providers.has(provider.id)) providers.set(provider.id, provider)
    })
    return [...providers.values()]
  }

  function mergeBridgeMethods(
    current: CookieData['bridgeMethods'],
    incoming: CookieData['bridgeMethods'] | undefined,
    providers: CookieData['bridgeProviders']
  ) {
    const methods = new Map(normalizeBridgeMethods(current, providers).map(method => [method.id, method]))
    normalizeBridgeMethods(incoming, providers).forEach(method => {
      if (!methods.has(method.id)) methods.set(method.id, method)
    })
    return [...methods.values()]
  }

  function mergeCookiePresetGroups(
    current: CookieData['cookiePresetGroups'],
    incoming: CookieData['cookiePresetGroups'] | undefined
  ) {
    const groups = new Map(normalizeCookiePresetGroups(current).map(group => [group.id, group]))
    normalizeCookiePresetGroups(incoming).forEach(group => {
      if (!groups.has(group.id)) groups.set(group.id, group)
    })
    return [...groups.values()]
  }

  function mergeCookiePresets(
    current: CookieData['cookiePresets'],
    incoming: CookieData['cookiePresets'] | undefined,
    groups: CookieData['cookiePresetGroups']
  ) {
    const presets = new Map(normalizeCookiePresets(current, groups).map(preset => [preset.id, preset]))
    normalizeCookiePresets(incoming, groups).forEach(preset => {
      if (!presets.has(preset.id)) presets.set(preset.id, preset)
    })
    return [...presets.values()]
  }

  /** 导出为 JSON 字符串；includeSensitive 为 false 时剥离 TinyPNG API Key。 */
  function exportJson(opts?: { includeSensitive?: boolean }): string {
    const source = opts?.includeSensitive ? data.value : stripSensitive(data.value)
    return JSON.stringify(source, null, 2)
  }

  /** 触发 JSON 文件下载；按本机敏感信息开关决定是否携带 API Key。 */
  async function downloadJson(opts?: { includeSensitive?: boolean }): Promise<void> {
    const includeSensitive = opts?.includeSensitive ?? await isSensitiveExportEnabled()
    const json = exportJson({ includeSensitive })
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const now = new Date().toISOString().slice(0, 10)
    a.download = `work-devtools-backup-${now}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    importPreview,
    importError,
    previewFile,
    buildOverwriteData,
    mergeData,
    exportJson,
    downloadJson,
    validateStructure,
  }
}
