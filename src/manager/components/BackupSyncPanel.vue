<script setup lang="ts">
import { ref } from 'vue'
import type { WorkDevToolsData } from '@shared/types'
import type { WebDavSyncApi } from '@shared/composables/useWebDavSync'
import { Cloud, DatabaseBackup, FileJson } from 'lucide-vue-next'
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

    <nav class="manager-surface flex w-fit items-center gap-1 p-1.5" aria-label="备份与同步功能">
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
