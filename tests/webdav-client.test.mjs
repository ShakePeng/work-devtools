import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { afterEach, test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/shared/webdav-client.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const webDavClient = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const {
  getWebDavFileUrl,
  isLegacyWebDavEndpoint,
  normalizeWebDavEndpoint,
  readWebDavFile,
  testWebDavConnection,
  writeWebDavFile,
} = webDavClient

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

const config = {
  endpoint: 'https://webdav.example.com/webdav/work-devtools-sync',
  username: '同步用户',
  password: 'secret',
}

const payload = {
  version: 1,
  updatedAt: 100,
  tools: {
    cookieInjector: {
      persons: [],
      uaInjectionEnabled: false,
      deviceProfiles: [],
      bridgeProviders: [],
      bridgeMethods: [],
      cookiePresetGroups: [],
      cookiePresets: [],
    },
  },
}

test('规范化 WebDAV 目录并生成固定文件地址', () => {
  assert.equal(
    normalizeWebDavEndpoint('https://webdav.example.com/webdav/work-devtools-sync'),
    'https://webdav.example.com/webdav/work-devtools-sync/'
  )
  assert.equal(
    getWebDavFileUrl(config.endpoint),
    'https://webdav.example.com/webdav/work-devtools-sync/work-devtools-sync.json'
  )
  assert.throws(() => normalizeWebDavEndpoint('ftp://webdav.example.com/path'), /HTTP 或 HTTPS/)
})

test('只把旧 Cookie Injector 专用目录识别为待重置连接', () => {
  assert.equal(
    isLegacyWebDavEndpoint('https://webdav.example.com/webdav/cookie-injector-sync/'),
    true
  )
  assert.equal(
    isLegacyWebDavEndpoint('https://webdav.example.com/webdav/my-cookie-injector-sync/'),
    false
  )
  assert.equal(
    isLegacyWebDavEndpoint('https://webdav.example.com/webdav/work-devtools-sync/'),
    false
  )
})

test('使用 PROPFIND 验证目录连接', async () => {
  let request
  globalThis.fetch = async (url, init) => {
    request = { url, init }
    return new Response('', { status: 207 })
  }

  await testWebDavConnection(config)

  assert.equal(request.url, 'https://webdav.example.com/webdav/work-devtools-sync/')
  assert.equal(request.init.method, 'PROPFIND')
  assert.equal(request.init.headers.Depth, '0')
  assert.match(request.init.headers.Authorization, /^Basic /)
})

test('读取并校验远端同步文件', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      ETag: '"version-1"',
      'Last-Modified': 'Fri, 24 Jul 2026 01:00:00 GMT',
    },
  })

  const remote = await readWebDavFile(config)

  assert.deepEqual(remote?.data, {
    ...payload,
    tools: {
      ...payload.tools,
      devAddresses: { projects: [] },
      imageCompressor: {
        settings: {
          defaultEngine: 'local',
          local: { pngOptimizeLevel: 3, jpegQuality: 80, webpQuality: 80, maxEdge: 0 },
        },
      },
    },
  })
  assert.equal(remote?.etag, '"version-1"')
})

test('远端文件不存在时返回 null', async () => {
  globalThis.fetch = async () => new Response('', { status: 404 })
  assert.equal(await readWebDavFile(config), null)
})

test('使用 ETag 条件写入，避免并发覆盖', async () => {
  let request
  globalThis.fetch = async (url, init) => {
    request = { url, init }
    return new Response(null, { status: 204 })
  }

  await writeWebDavFile(config, payload, {
    data: payload,
    etag: '"version-1"',
    lastModified: null,
  })

  assert.equal(request.init.method, 'PUT')
  assert.equal(request.init.headers['If-Match'], '"version-1"')
  assert.equal(request.init.headers['Content-Type'], 'application/json; charset=utf-8')
  assert.deepEqual(JSON.parse(request.init.body), payload)
})

test('首次写入要求远端文件仍不存在', async () => {
  let request
  globalThis.fetch = async (_url, init) => {
    request = init
    return new Response('', { status: 201 })
  }

  await writeWebDavFile(config, payload, null)
  assert.equal(request.headers['If-None-Match'], '*')
})

test('拒绝格式异常的远端同步文件', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ version: 1 }), { status: 200 })
  await assert.rejects(() => readWebDavFile(config), /格式不正确/)
})

test('鉴权失败时返回可操作的错误信息', async () => {
  globalThis.fetch = async () => new Response('', { status: 401 })
  await assert.rejects(() => testWebDavConnection(config), /用户名或密码错误/)
})
