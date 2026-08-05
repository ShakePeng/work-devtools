<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type {
  BridgeMethodDefinition,
  BridgeProvider,
  Person,
  Platform,
  Cookie,
  CookiePresetDefinition,
  CookiePresetGroup,
  DeviceProfile,
  PlatformBridgeMock,
} from '@shared/types'
import type { Selection } from './data-manager-types'
import {
  ChevronRight, ClipboardPaste, Copy, Edit3, Eye, FolderOpen, KeyRound,
  Code2, Cookie as CookieIcon, MoreHorizontal, PanelLeftOpen, Trash2, User, Monitor, X,
} from 'lucide-vue-next'

const props = defineProps<{
  selection: Selection
  selectedPerson: Person | null
  selectedPlatform: Platform | null
  highlightCookieId: string | null
  deviceProfiles: DeviceProfile[]
  uaInjectionEnabled: boolean
  bridgeProviders: BridgeProvider[]
  bridgeMethods: BridgeMethodDefinition[]
  cookiePresetGroups: CookiePresetGroup[]
  cookiePresets: CookiePresetDefinition[]
}>()

const emit = defineEmits<{
  'open-nav': []
  'select-platform': [personId: string, platformId: string]
  'edit-person': [person: Person]
  'edit-platform': [personId: string, platform: Platform]
  'copy-json': [type: 'person' | 'platform' | 'cookie', personId: string, platformId?: string, cookieId?: string]
  'update-bridge': [platformId: string, bridge: PlatformBridgeMock]
  'update-cookie': [cookie: Cookie]
  'import-child': [type: 'platform' | 'cookie', personId: string, platformId?: string]
  delete: [type: 'person' | 'platform' | 'cookie', id: string, label: string, personId?: string, platformId?: string]
}>()

const openMenu = ref<string | null>(null)
const configView = shallowRef<
  | { type: 'cookie'; cookie: Cookie }
  | { type: 'bridge'; bridge: PlatformBridgeMock }
  | null
>(null)

const viewedBridgeMethod = computed(() =>
  configView.value?.type == 'bridge'
    ? bridgeMethodFor(configView.value.bridge.methodId)
    : undefined
)

const viewedTitle = computed(() => {
  if (configView.value?.type == 'cookie') return configView.value.cookie.name
  if (configView.value?.type == 'bridge') {
    const method = viewedBridgeMethod.value
    return method ? `${method.objectPath.join('.')}.${method.method}` : configView.value.bridge.methodId
  }
  return ''
})

const viewedSource = computed(() => {
  if (configView.value?.type == 'cookie') return cookieGroupFor(configView.value.cookie)?.name || '自定义 Cookie'
  if (configView.value?.type == 'bridge') {
    return bridgeProviderFor(viewedBridgeMethod.value?.providerId || '')?.name || '未知 Bridge 系统'
  }
  return ''
})

const viewedValue = computed(() => {
  if (configView.value?.type == 'cookie') return configView.value.cookie.value
  if (configView.value?.type == 'bridge') return JSON.stringify(configView.value.bridge.value, null, 2)
  return ''
})

const viewedEnabled = computed(() =>
  configView.value?.type == 'cookie'
    ? configView.value.cookie.enabled
    : configView.value?.type == 'bridge'
      ? configView.value.bridge.enabled
      : false
)

function toggleMenu(key: string) {
  openMenu.value = openMenu.value === key ? null : key
}

function closeMenus() {
  openMenu.value = null
}

function profileFor(platform: Platform) {
  return platform.deviceProfileId ? props.deviceProfiles.find(profile => profile.id === platform.deviceProfileId) : null
}

function bridgeMethodFor(methodId: string) {
  return props.bridgeMethods.find(method => method.id == methodId)
}

function bridgeProviderFor(providerId: string) {
  return props.bridgeProviders.find(provider => provider.id == providerId)
}

function toggleBridgeEnabled(bridge: PlatformBridgeMock) {
  if (!props.selectedPlatform) return
  emit('update-bridge', props.selectedPlatform.id, { ...bridge, enabled: !bridge.enabled })
}

function cookiePresetFor(cookie: Cookie) {
  return cookie.presetId ? props.cookiePresets.find(preset => preset.id == cookie.presetId) : undefined
}

function cookieGroupFor(cookie: Cookie) {
  const preset = cookiePresetFor(cookie)
  return preset ? props.cookiePresetGroups.find(group => group.id == preset.groupId) : undefined
}

function toggleCookieEnabled(cookie: Cookie) {
  emit('update-cookie', { ...cookie, enabled: !cookie.enabled })
}

function viewCookie(cookie: Cookie) {
  configView.value = { type: 'cookie', cookie }
}

function viewBridge(bridge: PlatformBridgeMock) {
  configView.value = { type: 'bridge', bridge }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  closeMenus()
  configView.value = null
}

onMounted(() => {
  document.addEventListener('click', closeMenus)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenus)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <section class="min-w-0 flex-1 overflow-y-auto bg-white dark:bg-slate-950">
    <div v-if="!selection || !selectedPerson" class="flex min-h-full items-center justify-center p-8">
      <div class="max-w-sm text-center">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900">
          <FolderOpen :size="25" />
        </div>
        <h3 class="text-base font-semibold text-slate-700 dark:text-slate-200">选择一个人员开始管理</h3>
        <p class="mt-2 text-sm leading-6 text-slate-400">左侧负责定位层级，右侧只展示当前上下文的操作与数据。</p>
        <button class="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 lg:hidden dark:border-slate-700 dark:text-slate-300" @click="emit('open-nav')">
          <PanelLeftOpen :size="16" /> 打开导航
        </button>
      </div>
    </div>

    <div v-else-if="selection.type === 'person'" class="w-full p-5 lg:p-7">
      <header class="relative mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
        <div class="flex min-w-0 items-start gap-3">
          <button class="mt-0.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-900" title="打开导航" @click="emit('open-nav')">
            <PanelLeftOpen :size="18" />
          </button>
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <User :size="19" />
          </span>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Person</p>
            <h3 class="truncate text-xl font-semibold text-slate-800 dark:text-slate-100">{{ selectedPerson.name }}</h3>
            <p class="mt-1 text-sm text-slate-400">{{ selectedPerson.platforms.length }} 个平台 · {{ selectedPerson.platforms.reduce((sum, item) => sum + item.cookies.length, 0) }} 条 Cookie</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white" @click="emit('edit-person', selectedPerson)">
            <Edit3 :size="15" /> 编辑人员
          </button>
          <div class="relative" @click.stop>
            <button class="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white" title="更多操作" @click="toggleMenu('person')">
              <MoreHorizontal :size="17" />
            </button>
            <div v-if="openMenu === 'person'" class="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <button class="menu-item" @click="emit('copy-json', 'person', selectedPerson.id); closeMenus()"><Copy :size="14" />复制完整 JSON</button>
              <button class="menu-item" @click="emit('import-child', 'platform', selectedPerson.id); closeMenus()"><ClipboardPaste :size="14" />粘贴导入平台</button>
              <div class="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button class="menu-item menu-danger" @click="emit('delete', 'person', selectedPerson.id, selectedPerson.name); closeMenus()"><Trash2 :size="14" />删除人员</button>
            </div>
          </div>
        </div>
      </header>

      <div class="mb-3 flex items-center justify-between">
        <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-200">平台概览</h4>
        <span class="text-xs text-slate-400">选择平台以管理 Cookie 或 Bridge</span>
      </div>
      <div v-if="selectedPerson.platforms.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="platform in selectedPerson.platforms"
          :key="platform.id"
          class="group flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:bg-white hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-sky-800 dark:hover:bg-slate-900"
          @click="emit('select-platform', selectedPerson.id, platform.id)"
        >
          <span class="flex items-start justify-between gap-3">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl" :class="platform.mode == 'bridge' ? 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300'"><Code2 v-if="platform.mode == 'bridge'" :size="17" /><CookieIcon v-else :size="17" /></span>
            <ChevronRight :size="16" class="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
          </span>
          <span>
            <span class="flex items-center gap-2"><span class="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{{ platform.name }}</span><span class="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" :class="platform.mode == 'bridge' ? 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300'">{{ platform.mode == 'bridge' ? 'Bridge' : 'Cookie' }}</span></span>
            <span class="mt-1 block text-xs text-slate-400"><template v-if="platform.mode == 'bridge'">{{ platform.bridges?.filter(item => item.enabled).length || 0 }} 个 Bridge</template><template v-else>{{ platform.cookies.filter(item => item.enabled).length }} 条 Cookie</template><span v-if="props.uaInjectionEnabled && profileFor(platform)" class="text-sky-500"> · {{ profileFor(platform)?.name }}</span><span v-else-if="props.uaInjectionEnabled" class="text-amber-500"> · 未绑定设备</span></span>
          </span>
        </button>
      </div>
      <div v-else class="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-800">
        <Monitor :size="24" class="mx-auto mb-3 text-slate-300" />
        <p class="text-sm font-medium text-slate-600 dark:text-slate-300">还没有平台</p>
        <p class="mt-1 text-xs text-slate-400">添加平台后即可配置 Cookie 或 Bridge。</p>
      </div>
    </div>

    <div v-else-if="selectedPlatform" class="w-full p-5 lg:p-7">
      <header class="relative mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
        <div class="flex min-w-0 items-start gap-3">
          <button class="mt-0.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-900" title="打开导航" @click="emit('open-nav')"><PanelLeftOpen :size="18" /></button>
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="selectedPlatform.mode == 'bridge' ? 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300'"><Code2 v-if="selectedPlatform.mode == 'bridge'" :size="19" /><CookieIcon v-else :size="19" /></span>
          <div class="min-w-0">
            <p class="text-xs text-slate-400">{{ selectedPerson.name }} <span class="px-1">/</span> 平台</p>
            <h3 class="truncate text-xl font-semibold text-slate-800 dark:text-slate-100">{{ selectedPlatform.name }}</h3>
            <p class="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-slate-400">
              <span v-if="selectedPlatform.mode == 'cookie'" class="inline-flex items-center gap-1 text-amber-500"><CookieIcon :size="12" />Cookie 模式 · {{ selectedPlatform.cookies.filter(item => item.enabled).length }} 条已启用</span>
              <span v-else class="inline-flex items-center gap-1 text-violet-500"><Code2 :size="12" />Bridge 模式 · {{ selectedPlatform.bridges?.filter(item => item.enabled).length || 0 }} 个</span>
              <span v-if="props.uaInjectionEnabled && profileFor(selectedPlatform)" class="text-emerald-600 dark:text-emerald-400">· {{ profileFor(selectedPlatform)?.name }}</span><span v-else-if="props.uaInjectionEnabled" class="text-amber-500">· 未绑定设备UA预设</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white" @click="emit('edit-platform', selectedPerson.id, selectedPlatform)"><Edit3 :size="15" /> 编辑平台</button>
          <div class="relative" @click.stop>
            <button class="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white" title="更多操作" @click="toggleMenu('platform')"><MoreHorizontal :size="17" /></button>
            <div v-if="openMenu === 'platform'" class="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <button class="menu-item" @click="emit('copy-json', 'platform', selectedPerson.id, selectedPlatform.id); closeMenus()"><Copy :size="14" />复制完整 JSON</button>
              <button v-if="selectedPlatform.mode == 'cookie'" class="menu-item" @click="emit('import-child', 'cookie', selectedPerson.id, selectedPlatform.id); closeMenus()"><ClipboardPaste :size="14" />粘贴导入 Cookie</button>
              <div class="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button class="menu-item menu-danger" @click="emit('delete', 'platform', selectedPlatform.id, selectedPlatform.name, selectedPerson.id); closeMenus()"><Trash2 :size="14" />删除平台</button>
            </div>
          </div>
        </div>
      </header>

      <div v-if="selectedPlatform.mode == 'cookie'" class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
          <div><h4 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Cookie 配置</h4><p class="mt-0.5 text-[11px] text-slate-400">Key 来自 Cookie 预设，Value 在平台编辑器中单独覆盖。</p></div>
          <button class="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:border-amber-900 dark:bg-slate-900 dark:text-amber-300" @click="emit('edit-platform', selectedPerson.id, selectedPlatform)">选择或修改预设</button>
        </div>
        <div v-if="selectedPlatform.cookies.length" class="divide-y divide-slate-100 dark:divide-slate-800">
          <div
            v-for="cookie in selectedPlatform.cookies"
            :key="cookie.id"
            :data-cookie-id="cookie.id"
            class="px-4 py-3 transition-colors"
            :class="highlightCookieId === cookie.id ? 'bg-amber-50 ring-2 ring-inset ring-amber-300 dark:bg-amber-950/30 dark:ring-amber-700' : 'hover:bg-slate-50/70 dark:hover:bg-slate-900/40'"
          >
            <div class="flex items-center gap-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300"><CookieIcon :size="15" /></span>
              <div class="min-w-0 flex-1">
                <code class="block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{{ cookie.name }}</code>
                <p class="mt-0.5 text-[10px] text-slate-400">{{ cookieGroupFor(cookie)?.name || '自定义 Cookie' }}</p>
              </div>
              <button class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-amber-600 dark:hover:bg-slate-800 dark:hover:text-amber-300" title="查看 Cookie" @click="viewCookie(cookie)"><Eye :size="15" /></button>
              <button
                role="switch"
                :aria-checked="cookie.enabled"
                :aria-label="`${cookie.name}${cookie.enabled ? '已启用' : '已停用'}`"
                class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
                :class="cookie.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'"
                :title="cookie.enabled ? '点击停用' : '点击启用'"
                @click="toggleCookieEnabled(cookie)"
              >
                <span class="h-4 w-4 rounded-full bg-white shadow-sm transition-transform" :class="cookie.enabled ? 'translate-x-6' : 'translate-x-1'" />
              </button>
            </div>
          </div>
        </div>
        <div v-else class="px-6 py-14 text-center">
          <KeyRound :size="23" class="mx-auto mb-3 text-slate-300" />
          <p class="text-sm font-medium text-slate-600 dark:text-slate-300">尚未选择 Cookie Key</p>
          <p class="mt-1 text-xs text-slate-400">编辑平台后，从 Cookie 预设中选择需要注入的 Key。</p>
        </div>
      </div>

      <div v-else class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
          <div><h4 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Bridge Mock 配置</h4><p class="mt-0.5 text-[11px] text-slate-400">方法来自 Bridge 预设中的模板，返回值在平台编辑器中单独覆盖。</p></div>
          <button class="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-600 hover:bg-violet-50 dark:border-violet-900 dark:bg-slate-900 dark:text-violet-300" @click="emit('edit-platform', selectedPerson.id, selectedPlatform)">选择或修改模板</button>
        </div>
        <div v-if="selectedPlatform.bridges?.length" class="divide-y divide-slate-100 dark:divide-slate-800">
          <div v-for="bridge in selectedPlatform.bridges" :key="bridge.methodId" class="px-4 py-3">
            <div class="flex items-center gap-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300"><Code2 :size="15" /></span>
              <div class="min-w-0 flex-1">
                <code class="block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{{ bridgeMethodFor(bridge.methodId)?.objectPath.join('.') }}.{{ bridgeMethodFor(bridge.methodId)?.method || bridge.methodId }}</code>
                <p class="mt-0.5 text-[10px] text-slate-400">{{ bridgeProviderFor(bridgeMethodFor(bridge.methodId)?.providerId || '')?.name || '未知 Bridge 系统' }}</p>
              </div>
              <button class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-violet-600 dark:hover:bg-slate-800 dark:hover:text-violet-300" title="查看 Bridge 返回值" @click="viewBridge(bridge)"><Eye :size="15" /></button>
              <button
                role="switch"
                :aria-checked="bridge.enabled"
                :aria-label="`${bridgeMethodFor(bridge.methodId)?.method || bridge.methodId}${bridge.enabled ? '已启用' : '已停用'}`"
                class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
                :class="bridge.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'"
                :title="bridge.enabled ? '点击停用' : '点击启用'"
                @click="toggleBridgeEnabled(bridge)"
              >
                <span class="h-4 w-4 rounded-full bg-white shadow-sm transition-transform" :class="bridge.enabled ? 'translate-x-6' : 'translate-x-1'" />
              </button>
            </div>
          </div>
        </div>
        <div v-else class="px-6 py-14 text-center">
          <Code2 :size="23" class="mx-auto mb-3 text-slate-300" />
          <p class="text-sm font-medium text-slate-600 dark:text-slate-300">尚未选择 Bridge 模板</p>
          <p class="mt-1 text-xs text-slate-400">编辑平台后，从模板目录选择需要模拟的方法。</p>
        </div>
      </div>
    </div>
  </section>

  <Teleport to="body">
    <div v-if="configView" class="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" @mousedown.self="configView = null">
      <section class="flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div class="flex min-w-0 items-start gap-3">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              :class="configView.type == 'bridge'
                ? 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300'"
            >
              <Code2 v-if="configView.type == 'bridge'" :size="16" />
              <CookieIcon v-else :size="16" />
            </span>
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-[0.14em]" :class="configView.type == 'bridge' ? 'text-violet-500' : 'text-amber-500'">{{ configView.type == 'bridge' ? 'Bridge Mock' : 'Cookie Value' }}</p>
              <h3 class="mt-1 break-all font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{{ viewedTitle }}</h3>
              <div class="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                <span>{{ viewedSource }}</span>
                <span class="rounded-full px-2 py-0.5 font-semibold" :class="viewedEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'">{{ viewedEnabled ? '已启用' : '已停用' }}</span>
              </div>
            </div>
          </div>
          <button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" title="关闭" @click="configView = null"><X :size="17" /></button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">{{ configView.type == 'bridge' ? '实际返回值' : '当前 Value' }}</p>
            <span class="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ configView.type == 'bridge' ? 'JSON' : 'TEXT' }}</span>
          </div>
          <pre
            class="min-h-64 max-h-[52vh] overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6"
            :class="configView.type == 'bridge' ? 'text-emerald-300' : 'text-amber-200'"
          >{{ viewedValue || '(空)' }}</pre>
        </div>

        <footer class="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <span class="text-[11px] text-slate-400">当前为只读查看，修改请返回编辑平台。</span>
          <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900" @click="configView = null">关闭</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.menu-item {
  @apply flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white;
}

.menu-danger {
  @apply text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300;
}
</style>
