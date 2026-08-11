import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const [
  packageJson,
  wxtSource,
  backgroundSource,
  managerSource,
  typesSource,
  compressorComposeSource,
  compressorSettingsSource,
  importExportSource,
  workspaceDataSource,
  useLocalStorageSource,
  tinifyEngineSource,
  storageKeysSource,
  engineSource,
  settingsSource,
  managerNavSource,
  webDavSyncSource,
  backupSyncPanelSource,
] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../wxt.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/background/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/types/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/ImageCompressorCompose.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/ImageCompressorSettings.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/composables/useImportExport.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/workspaceData.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/composables/useLocalStorage.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/imageCompressor/tinifyEngine.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/storageKeys.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/imageCompressor/engine.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/imageCompressor/settings.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/managerNavigation.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/shared/composables/useWebDavSync.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/BackupSyncPanel.vue', import.meta.url), 'utf8'),
])

test('package.json 声明图片压缩运行依赖', () => {
  assert.ok(packageJson.dependencies['@jsquash/png'])
  assert.ok(packageJson.dependencies['@jsquash/jpeg'])
  assert.ok(packageJson.dependencies['@jsquash/webp'])
  assert.ok(packageJson.dependencies['@jsquash/oxipng'])
  assert.ok(packageJson.dependencies.jszip)
})

test('Manifest 允许 WASM 并把 wasm 列入 web_accessible_resources,同时放行 TinyPNG API 连接', () => {
  assert.match(wxtSource, /web_accessible_resources:/)
  assert.match(wxtSource, /resources:\s*\['assets\/\*\.wasm'\]/)
  assert.match(wxtSource, /wasm-unsafe-eval/)
  assert.match(wxtSource, /connect-src 'self' https:\/\/api\.tinify\.com https:\/\/api\.tinify\.cn/)
  assert.match(wxtSource, /optimizeDeps:/)
  assert.match(wxtSource, /'@jsquash\/png'/)
})

test('导航注册图片压缩深链', () => {
  assert.match(managerNavSource, /imageCompressor:\s*'image-compressor:compress'/)
  assert.match(managerNavSource, /imageCompressorSettings:\s*'image-compressor:settings'/)
})

test('扩展图标右键菜单新增图片压缩入口', () => {
  assert.match(backgroundSource, /id: 'work-devtools:image-compressor'/)
  assert.match(backgroundSource, /title: '图片压缩'/)
  assert.match(backgroundSource, /nav: MANAGER_NAV\.imageCompressor/)
})

test('管理页注册图片压缩一级工具并按 nav 渲染对应组件', () => {
  assert.match(managerSource, /key: 'image-compressor'/)
  assert.match(managerSource, /label: '图片压缩'/)
  assert.match(managerSource, /key: 'image-compressor:compress'/)
  assert.match(managerSource, /key: 'image-compressor:settings'/)
  assert.match(managerSource, /<ImageCompressorCompose/)
  assert.match(managerSource, /<ImageCompressorSettings/)
  assert.match(managerSource, /:settings="imageCompressor\.settings"/)
  assert.match(managerSource, /:save-settings="saveImageCompressorImmediate"/)
})

test('根数据版本升级到 3 并包含 imageCompressor 类型与多 Key 字段', () => {
  assert.match(typesSource, /export const CURRENT_VERSION = 3/)
  assert.match(typesSource, /export interface ImageCompressorData/)
  assert.match(typesSource, /tinifyApiKeys\?: string\[\]/)
  assert.match(typesSource, /imageCompressor: ImageCompressorData/)
})

test('workspaceData 默认结构与缺失补全均纳入 imageCompressor', () => {
  assert.match(workspaceDataSource, /import \{[\s\S]*?createDefaultImageCompressorData[\s\S]*?\} from '\.\/imageCompressor'/)
  assert.match(workspaceDataSource, /imageCompressor: normalizeImageCompressorData\(data\.tools\.imageCompressor\)/)
  assert.match(workspaceDataSource, /imageCompressor: ImageCompressorData = createDefaultImageCompressorData\(\)/)
})

test('useLocalStorage 暴露 imageCompressor ref 与即时保存函数', () => {
  assert.match(useLocalStorageSource, /imageCompressor: Ref<ImageCompressorData>/)
  assert.match(useLocalStorageSource, /imageCompressor\.value = normalized\.tools\.imageCompressor/)
  assert.match(useLocalStorageSource, /saveImageCompressorImmediate\(newData: ImageCompressorData\)/)
})

test('图片压缩设置源码声明默认值与多 Key 规范化', () => {
  assert.match(settingsSource, /pngOptimizeLevel: 3/)
  assert.match(settingsSource, /jpegQuality: 80/)
  assert.match(settingsSource, /defaultEngine: 'local'/)
  assert.match(settingsSource, /tinifyApiKeys = Array\.isArray\(rawKeys\)/)
  assert.match(settingsSource, /new Set\(rawKeys\.filter/)
  assert.match(settingsSource, /normalizeImageCompressorSettings\(value: unknown\)/)
})

test('引擎接口提供格式推断与扩展名工具函数', () => {
  assert.match(engineSource, /export function inferFormatFromMime/)
  assert.match(engineSource, /export function formatExtension/)
  assert.match(engineSource, /export function replaceExtension/)
  assert.match(engineSource, /export interface CompressResult/)
})

test('tinifyEngine 支持多 Key 轮换并在 429/401 时自动切换下一把并读取 quota', () => {
  assert.match(tinifyEngineSource, /apiKeys: string\[\]/)
  assert.match(tinifyEngineSource, /for \(let keyIndex = 0; keyIndex < config\.apiKeys\.length; keyIndex\+\+\)/)
  assert.match(tinifyEngineSource, /if \(uploadRes\.status == 429\)/)
  assert.match(tinifyEngineSource, /配额已耗尽/)
  assert.match(tinifyEngineSource, /Compression-Count/)
  assert.match(tinifyEngineSource, /compressionCount: validCount/)
  assert.match(tinifyEngineSource, /_tinifyKeyIndex: keyIndex/)
  assert.match(tinifyEngineSource, /maskKey\(apiKey\)/)
})

test('压缩页支持批量、压缩、单张下载与 zip 打包并显示 Key 数量', () => {
  assert.match(compressorComposeSource, /import JSZip from 'jszip'/)
  assert.match(compressorComposeSource, /@drop="onDrop"/)
  assert.match(compressorComposeSource, /type="file"[^>]*multiple/)
  assert.match(compressorComposeSource, /downloadSelectedZip/)
  assert.match(compressorComposeSource, /compressAll/)
  assert.match(compressorComposeSource, /createTinifyEngine/)
  assert.match(compressorComposeSource, /打包下载选中/)
  assert.match(compressorComposeSource, /tinifyKeys/)
  assert.match(compressorComposeSource, /apiKeys: tinifyKeys\.value/)
  assert.match(compressorComposeSource, /已配置 \$\{tinifyKeys\.length\} 把 API Key/)
})

test('设置页提供多 Key 列表增删与引擎参数表单', () => {
  assert.match(compressorSettingsSource, /v-model="defaultEngine"/)
  assert.match(compressorSettingsSource, /v-model\.number="local\.pngOptimizeLevel"/)
  assert.match(compressorSettingsSource, /v-model\.number="local\.jpegQuality"/)
  assert.match(compressorSettingsSource, /v-model="tinifyApiKeys\[index\]"/)
  assert.match(compressorSettingsSource, /添加 Key/)
  assert.match(compressorSettingsSource, /addKey\(\)/)
  assert.match(compressorSettingsSource, /removeKey\(index\)/)
  assert.match(compressorSettingsSource, /保存设置/)
})

test('导入导出通过 stripSensitive 按开关剥离 Key,默认不含', () => {
  assert.match(importExportSource, /function stripSensitive/)
  assert.match(importExportSource, /delete \(cloned\.tools\.imageCompressor\.settings as unknown as Record<string, unknown>\)\.tinifyApiKeys/)
  assert.match(importExportSource, /exportJson\(opts\?: \{ includeSensitive\?: boolean \}\)/)
  assert.match(importExportSource, /isSensitiveExportEnabled/)
  assert.match(importExportSource, /normalizeImageCompressorData\(importData\.tools\.imageCompressor\)/)
})

test('WebDAV 同步遵循敏感信息开关(strip 替换 inject)', () => {
  assert.match(webDavSyncSource, /function stripSensitive/)
  assert.match(webDavSyncSource, /stripSensitive\(nextData\)/)
  assert.match(webDavSyncSource, /isSensitiveExportEnabled\(\)/)
  assert.doesNotMatch(webDavSyncSource, /collectSensitiveInfo/)
  assert.doesNotMatch(webDavSyncSource, /extractSensitiveInfo/)
})

test('备份与同步页提供独立敏感信息开关模块,默认关闭', () => {
  assert.match(backupSyncPanelSource, /sensitiveExportEnabled = ref\(false\)/)
  assert.match(backupSyncPanelSource, /toggleSensitiveExport\(\)/)
  assert.match(backupSyncPanelSource, /导出敏感信息/)
  assert.match(backupSyncPanelSource, /STORAGE_KEYS\.sensitiveExportEnabled/)
  assert.match(backupSyncPanelSource, /chrome\.storage\.local\.set/)
})