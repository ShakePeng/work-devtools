import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/shared/bridgeProfiles.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const { normalizePlatformMode } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('旧平台存在 Bridge 配置时迁移为 Bridge 模式', () => {
  assert.equal(normalizePlatformMode({ bridges: [{ methodId: 'test' }] }), 'bridge')
})

test('旧平台没有 Bridge 配置时迁移为 Cookie 模式', () => {
  assert.equal(normalizePlatformMode({ cookies: [] }), 'cookie')
})

test('已确定的平台模式保持不变', () => {
  assert.equal(normalizePlatformMode({ mode: 'cookie', bridges: [{ methodId: 'test' }] }), 'cookie')
  assert.equal(normalizePlatformMode({ mode: 'bridge', bridges: [] }), 'bridge')
})
