<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useLocalStorage } from '@shared/composables/useLocalStorage'
import { usePersons } from '@shared/composables/usePersons'
import { usePlatforms } from '@shared/composables/usePlatforms'
import { useCookies } from '@shared/composables/useCookies'
import { useDeviceProfiles } from '@shared/composables/useDeviceProfiles'
import { getManagerPagePath, MANAGER_NAV } from '@shared/managerNavigation'
import PersonList from './components/PersonList.vue'
import Toast from './components/Toast.vue'
import { Database, ExternalLink, KeyRound, Layers3, Settings, Users } from 'lucide-vue-next'

const { data, workspaceData, loading, error, loadData, saveData, startWatchExternal } = useLocalStorage()

const personsApi = usePersons(data, saveData)
const platformsApi = usePlatforms(data, saveData)
const cookiesApi = useCookies(data, saveData)
const deviceProfilesApi = useDeviceProfiles(data, saveData)

const dataVersion = ref(0)
const toastMsg = ref('')
const toastType = ref<'success' | 'error' | 'warning'>('success')
const toastKey = ref(0)
const extensionVersion = chrome.runtime.getManifest().version

watch(
  () => workspaceData.value.updatedAt,
  () => { dataVersion.value++ }
)

const stats = computed(() => {
  let platforms = 0
  let cookies = 0
  data.value.persons.forEach(person => {
    platforms += person.platforms.length
    person.platforms.forEach(platform => { cookies += platform.cookies.length })
  })
  return { persons: data.value.persons.length, platforms, cookies }
})

provide('personsApi', personsApi)
provide('platformsApi', platformsApi)
provide('cookiesApi', cookiesApi)
provide('deviceProfilesApi', deviceProfilesApi)
provide('storageData', data)
provide('showToast', showToast)
provide('dataVersion', dataVersion)

function showToast(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
  toastMsg.value = msg
  toastType.value = type
  toastKey.value++
}

/** 打开管理页面（新标签页） */
function openManager() {
  void chrome.tabs.create({
    url: chrome.runtime.getURL(getManagerPagePath(MANAGER_NAV.cookieData)),
  })
}

onMounted(async () => {
  await loadData()
  // 监听管理页面侧的 storage 变更，自动刷新数据
  startWatchExternal()
})
</script>

<template>
  <div class="flex h-[600px] flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
    <!-- Loading -->
    <div
      v-if="loading"
      class="absolute inset-0 z-50 flex items-center justify-center bg-slate-100/80 backdrop-blur-sm dark:bg-slate-950/80"
    >
      <div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        <span class="text-sm font-medium text-slate-500 dark:text-slate-300">加载数据...</span>
      </div>
    </div>

    <!-- Header -->
    <header class="shrink-0 border-b border-slate-200 bg-white px-3 pb-2.5 pt-3 dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-center justify-between">
        <div class="flex min-w-0 items-center gap-2.5">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
            <Database :size="16" />
          </div>
          <div class="min-w-0">
            <h1 class="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">Work DevTools</h1>
            <p class="text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400">Quick workspace</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            class="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-sky-600 px-2 text-[11px] font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
            title="打开管理页面进行数据增删改查"
            @click="openManager"
          >
            <Settings :size="14" />管理
            <ExternalLink :size="11" class="opacity-70" />
          </button>
        </div>
      </div>

      <div class="mt-2.5 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/60">
        <div class="flex items-center justify-center gap-1.5 border-r border-slate-100 py-1.5 dark:border-slate-800">
          <Users :size="12" class="text-sky-500" />
          <p class="text-[10px] text-slate-400"><span class="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{{ stats.persons }}</span> 人员</p>
        </div>
        <div class="flex items-center justify-center gap-1.5 border-r border-slate-100 py-1.5 dark:border-slate-800">
          <Layers3 :size="12" class="text-indigo-500" />
          <p class="text-[10px] text-slate-400"><span class="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{{ stats.platforms }}</span> 平台</p>
        </div>
        <div class="flex items-center justify-center gap-1.5 py-1.5">
          <KeyRound :size="12" class="text-emerald-500" />
          <p class="text-[10px] text-slate-400"><span class="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{{ stats.cookies }}</span> Cookie</p>
        </div>
      </div>
    </header>

    <!-- Error -->
    <div
      v-if="error"
      class="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs text-red-600 shadow-sm dark:border-red-900 dark:bg-slate-900 dark:text-red-300"
    >
      <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-50 font-semibold dark:bg-red-950">!</span>
      <span class="min-w-0 flex-1">{{ error }}</span>
      <button class="rounded-lg bg-red-50 px-2 py-1 font-medium hover:bg-red-100 dark:bg-red-950" @click="loadData">重试</button>
    </div>

    <!-- Main -->
    <main v-if="!loading" class="min-h-0 flex-1 overflow-y-auto p-2.5">
      <PersonList />
    </main>

    <footer class="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-3 py-1.5 text-[9px] text-slate-400 dark:border-slate-800 dark:bg-slate-900">
      <span>选择平台后可查看或注入 Cookie</span>
      <span class="font-medium text-slate-500 dark:text-slate-400">v{{ extensionVersion }}</span>
    </footer>
  </div>

  <!-- Toast -->
  <Toast :message="toastMsg" :type="toastType" :key="toastKey" />
</template>
