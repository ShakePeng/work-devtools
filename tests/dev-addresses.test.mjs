import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

async function importTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
}

const devAddresses = await importTypeScriptModule('../src/shared/devAddresses.ts')
const managerNavigation = await importTypeScriptModule('../src/shared/managerNavigation.ts')

const {
  buildDevPageUrl,
  mergeDevAddressesData,
  normalizeDevAddressesData,
  normalizeDevBaseUrl,
  normalizeDevPagePath,
  reorderItemsById,
  regenerateDevAddressIds,
} = devAddresses

function createProject(overrides = {}) {
  return {
    id: 'project-1',
    name: '机票项目',
    defaultEnvironmentId: 'env-test',
    environments: [
      { id: 'env-test', name: '测试环境', baseUrl: 'https://dev.example.com/' },
    ],
    pages: [
      { id: 'page-list', name: '列表页', path: 'list?source=dev#top' },
    ],
    ...overrides,
  }
}

test('规范化 HTTP/HTTPS 环境地址并保留端口、path、查询参数和锚点', () => {
  assert.equal(normalizeDevBaseUrl(' https://dev.example.com/ '), 'https://dev.example.com')
  assert.equal(normalizeDevBaseUrl('http://localhost:5173'), 'http://localhost:5173')
  assert.equal(
    normalizeDevBaseUrl('https://dev.example.com/app/?env=test#top'),
    'https://dev.example.com/app?env=test#top'
  )
  assert.throws(() => normalizeDevBaseUrl('ftp://dev.example.com'), /HTTP 或 HTTPS/)
})

test('页面 path 自动补斜杠并保留查询参数和锚点', () => {
  assert.equal(normalizeDevPagePath('list?source=dev#top'), '/list?source=dev#top')
  assert.equal(
    buildDevPageUrl('https://dev.example.com/', '/order/detail?id=1#price'),
    'https://dev.example.com/order/detail?id=1#price'
  )
  assert.equal(
    buildDevPageUrl('https://wx.qa.17u.cn/flightcheckin', '/order/detail'),
    'https://wx.qa.17u.cn/flightcheckin/order/detail'
  )
  assert.equal(
    buildDevPageUrl('https://dev.example.com/app?env=qa#overview', '/detail?id=1#price'),
    'https://dev.example.com/app/detail?env=qa&id=1#price'
  )
  assert.throws(() => normalizeDevPagePath('https://other.example.com/page'), /相对路径/)
})

test('页面 wikiUrl 可选，填写时规范化为完整 HTTP/HTTPS 地址', () => {
  const normalized = normalizeDevAddressesData({
    projects: [createProject({
      pages: [
        { id: 'page-list', name: '列表页', path: '/list', wikiUrl: 'https://wiki.example.com/list' },
      ],
    })],
  })
  assert.equal(normalized.projects[0].pages[0].wikiUrl, 'https://wiki.example.com/list')

  const withoutWiki = normalizeDevAddressesData({ projects: [createProject()] })
  assert.equal(withoutWiki.projects[0].pages[0].wikiUrl, undefined)

  assert.throws(() => normalizeDevAddressesData({
    projects: [createProject({
      pages: [
        { id: 'page-list', name: '列表页', path: '/list', wikiUrl: 'ftp://wiki.example.com' },
      ],
    })],
  }), /Wiki 地址只支持 HTTP 或 HTTPS/)
})

test('旧工作台缺少常用开发地址时补为空数据', () => {
  assert.deepEqual(normalizeDevAddressesData(undefined), { projects: [] })
  assert.throws(() => normalizeDevAddressesData(null), /必须是对象/)
})

test('项目必须包含唯一环境、唯一页面和有效默认环境', () => {
  const normalized = normalizeDevAddressesData({ projects: [createProject()] })
  assert.equal(normalized.projects[0].environments[0].baseUrl, 'https://dev.example.com')
  assert.equal(normalized.projects[0].pages[0].path, '/list?source=dev#top')

  assert.throws(() => normalizeDevAddressesData({
    projects: [createProject({ environments: [] })],
  }), /至少需要一个环境/)
  assert.throws(() => normalizeDevAddressesData({
    projects: [createProject({ defaultEnvironmentId: 'missing' })],
  }), /默认环境不存在/)
  assert.throws(() => normalizeDevAddressesData({
    projects: [createProject({
      pages: [
        { id: 'page-1', name: '列表页', path: '/list' },
        { id: 'page-2', name: '列表页', path: '/other' },
      ],
    })],
  }), /页面名称.*重复/)
})

test('拖拽排序按目标前后重排，并跳过无变化的顺序', () => {
  const items = [
    { id: 'first', name: '第一项' },
    { id: 'second', name: '第二项' },
    { id: 'third', name: '第三项' },
  ]

  assert.deepEqual(
    reorderItemsById(items, 'third', 'first', 'before').map(item => item.id),
    ['third', 'first', 'second']
  )
  assert.deepEqual(
    reorderItemsById(items, 'first', 'third', 'after').map(item => item.id),
    ['second', 'third', 'first']
  )
  assert.equal(reorderItemsById(items, 'first', 'second', 'before'), items)
  assert.equal(reorderItemsById(items, 'missing', 'second', 'after'), items)
})

test('覆盖导入重建全部 ID 并映射默认环境', () => {
  let index = 0
  const regenerated = regenerateDevAddressIds(
    { projects: [createProject()] },
    () => `new-${++index}`
  )
  const project = regenerated.projects[0]
  assert.notEqual(project.id, 'project-1')
  assert.notEqual(project.environments[0].id, 'env-test')
  assert.equal(project.defaultEnvironmentId, project.environments[0].id)
  assert.notEqual(project.pages[0].id, 'page-list')
})

test('合并导入保留同名本机数据并追加缺少的环境和页面', () => {
  let index = 0
  const current = {
    projects: [createProject({ wikiUrl: 'https://wiki.example.com/current' })],
  }
  const incoming = {
    projects: [
      createProject({
        id: 'incoming-project',
        wikiUrl: 'https://wiki.example.com/incoming',
        environments: [
          { id: 'incoming-test', name: '测试环境', baseUrl: 'https://other.example.com' },
          { id: 'incoming-prod', name: '生产环境', baseUrl: 'https://www.example.com' },
        ],
        defaultEnvironmentId: 'incoming-prod',
        pages: [
          { id: 'incoming-list', name: '列表页', path: '/other-list' },
          { id: 'incoming-detail', name: '详情页', path: '/detail' },
        ],
      }),
      createProject({ id: 'project-2', name: '酒店项目' }),
    ],
  }

  const merged = mergeDevAddressesData(current, incoming, () => `merged-${++index}`)
  const project = merged.projects.find(item => item.name == '机票项目')
  assert.equal(merged.projects.length, 2)
  assert.equal(project.wikiUrl, 'https://wiki.example.com/current')
  assert.equal(project.environments.length, 2)
  assert.equal(project.environments.find(item => item.name == '测试环境').baseUrl, 'https://dev.example.com')
  assert.equal(project.pages.length, 2)
  assert.equal(project.pages.find(item => item.name == '列表页').path, '/list?source=dev#top')
})

test('管理页导航仅接受白名单并生成工具深链', () => {
  const { MANAGER_NAV, getManagerPagePath, parseManagerNav } = managerNavigation
  assert.equal(
    parseManagerNav('?nav=dev-addresses%3Aprojects'),
    MANAGER_NAV.devAddressProjects
  )
  assert.equal(parseManagerNav('?nav=unknown'), MANAGER_NAV.cookieData)
  assert.equal(
    getManagerPagePath(MANAGER_NAV.devAddressProjects),
    'manager.html?nav=dev-addresses:projects'
  )
})
