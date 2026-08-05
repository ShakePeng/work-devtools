<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CookieData, DeviceProfile, Platform } from '@shared/types'
import { resolveRuntimeBridges, TC_APP_BRIDGE_PROVIDER_ID } from '@shared/bridgeProfiles'
import BridgeList from './BridgeList.vue'
import BridgeViewModal from './BridgeViewModal.vue'
import CookieList from './CookieList.vue'
import CookieViewModal from './CookieViewModal.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { Check, ChevronDown, Code2, Cookie as CookieIcon, Eye, List, Pencil, Smartphone, Trash2, Zap } from 'lucide-vue-next'

const props = defineProps<{
  platform: Platform
  isExpanded: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{
  toggle: []
  remove: []
  update: [name: string]
  refresh: []
}>()

const cookiesApi = inject<any>('cookiesApi')!
const deviceProfilesApi = inject<{
  list: () => DeviceProfile[]
  available: () => DeviceProfile[]
  find: (id?: string) => DeviceProfile | undefined
  isUaInjectionEnabled: () => boolean
}>('deviceProfilesApi')
const toastEmit = inject<(msg: string, type: 'success' | 'error' | 'warning') => void>('showToast', () => {})
const storageData = inject<{ value: CookieData }>('storageData')

const isEditing = ref(false)
const editName = ref('')
const showConfirm = ref(false)
const isInjecting = ref(false)
const showView = ref(false)
const uaMenuOpen = ref(false)
const temporaryDeviceProfileId = ref('')

const deviceProfiles = computed(() => deviceProfilesApi?.available() || [])
const uaInjectionEnabled = computed(() => deviceProfilesApi?.isUaInjectionEnabled() != false)
const activeDeviceProfile = computed(() => deviceProfilesApi?.find(temporaryDeviceProfileId.value))
const uaLabel = computed(() => activeDeviceProfile.value?.name || '浏览器默认')
const cookieCount = computed(() => cookiesApi.list(props.platform.id).filter((cookie: { enabled?: boolean }) => cookie.enabled != false).length)
const bridgeCount = computed(() => props.platform.bridges?.filter(bridge => bridge.enabled).length || 0)
const runtimeBridges = computed(() => storageData
  ? resolveRuntimeBridges(props.platform.bridges, storageData.value.bridgeProviders, storageData.value.bridgeMethods)
  : []
)
const suggestedDeviceProfileId = computed(() => {
  if (props.platform.deviceProfileId) return props.platform.deviceProfileId
  const hasTcAppBridge = props.platform.mode == 'bridge' && props.platform.bridges?.some(bridge =>
    storageData?.value.bridgeMethods.some(method => method.id == bridge.methodId && method.providerId == TC_APP_BRIDGE_PROVIDER_ID)
  )
  return hasTcAppBridge ? 'builtin-tctravel-ios' : ''
})

watch(suggestedDeviceProfileId, profileId => { temporaryDeviceProfileId.value = profileId }, { immediate: true })

function startEdit() {
  editName.value = props.platform.name
  isEditing.value = true
}

function saveEdit() {
  if (editName.value.trim()) emit('update', editName.value.trim())
  isEditing.value = false
}

function chooseUa(id: string) {
  temporaryDeviceProfileId.value = id
  uaMenuOpen.value = false
}

function closeUaMenu() {
  uaMenuOpen.value = false
}

async function handleInject() {
  const cookies = props.platform.mode == 'cookie'
    ? cookiesApi.list(props.platform.id).filter((cookie: { enabled?: boolean }) => cookie.enabled != false)
    : []
  const bridges = props.platform.mode == 'bridge' ? runtimeBridges.value : []
  if (!cookies.length && !bridges.length) {
    toastEmit(props.platform.mode == 'bridge' ? '该平台还没有配置 Bridge Mock' : '该平台下没有 Cookie', 'warning')
    return
  }

  isInjecting.value = true
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url) {
      toastEmit('无法获取当前标签页', 'error')
      return
    }

    const response = await chrome.runtime.sendMessage({
      type: 'INJECT_COOKIES',
      cookies,
      targetUrl: tab.url,
      tabId: tab.id,
      deviceProfile: activeDeviceProfile.value,
      bridges,
    })

    if (!response) {
      toastEmit('后台服务未响应，请在扩展管理页重新加载扩展', 'error')
      return
    }
    if (response.success > 0 || response.bridgeSuccess > 0) {
      const parts = []
      if (props.platform.mode == 'cookie') parts.push(`${response.success} 条 Cookie`)
      if (response.bridgeSuccess) parts.push(`${response.bridgeSuccess} 个 Bridge`)
      const uaResult = activeDeviceProfile.value
        ? response.uaError
          ? '；页面 UA 已生效，请求头覆盖失败'
          : `；UA：${activeDeviceProfile.value.name}`
        : ''
      toastEmit(`成功注入 ${parts.join('、')}${uaResult}${response.failed ? `，${response.failed} 条 Cookie 失败` : ''}`, response.failed || response.uaError ? 'warning' : 'success')
      if (tab.id != null) await chrome.tabs.reload(tab.id)
    } else {
      toastEmit(response.errors?.[0] || '注入失败', 'error')
    }
  } catch (error) {
    toastEmit(`注入出错：${(error as Error).message}`, 'error')
  } finally {
    isInjecting.value = false
  }
}

onMounted(() => document.addEventListener('click', closeUaMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeUaMenu))
</script>

<template>
  <article class="relative rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
    <div class="flex min-h-12 items-center gap-1.5 px-2.5 py-2">
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" :class="platform.mode == 'bridge' ? 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300'"><Code2 v-if="platform.mode == 'bridge'" :size="14" /><CookieIcon v-else :size="14" /></span>

      <div class="min-w-0 flex-1">
        <template v-if="isEditing">
          <input v-model="editName" class="input-field w-full text-sm !py-1" placeholder="平台名称" @keyup.escape="isEditing = false" @keyup.enter="saveEdit" />
        </template>
        <template v-else>
          <h3 class="truncate text-[13px] font-semibold leading-4 text-slate-700 dark:text-slate-100">{{ platform.name }}</h3>
          <p class="text-[9px] leading-3" :class="platform.mode == 'bridge' ? 'text-violet-500' : 'text-amber-500'">{{ platform.mode == 'bridge' ? `${bridgeCount} 个 Bridge` : `${cookieCount} 条 Cookie` }}</p>
        </template>
      </div>

      <div v-if="isEditing" class="flex shrink-0 gap-0.5">
        <button class="rounded-md bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white" @click="saveEdit">保存</button>
        <button class="rounded-md px-1.5 py-1 text-[10px] text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="isEditing = false">取消</button>
      </div>

      <template v-else>
        <div v-if="uaInjectionEnabled" class="relative shrink-0" @click.stop>
          <button
            class="inline-flex h-7 max-w-[142px] items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
            title="临时切换本次注入的 UA"
            @click="uaMenuOpen = !uaMenuOpen"
            @keyup.escape="uaMenuOpen = false"
          >
            <Smartphone :size="12" class="shrink-0" />
            <span class="truncate">{{ uaLabel }}</span>
            <ChevronDown :size="11" class="shrink-0 transition-transform" :class="uaMenuOpen ? 'rotate-180' : ''" />
          </button>

          <div v-if="uaMenuOpen" class="absolute right-0 top-8 z-30 w-[280px] overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <p class="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">临时 UA · 不保存</p>
            <button class="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[10px] transition-colors hover:bg-slate-50 dark:hover:bg-slate-800" :class="!temporaryDeviceProfileId ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'" @click="chooseUa('')">
              <Check v-if="!temporaryDeviceProfileId" :size="12" /><span v-else class="w-3" />浏览器默认
            </button>
            <button v-for="profile in deviceProfiles" :key="profile.id" class="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[10px] transition-colors hover:bg-slate-50 dark:hover:bg-slate-800" :class="temporaryDeviceProfileId === profile.id ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'" @click="chooseUa(profile.id)">
              <Check v-if="temporaryDeviceProfileId === profile.id" :size="12" /><span v-else class="w-3" />{{ profile.name }}
            </button>
          </div>
        </div>

        <button class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800" :title="platform.mode == 'bridge' ? '查看 Bridge 配置' : '查看 Cookie'" @click="showView = true"><Eye :size="14" /></button>
        <button class="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-sky-600 px-2 text-[10px] font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:opacity-50" :disabled="isInjecting" title="注入 Cookie、UA 与 Bridge 到当前页面" @click="handleInject"><span v-if="isInjecting" class="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /><Zap v-else :size="12" />注入</button>
        <button class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" :class="isExpanded ? 'bg-sky-50 text-sky-600 dark:bg-slate-800 dark:text-sky-300' : ''" :title="isExpanded ? (platform.mode == 'bridge' ? '收起 Bridge' : '收起 Cookie') : (platform.mode == 'bridge' ? '展开 Bridge' : '展开 Cookie')" @click="emit('toggle')"><List :size="14" /></button>

        <template v-if="!readonly">
          <button class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800" title="编辑平台" @click="startEdit"><Pencil :size="13" /></button>
          <button class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40" title="删除平台" @click="showConfirm = true"><Trash2 :size="13" /></button>
        </template>
      </template>
    </div>

    <Transition name="collapse">
      <div v-if="isExpanded" class="border-t border-slate-100 bg-slate-50/65 dark:border-slate-800 dark:bg-slate-950/30">
        <div class="px-2.5 py-2"><CookieList v-if="platform.mode == 'cookie'" :platform="platform" /><BridgeList v-else :platform="platform" /></div>
      </div>
    </Transition>

    <ConfirmDialog v-if="showConfirm" title="删除平台" :message="`确定要删除「${platform.name}」吗？其下的所有配置数据也会被删除。`" confirm-text="删除" @confirm="emit('remove'); showConfirm = false" @cancel="showConfirm = false" />
    <CookieViewModal v-if="showView && platform.mode == 'cookie'" :platform-id="platform.id" :platform-name="platform.name" @close="showView = false" @refresh="emit('refresh')" />
    <BridgeViewModal v-if="showView && platform.mode == 'bridge'" :platform="platform" @close="showView = false" />
  </article>
</template>
