<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { WorkDevToolsData } from '@shared/types'
import type { WebDavSyncApi } from '@shared/composables/useWebDavSync'
import { STORAGE_KEYS } from '@shared/storageKeys'
import { Cloud, DatabaseBackup, FileJson, KeyRound } from 'lucide-vue-next'
import ImportExportPanel from './ImportExportPanel.vue'
import SyncPanel from './SyncPanel.vue'

defineProps<{
  importExport: any
  saveData: (data: WorkDevToolsData) => Promise<void>
  clearAll: () => Promise<void>
  webDavSync: WebDavSyncApi
}>()

const emit = defineEmits<{
  toast: [message: string, type: 'success' | 'error' | 'warning']
}>()

const activeTab = ref<'backup' | 'sync'>('backup')
const sensitiveExportEnabled = ref(false)

onMounted(async () => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.sensitiveExportEnabled)
    sensitiveExportEnabled.value = result[STORAGE_KEYS.sensitiveExportEnabled] == true
  } catch {
    // 读取失败保留默认关闭
  }
})

async function toggleSensitiveExport(): Promise<void> {
  const next = !sensitiveExportEnabled.value
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.sensitiveExportEnabled]: next,
    })
    sensitiveExportEnabled.value = next
    emit('toast', next
      ? '已开启：导出与同步将携带 TinyPNG API Key'
      : '已关闭：导出与同步不再携带 TinyPNG API Key', 'success')
  } catch (error) {
    emit('toast', `保存失败:${(error as Error).message}`, 'error')
  }
}
</script>

<template>
  <div class="manager-page">
    <header class="manager-page-header">
      <div class="flex items-start gap-3">
        <span class="manager-page-icon"><DatabaseBackup :size="20" /></span>
        <div>
          <p class="manager-page-kicker">Backup & Sync</p>
          <h2 class="manager-page-title">备份与同步</h2>
          <p class="manager-page-description">通过 JSON 文件备份或迁移全部工具数据，也可以使用 NAS WebDAV 在设备间手动同步。</p>
        </div>
      </div>
    </header>

    <nav class="manager-surface mb-2 flex w-fit items-center gap-1 p-1.5" aria-label="备份与同步功能">
      <button
        class="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
        :class="activeTab == 'backup'
          ? 'bg-sky-600 text-white shadow-sm'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'"
        @click="activeTab = 'backup'"
      >
        <FileJson :size="15" />导入导出
      </button>
      <button
        class="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
        :class="activeTab == 'sync'
          ? 'bg-sky-600 text-white shadow-sm'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'"
        @click="activeTab = 'sync'"
      >
        <Cloud :size="15" />WebDAV 同步
      </button>
    </nav>

    <section class="manager-surface mb-2 p-4">
      <label
        class="flex cursor-pointer items-start gap-3"
      >
        <input
          type="checkbox"
          :checked="sensitiveExportEnabled"
          class="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-950"
          @change="toggleSensitiveExport"
        />
        <span class="min-w-0">
          <span class="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            <KeyRound :size="14" class="text-amber-500" />
            导出敏感信息
          </span>
          <span class="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
            开启后，JSON 导出和 WebDAV 同步会携带 TinyPNG API Key，迁移到其他设备免重复配置；关闭则只包含普通工具数据。
          </span>
        </span>
      </label>
    </section>

    <ImportExportPanel
      v-if="activeTab == 'backup'"
      :import-export="importExport"
      :save-data="saveData"
      :clear-all="clearAll"
      embedded
      @toast="(message, type) => emit('toast', message, type)"
    />
    <SyncPanel
      v-else
      :web-dav-sync="webDavSync"
      embedded
      @toast="(message, type) => emit('toast', message, type)"
    />
  </div>
</template>
