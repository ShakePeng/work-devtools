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

test('24 小时内复用缓存且不发起 GitHub 请求', async () => {
  const now = 1_760_000_000_000
  const storage = createStorage({
    [STORAGE_KEY]: {
      checkedAt: now - RELEASE_CHECK_INTERVAL_MS + 1,
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

test('过期缓存请求最新 Release 并更新独立缓存', async () => {
  const now = 1_760_000_000_000
  const storage = createStorage({
    [STORAGE_KEY]: {
      checkedAt: now - RELEASE_CHECK_INTERVAL_MS,
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
      }
    },
  })

  assert.equal(requestUrl, LATEST_RELEASE_API_URL)
  assert.equal(status.hasUpdate, true)
  assert.equal(storage.values[STORAGE_KEY].checkedAt, now)
  assert.equal(storage.values[STORAGE_KEY].latestVersion, '1.0.2')
})

test('离线和限流时静默保留旧更新提示并延后下一次检查', async () => {
  const now = 1_760_000_000_000
  for (const request of [
    async () => { throw new Error('offline') },
    async () => ({ ok: false, status: 403, json: async () => ({}) }),
  ]) {
    const storage = createStorage({
      [STORAGE_KEY]: {
        checkedAt: now - RELEASE_CHECK_INTERVAL_MS,
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
    assert.equal(storage.values[STORAGE_KEY].checkedAt, now)
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
