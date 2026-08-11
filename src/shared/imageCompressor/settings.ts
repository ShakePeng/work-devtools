import type {
  ImageCompressorData,
  ImageCompressorEngine,
  ImageCompressorLocalOptions,
  ImageCompressorSettings,
} from '@shared/types'

export const DEFAULT_LOCAL_OPTIONS: ImageCompressorLocalOptions = {
  pngOptimizeLevel: 3,
  jpegQuality: 80,
  webpQuality: 80,
  maxEdge: 0,
}

export const DEFAULT_IMAGE_COMPRESSOR_SETTINGS: ImageCompressorSettings = {
  defaultEngine: 'local',
  local: { ...DEFAULT_LOCAL_OPTIONS },
}

export function createDefaultImageCompressorData(): ImageCompressorData {
  return {
    settings: {
      defaultEngine: 'local',
      local: { ...DEFAULT_LOCAL_OPTIONS },
    },
  }
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value != 'object' || Array.isArray(value)) {
    throw new Error(`${label}必须是对象`)
  }
}

function clampInt(value: unknown, min: number, max: number, label: string): number {
  const num = Number(value)
  if (!Number.isFinite(num)) throw new Error(`${label}必须是数字`)
  const rounded = Math.round(num)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

function normalizeLocalOptions(value: unknown): ImageCompressorLocalOptions {
  assertRecord(value, '本地压缩参数')
  return {
    pngOptimizeLevel: clampInt(value.pngOptimizeLevel, 0, 6, 'PNG 优化级别'),
    jpegQuality: clampInt(value.jpegQuality, 1, 100, 'JPEG 质量'),
    webpQuality: clampInt(value.webpQuality, 1, 100, 'WebP 质量'),
    maxEdge: clampInt(value.maxEdge, 0, 16384, '最长边'),
  }
}

export function normalizeImageCompressorSettings(value: unknown): ImageCompressorSettings {
  assertRecord(value, '图片压缩设置')
  const engineRaw = value.defaultEngine
  const defaultEngine: ImageCompressorEngine
    = engineRaw == 'tinify' || engineRaw == 'local' ? (engineRaw as ImageCompressorEngine) : 'local'
  const rawKeys = value.tinifyApiKeys
  const tinifyApiKeys = Array.isArray(rawKeys)
    ? [...new Set(rawKeys.filter((k: unknown): k is string => typeof k == 'string' && k.trim().length > 0).map((k: string) => k.trim()))]
    : undefined
  const rawUsage = value.tinifyKeyUsage
  const tinifyKeyUsage = Array.isArray(rawUsage)
    ? rawUsage.map((v: unknown) => typeof v == 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0)
    : undefined
  return {
    defaultEngine,
    local: normalizeLocalOptions(value.local ?? DEFAULT_LOCAL_OPTIONS),
    ...(tinifyApiKeys?.length ? { tinifyApiKeys } : {}),
    ...(tinifyKeyUsage?.length ? { tinifyKeyUsage } : {}),
  }
}

/** 缺少工具数据时按旧版本处理；一旦存在则完整校验。 */
export function normalizeImageCompressorData(value: unknown): ImageCompressorData {
  if (typeof value == 'undefined') return createDefaultImageCompressorData()
  assertRecord(value, 'tools.imageCompressor')
  return {
    settings: normalizeImageCompressorSettings(value.settings),
  }
}

export function isImageCompressorData(value: unknown): boolean {
  try {
    normalizeImageCompressorData(value)
    return true
  } catch {
    return false
  }
}