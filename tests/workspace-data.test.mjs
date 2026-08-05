import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({
  configFile: false,
  root: new URL('..', import.meta.url).pathname,
  server: { middlewareMode: true },
  logLevel: 'silent',
})
const {
  isWorkDevToolsData,
  resolveWorkDevToolsData,
} = await vite.ssrLoadModule('/src/shared/workspaceData.ts')
await vite.close()

function createVersionOneWorkspace() {
  return {
    version: 1,
    updatedAt: 1,
    tools: {
      cookieInjector: {
        persons: [
          {
            id: 'person-1',
            name: '测试人员',
            platforms: [
              {
                id: 'platform-1',
                name: '测试平台',
                cookies: [{ id: 'cookie-1' }],
              },
            ],
          },
        ],
      },
    },
  }
}

test('1.0.0 工作台缺少 devAddresses 时保留 Cookie Injector 数据并补空工具数据', () => {
  const versionOneWorkspace = createVersionOneWorkspace()

  assert.equal(isWorkDevToolsData(versionOneWorkspace), false)

  const resolved = resolveWorkDevToolsData(versionOneWorkspace)
  assert.ok(resolved)
  assert.deepEqual(
    resolved.tools.cookieInjector,
    versionOneWorkspace.tools.cookieInjector
  )
  assert.deepEqual(resolved.tools.devAddresses, { projects: [] })
})

test('已提供但结构无效的 devAddresses 不会被当作旧版缺失字段', () => {
  const invalidWorkspace = createVersionOneWorkspace()
  invalidWorkspace.tools.devAddresses = null

  assert.equal(resolveWorkDevToolsData(invalidWorkspace), null)
})
