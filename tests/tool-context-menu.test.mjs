import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const [wxtSource, backgroundSource, managerSource, popupSource, devManagerSource] = await Promise.all([
  readFile(new URL('../wxt.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/background/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/popup/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/manager/components/DevAddressManager.vue', import.meta.url), 'utf8'),
])

test('扩展图标右键菜单注册两个工具入口', () => {
  assert.match(wxtSource, /'contextMenus'/)
  assert.match(backgroundSource, /id: 'work-devtools:cookie-injector'/)
  assert.match(backgroundSource, /title: 'Cookie Injector'/)
  assert.match(backgroundSource, /id: 'work-devtools:dev-addresses'/)
  assert.match(backgroundSource, /title: '常用开发地址'/)
  assert.match(backgroundSource, /contexts: \['action'\]/)
  assert.match(backgroundSource, /chrome\.runtime\.onInstalled\.addListener/)
  assert.match(backgroundSource, /chrome\.contextMenus\.removeAll\(\)/)
  assert.match(backgroundSource, /getManagerPagePath\(item\.nav\)/)
})

test('管理页使用白名单深链且 Popup 固定进入 Cookie Injector', () => {
  assert.match(managerSource, /parseManagerNav\(window\.location\.search\)/)
  assert.match(managerSource, /url\.searchParams\.set\('nav', nav\)/)
  assert.match(popupSource, /getManagerPagePath\(MANAGER_NAV\.cookieData\)/)
  assert.match(popupSource, /chrome\.runtime\.getManifest\(\)\.version/)
})

test('常用页面支持复制和跳转，Wiki 同时支持复制和打开', () => {
  assert.match(devManagerSource, /buildDevPageUrl\(environment\.baseUrl, page\.path\)/)
  assert.match(devManagerSource, /复制完整地址/)
  assert.match(devManagerSource, /async function openPageAddress\(page: DevPage\)[\s\S]*chrome\.tabs\.create\(\{ url \}\)/)
  assert.match(devManagerSource, /@click="openPageAddress\(page\)"[\s\S]*跳转/)
  assert.match(devManagerSource, /copyWiki\(selectedProject\)/)
  assert.match(devManagerSource, /openWiki\(selectedProject\)/)
})

test('新建项目默认包含健康检查页面', () => {
  assert.match(devManagerSource, /pages: current\?\.pages\.map[\s\S]*name: '健康检查', path: '\/health'/)
})

test('项目详情平铺展示环境并通过单选框切换默认环境', () => {
  assert.match(devManagerSource, /v-for="environment in selectedProject\.environments"/)
  assert.match(devManagerSource, /type="radio"[\s\S]*name="current-environment"/)
  assert.match(devManagerSource, /@change="changeDefaultEnvironment\(environment\.id\)"/)
  assert.doesNotMatch(devManagerSource, /<select[\s\S]*@change="changeDefaultEnvironment"/)
})
