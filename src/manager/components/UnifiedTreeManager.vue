<script setup lang="ts">
import { computed, inject, nextTick, ref, shallowRef, watch, type Ref } from 'vue'
import {
  type BridgeMethodDefinition,
  type BridgeProvider,
  type Cookie,
  type CookieData,
  type CookiePresetDefinition,
  type CookiePresetGroup,
  type DeviceProfile,
  type Person,
  type Platform,
  type PlatformBridgeMock,
  type PlatformMode,
} from '@shared/types'
import { normalizeDeviceProfiles } from '@shared/deviceProfiles'
import {
  normalizeBridgeMethods,
  normalizeBridgeProviders,
  normalizePersonBridgeMocks,
  normalizePlatformBridges,
  normalizePlatformMode,
} from '@shared/bridgeProfiles'
import {
  normalizeCookiePresetGroups,
  normalizeCookiePresets,
  normalizePersonCookieConfigs,
  normalizePlatformCookies,
} from '@shared/cookieProfiles'
import { requirePlatformName } from '@shared/constants/platforms'
import {
  Braces, ClipboardPaste, KeyRound, LayoutPanelLeft, Monitor, MoreHorizontal,
  Plus, Search, Users, X,
} from 'lucide-vue-next'
import CookieInjectorJsonEditorDialog from './CookieInjectorJsonEditorDialog.vue'
import DataManagerNavigation from './DataManagerNavigation.vue'
import DataManagerContent from './DataManagerContent.vue'
import EntityEditorDrawer from './EntityEditorDrawer.vue'
import type {
  EditorState, EditorSubmitPayload, SearchResult, Selection,
} from './data-manager-types'

const personsApi = inject<any>('personsApi')!
const platformsApi = inject<any>('platformsApi')!
const cookiesApi = inject<any>('cookiesApi')!
const deviceProfilesApi = inject<{ available: () => DeviceProfile[]; find: (id?: string) => DeviceProfile | undefined; isUaInjectionEnabled: () => boolean }>('deviceProfilesApi')!
const bridgeProfilesApi = inject<{ providers: () => BridgeProvider[]; methods: () => BridgeMethodDefinition[] }>('bridgeProfilesApi')!
const cookieProfilesApi = inject<{ groups: () => CookiePresetGroup[]; presets: () => CookiePresetDefinition[] }>('cookieProfilesApi')!
const showToast = inject<(message: string, type: 'success' | 'error' | 'warning') => void>('showToast', () => {})
const storageData = inject<Ref<CookieData>>('storageData')!
const saveDataImmediate = inject<(data: CookieData) => Promise<void>>(
  'saveDataImmediate',
  async () => {}
)

type DeleteTarget = {
  type: 'person' | 'platform' | 'cookie'
  id: string
  label: string
  personId?: string
  platformId?: string
}

const selection = ref<Selection>(null)
const expandedPersons = ref<Set<string>>(new Set())
const mobileNavOpen = ref(false)
const searchQuery = ref('')
const searchFocused = ref(false)
const pageMenuOpen = ref(false)
const highlightCookieId = ref<string | null>(null)

const editorState = shallowRef<EditorState | null>(null)
const editorError = ref<string | null>(null)
const editorSaving = ref(false)
const editorConfirmation = ref<{ title: string; message: string; action: () => Promise<void> } | null>(null)
const deleteTarget = ref<DeleteTarget | null>(null)
const jsonEditorOpen = ref(false)

const persons = computed<Person[]>(() => personsApi.list())
const uaInjectionEnabled = computed(() => deviceProfilesApi.isUaInjectionEnabled())
const deviceProfiles = computed<DeviceProfile[]>(() => deviceProfilesApi.available())
const bridgeProviders = computed<BridgeProvider[]>(() => bridgeProfilesApi.providers())
const bridgeMethods = computed<BridgeMethodDefinition[]>(() => bridgeProfilesApi.methods())
const cookiePresetGroups = computed<CookiePresetGroup[]>(() => cookieProfilesApi.groups())
const cookiePresets = computed<CookiePresetDefinition[]>(() => cookieProfilesApi.presets())
const selectedPerson = computed<Person | null>(() => {
  if (!selection.value) return null
  return persons.value.find(person => person.id === selection.value?.personId) || null
})
const selectedPlatform = computed<Platform | null>(() => {
  const currentSelection = selection.value
  if (currentSelection?.type !== 'platform') return null
  return selectedPerson.value?.platforms.find(platform => platform.id === currentSelection.platformId) || null
})

const totals = computed(() => {
  let platforms = 0
  let cookies = 0
  persons.value.forEach(person => {
    platforms += person.platforms.length
    person.platforms.forEach(platform => { cookies += platform.cookies.length })
  })
  return { persons: persons.value.length, platforms, cookies }
})

const searchGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const groups: { persons: SearchResult[]; platforms: SearchResult[]; cookies: SearchResult[] } = {
    persons: [], platforms: [], cookies: [],
  }
  if (!query) return groups

  for (const person of persons.value) {
    if (person.name.toLowerCase().includes(query) && groups.persons.length < 5) {
      groups.persons.push({ type: 'person', person })
    }
    for (const platform of person.platforms) {
      if (platform.name.toLowerCase().includes(query) && groups.platforms.length < 6) {
        groups.platforms.push({ type: 'platform', person, platform })
      }
      for (const cookie of platform.cookies) {
        if ((cookie.name.toLowerCase().includes(query) || cookie.value.toLowerCase().includes(query)) && groups.cookies.length < 8) {
          groups.cookies.push({ type: 'cookie', person, platform, cookie })
        }
      }
    }
  }
  return groups
})

const hasSearchResults = computed(() =>
  searchGroups.value.persons.length + searchGroups.value.platforms.length + searchGroups.value.cookies.length > 0
)

watch(
  persons,
  current => {
    if (current.length === 0) {
      selection.value = null
      return
    }
    if (!selection.value || !current.some(person => person.id === selection.value?.personId)) {
      selection.value = { type: 'person', personId: current[0].id }
      expandedPersons.value = new Set([current[0].id])
    }
  },
  { immediate: true }
)

function togglePerson(personId: string) {
  const next = new Set(expandedPersons.value)
  if (next.has(personId)) next.delete(personId)
  else next.add(personId)
  expandedPersons.value = next
}

function expandPerson(personId: string) {
  if (expandedPersons.value.has(personId)) return
  expandedPersons.value = new Set([...expandedPersons.value, personId])
}

function selectPerson(personId: string) {
  selection.value = { type: 'person', personId }
  mobileNavOpen.value = false
}

function selectPlatform(personId: string, platformId: string) {
  expandPerson(personId)
  selection.value = { type: 'platform', personId, platformId }
  mobileNavOpen.value = false
}

async function selectSearchResult(result: SearchResult) {
  searchFocused.value = false
  searchQuery.value = ''
  if (result.type === 'person') {
    expandPerson(result.person.id)
    selectPerson(result.person.id)
    return
  }
  if (result.type === 'platform') {
    selectPlatform(result.person.id, result.platform.id)
    return
  }
  selectPlatform(result.person.id, result.platform.id)
  highlightCookieId.value = result.cookie.id
  await nextTick()
  document.querySelector(`[data-cookie-id="${result.cookie.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  window.setTimeout(() => {
    if (highlightCookieId.value === result.cookie.id) highlightCookieId.value = null
  }, 2400)
}

function openAddPerson() {
  editorError.value = null
  editorState.value = {
    mode: 'add', entityType: 'person', title: '添加人员', breadcrumb: '数据管理 / 人员',
  }
}

function openAddPlatform(personId: string) {
  const person = persons.value.find(item => item.id === personId)
  if (!person) return
  expandPerson(personId)
  selection.value = { type: 'person', personId }
  editorError.value = null
  editorState.value = {
    mode: 'add', entityType: 'platform', personId,
    title: '添加平台', breadcrumb: `${person.name} / 新平台`,
    initialDeviceProfileId: deviceProfiles.value[0]?.id,
    initialPlatformMode: 'cookie',
  }
}

function openAddCookie(personId: string, platformId: string) {
  const person = persons.value.find(item => item.id === personId)
  const platform = person?.platforms.find(item => item.id === platformId)
  if (!person || !platform) return
  if (platform.mode == 'bridge') {
    showToast('Bridge 模式平台不能添加 Cookie', 'warning')
    return
  }
  editorError.value = null
  editorState.value = {
    mode: 'add', entityType: 'cookie', personId, platformId,
    title: '添加 Cookie', breadcrumb: `${person.name} / ${platform.name}`,
  }
}

function openEditPerson(person: Person) {
  editorError.value = null
  editorState.value = {
    mode: 'edit', entityType: 'person', entityId: person.id, personId: person.id,
    title: '编辑人员', breadcrumb: person.name,
    initialName: person.name, initialJson: JSON.stringify(person, null, 2),
  }
}

function openEditPlatform(personId: string, platform: Platform) {
  const person = persons.value.find(item => item.id === personId)
  editorError.value = null
  editorState.value = {
    mode: 'edit', entityType: 'platform', entityId: platform.id, personId, platformId: platform.id,
    title: '编辑平台', breadcrumb: `${person?.name || ''} / ${platform.name}`,
    initialName: platform.name, initialJson: JSON.stringify(platform, null, 2), initialDeviceProfileId: platform.deviceProfileId,
    initialBridges: platform.bridges,
    initialCookies: platform.cookies,
    initialPlatformMode: platform.mode,
  }
}

async function updatePlatformBridge(platformId: string, bridge: PlatformBridgeMock) {
  const platform = persons.value
    .flatMap(person => person.platforms)
    .find(item => item.id == platformId)
  if (!platform || platform.mode != 'bridge') {
    showToast('Bridge 平台已不存在，请刷新后重试', 'error')
    return
  }
  const bridges = (platform.bridges || []).map(item => item.methodId == bridge.methodId ? bridge : item)
  try {
    await platformsApi.update(platform.id, platform.name, undefined, bridges)
    showToast(`Bridge 已${bridge.enabled ? '启用' : '停用'}`, 'success')
  } catch (error) {
    showToast(`Bridge 更新失败：${(error as Error).message}`, 'error')
  }
}

async function updatePlatformCookie(cookie: Cookie) {
  try {
    await cookiesApi.update(cookie.id, { enabled: cookie.enabled })
    showToast(`Cookie 已${cookie.enabled ? '启用' : '停用'}`, 'success')
  } catch (error) {
    showToast(`Cookie 更新失败：${(error as Error).message}`, 'error')
  }
}

function openEditCookie(personId: string, platformId: string, cookie: Cookie) {
  const person = persons.value.find(item => item.id === personId)
  const platform = person?.platforms.find(item => item.id === platformId)
  editorError.value = null
  editorState.value = {
    mode: 'edit', entityType: 'cookie', entityId: cookie.id, personId, platformId,
    title: '编辑 Cookie', breadcrumb: `${person?.name || ''} / ${platform?.name || ''} / ${cookie.name}`,
    initialName: cookie.name, initialValue: cookie.value, initialJson: JSON.stringify(cookie, null, 2),
  }
}

async function openImportChild(type: 'platform' | 'cookie', personId: string, platformId?: string) {
  const person = persons.value.find(item => item.id === personId)
  const platform = person?.platforms.find(item => item.id === platformId)
  let clipboardText = ''
  try { clipboardText = await navigator.clipboard.readText() } catch { /* clipboard permission is optional */ }
  editorError.value = null
  editorState.value = {
    mode: 'import', entityType: type, personId, platformId,
    title: type === 'platform' ? '粘贴导入平台' : '粘贴导入 Cookie',
    breadcrumb: type === 'platform' ? `${person?.name || ''} / 平台` : `${person?.name || ''} / ${platform?.name || ''}`,
    initialJson: clipboardText.trim(),
  }
}

async function openImportPerson() {
  let clipboardText = ''
  try { clipboardText = await navigator.clipboard.readText() } catch { /* clipboard permission is optional */ }
  pageMenuOpen.value = false
  editorError.value = null
  editorState.value = {
    mode: 'import', entityType: 'person', title: '粘贴导入人员', breadcrumb: '数据管理 / 人员',
    initialJson: clipboardText.trim(),
  }
}

function closeEditor() {
  editorState.value = null
  editorError.value = null
  editorConfirmation.value = null
}

async function handleEditorSubmit(payload: EditorSubmitPayload) {
  const state = editorState.value
  if (!state) return
  editorError.value = null
  editorSaving.value = true
  try {
    if (state.mode === 'add') await handleAddSubmit(state, payload)
    else if (state.mode === 'import') await handleImportSubmit(state, payload)
    else await handleEditSubmit(state, payload)
  } catch (error) {
    editorError.value = (error as Error).message
  } finally {
    editorSaving.value = false
  }
}

async function handleAddSubmit(state: EditorState, payload: EditorSubmitPayload) {
  if (state.entityType === 'person') {
    const person = await personsApi.add(requireName(payload.name))
    expandPerson(person.id)
    selection.value = { type: 'person', personId: person.id }
    showToast(`已添加人员「${person.name}」`, 'success')
    closeEditor()
    return
  }
  if (state.entityType === 'platform') {
    const profile = uaInjectionEnabled.value && payload.deviceProfileId ? deviceProfilesApi.find(payload.deviceProfileId) : undefined
    if (uaInjectionEnabled.value && payload.deviceProfileId && !profile) throw new Error('请选择有效的设备UA预设。')
    const platform = await platformsApi.add(
      state.personId!,
      requireName(payload.name),
      profile?.id,
      payload.bridges || [],
      payload.platformMode || 'cookie',
      payload.cookies || []
    )
    expandPerson(state.personId!)
    selection.value = { type: 'platform', personId: state.personId!, platformId: platform.id }
    showToast(`已添加平台「${platform.name}」`, 'success')
    closeEditor()
    return
  }

  if (payload.tab === 'bulk') {
    const pairs = parseBulk(payload.json || '')
    if (!pairs.length) throw new Error('未解析到有效 Cookie，请使用 key=value; key2=value2 格式。')
    const duplicates = pairs.filter(pair => cookiesApi.findByName(state.platformId!, pair.name))
    const action = async () => {
      for (const pair of pairs) await upsertCookie(state.platformId!, pair)
      showToast(`已添加 ${pairs.length} 条 Cookie`, 'success')
      closeEditor()
    }
    if (duplicates.length) {
      editorConfirmation.value = {
        title: '覆盖重复 Cookie',
        message: `${duplicates.length} 个 Key 已存在，继续后将使用新值覆盖。`,
        action,
      }
    } else await action()
    return
  }

  const cookie = { name: requireName(payload.name, 'Cookie Key'), value: requireName(payload.value, 'Cookie Value') }
  const existing = cookiesApi.findByName(state.platformId!, cookie.name)
  const action = async () => {
    if (existing) await cookiesApi.update(existing.id, cookie)
    else await cookiesApi.add(state.platformId!, cookie)
    showToast(existing ? '已覆盖 Cookie' : '已添加 Cookie', 'success')
    closeEditor()
  }
  if (existing) {
    editorConfirmation.value = { title: '覆盖 Cookie', message: `Key「${cookie.name}」已存在，是否覆盖原值？`, action }
  } else await action()
}

async function handleEditSubmit(state: EditorState, payload: EditorSubmitPayload) {
  if (payload.tab === 'form') {
    if (state.entityType === 'person') {
      await personsApi.update(state.entityId!, requireName(payload.name))
      showToast('已更新人员', 'success')
    } else if (state.entityType === 'platform') {
      const profile = uaInjectionEnabled.value && payload.deviceProfileId ? deviceProfilesApi.find(payload.deviceProfileId) : undefined
      if (uaInjectionEnabled.value && payload.deviceProfileId && !profile) throw new Error('请选择有效的设备UA预设。')
      await platformsApi.update(
        state.entityId!,
        requireName(payload.name),
        uaInjectionEnabled.value ? profile?.id || '' : undefined,
        payload.bridges || [],
        payload.cookies
      )
      showToast('已更新平台', 'success')
    } else {
      await cookiesApi.update(state.entityId!, {
        name: requireName(payload.name, 'Cookie Key'),
        value: requireName(payload.value, 'Cookie Value'),
      })
      showToast('已更新 Cookie', 'success')
    }
    closeEditor()
    return
  }

  const parsed = parseJson(payload.json || '')
  if (state.entityType === 'person') {
    const current = persons.value.find(person => person.id === state.entityId)
    if (!current) throw new Error('人员已不存在，请刷新后重试。')
    const replacement = validatePersonEntity(parsed, current.id)
    current.platforms.forEach(platform => {
      const next = replacement.platforms.find(item => item.id == platform.id)
      if (next && next.mode != platform.mode) throw new Error(`平台「${platform.name}」的模式创建后不可修改。`)
    })
    replacement.platforms.forEach(platform => assertKnownDeviceProfile(platform.deviceProfileId))
    const changes = comparePersonChildren(current, replacement)
    const action = async () => {
      await personsApi.replace(current.id, replacement)
      showToast('已保存人员完整数据', 'success')
      closeEditor()
    }
    if (changes) editorConfirmation.value = { title: '确认修改下级数据', message: changes, action }
    else await action()
    return
  }
  if (state.entityType === 'platform') {
    const current = selectedOrFindPlatform(state.entityId!)
    if (!current) throw new Error('平台已不存在，请刷新后重试。')
    const replacement = validatePlatformEntity(parsed, current.id, collectExternalIds('platform', current.id))
    if (replacement.mode != current.mode) throw new Error('平台模式创建后不可修改。')
    assertKnownDeviceProfile(replacement.deviceProfileId)
    const changes = current.cookies.length !== replacement.cookies.length
      ? `Cookie 数量将从 ${current.cookies.length} 条变为 ${replacement.cookies.length} 条。`
      : ''
    const action = async () => {
      await platformsApi.replace(current.id, replacement)
      showToast('已保存平台完整数据', 'success')
      closeEditor()
    }
    if (changes) editorConfirmation.value = { title: '确认修改下级数据', message: changes, action }
    else await action()
    return
  }

  const cookie = validateCookieEntity(parsed, state.entityId!, new Set())
  await cookiesApi.update(state.entityId!, { name: cookie.name, value: cookie.value })
  showToast('已保存 Cookie JSON', 'success')
  closeEditor()
}

async function handleImportSubmit(state: EditorState, payload: EditorSubmitPayload) {
  const parsed = parseJson(payload.json || '')
  if (state.entityType === 'person') {
    const input = validatePersonImport(parsed)
    const person = await personsApi.add(input.name)
    for (const platformInput of input.platforms) {
      const platform = await platformsApi.add(
        person.id,
        platformInput.name,
        platformInput.deviceProfileId,
        platformInput.bridges,
        platformInput.mode
      )
      for (const cookie of platformInput.cookies) await cookiesApi.add(platform.id, cookie)
    }
    expandPerson(person.id)
    selection.value = { type: 'person', personId: person.id }
    showToast(`已导入人员「${input.name}」`, 'success')
    closeEditor()
    return
  }
  if (state.entityType === 'platform') {
    const input = validatePlatformImport(parsed)
    const action = async () => {
      const platform = await platformsApi.add(
        state.personId!,
        input.name,
        input.deviceProfileId,
        input.bridges,
        input.mode
      )
      for (const cookie of input.cookies) await cookiesApi.add(platform.id, { name: cookie.name, value: cookie.value })
      expandPerson(state.personId!)
      selection.value = { type: 'platform', personId: state.personId!, platformId: platform.id }
      showToast(`已导入平台「${input.name}」`, 'success')
      closeEditor()
    }
    await action()
    return
  }

  const inputs = validateCookieImport(parsed)
  const duplicates = inputs.filter(cookie => cookiesApi.findByName(state.platformId!, cookie.name))
  const action = async () => {
    for (const cookie of inputs) await upsertCookie(state.platformId!, cookie)
    showToast(`已导入 ${inputs.length} 条 Cookie`, 'success')
    closeEditor()
  }
  if (duplicates.length) {
    editorConfirmation.value = {
      title: '覆盖重复 Cookie',
      message: `${duplicates.length} 个 Key 已存在，继续后将使用导入值覆盖。`,
      action,
    }
  } else await action()
}

async function confirmEditorAction() {
  const pending = editorConfirmation.value
  if (!pending) return
  editorConfirmation.value = null
  editorSaving.value = true
  try { await pending.action() }
  catch (error) { editorError.value = (error as Error).message }
  finally { editorSaving.value = false }
}

function requestDelete(type: DeleteTarget['type'], id: string, label: string, personId?: string, platformId?: string) {
  deleteTarget.value = { type, id, label, personId, platformId }
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  if (target.type === 'person') {
    const index = persons.value.findIndex(person => person.id === target.id)
    await personsApi.remove(target.id)
    const remaining = persons.value.filter(person => person.id !== target.id)
    const fallback = remaining[Math.min(index, remaining.length - 1)]
    selection.value = fallback ? { type: 'person', personId: fallback.id } : null
    const next = new Set(expandedPersons.value)
    next.delete(target.id)
    expandedPersons.value = next
  } else if (target.type === 'platform') {
    await platformsApi.remove(target.id)
    selection.value = target.personId ? { type: 'person', personId: target.personId } : null
  } else {
    await cookiesApi.remove(target.id)
  }
  showToast(`已删除「${target.label}」`, 'success')
  deleteTarget.value = null
}

async function copyJson(type: 'person' | 'platform' | 'cookie', personId: string, platformId?: string, cookieId?: string) {
  const person = persons.value.find(item => item.id === personId)
  const platform = person?.platforms.find(item => item.id === platformId)
  const entity = type === 'person' ? person : type === 'platform' ? platform : platform?.cookies.find(item => item.id === cookieId)
  if (!entity) return
  await copyText(JSON.stringify(entity, null, 2), '已复制完整 JSON')
}

async function copyValue(cookie: Cookie) {
  await copyText(cookie.value, `已复制「${cookie.name}」的 Value`)
}

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  showToast(successMessage, 'success')
}

function blurSearchSoon() {
  window.setTimeout(() => { searchFocused.value = false }, 150)
}

function requireName(value?: string, label = '名称') {
  const result = value?.trim()
  if (!result) throw new Error(`请填写${label}。`)
  return result
}

function parseJson(value: string): any {
  try { return JSON.parse(value) }
  catch (error) { throw new Error(`JSON 语法错误：${(error as Error).message}`) }
}

function parseBulk(value: string): Array<{ name: string; value: string }> {
  return value.split(';').map(segment => {
    const index = segment.indexOf('=')
    return index > 0
      ? { name: segment.slice(0, index).trim(), value: segment.slice(index + 1).trim() }
      : { name: '', value: '' }
  }).filter(cookie => cookie.name && cookie.value)
}

async function upsertCookie(platformId: string, cookie: { name: string; value: string }) {
  const existing = cookiesApi.findByName(platformId, cookie.name)
  if (existing) await cookiesApi.update(existing.id, cookie)
  else await cookiesApi.add(platformId, cookie)
}

function assertObject(value: any, label: string): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}必须为 JSON 对象。`)
}

function validateCookieEntity(value: any, rootId: string, usedIds: Set<string>): Cookie {
  assertObject(value, 'Cookie')
  const name = requireName(value.name, 'Cookie Key')
  if (typeof value.value !== 'string') throw new Error('Cookie Value 必须为字符串。')
  const id = rootId || requireName(value.id, 'Cookie ID')
  if (usedIds.has(id)) throw new Error(`发现重复 ID：${id}`)
  usedIds.add(id)
  const preset = typeof value.presetId == 'string'
    ? cookiePresets.value.find(item => item.id == value.presetId)
    : undefined
  return {
    id,
    name,
    value: value.value,
    enabled: value.enabled != false,
    presetId: preset?.id,
  }
}

function validatePlatformEntity(
  value: any,
  rootId: string,
  usedIds: Set<string>,
  methodCatalog = bridgeMethods.value
): Platform {
  assertObject(value, '平台')
  if (!Array.isArray(value.cookies)) throw new Error('平台 cookies 必须为数组。')
  const platformId = rootId || requireName(value.id, '平台 ID')
  if (usedIds.has(platformId)) throw new Error(`发现重复 ID：${platformId}`)
  usedIds.add(platformId)
  const mode = normalizePlatformMode(value)
  const bridges = mode == 'bridge' ? validatePlatformBridges(value.bridges, methodCatalog) : []
  return {
    id: platformId,
    name: requirePlatformName(value.name),
    mode,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    order: typeof value.order === 'number' ? value.order : 0,
    cookies: mode == 'cookie'
      ? normalizePlatformCookies(
          value.cookies.map((cookie: any) => validateCookieEntity(cookie, requireName(cookie?.id, 'Cookie ID'), usedIds)),
          cookiePresets.value
        )
      : [],
    deviceProfileId: typeof value.deviceProfileId === 'string' ? value.deviceProfileId : undefined,
    bridges,
  }
}

function validatePersonEntity(value: any, rootId: string): Person {
  assertObject(value, '人员')
  if (!Array.isArray(value.platforms)) throw new Error('人员 platforms 必须为数组。')
  const usedIds = collectExternalIds('person', rootId)
  if (usedIds.has(rootId)) usedIds.delete(rootId)
  usedIds.add(rootId)
  return {
    id: rootId,
    name: requireName(value.name),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    order: typeof value.order === 'number' ? value.order : 0,
    platforms: value.platforms.map((platform: any) =>
      validatePlatformEntity(platform, requireName(platform?.id, '平台 ID'), usedIds)
    ),
  }
}

function collectExternalIds(excludeType: 'person' | 'platform', excludeId: string) {
  const ids = new Set<string>()
  persons.value.forEach(person => {
    if (excludeType === 'person' && person.id === excludeId) return
    ids.add(person.id)
    person.platforms.forEach(platform => {
      if (excludeType === 'platform' && platform.id === excludeId) return
      ids.add(platform.id)
      platform.cookies.forEach(cookie => ids.add(cookie.id))
    })
  })
  return ids
}

function validatePlatformImport(value: any): { name: string; mode: PlatformMode; deviceProfileId?: string; bridges: PlatformBridgeMock[]; cookies: Array<{ name: string; value: string }> } {
  assertObject(value, '平台')
  if (value.cookies !== undefined && !Array.isArray(value.cookies)) throw new Error('平台 cookies 必须为数组。')
  const deviceProfileId = typeof value.deviceProfileId === 'string' ? value.deviceProfileId : undefined
  const mode = normalizePlatformMode(value)
  assertKnownDeviceProfile(deviceProfileId)
  return {
    name: requirePlatformName(value.name),
    mode,
    deviceProfileId,
    bridges: mode == 'bridge' ? validatePlatformBridges(value.bridges) : [],
    cookies: mode == 'cookie' ? (value.cookies || []).map((cookie: any) => {
      assertObject(cookie, 'Cookie')
      if (typeof cookie.value !== 'string') throw new Error('Cookie Value 必须为字符串。')
      return { name: requireName(cookie.name, 'Cookie Key'), value: cookie.value }
    }) : [],
  }
}

function validatePersonImport(value: any): { name: string; platforms: Array<{ name: string; mode: PlatformMode; deviceProfileId?: string; bridges: PlatformBridgeMock[]; cookies: Array<{ name: string; value: string }> }> } {
  assertObject(value, '人员')
  if (value.platforms !== undefined && !Array.isArray(value.platforms)) throw new Error('人员 platforms 必须为数组。')
  return {
    name: requireName(value.name),
    platforms: (value.platforms || []).map((platform: any) => validatePlatformImport(platform)),
  }
}

function validatePlatformBridges(
  value: unknown,
  methodCatalog = bridgeMethods.value
): PlatformBridgeMock[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new Error('平台 bridges 必须为数组。')
  const normalized = normalizePlatformBridges(value, methodCatalog)
  if (normalized.length != value.length) {
    throw new Error('平台 bridges 中存在无效、重复或已删除的方法。')
  }
  return normalized
}

function validateCookieImport(value: any): Array<{ name: string; value: string }> {
  const items = Array.isArray(value) ? value : [value]
  if (!items.length) throw new Error('没有可导入的 Cookie。')
  return items.map(item => {
    assertObject(item, 'Cookie')
    if (typeof item.value !== 'string') throw new Error('Cookie Value 必须为字符串。')
    return { name: requireName(item.name, 'Cookie Key'), value: item.value }
  })
}

function comparePersonChildren(current: Person, replacement: Person) {
  const beforeCookies = current.platforms.reduce((sum, platform) => sum + platform.cookies.length, 0)
  const afterCookies = replacement.platforms.reduce((sum, platform) => sum + platform.cookies.length, 0)
  const changes: string[] = []
  if (current.platforms.length !== replacement.platforms.length) changes.push(`平台 ${current.platforms.length} → ${replacement.platforms.length}`)
  if (beforeCookies !== afterCookies) changes.push(`Cookie ${beforeCookies} → ${afterCookies}`)
  return changes.length ? `下级数量将发生变化：${changes.join('，')}。` : ''
}

function selectedOrFindPlatform(platformId: string) {
  for (const person of persons.value) {
    const platform = person.platforms.find(item => item.id === platformId)
    if (platform) return platform
  }
  return null
}

function assertKnownDeviceProfile(profileId?: string) {
  if (uaInjectionEnabled.value && profileId && !deviceProfilesApi.find(profileId)) {
    throw new Error('平台引用的设备UA预设不存在，请先选择有效预设。')
  }
}

function normalizeCookieInjectorJsonData(value: unknown): CookieData {
  assertObject(value, 'Cookie Injector 数据')
  const cookieInjector = value
  if (!Array.isArray(cookieInjector.persons)) throw new Error('persons 必须为数组。')
  if (cookieInjector.deviceProfiles != undefined && !Array.isArray(cookieInjector.deviceProfiles)) {
    throw new Error('deviceProfiles 必须为数组。')
  }
  if (cookieInjector.bridgeProviders != undefined && !Array.isArray(cookieInjector.bridgeProviders)) {
    throw new Error('bridgeProviders 必须为数组。')
  }
  if (cookieInjector.bridgeMethods != undefined && !Array.isArray(cookieInjector.bridgeMethods)) {
    throw new Error('bridgeMethods 必须为数组。')
  }
  if (cookieInjector.cookiePresetGroups != undefined && !Array.isArray(cookieInjector.cookiePresetGroups)) {
    throw new Error('cookiePresetGroups 必须为数组。')
  }
  if (cookieInjector.cookiePresets != undefined && !Array.isArray(cookieInjector.cookiePresets)) {
    throw new Error('cookiePresets 必须为数组。')
  }

  const normalizedProviders = normalizeBridgeProviders(cookieInjector.bridgeProviders)
  const normalizedMethods = normalizeBridgeMethods(cookieInjector.bridgeMethods, normalizedProviders)
  const usedIds = new Set<string>()
  for (const person of cookieInjector.persons) {
    assertObject(person, '人员')
    const personId = requireName(person.id, '人员 ID')
    if (usedIds.has(personId)) throw new Error(`发现重复 ID：${personId}`)
    usedIds.add(personId)
    if (!Array.isArray(person.platforms)) {
      throw new Error(`人员「${person.name || personId}」缺少 platforms 数组。`)
    }
    for (const platform of person.platforms) {
      const validated = validatePlatformEntity(
        platform,
        requireName(platform?.id, '平台 ID'),
        usedIds,
        normalizedMethods
      )
      const current = selectedOrFindPlatform(validated.id)
      if (current && current.mode != validated.mode) {
        throw new Error(`平台「${current.name}」的模式创建后不可修改。`)
      }
    }
  }
  return cookieInjector as CookieData
}
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950" @click="pageMenuOpen = false">
    <header class="relative z-30 flex min-h-[72px] flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 lg:px-5">
      <div class="mr-auto flex items-center gap-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"><LayoutPanelLeft :size="19" /></span>
        <div>
          <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">数据管理</h2>
          <div class="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
            <span class="inline-flex items-center gap-1"><Users :size="11" />{{ totals.persons }}</span>
            <span class="inline-flex items-center gap-1"><Monitor :size="11" />{{ totals.platforms }}</span>
            <span class="inline-flex items-center gap-1"><KeyRound :size="11" />{{ totals.cookies }}</span>
          </div>
        </div>
      </div>

      <div class="relative order-last w-full sm:order-none sm:w-72">
        <Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="searchQuery"
          class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-sm text-slate-700 outline-none ring-sky-500/30 transition focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:bg-slate-900"
          placeholder="搜索人员、平台或 Cookie"
          @focus="searchFocused = true"
          @blur="blurSearchSoon"
          @keyup.escape="searchFocused = false; searchQuery = ''"
        />
        <button v-if="searchQuery" class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" title="清除搜索" @mousedown.prevent @click="searchQuery = ''"><X :size="14" /></button>

        <div v-if="searchFocused && searchQuery.trim()" class="absolute left-0 right-0 top-11 z-50 max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <template v-if="hasSearchResults">
            <div v-if="searchGroups.persons.length" class="mb-2">
              <p class="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">人员</p>
              <button v-for="result in searchGroups.persons" :key="`p-${result.person.id}`" class="search-result" @mousedown.prevent @click="selectSearchResult(result)"><Users :size="14" /><span class="truncate">{{ result.person.name }}</span></button>
            </div>
            <div v-if="searchGroups.platforms.length" class="mb-2">
              <p class="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">平台</p>
              <button v-for="result in searchGroups.platforms" :key="result.type === 'platform' ? `pl-${result.platform.id}` : ''" class="search-result" @mousedown.prevent @click="selectSearchResult(result)">
                <Monitor :size="14" /><span v-if="result.type === 'platform'" class="min-w-0"><span class="block truncate">{{ result.platform.name }}</span><span class="block truncate text-[10px] text-slate-400">{{ result.person.name }}</span></span>
              </button>
            </div>
            <div v-if="searchGroups.cookies.length">
              <p class="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Cookie</p>
              <button v-for="result in searchGroups.cookies" :key="result.type === 'cookie' ? `c-${result.cookie.id}` : ''" class="search-result" @mousedown.prevent @click="selectSearchResult(result)">
                <KeyRound :size="14" /><span v-if="result.type === 'cookie'" class="min-w-0"><span class="block truncate font-mono">{{ result.cookie.name }}</span><span class="block truncate text-[10px] text-slate-400">{{ result.person.name }} / {{ result.platform.name }}</span></span>
              </button>
            </div>
          </template>
          <p v-else class="px-3 py-8 text-center text-xs text-slate-400">未找到匹配数据</p>
        </div>
      </div>

      <button class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-800 dark:hover:text-sky-300" @click="jsonEditorOpen = true"><Braces :size="15" />JSON</button>
      <button class="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700" @click="openAddPerson"><Plus :size="16" />添加人员</button>
      <div class="relative" @click.stop>
        <button class="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white" title="页面更多操作" @click="pageMenuOpen = !pageMenuOpen"><MoreHorizontal :size="17" /></button>
        <div v-if="pageMenuOpen" class="absolute right-0 top-11 z-50 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <button class="search-result" @click="openImportPerson"><ClipboardPaste :size="14" />粘贴导入人员</button>
        </div>
      </div>
    </header>

    <div class="relative flex min-h-0 flex-1 overflow-hidden">
      <div v-if="mobileNavOpen" class="absolute inset-0 z-30 bg-slate-950/35 lg:hidden" @click="mobileNavOpen = false" />
      <div class="absolute inset-y-0 left-0 z-40 transition-transform lg:static lg:translate-x-0" :class="mobileNavOpen ? 'translate-x-0' : '-translate-x-full'">
        <DataManagerNavigation
          :persons="persons"
          :selection="selection"
          :expanded-persons="expandedPersons"
          @toggle-person="togglePerson"
          @select-person="selectPerson"
          @select-platform="selectPlatform"
          @add-platform="openAddPlatform"
          @close="mobileNavOpen = false"
        />
      </div>
      <DataManagerContent
        :selection="selection"
        :selected-person="selectedPerson"
        :selected-platform="selectedPlatform"
        :highlight-cookie-id="highlightCookieId"
        :device-profiles="deviceProfiles"
        :ua-injection-enabled="uaInjectionEnabled"
        :bridge-providers="bridgeProviders"
        :bridge-methods="bridgeMethods"
        :cookie-preset-groups="cookiePresetGroups"
        :cookie-presets="cookiePresets"
        @open-nav="mobileNavOpen = true"
        @select-platform="selectPlatform"
        @edit-person="openEditPerson"
        @edit-platform="openEditPlatform"
        @copy-json="copyJson"
        @update-bridge="updatePlatformBridge"
        @update-cookie="updatePlatformCookie"
        @import-child="openImportChild"
        @delete="requestDelete"
      />
    </div>

    <CookieInjectorJsonEditorDialog
      v-if="jsonEditorOpen"
      :data="storageData"
      :validate-data="normalizeCookieInjectorJsonData"
      :save-data="saveDataImmediate"
      @close="jsonEditorOpen = false"
      @toast="showToast"
    />

    <EntityEditorDrawer
      :state="editorState"
      :error="editorError"
      :saving="editorSaving"
      :device-profiles="deviceProfiles"
      :ua-injection-enabled="uaInjectionEnabled"
      :bridge-providers="bridgeProviders"
      :bridge-methods="bridgeMethods"
      :cookie-preset-groups="cookiePresetGroups"
      :cookie-presets="cookiePresets"
      @close="closeEditor"
      @submit="handleEditorSubmit"
      @clear-error="editorError = null"
    />

    <Teleport to="body">
      <div v-if="editorConfirmation" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
        <div class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ editorConfirmation.title }}</h3>
          <p class="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{{ editorConfirmation.message }}</p>
          <div class="mt-5 flex justify-end gap-2">
            <button class="rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="editorConfirmation = null">返回检查</button>
            <button class="rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700" @click="confirmEditorAction">确认继续</button>
          </div>
        </div>
      </div>

      <div v-if="deleteTarget" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" @mousedown.self="deleteTarget = null">
        <div class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">确认删除「{{ deleteTarget.label }}」</h3>
          <p class="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{{ deleteTarget.type === 'person' ? '该人员下的平台及其配置会一并删除。' : deleteTarget.type === 'platform' ? '该平台下的 Cookie 或 Bridge 配置会一并删除。' : '删除后无法恢复。' }}</p>
          <div class="mt-5 flex justify-end gap-2">
            <button class="rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="deleteTarget = null">取消</button>
            <button class="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700" @click="confirmDelete">确认删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.search-result {
  @apply flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-600 transition-colors hover:bg-sky-50 hover:text-sky-700 dark:text-slate-300 dark:hover:bg-sky-950 dark:hover:text-sky-300;
}
</style>
