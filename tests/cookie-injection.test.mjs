import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL('../src/shared/cookieInjection.ts', import.meta.url),
  'utf8'
)
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const { shouldUseSecureCookie } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
)

test('HTTPS 页面使用 Secure Cookie', () => {
  assert.equal(shouldUseSecureCookie('https://example.com/page'), true)
})

test('HTTP 本地开发页使用普通 Cookie', () => {
  assert.equal(shouldUseSecureCookie('http://localhost:5173/page'), false)
})

test('拒绝向非 HTTP/HTTPS 页面注入 Cookie', () => {
  assert.throws(
    () => shouldUseSecureCookie('chrome://extensions'),
    /Cookie 注入仅支持 HTTP\/HTTPS 页面/
  )
})
