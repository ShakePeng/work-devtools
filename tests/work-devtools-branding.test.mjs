import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const [packageJson, wxtSource, managerSource, popupSource, managerHtml, popupHtml, storageKeysSource, dataManagerSource, backupSyncSource, importExportSource, syncSource, devAddressSource, devAddressJsonEditorSource, cookieInjectorJsonEditorSource, jsonEditorDialogSource, uiStyleGuideSource] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../wxt.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/popup/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/entrypoints/manager/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/entrypoints/popup/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/storageKeys.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/UnifiedTreeManager.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/BackupSyncPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/ImportExportPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/SyncPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/DevAddressManager.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/DevAddressJsonEditorDialog.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/CookieInjectorJsonEditorDialog.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/JsonEditorDialog.vue', import.meta.url), 'utf8'),
  readFile(new URL('../docs/ui-style-guide.md', import.meta.url), 'utf8'),
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
  assert.match(devAddressSource, /:draggable="data\.projects\.length > 1 && !sorting"/)
  assert.match(devAddressSource, /@dragstart="startProjectDrag\(\$event, project\.id\)"/)
  assert.match(devAddressSource, /@drop\.prevent="dropProject\(\$event, project\.id\)"/)
  assert.match(devAddressSource, /:draggable="selectedProject\.pages\.length > 1 && !sorting"/)
  assert.match(devAddressSource, /@dragstart="startPageDrag\(\$event, page\.id\)"/)
  assert.match(devAddressSource, /@drop\.prevent="dropPage\(\$event, page\.id\)"/)
})

test('常用开发地址只保留 JSON 按钮并通过独立弹框编辑工具数据', () => {
  assert.equal((devAddressSource.match(/@click="jsonEditorOpen = true"/g) || []).length, 1)
  assert.match(devAddressSource, /<Braces :size="16" \/>JSON/)
  assert.match(devAddressSource, /<DevAddressJsonEditorDialog/)
  assert.match(devAddressSource, /:data="data"/)
  assert.match(devAddressSource, /:save-data="saveData"/)
  assert.doesNotMatch(devAddressSource, /type ViewMode/)
  assert.doesNotMatch(devAddressSource, /常用开发地址编辑模式/)
  assert.doesNotMatch(devAddressSource, /v-model="jsonText"/)
  assert.doesNotMatch(devAddressSource, /view-switch|json-toolbar-button/)

  assert.match(jsonEditorDialogSource, /h-\[80vh\].*max-w-5xl/)
  assert.match(jsonEditorDialogSource, /JSON\.stringify\(props\.data, null, 2\)/)
  assert.match(jsonEditorDialogSource, /import\('codemirror'\)/)
  assert.match(jsonEditorDialogSource, /import\('@codemirror\/lang-json'\)/)
  assert.match(jsonEditorDialogSource, /import\('@codemirror\/lint'\)/)
  assert.match(jsonEditorDialogSource, /import\('@codemirror\/commands'\)/)
  assert.match(jsonEditorDialogSource, /import\('@codemirror\/theme-one-dark'\)/)
  assert.match(jsonEditorDialogSource, /\boneDark,\s*editorLayoutTheme,/)
  assert.doesNotMatch(jsonEditorDialogSource, /backgroundColor: '#020617'|color: '#d1fae5'/)
  assert.match(jsonEditorDialogSource, /linter\(jsonParseLinter\(\)\)/)
  assert.match(jsonEditorDialogSource, /lintGutter\(\)/)
  assert.match(jsonEditorDialogSource, /EditorView\.lineWrapping/)
  assert.match(jsonEditorDialogSource, /event\.key != 'Tab'/)
  assert.match(devAddressJsonEditorSource, /:normalize-data="normalizeDevAddressesData"/)
  assert.match(devAddressJsonEditorSource, /await props\.saveData\(data as DevAddressesData\)/)
  assert.match(devAddressJsonEditorSource, /scope-path="tools\.devAddresses"/)
  assert.match(devAddressJsonEditorSource, /确认覆盖常用开发地址/)
  assert.doesNotMatch(devAddressJsonEditorSource, /parsed\.tools/)

  assert.ok(packageJson.dependencies.codemirror)
  assert.ok(packageJson.dependencies['@codemirror/lang-json'])
  assert.ok(packageJson.dependencies['@codemirror/lint'])
  assert.ok(packageJson.dependencies['@codemirror/commands'])
  assert.ok(packageJson.dependencies['@codemirror/theme-one-dark'])
})

test('常用开发地址 JSON 弹框覆盖编辑、校验和关闭保护', () => {
  assert.match(jsonEditorDialogSource, /function formatJson\(\)/)
  assert.match(jsonEditorDialogSource, /JSON\.stringify\(JSON\.parse\(jsonText\.value\), null, 2\)/)
  assert.match(jsonEditorDialogSource, /function restoreJson\(\)/)
  assert.match(jsonEditorDialogSource, /syntaxError\.value = \(error as Error\)\.message/)
  assert.match(jsonEditorDialogSource, /businessError\.value = \(error as Error\)\.message/)
  assert.match(jsonEditorDialogSource, /overwriteConfirmed\.value = false/)
  assert.match(jsonEditorDialogSource, /window\.confirm\('存在未保存的 JSON 修改，确定关闭吗？'\)/)
  assert.match(jsonEditorDialogSource, /event\.key != 'Escape'/)
  assert.match(jsonEditorDialogSource, /overlayPressOnOverlay = event\.target == event\.currentTarget/)
  assert.match(jsonEditorDialogSource, /emit\('toast', props\.successMessage, 'success'\)\s*emit\('close'\)/)
  assert.match(jsonEditorDialogSource, /保存 JSON 失败/)
})

test('备份与同步保持工作区一级导航，并统一页面级模块纵向间距', () => {
  assert.match(managerSource, /const workspaceNavItems: NavItem\[\]/)
  assert.match(managerSource, /key: 'backup-sync', label: '备份与同步'/)
  assert.match(managerSource, /<div v-else class="h-full overflow-y-auto p-5 lg:p-7">/)
  assert.match(managerSource, /v-if="activeNav == 'backup-sync'"/)
  assert.match(backupSyncSource, /class="manager-surface mb-2 flex w-fit items-center gap-1 p-1.5"/)
  assert.match(importExportSource, /class="grid gap-x-5 gap-y-2 xl:grid-cols-2"/)
  assert.match(importExportSource, /class="mt-2 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-200/)
  assert.match(syncSource, /class="grid gap-x-5 gap-y-2 xl:grid-cols-\[minmax\(0,1\.4fr\)_minmax\(280px,0\.6fr\)\]"/)
  assert.match(syncSource, /class="grid gap-x-5 gap-y-2 xl:grid-cols-\[minmax\(0,1\.35fr\)_minmax\(300px,0\.65fr\)\]"/)
  assert.match(devAddressSource, /class="grid min-h-\[560px\] gap-x-5 gap-y-2 lg:grid-cols-\[280px_minmax\(0,1fr\)\]"/)
  assert.match(devAddressSource, /class="grid gap-x-4 gap-y-2 xl:grid-cols-\[minmax\(0,1fr\)_minmax\(300px,0\.8fr\)\]"/)
  assert.match(devAddressSource, /class="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3/)
  assert.match(uiStyleGuideSource, /页面级纵向相邻的独立模块：`mb-2` 或父容器 `space-y-2`/)
  assert.match(uiStyleGuideSource, /`gap-x-5 gap-y-2`/)
})

test('工具内容采用顶部 Tab 与独立滚动区域', () => {
  assert.match(managerSource, /v-if="activeToolGroup" class="flex h-full min-h-0 flex-col"/)
  assert.match(managerSource, /v-if="activeToolGroup\.children\.length > 1"/)
  assert.match(managerSource, /activeNav == 'cookie-injector:data' \? 'overflow-hidden p-3' : 'overflow-y-auto p-5 lg:p-7'/)
})

test('Cookie Injector 只保留 JSON 按钮并通过独立弹框编辑工具数据', () => {
  assert.doesNotMatch(managerSource, /Cookie Injector 数据/)
  assert.doesNotMatch(managerSource, /stats\.persons/)
  assert.equal((dataManagerSource.match(/@click="jsonEditorOpen = true"/g) || []).length, 1)
  assert.match(dataManagerSource, /<CookieInjectorJsonEditorDialog/)
  assert.match(dataManagerSource, /:data="storageData"/)
  assert.match(dataManagerSource, /:validate-data="normalizeCookieInjectorJsonData"/)
  assert.match(dataManagerSource, /:save-data="saveDataImmediate"/)
  assert.match(dataManagerSource, /return cookieInjector as CookieData/)
  assert.doesNotMatch(dataManagerSource, /type ViewMode|view-switch|v-model="jsonText"/)

  assert.match(cookieInjectorJsonEditorSource, /scope-path="tools\.cookieInjector"/)
  assert.match(cookieInjectorJsonEditorSource, /确认覆盖 Cookie Injector/)
  assert.match(cookieInjectorJsonEditorSource, /Cookie Injector JSON 已保存/)
  assert.match(cookieInjectorJsonEditorSource, /await props\.saveData\(data as CookieData\)/)
  assert.doesNotMatch(dataManagerSource, /全局 JSON/)
  assert.doesNotMatch(cookieInjectorJsonEditorSource, /parsed\.tools\.cookieInjector/)
})

test('Bridge 会话键包含品牌与工具命名空间', () => {
  assert.match(storageKeysSource, /__WORK_DEVTOOLS_COOKIE_INJECTOR_BRIDGE_MOCKS__/)
  assert.doesNotMatch(storageKeysSource, /__COOKIE_INJECTOR_BRIDGE_MOCKS__/)
})
