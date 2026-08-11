import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

async function importTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
}

function createStorage(initial = {}) {
  const values = { ...initial }
  const writes = []
  return {
    values,
    writes,
    async get(key) {
      return { [key]: values[key] }
    },
    async set(next) {
      writes.push(next)
      Object.assign(values, next)
    },
  }
}

async function withoutWarnings(callback) {
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    return await callback()
  } finally {
    console.warn = originalWarn
  }
}

const releaseUpdate = await importTypeScriptModule('../src/shared/releaseUpdate.ts')
const [managerSource, popupSource, storageKeysSource, composableSource, releaseUpdateSource] = await Promise.all([
  readFile(new URL('../src/manager/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/popup/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/storageKeys.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/composables/useReleaseUpdate.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/releaseUpdate.ts', import.meta.url), 'utf8'),
])

const {
  LATEST_RELEASE_API_URL,
  RELEASE_CHECK_INTERVAL_MS,
  checkReleaseUpdate,
  compareReleaseVersions,
  getReleaseUpdateStatus,
  hasNewerRelease,
  normalizeReleaseVersion,
  parseGitHubLatestRelease,
} = releaseUpdate

const STORAGE_KEY = 'work_devtools.system.release_check'
const RELEASE_URL = 'https://github.com/ShakePeng/work-devtools/releases/tag/v1.0.2'

test('版本比较接受 Release tag，拒绝非法版本', () => {
  assert.equal(normalizeReleaseVersion(' v1.0.2 '), '1.0.2')
  assert.equal(normalizeReleaseVersion('1.0.2.3'), '1.0.2.3')
  assert.equal(normalizeReleaseVersion('1.0'), null)
  assert.equal(normalizeReleaseVersion('v1.0.2-beta'), null)
  assert.equal(normalizeReleaseVersion(102), null)
  assert.equal(compareReleaseVersions('1.0.10', '1.0.2'), 8)
  assert.equal(compareReleaseVersions('1.0.2', '1.0.2.0'), 0)
  assert.equal(compareReleaseVersions('bad', '1.0.2'), null)
  assert.equal(hasNewerRelease('v1.0.3', '1.0.2'), true)
  assert.equal(getReleaseUpdateStatus({
    checkedAt: 0,
    latestVersion: '1.0.0',
    releaseUrl: 'https://github.com/ShakePeng/work-devtools/releases/tag/v1.0.0',
  }, '1.0.1').hasUpdate, false)
})

test('仅解析最新正式 GitHub Release', () => {
  assert.deepEqual(parseGitHubLatestRelease({
    tag_name: 'v1.0.2',
    html_url: RELEASE_URL,
    draft: false,
    prerelease: false,
  }), {
    version: '1.0.2',
    releaseUrl: RELEASE_URL,
  })
  assert.equal(parseGitHubLatestRelease({
    tag_name: 'v1.0.2',
    draft: true,
    prerelease: false,
  }), null)
  assert.equal(parseGitHubLatestRelease({
    tag_name: 'v1.0.2',
    draft: false,
    prerelease: true,
  }), null)
})

test('INTERVAL=0 表示每次打开都发请求，缓存仅用于初始展示与携带 ETag', () => {
  assert.equal(RELEASE_CHECK_INTERVAL_MS, 0)
})

test('缓存新鲜时跳过请求直接返回缓存状态（仅用于未来时间戳的边界场景）', async () => {
  const now = 1_760_000_000_000
  const storage = createStorage({
    [STORAGE_KEY]: {
      checkedAt: now + 1, // 未来时间 → 新鲜
      latestVersion: '1.0.2',
      releaseUrl: RELEASE_URL,
    },
  })
  let requestCount = 0

  const status = await checkReleaseUpdate({
    storage,
    storageKey: STORAGE_KEY,
    currentVersion: '1.0.1',
    now,
    request: async () => {
      requestCount++
      throw new Error('不应请求')
    },
  })

  assert.equal(requestCount, 0)
  assert.equal(status.hasUpdate, true)
  assert.equal(status.latestVersion, '1.0.2')
})

test('打开管理页即发请求并更新缓存（INTERVAL=0 下应当总是请求）', async () => {
  const now = 1_760_000_000_000
  const initialCheckedAt = now - 1000
  const storage = createStorage({
    [STORAGE_KEY]: {
      checkedAt: initialCheckedAt,
      latestVersion: '1.0.1',
      releaseUrl: 'https://github.com/ShakePeng/work-devtools/releases/tag/v1.0.1',
    },
  })
  let requestUrl = ''

  const status = await checkReleaseUpdate({
    storage,
    storageKey: STORAGE_KEY,
    currentVersion: '1.0.1',
    now,
    request: async (url) => {
      requestUrl = url
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v1.0.2',
          html_url: RELEASE_URL,
          draft: false,
          prerelease: false,
        }),
        headers: new Headers({ etag: 'W/"abc123"' }),
      }
    },
  })

  assert.equal(requestUrl, LATEST_RELEASE_API_URL)
  assert.equal(status.hasUpdate, true)
  assert.equal(status.latestVersion, '1.0.2')
  assert.equal(storage.values[STORAGE_KEY].checkedAt, now)
  assert.equal(storage.values[STORAGE_KEY].latestVersion, '1.0.2')
  assert.equal(storage.values[STORAGE_KEY].etag, 'W/"abc123"')
})

test('缓存携带 ETag 时下次请求带 If-None-Match header', async () => {
  const now = 1_760_000_000_000
  const storage = createStorage({
    [STORAGE_KEY]: {
      checkedAt: now - 1000,
      latestVersion: '1.0.2',
      releaseUrl: RELEASE_URL,
      etag: 'W/"prev-etag"',
    },
  })
  let receivedHeaders = null

  await checkReleaseUpdate({
    storage,
    storageKey: STORAGE_KEY,
    currentVersion: '1.0.1',
    now,
    request: async (url, init) => {
      receivedHeaders = init.headers
      return {
        ok: true,
        status: 304,
        json: async () => ({}),
        headers: new Headers(),
      }
    },
  })

  assert.ok(receivedHeaders)
  assert.equal(receivedHeaders['If-None-Match'], 'W/"prev-etag"')
})

test('GitHub 304 时保留旧版本提示，仅更新 checkedAt 与 etag（不计入限流配额）', async () => {
  const now = 1_760_000_000_000
  const initialCheckedAt = now - 1000
  const storage = createStorage({
    [STORAGE_KEY]: {
      checkedAt: initialCheckedAt,
      latestVersion: '1.0.2',
      releaseUrl: RELEASE_URL,
      etag: 'W/"old"',
    },
  })
  let jsonCalled = false

  const status = await checkReleaseUpdate({
    storage,
    storageKey: STORAGE_KEY,
    currentVersion: '1.0.1',
    now,
    request: async () => ({
      ok: true,
      status: 304,
      json: async () => { jsonCalled = true; return {} },
      headers: new Headers({ etag: 'W/"new"' }),
    }),
  })

  // 304 不应调用 json()（响应没有 body）
  assert.equal(jsonCalled, false)
  assert.equal(status.hasUpdate, true)
  assert.equal(status.latestVersion, '1.0.2')
  assert.equal(status.releaseUrl, RELEASE_URL)
  assert.equal(storage.values[STORAGE_KEY].checkedAt, now)
  assert.equal(storage.values[STORAGE_KEY].latestVersion, '1.0.2')
  assert.equal(storage.values[STORAGE_KEY].etag, 'W/"new"')
})

test('请求失败时不更新 checkedAt，下次打开可立即重试', async () => {
  const now = 1_760_000_000_000
  const initialCheckedAt = now - 1000
  for (const request of [
    async () => { throw new Error('offline') },
    async () => ({ ok: false, status: 403, json: async () => ({}), headers: new Headers() }),
  ]) {
    const storage = createStorage({
      [STORAGE_KEY]: {
        checkedAt: initialCheckedAt,
        latestVersion: '1.0.2',
        releaseUrl: RELEASE_URL,
      },
    })

    const status = await withoutWarnings(() => checkReleaseUpdate({
      storage,
      storageKey: STORAGE_KEY,
      currentVersion: '1.0.1',
      now,
      request,
    }))

    assert.equal(status.hasUpdate, true)
    assert.equal(status.latestVersion, '1.0.2')
    // 失败路径保留旧 checkedAt，不写 now
    assert.equal(storage.values[STORAGE_KEY].checkedAt, initialCheckedAt)
    assert.equal(storage.values[STORAGE_KEY].latestVersion, '1.0.2')
  }
})

test('版本入口、更新条和缓存键均独立于工作区数据', () => {
  assert.match(storageKeysSource, /system:\s*\{[\s\S]*releaseCheck: 'work_devtools\.system\.release_check'/)
  assert.match(composableSource, /STORAGE_KEYS\.system\.releaseCheck/)
  assert.match(managerSource, /const extensionVersion = chrome\.runtime\.getManifest\(\)\.version/)
  assert.match(managerSource, /插件版本/)
  assert.match(managerSource, /v-if="hasUpdate"/)
  assert.match(managerSource, /发现 v\{\{ latestVersion \}\}/)
  assert.doesNotMatch(managerSource, /v-if="releaseUpdate\.hasUpdate"/)
  assert.match(managerSource, /@click="openReleases"/)
  assert.match(popupSource, /const extensionVersion = chrome\.runtime\.getManifest\(\)\.version/)
  assert.match(popupSource, /v-if="hasUpdate"/)
  assert.match(popupSource, /发现新版本 v\{\{ latestVersion \}\}/)
  assert.doesNotMatch(popupSource, /v-if="releaseUpdate\.hasUpdate"/)
  assert.match(popupSource, /@click="openLatestRelease"/)
  assert.doesNotMatch(releaseUpdateSource, /WorkDevToolsData|workspaceData|WebDav/)
})