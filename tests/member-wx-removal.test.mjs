import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const files = await Promise.all([
  readFile(new URL('../src/background/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/popup/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/types/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
])

test('扩展源码不再包含 MemberId 查询消息、入口或加密依赖', () => {
  const source = files.join('\n')
  assert.doesNotMatch(source, /FETCH_MEMBER_WX/)
  assert.doesNotMatch(source, /MemberIdPanel/)
  assert.doesNotMatch(source, /crypto-js/)
})
