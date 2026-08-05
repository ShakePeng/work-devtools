import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const [packageJson, wxtSource, managerSource, popupSource, managerHtml, popupHtml, storageKeysSource, dataManagerSource] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../wxt.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/popup/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/entrypoints/manager/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/entrypoints/popup/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/storageKeys.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/UnifiedTreeManager.vue', import.meta.url), 'utf8'),
])

test('扩展品牌统一使用 Work DevTools', () => {
  assert.equal(packageJson.name, 'work-devtools')
  assert.match(wxtSource, /name: 'Work DevTools'/)
  assert.match(wxtSource, /default_title: 'Work DevTools'/)
  assert.match(managerSource, />Work DevTools<\/h1>/)
  assert.match(popupSource, />Work DevTools<\/h1>/)
  assert.match(managerHtml, /<title>Work DevTools - 管理<\/title>/)
  assert.match(popupHtml, /<title>Work DevTools<\/title>/)
})

test('Cookie Injector 作为一级入口并在内容区承载四个功能 Tab', () => {
  assert.match(managerSource, /label: 'Cookie Injector'/)
  const keys = [
    'cookie-injector:data',
    'cookie-injector:cookies',
    'cookie-injector:bridges',
    'cookie-injector:devices',
  ]
  const positions = keys.map(key => managerSource.indexOf(`{ key: '${key}'`))
  assert.ok(positions.every(position => position >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
  assert.match(managerSource, /const activeToolGroup = computed/)
  assert.match(managerSource, /v-for="item in activeToolGroup\.children"/)
  assert.match(managerSource, /:aria-label="`\$\{activeToolGroup\.label\} 功能`"/)
  assert.match(managerSource, /overflow-x-auto/)
  assert.match(managerSource, /:aria-current="activeNav == item\.key \? 'page' : undefined"/)
})

test('点击一级工具固定进入该工具首个页面且左侧不再提供折叠导航', () => {
  assert.match(managerSource, /function selectTool\(group: ToolNavGroup\): void \{\s*selectNav\(group\.children\[0\]\.key\)\s*\}/)
  assert.match(managerSource, /@click="selectTool\(group\)"/)
  assert.doesNotMatch(managerSource, /expandedTools/)
  assert.doesNotMatch(managerSource, /aria-expanded/)
  assert.doesNotMatch(managerSource, /<Transition name="collapse">/)
})

test('常用开发地址作为独立一级工具进入地址管理页', () => {
  assert.match(managerSource, /key: 'dev-addresses'/)
  assert.match(managerSource, /label: '常用开发地址'/)
  assert.match(managerSource, /key: 'dev-addresses:projects'/)
  assert.match(managerSource, /<DevAddressManager/)
})

test('备份与同步保持工作区一级导航', () => {
  assert.match(managerSource, /const workspaceNavItems: NavItem\[\]/)
  assert.match(managerSource, /key: 'backup-sync', label: '备份与同步'/)
  assert.match(managerSource, /<div v-else class="h-full overflow-y-auto p-5 lg:p-7">/)
  assert.match(managerSource, /v-if="activeNav == 'backup-sync'"/)
})

test('工具内容采用顶部 Tab 与独立滚动区域', () => {
  assert.match(managerSource, /v-if="activeToolGroup" class="flex h-full min-h-0 flex-col"/)
  assert.match(managerSource, /v-if="activeToolGroup\.children\.length > 1"/)
  assert.match(managerSource, /activeNav == 'cookie-injector:data' \? 'overflow-hidden p-3' : 'overflow-y-auto p-5 lg:p-7'/)
})

test('侧栏不再固定展示 Cookie Injector 统计，JSON 仅编辑 Cookie Injector 数据', () => {
  assert.doesNotMatch(managerSource, /Cookie Injector 数据/)
  assert.doesNotMatch(managerSource, /stats\.persons/)
  assert.match(dataManagerSource, /JSON\.stringify\(storageData\.value, null, 2\)/)
  assert.match(dataManagerSource, /await saveDataImmediate\(parsed\)/)
  assert.match(dataManagerSource, /const cookieInjector = parsed/)
  assert.match(dataManagerSource, /当前内容对应 tools\.cookieInjector/)
  assert.doesNotMatch(dataManagerSource, /全局 JSON/)
  assert.doesNotMatch(dataManagerSource, /parsed\.tools\.cookieInjector/)
})

test('Bridge 会话键包含品牌与工具命名空间', () => {
  assert.match(storageKeysSource, /__WORK_DEVTOOLS_COOKIE_INJECTOR_BRIDGE_MOCKS__/)
  assert.doesNotMatch(storageKeysSource, /__COOKIE_INJECTOR_BRIDGE_MOCKS__/)
})
