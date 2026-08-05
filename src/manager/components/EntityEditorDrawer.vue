<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { nanoid } from 'nanoid'
import type {
  BridgeMethodDefinition,
  BridgeProvider,
  Cookie as CookieItem,
  CookiePresetDefinition,
  CookiePresetGroup,
  DeviceProfile,
  JsonValue,
  PlatformBridgeMock,
  PlatformMode,
} from '@shared/types'
import { cloneJsonValue, TC_APP_BRIDGE_PROVIDER_ID } from '@shared/bridgeProfiles'
import type { EditorState, EditorSubmitPayload } from './data-manager-types'
import { Braces, Check, Code2, Cookie, Edit3, FileInput, LockKeyhole, Plus, RotateCcw, Save, Search, Trash2, X } from 'lucide-vue-next'

const props = defineProps<{
  state: EditorState | null
  error: string | null
  saving: boolean
  deviceProfiles: DeviceProfile[]
  uaInjectionEnabled: boolean
  bridgeProviders: BridgeProvider[]
  bridgeMethods: BridgeMethodDefinition[]
  cookiePresetGroups: CookiePresetGroup[]
  cookiePresets: CookiePresetDefinition[]
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: EditorSubmitPayload]
  'clear-error': []
}>()

const tab = ref<'form' | 'json' | 'bulk'>('form')
const name = ref('')
const value = ref('')
const json = ref('')
const bulk = ref('')
const deviceProfileId = ref('')
const platformMode = ref<PlatformMode>('cookie')
const bridges = shallowRef<PlatformBridgeMock[]>([])
const cookies = ref<CookieItem[]>([])
const bridgeJsonDrafts = ref<Record<string, string>>({})
const bridgeSelectorOpen = ref(false)
const bridgeSearch = ref('')
const cookieSelectorOpen = ref(false)
const cookieSearch = ref('')
const discardPrompt = ref(false)
const firstInput = ref<HTMLElement | null>(null)

function initialProfileId(state: EditorState | null): string {
  if (!state) return ''
  if (state.initialDeviceProfileId) return state.initialDeviceProfileId
  return state.mode == 'add' && state.entityType == 'platform' ? props.deviceProfiles[0]?.id || '' : ''
}

function initialBridges(state: EditorState | null): PlatformBridgeMock[] {
  return (state?.initialBridges || []).map(bridge => ({
    ...bridge,
    value: cloneJsonValue(bridge.value),
  }))
}

function initialCookies(state: EditorState | null): CookieItem[] {
  return (state?.initialCookies || []).map(cookie => ({ ...cookie }))
}

function initialPlatformMode(state: EditorState | null): PlatformMode {
  return state?.initialPlatformMode || 'cookie'
}

watch(
  () => props.state,
  async state => {
    discardPrompt.value = false
    name.value = state?.initialName || ''
    value.value = state?.initialValue || ''
    json.value = state?.initialJson || ''
    bulk.value = ''
    deviceProfileId.value = initialProfileId(state)
    platformMode.value = initialPlatformMode(state)
    bridges.value = initialBridges(state)
    cookies.value = initialCookies(state)
    bridgeJsonDrafts.value = Object.fromEntries(bridges.value.map(bridge => [
      bridge.methodId,
      JSON.stringify(bridge.value, null, 2),
    ]))
    bridgeSelectorOpen.value = false
    bridgeSearch.value = ''
    cookieSelectorOpen.value = false
    cookieSearch.value = ''
    tab.value = state?.mode === 'import' ? 'json' : 'form'
    emit('clear-error')
    if (state) {
      await nextTick()
      firstInput.value?.focus()
    }
  },
  { immediate: true }
)

watch(platformMode, mode => {
  if (props.state?.mode != 'add' || mode != 'bridge' || deviceProfileId.value != 'builtin-wechat-ios') return
  const hasTcAppBridge = props.bridgeProviders.some(provider => provider.id == TC_APP_BRIDGE_PROVIDER_ID)
  if (hasTcAppBridge && props.deviceProfiles.some(profile => profile.id == 'builtin-tctravel-ios')) {
    deviceProfileId.value = 'builtin-tctravel-ios'
  }
})

const isDirty = computed(() => {
  if (!props.state) return false
  return name.value !== (props.state.initialName || '')
    || value.value !== (props.state.initialValue || '')
    || json.value !== (props.state.initialJson || '')
    || bulk.value !== ''
    || deviceProfileId.value != initialProfileId(props.state)
    || platformMode.value != initialPlatformMode(props.state)
    || JSON.stringify(parsedBridgeDrafts.value) != JSON.stringify(initialBridges(props.state))
    || JSON.stringify(cookies.value) != JSON.stringify(initialCookies(props.state))
})

const jsonSyntaxError = computed(() => {
  if ((tab.value !== 'json' && props.state?.mode !== 'import') || !json.value.trim()) return null
  try {
    JSON.parse(json.value)
    return null
  } catch (error) {
    return `JSON 语法错误：${(error as Error).message}`
  }
})

const bridgeJsonError = computed(() => {
  if (props.state?.entityType == 'platform' && platformMode.value != 'bridge') return null
  for (const bridge of bridges.value) {
    try {
      JSON.parse(bridgeJsonDrafts.value[bridge.methodId] || '')
    } catch (error) {
      const method = props.bridgeMethods.find(item => item.id == bridge.methodId)
      return `${method?.method || bridge.methodId} 返回值 JSON 错误：${(error as Error).message}`
    }
  }
  return null
})

const cookieDraftError = computed(() => {
  if (props.state?.entityType != 'platform' || platformMode.value != 'cookie') return null
  const names = new Set<string>()
  for (const cookie of cookies.value) {
    const cookieName = cookie.name.trim()
    if (!cookieName) return 'Cookie Key 不能为空'
    if (names.has(cookieName)) return `Cookie Key「${cookieName}」重复`
    names.add(cookieName)
  }
  return null
})

const parsedBridgeDrafts = computed<PlatformBridgeMock[]>(() => bridges.value.map(bridge => {
  let value = bridge.value
  try {
    value = JSON.parse(bridgeJsonDrafts.value[bridge.methodId] || '') as JsonValue
  } catch { /* 错误由 bridgeJsonError 显示 */ }
  return { ...bridge, value }
}))

const selectedBridgeDetails = computed(() => bridges.value.flatMap(bridge => {
  const method = props.bridgeMethods.find(item => item.id == bridge.methodId)
  const provider = method ? props.bridgeProviders.find(item => item.id == method.providerId) : undefined
  return method && provider ? [{ bridge, method, provider }] : []
}))

const filteredBridgeMethods = computed(() => {
  const query = bridgeSearch.value.trim().toLowerCase()
  return props.bridgeMethods.filter(method => {
    const provider = props.bridgeProviders.find(item => item.id == method.providerId)
    return !query || `${provider?.name || ''} ${method.objectPath.join('.')}.${method.method}`.toLowerCase().includes(query)
  })
})

const bridgeMethodGroups = computed(() => props.bridgeProviders.flatMap(provider => {
  const methods = filteredBridgeMethods.value.filter(method => method.providerId == provider.id)
  return methods.length ? [{ provider, methods }] : []
}))

const selectedCookieDetails = computed(() => cookies.value.map(cookie => {
  const preset = cookie.presetId
    ? props.cookiePresets.find(item => item.id == cookie.presetId)
    : undefined
  const group = preset
    ? props.cookiePresetGroups.find(item => item.id == preset.groupId)
    : undefined
  return { cookie, preset, group }
}))

const filteredCookiePresets = computed(() => {
  const query = cookieSearch.value.trim().toLowerCase()
  return props.cookiePresets.filter(preset => {
    const group = props.cookiePresetGroups.find(item => item.id == preset.groupId)
    return !query || `${group?.name || ''} ${preset.key}`.toLowerCase().includes(query)
  })
})

const cookiePresetGroups = computed(() => props.cookiePresetGroups.flatMap(group => {
  const presets = filteredCookiePresets.value.filter(preset => preset.groupId == group.id)
  return presets.length ? [{ group, presets }] : []
}))

const headingIcon = computed(() => {
  if (props.state?.entityType == 'platform') return platformMode.value == 'bridge' ? Code2 : Cookie
  if (props.state?.mode === 'add') return Plus
  if (props.state?.mode === 'import') return FileInput
  return Edit3
})

const headingIconClass = computed(() => {
  if (props.state?.entityType != 'platform') return 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400'
  return platformMode.value == 'bridge'
    ? 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300'
    : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300'
})

const primaryLabel = computed(() => {
  if (props.saving) return '保存中...'
  if (props.state?.mode === 'import') return '确认导入'
  if (props.state?.mode === 'add') return tab.value === 'bulk' ? '批量添加' : '添加'
  return '保存修改'
})

const canSubmit = computed(() => {
  if (!props.state || props.saving || jsonSyntaxError.value || bridgeJsonError.value || cookieDraftError.value) return false
  if (props.state.mode === 'import' || tab.value === 'json') return !!json.value.trim()
  if (tab.value === 'bulk') return !!bulk.value.trim()
  if (props.state.entityType === 'platform') return !!name.value.trim()
  if (props.state.entityType === 'cookie') return !!name.value.trim() && !!value.value.trim()
  return !!name.value.trim()
})

function requestClose() {
  if (props.state?.mode == 'add' && props.state.entityType == 'platform') {
    emit('close')
    return
  }
  if (isDirty.value) {
    discardPrompt.value = true
    return
  }
  emit('close')
}

function changeTab(next: 'form' | 'json' | 'bulk') {
  tab.value = next
  discardPrompt.value = false
  emit('clear-error')
}

function submit() {
  if (!props.state || !canSubmit.value) return
  emit('submit', {
    mode: props.state.mode,
    entityType: props.state.entityType,
    tab: props.state.mode === 'import' ? 'json' : tab.value,
    name: name.value.trim(),
    value: value.value.trim(),
    json: tab.value === 'bulk' ? bulk.value : json.value,
    deviceProfileId: deviceProfileId.value || undefined,
    bridges: platformMode.value == 'bridge' ? parsedBridgeDrafts.value : [],
    cookies: props.state.entityType == 'platform' && platformMode.value == 'cookie' ? cookies.value.map(cookie => ({
      ...cookie,
      name: cookie.name.trim(),
    })) : undefined,
    platformMode: platformMode.value,
  })
}

function hasBridge(methodId: string) {
  return bridges.value.some(bridge => bridge.methodId == methodId)
}

function toggleBridge(method: BridgeMethodDefinition) {
  if (hasBridge(method.id)) {
    bridges.value = bridges.value.filter(bridge => bridge.methodId != method.id)
    const next = { ...bridgeJsonDrafts.value }
    delete next[method.id]
    bridgeJsonDrafts.value = next
    return
  }
  bridges.value = [...bridges.value, {
    methodId: method.id,
    enabled: true,
    value: cloneJsonValue(method.defaultValue),
  }]
  bridgeJsonDrafts.value = {
    ...bridgeJsonDrafts.value,
    [method.id]: JSON.stringify(method.defaultValue, null, 2),
  }
}

function removeBridge(methodId: string) {
  const method = props.bridgeMethods.find(item => item.id == methodId)
  if (method) toggleBridge(method)
}

function toggleBridgeEnabled(methodId: string) {
  bridges.value = bridges.value.map(bridge =>
    bridge.methodId == methodId ? { ...bridge, enabled: !bridge.enabled } : bridge
  )
}

function resetBridge(method: BridgeMethodDefinition) {
  bridgeJsonDrafts.value = {
    ...bridgeJsonDrafts.value,
    [method.id]: JSON.stringify(method.defaultValue, null, 2),
  }
}

function addCookieDraft() {
  cookies.value = [...cookies.value, {
    id: nanoid(),
    name: '',
    value: '',
    enabled: true,
  }]
}

function removeCookieDraft(cookieId: string) {
  cookies.value = cookies.value.filter(cookie => cookie.id != cookieId)
}

function hasCookiePreset(presetId: string) {
  return cookies.value.some(cookie => cookie.presetId == presetId)
}

function toggleCookiePreset(preset: CookiePresetDefinition) {
  const selected = cookies.value.find(cookie => cookie.presetId == preset.id)
  if (selected) {
    removeCookieDraft(selected.id)
    return
  }
  const sameKey = cookies.value.find(cookie => cookie.name == preset.key)
  if (sameKey) {
    cookies.value = cookies.value.map(cookie =>
      cookie.id == sameKey.id ? { ...cookie, presetId: preset.id } : cookie
    )
    return
  }
  cookies.value = [...cookies.value, {
    id: nanoid(),
    name: preset.key,
    value: preset.defaultValue,
    enabled: true,
    presetId: preset.id,
  }]
}

function toggleCookieEnabled(cookieId: string) {
  cookies.value = cookies.value.map(cookie =>
    cookie.id == cookieId ? { ...cookie, enabled: !cookie.enabled } : cookie
  )
}

function resetCookie(preset: CookiePresetDefinition, cookieId: string) {
  cookies.value = cookies.value.map(cookie =>
    cookie.id == cookieId ? { ...cookie, value: preset.defaultValue } : cookie
  )
}
</script>

<template>
  <Teleport to="body">
    <div v-if="state" class="fixed inset-0 z-[70] flex justify-end bg-slate-950/35 backdrop-blur-[1px]" @mousedown.self="requestClose">
      <aside class="flex h-full w-full max-w-[960px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <header class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div class="flex min-w-0 items-start gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" :class="headingIconClass">
              <component :is="headingIcon" :size="17" />
            </span>
            <div class="min-w-0">
              <h3 class="truncate text-base font-semibold text-slate-800 dark:text-slate-100">{{ state.title }}</h3>
              <p class="mt-0.5 truncate text-xs text-slate-400">{{ state.breadcrumb }}</p>
            </div>
          </div>
          <button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-white" title="关闭" @click="requestClose"><X :size="18" /></button>
        </header>

        <div v-if="state.mode === 'edit' || (state.mode === 'add' && state.entityType === 'cookie')" class="flex gap-1 border-b border-slate-200 px-5 pt-3 dark:border-slate-800">
          <button
            class="drawer-tab"
            :class="tab === 'form' ? 'drawer-tab-active' : ''"
            @click="changeTab('form')"
          >结构化表单</button>
          <button
            v-if="state.mode === 'edit'"
            class="drawer-tab"
            :class="tab === 'json' ? 'drawer-tab-active' : ''"
            @click="changeTab('json')"
          ><Braces :size="13" /> JSON</button>
          <button
            v-if="state.mode === 'add' && state.entityType === 'cookie'"
            class="drawer-tab"
            :class="tab === 'bulk' ? 'drawer-tab-active' : ''"
            @click="changeTab('bulk')"
          >批量添加</button>
        </div>

        <div class="flex-1 overflow-y-auto p-5">
          <div v-if="error || jsonSyntaxError || bridgeJsonError || cookieDraftError" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {{ error || jsonSyntaxError || bridgeJsonError || cookieDraftError }}
          </div>

          <template v-if="state.mode === 'import' || tab === 'json'">
            <div class="mb-3 flex items-center justify-between">
              <label class="text-xs font-semibold text-slate-600 dark:text-slate-300">{{ state.mode === 'import' ? '粘贴 JSON 数据' : '实体完整 JSON' }}</label>
              <span class="text-[11px] text-slate-400">保存前自动校验结构</span>
            </div>
            <textarea
              v-model="json"
              class="min-h-[480px] w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6 text-emerald-300 outline-none ring-sky-500/30 focus:ring-2"
              spellcheck="false"
              placeholder="{}"
              @input="emit('clear-error')"
              @keydown.meta.enter="submit"
              @keydown.ctrl.enter="submit"
            />
            <p class="mt-2 text-[11px] leading-5 text-slate-400">实体根 ID、创建时间和排序不会被 JSON 覆盖；修改下级数量时会再次确认。</p>
          </template>

          <template v-else-if="tab === 'bulk'">
            <label class="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Cookie 数据</label>
            <textarea
              v-model="bulk"
              class="min-h-52 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm leading-6 text-slate-700 outline-none ring-sky-500/30 focus:border-sky-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              placeholder="token=abc123; userId=456; sig=xyz"
              @input="emit('clear-error')"
            />
            <p class="mt-2 text-xs leading-5 text-slate-400">使用分号分隔多条 Cookie；Value 中的第一个等号之后内容会完整保留。</p>
          </template>

          <template v-else>
            <div class="space-y-5">
              <div v-if="state.entityType === 'platform'" class="space-y-5">
                <div>
                  <label class="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">平台名称</label>
                  <input ref="firstInput" v-model="name" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none ring-sky-500/30 transition focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="例如：同程 App 本地调试" @input="emit('clear-error')" />
                  <p class="mt-2 text-[11px] leading-5 text-slate-400">平台名称支持自由填写，同一人员下不能重名。</p>
                </div>
                <div>
                  <div class="mb-2 flex items-center justify-between">
                    <label class="text-xs font-semibold text-slate-600 dark:text-slate-300">平台模式</label>
                    <span v-if="state.mode == 'edit'" class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400"><LockKeyhole :size="11" />创建后不可修改</span>
                  </div>
                  <div v-if="state.mode == 'edit'" class="flex items-center gap-3 rounded-xl border px-4 py-3" :class="platformMode == 'bridge' ? 'border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/25' : 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25'">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-900">
                      <Code2 v-if="platformMode == 'bridge'" :size="17" class="text-violet-500" />
                      <Cookie v-else :size="17" class="text-amber-500" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-semibold text-slate-700 dark:text-slate-200">{{ platformMode == 'bridge' ? 'Bridge 模式' : 'Cookie 模式' }}</span>
                      <span class="mt-0.5 block text-[11px] text-slate-400">{{ platformMode == 'bridge' ? '从模板选择并维护 Mock 返回值' : '维护并注入当前平台的 Cookie' }}</span>
                    </span>
                    <LockKeyhole :size="14" class="shrink-0 text-slate-400" />
                  </div>
                  <div v-else class="grid grid-cols-2 gap-2">
                    <button
                      class="rounded-xl border p-3 text-left transition-colors"
                      :class="platformMode == 'cookie' ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-200 dark:border-amber-800 dark:bg-amber-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'"
                      @click="platformMode = 'cookie'"
                    >
                      <span class="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><Cookie :size="15" class="text-amber-500" />Cookie 模式</span>
                      <span class="mt-1.5 block text-[10px] leading-4 text-slate-400">维护并注入 Cookie</span>
                    </button>
                    <button
                      class="rounded-xl border p-3 text-left transition-colors"
                      :class="platformMode == 'bridge' ? 'border-violet-300 bg-violet-50 ring-1 ring-violet-200 dark:border-violet-800 dark:bg-violet-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'"
                      @click="platformMode = 'bridge'"
                    >
                      <span class="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><Code2 :size="15" class="text-violet-500" />Bridge 模式</span>
                      <span class="mt-1.5 block text-[10px] leading-4 text-slate-400">从模板选择并修改返回值</span>
                    </button>
                  </div>
                </div>
                <div v-if="props.uaInjectionEnabled">
                  <label class="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">注入 UA 预设</label>
                  <select v-model="deviceProfileId" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none ring-sky-500/30 transition focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <option value="">不绑定（浏览器默认）</option>
                    <option v-for="profile in deviceProfiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
                  </select>
                  <p class="mt-2 text-[11px] leading-5 text-slate-400">不绑定设备UA预设时保留浏览器默认 UA。</p>
                </div>
                <div v-if="platformMode == 'bridge'">
                  <div class="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">Bridge Mock</label>
                      <p class="mt-1 text-[11px] text-slate-400">选择方法后，可为当前平台覆盖默认返回值。</p>
                    </div>
                    <button class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300" @click="bridgeSelectorOpen = true"><Plus :size="13" />选择方法</button>
                  </div>

                  <div v-if="selectedBridgeDetails.length" class="grid gap-3 md:grid-cols-2">
                    <article v-for="{ bridge, method, provider } in selectedBridgeDetails" :key="method.id" class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                      <header class="flex items-start gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                        <Code2 :size="14" class="mt-0.5 shrink-0 text-violet-500" />
                        <div class="min-w-0 flex-1">
                          <p class="truncate font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{{ method.objectPath.join('.') }}.{{ method.method }}</p>
                          <p class="mt-0.5 text-[10px] text-slate-400">{{ provider.name }}</p>
                        </div>
                        <button role="switch" :aria-checked="bridge.enabled" class="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors" :class="bridge.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'" @click="toggleBridgeEnabled(bridge.methodId)"><span class="h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform" :class="bridge.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'" /></button>
                        <button class="rounded-md p-1 text-slate-400 hover:bg-white hover:text-red-500 dark:hover:bg-slate-800" title="移除" @click="removeBridge(method.id)"><Trash2 :size="14" /></button>
                      </header>
                      <div class="p-3">
                        <textarea v-model="bridgeJsonDrafts[method.id]" rows="7" spellcheck="false" class="w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-emerald-300 outline-none focus:border-sky-500" />
                        <div class="mt-2 flex justify-end"><button class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-sky-600" @click="resetBridge(method)"><RotateCcw :size="11" />恢复默认值</button></div>
                      </div>
                    </article>
                  </div>
                  <button v-else class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-xs text-slate-400 hover:border-sky-300 hover:bg-sky-50/40 hover:text-sky-600 dark:border-slate-700 dark:hover:bg-sky-950/20" @click="bridgeSelectorOpen = true"><Code2 :size="16" />尚未选择 Bridge 方法</button>
                </div>
                <div v-else>
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">Cookie 配置</label>
                      <p class="mt-1 text-[11px] text-slate-400">从预设中单独选择 Key，并为当前平台覆盖默认 Value。</p>
                    </div>
                    <div class="flex shrink-0 gap-2">
                      <button class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" @click="addCookieDraft"><Plus :size="13" />自定义</button>
                      <button class="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" @click="cookieSelectorOpen = true"><Plus :size="13" />选择 Key</button>
                    </div>
                  </div>
                  <div v-if="selectedCookieDetails.length" class="grid gap-3 md:grid-cols-2">
                    <article v-for="{ cookie, preset, group } in selectedCookieDetails" :key="cookie.id" class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                      <header class="flex items-start gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                        <Cookie :size="14" class="mt-0.5 shrink-0 text-amber-500" />
                        <div class="min-w-0 flex-1">
                          <p v-if="preset" class="truncate font-mono text-xs font-semibold leading-4 text-slate-700 dark:text-slate-200">{{ preset.key }}</p>
                          <input v-else v-model="cookie.name" class="block w-full appearance-none border-0 bg-transparent p-0 font-mono text-xs font-semibold leading-4 text-slate-700 shadow-none outline-none ring-0 placeholder:text-slate-300 focus:border-0 focus:outline-none focus:ring-0 dark:text-slate-200 dark:placeholder:text-slate-600" placeholder="Cookie Key" />
                          <p class="mt-0.5 text-[10px] text-slate-400">{{ group?.name || '自定义 Cookie' }}</p>
                        </div>
                        <button role="switch" :aria-checked="cookie.enabled" class="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors" :class="cookie.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'" @click="toggleCookieEnabled(cookie.id)"><span class="h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform" :class="cookie.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'" /></button>
                        <button class="rounded-md p-1 text-slate-400 hover:bg-white hover:text-red-500 dark:hover:bg-slate-800" title="移除" @click="removeCookieDraft(cookie.id)"><Trash2 :size="14" /></button>
                      </header>
                      <div class="p-3">
                        <textarea v-model="cookie.value" rows="6" spellcheck="false" class="w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-amber-200 outline-none focus:border-amber-500" placeholder="Cookie Value" />
                        <div class="mt-2 flex justify-end">
                          <button v-if="preset" class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-amber-600" @click="resetCookie(preset, cookie.id)"><RotateCcw :size="11" />恢复默认值</button>
                          <span v-else class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400"><Edit3 :size="11" />Key 可直接编辑</span>
                        </div>
                      </div>
                    </article>
                  </div>
                  <button v-else class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-xs text-slate-400 hover:border-amber-300 hover:bg-amber-50/40 hover:text-amber-600 dark:border-slate-700 dark:hover:bg-amber-950/20" @click="cookieSelectorOpen = true"><Cookie :size="16" />尚未选择 Cookie Key</button>
                </div>
              </div>
              <div v-else>
                <label class="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">{{ state.entityType === 'cookie' ? 'Cookie Key' : '名称' }}</label>
                <input
                  ref="firstInput"
                  v-model="name"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none ring-sky-500/30 transition focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900"
                  :class="state.entityType === 'cookie' ? 'font-mono' : ''"
                  :placeholder="state.entityType === 'person' ? '例如：测试账号 A' : '例如：token'"
                  @input="emit('clear-error')"
                  @keyup.enter="state.entityType !== 'cookie' && submit()"
                />
              </div>
              <div v-if="state.entityType === 'cookie'">
                <label class="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Cookie Value</label>
                <textarea
                  v-model="value"
                  rows="8"
                  class="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm leading-6 text-slate-800 outline-none ring-sky-500/30 transition focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900"
                  placeholder="Cookie Value"
                  @input="emit('clear-error')"
                />
              </div>
            </div>
          </template>
        </div>

        <div v-if="discardPrompt" class="mx-5 mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <p class="text-xs font-semibold text-amber-700 dark:text-amber-300">存在未保存的修改，确定放弃吗？</p>
          <div class="mt-2 flex justify-end gap-2">
            <button class="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-white dark:hover:bg-slate-900" @click="discardPrompt = false">继续编辑</button>
            <button class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700" @click="emit('close')">放弃修改</button>
          </div>
        </div>

        <footer class="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <span class="text-[11px] text-slate-400">{{ isDirty ? '有未保存修改' : '内容未修改' }}</span>
          <div class="flex gap-2">
            <button class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900" @click="requestClose">取消</button>
            <button class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40" :disabled="!canSubmit" @click="submit">
              <Save :size="15" /> {{ primaryLabel }}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="bridgeSelectorOpen" class="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" @mousedown.self="bridgeSelectorOpen = false">
      <section class="flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div><p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-500">Bridge Catalog</p><h3 class="mt-1 font-semibold text-slate-800 dark:text-slate-100">选择 Bridge 方法</h3><p class="mt-1 text-xs text-slate-400">已选择 {{ bridges.length }} 个；返回机制由 Bridge 系统统一决定。</p></div>
          <button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="bridgeSelectorOpen = false"><X :size="17" /></button>
        </header>
        <div class="border-b border-slate-100 p-4 dark:border-slate-800">
          <div class="relative"><Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="bridgeSearch" class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950" placeholder="搜索系统、命名空间或方法" /></div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          <section v-for="{ provider, methods } in bridgeMethodGroups" :key="provider.id" class="mb-5">
            <div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-1 py-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"><h4 class="text-xs font-semibold text-slate-700 dark:text-slate-200">{{ provider.name }}</h4><span class="text-[10px] text-slate-400">{{ methods.length }} 个方法</span></div>
            <div class="mt-2 grid gap-1 sm:grid-cols-2">
              <button v-for="method in methods" :key="method.id" class="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors" :class="hasBridge(method.id) ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300' : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800'" @click="toggleBridge(method)">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border" :class="hasBridge(method.id) ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 dark:border-slate-600'"><Check v-if="hasBridge(method.id)" :size="12" /></span>
                <span class="min-w-0"><span class="block truncate font-mono text-xs font-semibold">{{ method.method }}</span><span class="mt-0.5 block truncate font-mono text-[9px] opacity-60">{{ method.objectPath.join('.') }}</span></span>
              </button>
            </div>
          </section>
          <p v-if="!bridgeMethodGroups.length" class="py-16 text-center text-sm text-slate-400">未找到匹配方法</p>
        </div>
        <footer class="flex items-center justify-between border-t border-slate-100 px-5 py-4 dark:border-slate-800"><span class="text-xs text-slate-400">配置会在点击注入并刷新页面后生效</span><button class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700" @click="bridgeSelectorOpen = false">完成选择</button></footer>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="cookieSelectorOpen" class="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" @mousedown.self="cookieSelectorOpen = false">
      <section class="flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div><p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-500">Cookie Catalog</p><h3 class="mt-1 font-semibold text-slate-800 dark:text-slate-100">选择 Cookie Key</h3><p class="mt-1 text-xs text-slate-400">已选择 {{ cookies.length }} 个；每个 Key 可以单独选择、覆盖和启停。</p></div>
          <button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="cookieSelectorOpen = false"><X :size="17" /></button>
        </header>
        <div class="border-b border-slate-100 p-4 dark:border-slate-800">
          <div class="relative"><Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="cookieSearch" class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950" placeholder="搜索分组或 Cookie Key" /></div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          <section v-for="{ group, presets } in cookiePresetGroups" :key="group.id" class="mb-5">
            <div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-1 py-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"><h4 class="text-xs font-semibold text-slate-700 dark:text-slate-200">{{ group.name }}</h4><span class="text-[10px] text-slate-400">{{ presets.length }} 个 Key</span></div>
            <div class="mt-2 grid gap-1 sm:grid-cols-2">
              <button v-for="preset in presets" :key="preset.id" class="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors" :class="hasCookiePreset(preset.id) ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300' : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800'" @click="toggleCookiePreset(preset)">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border" :class="hasCookiePreset(preset.id) ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 dark:border-slate-600'"><Check v-if="hasCookiePreset(preset.id)" :size="12" /></span>
                <span class="min-w-0"><span class="block truncate font-mono text-xs font-semibold">{{ preset.key }}</span><span class="mt-0.5 block truncate font-mono text-[9px] opacity-60">默认值：{{ preset.defaultValue || '(空)' }}</span></span>
              </button>
            </div>
          </section>
          <p v-if="!cookiePresetGroups.length" class="py-16 text-center text-sm text-slate-400">未找到匹配的 Cookie Key</p>
        </div>
        <footer class="flex items-center justify-between border-t border-slate-100 px-5 py-4 dark:border-slate-800"><span class="text-xs text-slate-400">配置会在点击注入并刷新页面后生效</span><button class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600" @click="cookieSelectorOpen = false">完成选择</button></footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.drawer-tab {
  @apply inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200;
}

.drawer-tab-active {
  @apply border-sky-500 text-sky-600 dark:text-sky-400;
}
</style>
