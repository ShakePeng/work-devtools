import type { WebDavSyncConfig, WorkDevToolsData } from '@shared/types'

export const WEBDAV_FILE_NAME = 'work-devtools-sync.json'

export interface WebDavRemoteFile {
  data: WorkDevToolsData
  etag: string | null
  lastModified: string | null
}

type WebDavCredentials = Pick<WebDavSyncConfig, 'endpoint' | 'username' | 'password'>

function isWorkDevToolsData(value: unknown): value is WorkDevToolsData {
  if (!value || typeof value != 'object') return false
  const root = value as Record<string, unknown>
  if (typeof root.version != 'number' || typeof root.updatedAt != 'number') return false
  if (!root.tools || typeof root.tools != 'object') return false
  const cookieInjector = (root.tools as Record<string, unknown>).cookieInjector
  if (!cookieInjector || typeof cookieInjector != 'object') return false
  const data = cookieInjector as Record<string, unknown>
  if (!Array.isArray(data.persons)) return false
  for (const personValue of data.persons) {
    if (!personValue || typeof personValue != 'object') return false
    const person = personValue as Record<string, unknown>
    if (typeof person.id != 'string' || typeof person.name != 'string') return false
    if (!Array.isArray(person.platforms)) return false
    for (const platformValue of person.platforms) {
      if (!platformValue || typeof platformValue != 'object') return false
      const platform = platformValue as Record<string, unknown>
      if (typeof platform.id != 'string' || typeof platform.name != 'string') return false
      if (!Array.isArray(platform.cookies)) return false
      for (const cookieValue of platform.cookies) {
        if (!cookieValue || typeof cookieValue != 'object') return false
        const cookie = cookieValue as Record<string, unknown>
        if (typeof cookie.id != 'string') return false
      }
    }
  }
  return (!data.deviceProfiles || Array.isArray(data.deviceProfiles))
    && (!data.bridgeProviders || Array.isArray(data.bridgeProviders))
    && (!data.bridgeMethods || Array.isArray(data.bridgeMethods))
    && (!data.cookiePresetGroups || Array.isArray(data.cookiePresetGroups))
    && (!data.cookiePresets || Array.isArray(data.cookiePresets))
}

function encodeBasicAuth(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ''
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function authHeaders(config: WebDavCredentials): HeadersInit {
  return {
    Authorization: `Basic ${encodeBasicAuth(config.username, config.password)}`,
  }
}

export function normalizeWebDavEndpoint(value: string): string {
  const input = value.trim()
  if (!input) throw new Error('WebDAV 目录地址不能为空')

  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error('WebDAV 目录地址格式不正确')
  }

  if (url.protocol != 'https:' && url.protocol != 'http:') {
    throw new Error('WebDAV 目录地址只支持 HTTP 或 HTTPS')
  }

  url.search = ''
  url.hash = ''
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
  return url.toString()
}

export function isLegacyWebDavEndpoint(value: string): boolean {
  try {
    const url = new URL(normalizeWebDavEndpoint(value))
    const pathSegments = url.pathname.split('/').filter(Boolean)
    return pathSegments.at(-1) == 'cookie-injector-sync'
  } catch {
    return false
  }
}

export function getWebDavFileUrl(endpoint: string): string {
  return new URL(WEBDAV_FILE_NAME, normalizeWebDavEndpoint(endpoint)).toString()
}

async function responseError(action: string, response: Response): Promise<Error> {
  if (response.status == 401) return new Error(`${action}失败：用户名或密码错误`)
  if (response.status == 403) return new Error(`${action}失败：当前用户没有目录读写权限`)
  if (response.status == 404) return new Error(`${action}失败：WebDAV 目录不存在`)
  if (response.status == 409) return new Error(`${action}失败：请先在 NAS 中创建专用同步目录`)
  if (response.status == 412) return new Error('远端文件已被其他设备更新，请刷新远端状态后重试')

  let detail = ''
  try {
    detail = (await response.text()).replace(/\s+/g, ' ').trim().slice(0, 200)
  } catch {
    // 响应正文不是定位失败的必要条件，保留状态码即可。
  }
  return new Error(`${action}失败 (${response.status})${detail ? `：${detail}` : ''}`)
}

function networkError(action: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  const cause = error instanceof Error && error.cause
    ? `；${error.cause instanceof Error ? error.cause.message : String(error.cause)}`
    : ''
  return new Error(`${action}失败：${message}${cause}`)
}

async function request(
  action: string,
  url: string,
  init: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    throw networkError(action, error)
  }
}

/** 验证目录和账号权限，不读取或改写同步文件。 */
export async function testWebDavConnection(config: WebDavCredentials): Promise<void> {
  const endpoint = normalizeWebDavEndpoint(config.endpoint)
  const response = await request('测试 WebDAV 连接', endpoint, {
    method: 'PROPFIND',
    headers: {
      ...authHeaders(config),
      Depth: '0',
    },
  })

  if (response.ok || response.status == 207) return
  throw await responseError('测试 WebDAV 连接', response)
}

/** 读取远端同步文件；文件尚未创建时返回 null。 */
export async function readWebDavFile(config: WebDavCredentials): Promise<WebDavRemoteFile | null> {
  const response = await request('读取 WebDAV 同步文件', getWebDavFileUrl(config.endpoint), {
    method: 'GET',
    headers: authHeaders(config),
    cache: 'no-store',
  })

  if (response.status == 404) return null
  if (!response.ok) throw await responseError('读取 WebDAV 同步文件', response)

  let raw: unknown
  try {
    raw = await response.json()
  } catch {
    throw new Error('WebDAV 同步文件不是有效的 JSON')
  }
  if (!isWorkDevToolsData(raw)) throw new Error('WebDAV 同步文件格式不正确')

  return {
    data: raw,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  }
}

/**
 * 使用 WebDAV 条件写入避免静默覆盖：
 * - 远端不存在时要求仍不存在；
 * - 远端存在时优先按 ETag 匹配，兼容无 ETag 服务时再使用修改时间。
 */
export async function writeWebDavFile(
  config: WebDavCredentials,
  data: WorkDevToolsData,
  remote: WebDavRemoteFile | null
): Promise<void> {
  const headers: Record<string, string> = {
    ...authHeaders(config) as Record<string, string>,
    'Content-Type': 'application/json; charset=utf-8',
  }

  if (!remote) {
    headers['If-None-Match'] = '*'
  } else if (remote.etag) {
    headers['If-Match'] = remote.etag
  } else if (remote.lastModified) {
    headers['If-Unmodified-Since'] = remote.lastModified
  }

  const response = await request('写入 WebDAV 同步文件', getWebDavFileUrl(config.endpoint), {
    method: 'PUT',
    headers,
    body: JSON.stringify(data, null, 2),
  })

  if (!response.ok) throw await responseError('写入 WebDAV 同步文件', response)
}
