import {
  type CompressEngine,
  type CompressFormat,
  type CompressInput,
  type CompressOptions,
  type CompressResult,
  formatExtension,
  inferFormatFromMime,
  replaceExtension,
} from './engine'

/**
 * TinyPNG API 端点。官方主域为 api.tinify.com；
 * api.tinify.cn 为面向国内的镜像域名,可能不稳定或不可达,故按序回退。
 */
const TINIFY_ENDPOINTS = [
  'https://api.tinify.com/shrink',
  'https://api.tinify.cn/shrink',
] as const

export interface TinifyEngineConfig {
  apiKeys: string[]
}

async function uploadToTinify(
  endpoint: string,
  input: CompressInput,
  auth: string
): Promise<Response> {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': input.blob.type || 'application/octet-stream',
    },
    body: input.blob,
  })
}

/** TinyPNG 云压缩引擎；支持多把 Key,遇到 429 自动切换下一把。 */
export function createTinifyEngine(config: TinifyEngineConfig): CompressEngine {
  return {
    id: 'tinify',
    async compress(input: CompressInput, _options: CompressOptions): Promise<CompressResult> {
      if (!config.apiKeys.length) throw new Error('未配置 TinyPNG API Key,请先到「图片压缩 设置」填入')

      const beforeBytes = input.blob.size
      const sourceFormat = inferFormatFromMime(input.blob.type)
      const outFormat: CompressFormat = sourceFormat ?? 'image/png'

      const failures: string[] = []
      let usedKeyIndex = -1
      for (let keyIndex = 0; keyIndex < config.apiKeys.length; keyIndex++) {
        const apiKey = config.apiKeys[keyIndex]
        const auth = btoa(`api:${apiKey}`)
        try {
          const uploadRes = await uploadToTinify(TINIFY_ENDPOINTS[0], input, auth)
          // 429 配额耗尽 → 尝试下一把 Key
          if (uploadRes.status == 429) {
            failures.push(`${maskKey(apiKey)} 配额已耗尽`)
            continue
          }
          if (uploadRes.status == 401) {
            failures.push(`${maskKey(apiKey)} 无效`)
            continue
          }
          if (!uploadRes.ok) {
            const text = await uploadRes.text().catch(() => '')
            throw new Error(`TinyPNG 压缩失败:HTTP ${uploadRes.status}${text ? ` - ${text}` : ''}`)
          }

          usedKeyIndex = keyIndex

          // 从响应 header 读取本月已用次数
          const countHeader = uploadRes.headers.get('Compression-Count') || uploadRes.headers.get('compression-count')
          const compressionCount = countHeader ? parseInt(countHeader, 10) : undefined
          const validCount = compressionCount != null && !isNaN(compressionCount) ? compressionCount : undefined

          const meta = await uploadRes.json().catch(() => null) as {
            input?: { size: number; type: string }
            output?: { size: number; type: string; url: string; ratio: number }
            error?: string
            message?: string
          } | null
          if (meta?.error) {
            failures.push(`${maskKey(apiKey)} ${meta.message || meta.error}`)
            continue
          }
          if (!meta?.output?.url) {
            failures.push(`${maskKey(apiKey)} 未返回压缩结果`)
            continue
          }

          const blobRes = await fetch(meta.output.url, {
            headers: { Authorization: `Basic ${auth}` },
          }).catch(error => {
            throw new Error(`下载压缩结果失败:${(error as Error).message}`)
          })
          if (!blobRes.ok) throw new Error(`下载压缩结果失败:HTTP ${blobRes.status}`)
          const blob = await blobRes.blob()

          const resultType = (meta.output.type || blob.type || input.blob.type) as CompressFormat
          const finalType: CompressFormat
            = resultType == 'image/jpeg' || resultType == 'image/webp' || resultType == 'image/png'
              ? resultType
              : outFormat
          const ext = formatExtension(finalType)
          return {
            blob,
            type: finalType,
            name: replaceExtension(input.name || 'image', ext),
            beforeBytes: meta.input?.size ?? beforeBytes,
            afterBytes: meta.output.size ?? blob.size,
            compressionCount: validCount,
            // 透传使用的 Key 索引供调用方更新 usage
            _tinifyKeyIndex: keyIndex,
          } as CompressResult & { _tinifyKeyIndex: number }
        } catch (error) {
          throw error
        }
      }

      throw new Error(
        `所有 TinyPNG API Key 均不可用(${config.apiKeys.length} 把):${failures.join('、')}`
        + '。可前往「图片压缩 → 压缩设置」添加更多 Key。'
      )
    },
  }
}

function maskKey(key: string): string {
  const visible = Math.min(8, Math.floor(key.length / 2))
  return key.length <= 8 ? '***' : key.slice(0, visible) + '***'
}