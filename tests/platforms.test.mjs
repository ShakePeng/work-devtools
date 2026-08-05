import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/shared/constants/platforms.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const platformConstants = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const {
  isPlatformName,
  requirePlatformName,
} = platformConstants

test('平台名称支持自由填写并去除首尾空格', () => {
  assert.equal(isPlatformName(' 自定义平台 '), true)
  assert.equal(requirePlatformName(' 自定义平台 '), '自定义平台')
})

test('拒绝空平台名称', () => {
  assert.equal(isPlatformName('   '), false)
  assert.throws(() => requirePlatformName('   '), /请填写平台名称/)
})
