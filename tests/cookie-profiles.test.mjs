import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/shared/cookieProfiles.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const cookieProfiles = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const {
  createDefaultCookiePresetGroups,
  createDefaultCookiePresets,
  normalizePlatformCookies,
} = cookieProfiles

test('内置 Cookie 预设按三个业务分组提供七个可独立选择的 Key', () => {
  const groups = createDefaultCookiePresetGroups(1)
  const presets = createDefaultCookiePresets(1)

  assert.deepEqual(groups.map(group => group.name), ['微信预设', '同程 T 站预设', '艺龙 T 站预设'])
  assert.deepEqual(presets.map(preset => preset.key), [
    'CooperateUser',
    'CooperateWxUser',
    'cookieOpenSource',
    'CooperateTcWxUser',
    'WxUser',
    'cnUser',
    'elongUser',
  ])
  assert.ok(presets.every(preset => preset.defaultValue == 'xxx'))
})

test('旧 Cookie 自动启用并按同名 Key 关联内置预设', () => {
  const presets = createDefaultCookiePresets(1)
  const [cookie] = normalizePlatformCookies([{
    id: 'cookie-1',
    name: 'CooperateUser',
    value: 'custom-value',
  }], presets)

  assert.equal(cookie.enabled, true)
  assert.equal(cookie.value, 'custom-value')
  assert.equal(cookie.presetId, 'builtin-cookie-cooperate-user')
})

test('Cookie 停用状态与自定义 Key 保持不变', () => {
  const presets = createDefaultCookiePresets(1)
  const [cookie] = normalizePlatformCookies([{
    id: 'cookie-2',
    name: 'customKey',
    value: 'custom-value',
    enabled: false,
  }], presets)

  assert.equal(cookie.enabled, false)
  assert.equal(cookie.presetId, undefined)
})

test('平台 Cookie 通过预设 ID 跟随 Key 重命名但保留覆盖值', () => {
  const presets = createDefaultCookiePresets(1).map(preset =>
    preset.id == 'builtin-cookie-cn-user' ? { ...preset, key: 'renamedCnUser' } : preset
  )
  const [cookie] = normalizePlatformCookies([{
    id: 'cookie-3',
    name: 'cnUser',
    value: 'platform-value',
    enabled: true,
    presetId: 'builtin-cookie-cn-user',
  }], presets)

  assert.equal(cookie.name, 'renamedCnUser')
  assert.equal(cookie.value, 'platform-value')
  assert.equal(cookie.presetId, 'builtin-cookie-cn-user')
})
