import type { ImageCompressorLocalOptions } from '@shared/types'

export type CompressFormat = 'image/png' | 'image/jpeg' | 'image/webp'

export interface CompressInput {
  /** 浏览器文件对象或 Blob。 */
  blob: Blob
  /** 文件名，缺省从 blob.type 推断扩展名。 */
  name?: string
}

export interface CompressResult {
  /** 压缩后二进制。 */
  blob: Blob
  /** 输出 MIME。 */
  type: CompressFormat
  /** 建议的输出文件名（保留原文件名前缀，更新扩展名）。 */
  name: string
  /** 原始字节大小。 */
  beforeBytes: number
  /** 压缩后字节大小。 */
  afterBytes: number
  /** TinyPNG 云压缩后返回的本月已用次数（本地引擎不返回）。 */
  compressionCount?: number
}

export interface CompressEngine {
  /** 引擎 id；用于 UI 与日志区分。 */
  id: 'local' | 'tinify'
  /** 执行单文件压缩；抛错时给出可读中文 message。 */
  compress(input: CompressInput, options: CompressOptions): Promise<CompressResult>
}

export interface CompressOptions {
  /** 本地引擎参数；Tinify 引擎会忽略除 maxEdge 外的字段。 */
  local: ImageCompressorLocalOptions
  /** TinyPNG 模式下最长边限制；0 表示不限制。 */
  maxEdge?: number
}

export function inferFormatFromMime(mime: string): CompressFormat | null {
  if (mime == 'image/png') return 'image/png'
  if (mime == 'image/jpeg') return 'image/jpeg'
  if (mime == 'image/webp') return 'image/webp'
  return null
}

export function formatExtension(format: CompressFormat): string {
  if (format == 'image/png') return 'png'
  if (format == 'image/jpeg') return 'jpg'
  return 'webp'
}

export function replaceExtension(fileName: string, ext: string): string {
  const dot = fileName.lastIndexOf('.')
  const base = dot > 0 ? fileName.slice(0, dot) : fileName
  return `${base}.${ext}`
}