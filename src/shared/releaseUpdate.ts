export const RELEASE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
export const RELEASES_PAGE_URL = 'https://github.com/ShakePeng/work-devtools/releases'
export const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/ShakePeng/work-devtools/releases/latest'

export interface ReleaseCheckCache {
  checkedAt: number
  latestVersion: string | null
  releaseUrl: string | null
}

export interface ReleaseUpdateStatus {
  currentVersion: string
  latestVersion: string | null
  releaseUrl: string | null
  hasUpdate: boolean
}

export interface ReleaseCheckStorage {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

export type ReleaseRequest = (
  url: string,
  init: RequestInit
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

interface GitHubLatestRelease {
  version: string
  releaseUrl: string
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value == 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/** GitHub tag 和 Chrome 扩展版本统一为三段或四段数字版本。 */
export function normalizeReleaseVersion(value: unknown): string | null {
  if (typeof value != 'string') return null
  const normalized = value.trim().replace(/^v/i, '')
  const parts = normalized.split('.')
  if (parts.length < 3 || parts.length > 4 || parts.some(part => !/^\d+$/.test(part))) {
    return null
  }

  const numbers = parts.map(part => Number(part))
  if (numbers.some(part => !Number.isSafeInteger(part))) return null
  return numbers.join('.')
}

/** 左侧版本较大时返回正数；非法版本返回 null。 */
export function compareReleaseVersions(left: string, right: string): number | null {
  const normalizedLeft = normalizeReleaseVersion(left)
  const normalizedRight = normalizeReleaseVersion(right)
  if (!normalizedLeft || !normalizedRight) return null

  const leftParts = normalizedLeft.split('.').map(Number)
  const rightParts = normalizedRight.split('.').map(Number)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index++) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (difference != 0) return difference
  }
  return 0
}

export function hasNewerRelease(latestVersion: string, currentVersion: string): boolean {
  const comparison = compareReleaseVersions(latestVersion, currentVersion)
  return comparison != null && comparison > 0
}

function getReleaseUrlForTag(tagName: string): string {
  return `${RELEASES_PAGE_URL}/tag/${encodeURIComponent(tagName)}`
}

function getReleaseUrlForVersion(version: string): string {
  return getReleaseUrlForTag(`v${version}`)
}

function normalizeReleaseUrl(value: unknown): string | null {
  if (typeof value != 'string') return null
  try {
    const url = new URL(value)
    const releasesUrl = new URL(RELEASES_PAGE_URL)
    if (url.origin != releasesUrl.origin || !url.pathname.startsWith(`${releasesUrl.pathname}/`)) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

export function normalizeReleaseCheckCache(value: unknown): ReleaseCheckCache | null {
  const cache = toRecord(value)
  if (!cache || typeof cache.checkedAt != 'number' || !Number.isFinite(cache.checkedAt) || cache.checkedAt < 0) {
    return null
  }

  const latestVersion = normalizeReleaseVersion(cache.latestVersion)
  return {
    checkedAt: cache.checkedAt,
    latestVersion,
    releaseUrl: latestVersion
      ? normalizeReleaseUrl(cache.releaseUrl) || getReleaseUrlForVersion(latestVersion)
      : null,
  }
}

export function isReleaseCheckFresh(cache: ReleaseCheckCache | null, now = Date.now()): boolean {
  return !!cache && now - cache.checkedAt < RELEASE_CHECK_INTERVAL_MS
}

/** latest 接口理论上只返回正式版，仍校验响应避免意外展示草稿或预发布版。 */
export function parseGitHubLatestRelease(value: unknown): GitHubLatestRelease | null {
  const release = toRecord(value)
  if (!release || release.draft != false || release.prerelease != false) return null

  const version = normalizeReleaseVersion(release.tag_name)
  if (!version || typeof release.tag_name != 'string') return null
  return {
    version,
    releaseUrl: normalizeReleaseUrl(release.html_url) || getReleaseUrlForTag(release.tag_name),
  }
}

export function getReleaseUpdateStatus(
  cache: ReleaseCheckCache | null,
  currentVersion: string
): ReleaseUpdateStatus {
  const normalizedCurrentVersion = normalizeReleaseVersion(currentVersion) || currentVersion
  const latestVersion = cache?.latestVersion || null
  return {
    currentVersion: normalizedCurrentVersion,
    latestVersion,
    releaseUrl: latestVersion ? cache?.releaseUrl || getReleaseUrlForVersion(latestVersion) : null,
    hasUpdate: !!latestVersion && hasNewerRelease(latestVersion, normalizedCurrentVersion),
  }
}

async function readReleaseCheckCache(
  storage: ReleaseCheckStorage,
  storageKey: string
): Promise<ReleaseCheckCache | null> {
  try {
    const result = await storage.get(storageKey)
    return normalizeReleaseCheckCache(result[storageKey])
  } catch (error) {
    console.warn('[ReleaseUpdate] 读取版本检查缓存失败:', error)
    return null
  }
}

async function writeReleaseCheckCache(
  storage: ReleaseCheckStorage,
  storageKey: string,
  cache: ReleaseCheckCache
): Promise<void> {
  try {
    await storage.set({ [storageKey]: cache })
  } catch (error) {
    console.warn('[ReleaseUpdate] 写入版本检查缓存失败:', error)
  }
}

/**
 * 读取 GitHub 最新正式 Release，并通过独立本机缓存限制为每 24 小时至多请求一次。
 * 请求异常时保留旧缓存的更新提示，界面无需因网络问题展示错误。
 */
export async function checkReleaseUpdate(options: {
  storage: ReleaseCheckStorage
  storageKey: string
  currentVersion: string
  now?: number
  request?: ReleaseRequest
}): Promise<ReleaseUpdateStatus> {
  const now = typeof options.now == 'number' && Number.isFinite(options.now)
    ? options.now
    : Date.now()
  const cached = await readReleaseCheckCache(options.storage, options.storageKey)
  if (isReleaseCheckFresh(cached, now)) {
    return getReleaseUpdateStatus(cached, options.currentVersion)
  }

  try {
    const request = options.request || fetch
    const response = await request(LATEST_RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) throw new Error(`GitHub Release 请求失败（${response.status}）`)

    const latestRelease = parseGitHubLatestRelease(await response.json())
    if (!latestRelease) throw new Error('GitHub Release 响应不是正式版本')

    const nextCache: ReleaseCheckCache = {
      checkedAt: now,
      latestVersion: latestRelease.version,
      releaseUrl: latestRelease.releaseUrl,
    }
    await writeReleaseCheckCache(options.storage, options.storageKey, nextCache)
    return getReleaseUpdateStatus(nextCache, options.currentVersion)
  } catch (error) {
    console.warn('[ReleaseUpdate] 检查最新版本失败:', error)
    const nextCache: ReleaseCheckCache = {
      checkedAt: now,
      latestVersion: cached?.latestVersion || null,
      releaseUrl: cached?.releaseUrl || null,
    }
    await writeReleaseCheckCache(options.storage, options.storageKey, nextCache)
    return getReleaseUpdateStatus(cached, options.currentVersion)
  }
}
