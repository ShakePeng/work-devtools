<script setup lang="ts">
import { computed, onMounted, ref, provide } from 'vue'
import { useLocalStorage } from '@shared/composables/useLocalStorage'
import { usePersons } from '@shared/composables/usePersons'
import { usePlatforms } from '@shared/composables/usePlatforms'
import { useCookies } from '@shared/composables/useCookies'
import { useDeviceProfiles } from '@shared/composables/useDeviceProfiles'
import { useBridgeProfiles } from '@shared/composables/useBridgeProfiles'
import { useCookieProfiles } from '@shared/composables/useCookieProfiles'
import { useImportExport } from '@shared/composables/useImportExport'
import { useWebDavSync } from '@shared/composables/useWebDavSync'
import { FolderTree, Database, DatabaseBackup, Smartphone, Code2, Cookie } from 'lucide-vue-next'
import UnifiedTreeManager from './components/UnifiedTreeManager.vue'
import BackupSyncPanel from './components/BackupSyncPanel.vue'
import Toast from './components/Toast.vue'
import DeviceProfilePanel from './components/DeviceProfilePanel.vue'
import BridgeProfilePanel from './components/BridgeProfilePanel.vue'
import CookieProfilePanel from './components/CookieProfilePanel.vue'

type ToolKey = 'cookie-injector'
type NavKey =
  | 'cookie-injector:data'
  | 'cookie-injector:cookies'
  | 'cookie-injector:bridges'
  | 'cookie-injector:devices'
  | 'backup-sync'

interface NavItem {
  key: NavKey
  label: string
  description: string
  icon: any
}

interface ToolNavGroup {
  key: ToolKey
  label: string
  description: string
  icon: any
  children: NavItem[]
}

const activeNav = ref<NavKey>('cookie-injector:data')

const {
  data,
  workspaceData,
  loading,
  error,
  loadData,
  saveData,
  saveDataImmediate,
  saveWorkspaceDataImmediate,
  clearAll,
  startWatchExternal,
} = useLocalStorage()
const personsApi = usePersons(data, saveData)
const platformsApi = usePlatforms(data, saveData)
const cookiesApi = useCookies(data, saveData)
const deviceProfilesApi = useDeviceProfiles(data, saveDataImmediate)
const bridgeProfilesApi = useBridgeProfiles(data, saveDataImmediate)
const cookieProfilesApi = useCookieProfiles(data, saveDataImmediate)
const importExport = useImportExport(workspaceData)
const webDavSync = useWebDavSync(workspaceData, saveWorkspaceDataImmediate)

const toastMsg = ref('')
const toastType = ref<'success' | 'error' | 'warning'>('success')
const toastKey = ref(0)

function showToast(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
  toastMsg.value = msg
  toastType.value = type
  toastKey.value++
}

provide('personsApi', personsApi)
provide('platformsApi', platformsApi)
provide('cookiesApi', cookiesApi)
provide('deviceProfilesApi', deviceProfilesApi)
provide('bridgeProfilesApi', bridgeProfilesApi)
provide('cookieProfilesApi', cookieProfilesApi)
provide('showToast', showToast)
provide('storageData', data)
provide('saveDataImmediate', saveDataImmediate)
provide('workspaceData', workspaceData)
provide('saveWorkspaceDataImmediate', saveWorkspaceDataImmediate)

const toolNavGroups: ToolNavGroup[] = [
  {
    key: 'cookie-injector',
    label: 'Cookie Injector',
    description: 'Cookie 与 Bridge 注入',
    icon: Cookie,
    children: [
      { key: 'cookie-injector:data', label: '数据管理', description: '人员、平台与 Cookie', icon: FolderTree },
      { key: 'cookie-injector:cookies', label: 'Cookie 预设', description: '分组、Key 与默认值', icon: Cookie },
      { key: 'cookie-injector:bridges', label: 'Bridge 预设', description: '方法目录与默认返回值', icon: Code2 },
      { key: 'cookie-injector:devices', label: '设备UA预设', description: 'User-Agent 与设备身份', icon: Smartphone },
    ],
  },
]

const workspaceNavItems: NavItem[] = [
  { key: 'backup-sync', label: '备份与同步', description: '导入导出与 WebDAV', icon: DatabaseBackup },
]

const activeToolGroup = computed(() =>
  toolNavGroups.find(group => group.children.some(item => item.key == activeNav.value)) || null
)

function isToolActive(group: ToolNavGroup): boolean {
  return group.children.some(item => item.key == activeNav.value)
}

function selectTool(group: ToolNavGroup): void {
  activeNav.value = group.children[0].key
}

onMounted(async () => {
  await loadData()
  startWatchExternal()
  await webDavSync.init()
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-100/80 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
    <div
      v-if="loading"
      class="absolute inset-0 z-50 flex items-center justify-center bg-slate-100/75 backdrop-blur-sm dark:bg-slate-950/75"
    >
      <div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        <span class="text-sm font-medium text-slate-600 dark:text-slate-300">正在加载管理数据...</span>
      </div>
    </div>

    <div
      v-if="error"
      class="absolute left-1/2 top-4 z-50 flex max-w-[640px] -translate-x-1/2 items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-600 shadow-xl dark:border-red-900 dark:bg-slate-900 dark:text-red-300"
    >
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/50">!</span>
      <span class="min-w-0 flex-1">{{ error }}</span>
      <button class="shrink-0 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-950" @click="loadData">重试</button>
    </div>

    <!-- 左侧导航 -->
    <nav class="flex w-[248px] shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div class="flex h-[76px] items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
          <Database :size="19" />
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">Work DevTools</h1>
          <p class="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Workspace</p>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto px-3 py-4">
        <p class="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">开发工具</p>
        <button
          v-for="group in toolNavGroups"
          :key="group.key"
          class="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
          :class="isToolActive(group)
            ? 'bg-slate-50 text-slate-900 dark:bg-slate-800/70 dark:text-white'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white'"
          :aria-current="isToolActive(group) ? 'page' : undefined"
          @click="selectTool(group)"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            :class="isToolActive(group)
              ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300'
              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'"
          >
            <component :is="group.icon" :size="16" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold">{{ group.label }}</span>
            <span class="mt-0.5 block truncate text-[10px] opacity-60">{{ group.description }}</span>
          </span>
        </button>

        <p class="mb-2 mt-5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">工作区</p>
        <button
          v-for="item in workspaceNavItems"
          :key="item.key"
          class="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all"
          :class="activeNav == item.key
            ? 'bg-sky-50 text-sky-800 shadow-sm ring-1 ring-sky-100 dark:bg-sky-950/60 dark:text-sky-200 dark:ring-sky-900'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white'"
          @click="activeNav = item.key"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            :class="activeNav == item.key
              ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-900 dark:text-sky-400'
              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'"
          >
            <component :is="item.icon" :size="16" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold">{{ item.label }}</span>
            <span class="mt-0.5 block truncate text-[10px] opacity-60">{{ item.description }}</span>
          </span>
        </button>
      </div>
    </nav>

    <!-- 主内容区 -->
    <main class="min-w-0 flex-1 overflow-hidden">
      <div v-if="activeToolGroup" class="flex h-full min-h-0 flex-col">
        <div class="shrink-0 border-b border-slate-200 bg-white/80 px-3 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:px-5">
          <nav
            class="flex max-w-full w-fit items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-950/70"
            :aria-label="`${activeToolGroup.label} 功能`"
          >
            <button
              v-for="item in activeToolGroup.children"
              :key="item.key"
              class="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
              :class="activeNav == item.key
                ? 'bg-white text-sky-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-sky-300 dark:ring-slate-700'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'"
              :aria-current="activeNav == item.key ? 'page' : undefined"
              @click="activeNav = item.key"
            >
              <component
                :is="item.icon"
                :size="15"
                :class="activeNav == item.key ? 'text-sky-500' : 'text-slate-400 dark:text-slate-500'"
              />
              {{ item.label }}
            </button>
          </nav>
        </div>

        <div
          class="min-h-0 flex-1"
          :class="activeNav == 'cookie-injector:data' ? 'overflow-hidden p-3' : 'overflow-y-auto p-5 lg:p-7'"
        >
          <UnifiedTreeManager v-if="activeNav == 'cookie-injector:data'" />

          <DeviceProfilePanel v-else-if="activeNav == 'cookie-injector:devices'" :api="deviceProfilesApi" @toast="showToast" />

          <CookieProfilePanel v-else-if="activeNav == 'cookie-injector:cookies'" :api="cookieProfilesApi" @toast="showToast" />

          <BridgeProfilePanel v-else-if="activeNav == 'cookie-injector:bridges'" :api="bridgeProfilesApi" @toast="showToast" />
        </div>
      </div>

      <div v-else class="h-full overflow-y-auto p-5 lg:p-7">
        <BackupSyncPanel
          v-if="activeNav == 'backup-sync'"
          :import-export="importExport"
          :save-data="saveWorkspaceDataImmediate"
          :clear-all="clearAll"
          :web-dav-sync="webDavSync"
          @toast="showToast"
        />
      </div>
    </main>

    <Toast :message="toastMsg" :type="toastType" :key="toastKey" />
  </div>
</template>
