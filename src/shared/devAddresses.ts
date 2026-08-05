import type {
  DevAddressProject,
  DevAddressesData,
  DevEnvironment,
  DevPage,
} from './types'

type IdFactory = () => string

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value != 'object' || Array.isArray(value)) {
    throw new Error(`${label}必须是对象`)
  }
}

function requireText(value: unknown, label: string): string {
  if (typeof value != 'string' || !value.trim()) throw new Error(`${label}不能为空`)
  return value.trim()
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label}「${value}」重复`)
    seen.add(value)
  }
}

export function createDefaultDevAddressesData(): DevAddressesData {
  return { projects: [] }
}

/** 环境保存完整 HTTP/HTTPS 基础地址，可包含端口、path、查询参数和锚点。 */
export function normalizeDevBaseUrl(value: string): string {
  const input = value.trim()
  if (!input) throw new Error('环境域名不能为空')

  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error('环境域名格式不正确，请填写完整的 HTTP/HTTPS 地址')
  }

  if (url.protocol != 'http:' && url.protocol != 'https:') {
    throw new Error('环境域名只支持 HTTP 或 HTTPS')
  }
  if (url.username || url.password) throw new Error('环境域名不能包含用户名或密码')

  const pathname = url.pathname == '/' ? '' : url.pathname.replace(/\/+$/, '')
  return `${url.origin}${pathname}${url.search}${url.hash}`
}

export function normalizeDevPagePath(value: string): string {
  const input = value.trim()
  if (!input) throw new Error('页面 path 不能为空')
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(input)) {
    throw new Error('页面 path 只能填写相对路径')
  }
  if (input.startsWith('/')) return input
  return `/${input}`
}

export function normalizeDevWikiUrl(value?: string): string | undefined {
  const input = value?.trim()
  if (!input) return undefined

  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error('Wiki 地址格式不正确，请填写完整的 HTTP/HTTPS 地址')
  }
  if (url.protocol != 'http:' && url.protocol != 'https:') {
    throw new Error('Wiki 地址只支持 HTTP 或 HTTPS')
  }
  return url.toString()
}

export function buildDevPageUrl(baseUrl: string, path: string): string {
  const base = new URL(normalizeDevBaseUrl(baseUrl))
  const page = new URL(normalizeDevPagePath(path), base.origin)
  const basePath = base.pathname == '/' ? '' : base.pathname.replace(/\/+$/, '')
  base.pathname = `${basePath}${page.pathname}`

  if (page.search) {
    const pageKeys = new Set(page.searchParams.keys())
    pageKeys.forEach(key => base.searchParams.delete(key))
    page.searchParams.forEach((value, key) => base.searchParams.append(key, value))
  }
  if (page.hash) base.hash = page.hash
  return base.toString()
}

function normalizeEnvironment(value: unknown, projectName: string, index: number): DevEnvironment {
  assertRecord(value, `项目「${projectName}」的第 ${index + 1} 个环境`)
  return {
    id: requireText(value.id, `项目「${projectName}」的环境 ID`),
    name: requireText(value.name, `项目「${projectName}」的环境名称`),
    baseUrl: normalizeDevBaseUrl(requireText(value.baseUrl, `项目「${projectName}」的环境域名`)),
  }
}

function normalizePage(value: unknown, projectName: string, index: number): DevPage {
  assertRecord(value, `项目「${projectName}」的第 ${index + 1} 个页面`)
  return {
    id: requireText(value.id, `项目「${projectName}」的页面 ID`),
    name: requireText(value.name, `项目「${projectName}」的页面名称`),
    path: normalizeDevPagePath(requireText(value.path, `项目「${projectName}」的页面 path`)),
  }
}

function normalizeProject(value: unknown, index: number): DevAddressProject {
  assertRecord(value, `第 ${index + 1} 个项目`)
  const name = requireText(value.name, `第 ${index + 1} 个项目名称`)
  if (!Array.isArray(value.environments) || !value.environments.length) {
    throw new Error(`项目「${name}」至少需要一个环境`)
  }
  if (!Array.isArray(value.pages)) throw new Error(`项目「${name}」的 pages 必须是数组`)

  const environments = value.environments.map((item, itemIndex) =>
    normalizeEnvironment(item, name, itemIndex)
  )
  const pages = value.pages.map((item, itemIndex) => normalizePage(item, name, itemIndex))
  assertUnique(environments.map(item => item.id), `项目「${name}」的环境 ID`)
  assertUnique(environments.map(item => item.name), `项目「${name}」的环境名称`)
  assertUnique(pages.map(item => item.id), `项目「${name}」的页面 ID`)
  assertUnique(pages.map(item => item.name), `项目「${name}」的页面名称`)

  const defaultEnvironmentId = requireText(
    value.defaultEnvironmentId,
    `项目「${name}」的默认环境`
  )
  if (!environments.some(item => item.id == defaultEnvironmentId)) {
    throw new Error(`项目「${name}」的默认环境不存在`)
  }

  if (value.wikiUrl != undefined && typeof value.wikiUrl != 'string') {
    throw new Error(`项目「${name}」的 Wiki 地址必须是字符串`)
  }
  if (value.note != undefined && typeof value.note != 'string') {
    throw new Error(`项目「${name}」的备注必须是字符串`)
  }

  const wikiUrl = normalizeDevWikiUrl(value.wikiUrl as string | undefined)
  const note = (value.note as string | undefined)?.trim() || undefined
  return {
    id: requireText(value.id, `项目「${name}」的 ID`),
    name,
    ...(wikiUrl ? { wikiUrl } : {}),
    ...(note ? { note } : {}),
    defaultEnvironmentId,
    environments,
    pages,
  }
}

/** 缺少工具数据时按旧版本处理；一旦存在则完整校验，避免静默丢弃用户地址。 */
export function normalizeDevAddressesData(value: unknown): DevAddressesData {
  if (typeof value == 'undefined') return createDefaultDevAddressesData()
  assertRecord(value, 'tools.devAddresses')
  if (!Array.isArray(value.projects)) throw new Error('tools.devAddresses.projects 必须是数组')

  const projects = value.projects.map(normalizeProject)
  assertUnique(projects.map(item => item.id), '项目 ID')
  assertUnique(projects.map(item => item.name), '项目名称')
  return { projects }
}

export function isDevAddressesData(value: unknown): boolean {
  try {
    normalizeDevAddressesData(value)
    return true
  } catch {
    return false
  }
}

function regenerateProjectIds(project: DevAddressProject, createId: IdFactory): DevAddressProject {
  const environmentIds = new Map<string, string>()
  const environments = project.environments.map(environment => {
    const id = createId()
    environmentIds.set(environment.id, id)
    return { ...environment, id }
  })
  return {
    ...project,
    id: createId(),
    defaultEnvironmentId: environmentIds.get(project.defaultEnvironmentId) || environments[0].id,
    environments,
    pages: project.pages.map(page => ({ ...page, id: createId() })),
  }
}

export function regenerateDevAddressIds(
  value: unknown,
  createId: IdFactory
): DevAddressesData {
  const normalized = normalizeDevAddressesData(value)
  return {
    projects: normalized.projects.map(project => regenerateProjectIds(project, createId)),
  }
}

/** 合并时保留本机同名数据，只追加缺少的项目、环境和页面。 */
export function mergeDevAddressesData(
  currentValue: unknown,
  incomingValue: unknown,
  createId: IdFactory
): DevAddressesData {
  const current = normalizeDevAddressesData(currentValue)
  const incoming = normalizeDevAddressesData(incomingValue)
  const projects = current.projects.map(project => ({
    ...project,
    environments: project.environments.map(environment => ({ ...environment })),
    pages: project.pages.map(page => ({ ...page })),
  }))

  for (const incomingProject of incoming.projects) {
    const existing = projects.find(project => project.name == incomingProject.name)
    if (!existing) {
      projects.push(regenerateProjectIds(incomingProject, createId))
      continue
    }

    const environmentNames = new Set(existing.environments.map(environment => environment.name))
    for (const environment of incomingProject.environments) {
      if (!environmentNames.has(environment.name)) {
        existing.environments.push({ ...environment, id: createId() })
        environmentNames.add(environment.name)
      }
    }

    const pageNames = new Set(existing.pages.map(page => page.name))
    for (const page of incomingProject.pages) {
      if (!pageNames.has(page.name)) {
        existing.pages.push({ ...page, id: createId() })
        pageNames.add(page.name)
      }
    }
  }

  return normalizeDevAddressesData({ projects })
}
