<script setup lang="ts">
import { ref } from 'vue'
import type { WorkDevToolsData } from '@shared/types'
import { FileJson, AlertTriangle, Download, Upload, DatabaseBackup } from 'lucide-vue-next'

const props = defineProps<{
  importExport: any
  saveData: (d: WorkDevToolsData) => Promise<void>
  clearAll: () => Promise<void>
  embedded?: boolean
}>()

const emit = defineEmits<{
  toast: [msg: string, type: 'success' | 'error' | 'warning']
}>()

const mode = ref<'overwrite' | 'merge'>('overwrite')
const step = ref<'select' | 'preview'>('select')
const expandedPersons = ref<Set<string>>(new Set())
const expandedPlatforms = ref<Set<string>>(new Set())
const showClearConfirm = ref(false)
const importing = ref(false)

function togglePerson(id: string) {
  if (expandedPersons.value.has(id)) {
    expandedPersons.value.delete(id)
  } else {
    expandedPersons.value.add(id)
  }
  expandedPersons.value = new Set(expandedPersons.value)
}

function togglePlatform(id: string) {
  if (expandedPlatforms.value.has(id)) {
    expandedPlatforms.value.delete(id)
  } else {
    expandedPlatforms.value.add(id)
  }
  expandedPlatforms.value = new Set(expandedPlatforms.value)
}

function handleFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    const preview = props.importExport.previewFile(text)
    if (preview) {
      step.value = 'preview'
    } else {
      emit('toast', props.importExport.importError.value || '文件解析失败', 'error')
    }
  }
  reader.readAsText(file)
  input.value = ''
}

async function handleImport() {
  importing.value = true
  try {
    const preview = props.importExport.importPreview.value
    if (!preview) return

    let newData: WorkDevToolsData
    if (mode.value == 'overwrite') {
      newData = props.importExport.buildOverwriteData(preview.data)
      await props.clearAll()
    } else {
      newData = props.importExport.mergeData(preview.data)
    }

    await props.saveData(newData)
    emit('toast', `导入成功！人员 ${preview.persons} / 平台 ${preview.platforms} / Cookie ${preview.cookies}`, 'success')
    step.value = 'select'
    props.importExport.importPreview.value = null
  } catch (e) {
    emit('toast', `导入失败: ${(e as Error).message}`, 'error')
  } finally {
    importing.value = false
  }
}

async function handleClear() {
  await props.clearAll()
  showClearConfirm.value = false
  emit('toast', '已清空所有数据', 'success')
}

const preview = () => props.importExport.importPreview.value
</script>

<template>
  <div :class="embedded ? '' : 'manager-page'">
    <header v-if="!embedded" class="manager-page-header">
      <div class="flex items-start gap-3">
        <span class="manager-page-icon"><DatabaseBackup :size="20" /></span>
        <div>
          <p class="manager-page-kicker">Backup & Migration</p>
          <h2 class="manager-page-title">导入导出</h2>
          <p class="manager-page-description">备份完整 Work DevTools 数据，或从已有 JSON 文件恢复和迁移工具数据。</p>
        </div>
      </div>
    </header>

    <div class="grid gap-x-5 gap-y-2 xl:grid-cols-2">
      <!-- 导出 -->
      <section class="manager-surface flex min-h-64 flex-col p-6">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <p class="manager-section-label">Export</p>
            <h3 class="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">导出完整备份</h3>
          </div>
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <Download :size="18" />
          </span>
        </div>
        <p class="text-sm leading-6 text-slate-500 dark:text-slate-400">将当前全部工具数据导出为统一的 Work DevTools JSON 文件，可用于离线备份或迁移到其他设备。</p>
        <div class="mt-auto pt-6">
          <button
            class="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
            @click="importExport.downloadJson()"
          >
            <FileJson :size="16" />
            导出 JSON 文件
          </button>
        </div>
      </section>

      <!-- 导入 -->
      <section class="manager-surface min-h-64 p-6">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <p class="manager-section-label">Import</p>
            <h3 class="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">从备份恢复</h3>
          </div>
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <Upload :size="18" />
          </span>
        </div>

      <template v-if="step === 'select'">
        <p class="mb-5 text-sm leading-6 text-slate-500 dark:text-slate-400">选择之前导出的 JSON 备份，系统会先展示数据规模和导入方式，不会立即覆盖现有数据。</p>
        <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-950/40">
          <label class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <FileJson :size="16" />
            选择备份文件
            <input type="file" accept=".json" class="hidden" @change="handleFile" />
          </label>
          <p class="mt-3 text-xs text-slate-400">支持 Work DevTools 完整备份，也兼容旧版 Cookie Injector JSON。</p>
        </div>
      </template>

      <!-- 预览 -->
      <template v-if="step === 'preview' && preview()">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div class="manager-surface-muted p-3 text-center"><p class="text-lg font-semibold text-slate-700 dark:text-slate-200">{{ preview().persons }}</p><p class="text-[10px] text-slate-400">人员</p></div>
            <div class="manager-surface-muted p-3 text-center"><p class="text-lg font-semibold text-slate-700 dark:text-slate-200">{{ preview().platforms }}</p><p class="text-[10px] text-slate-400">平台</p></div>
            <div class="manager-surface-muted p-3 text-center"><p class="text-lg font-semibold text-slate-700 dark:text-slate-200">{{ preview().cookies }}</p><p class="text-[10px] text-slate-400">Cookie</p></div>
            <div class="manager-surface-muted p-3 text-center"><p class="text-lg font-semibold text-slate-700 dark:text-slate-200">{{ preview().projects }}</p><p class="text-[10px] text-slate-400">项目</p></div>
            <div class="manager-surface-muted p-3 text-center"><p class="text-lg font-semibold text-slate-700 dark:text-slate-200">{{ preview().pages }}</p><p class="text-[10px] text-slate-400">页面</p></div>
          </div>

          <!-- 导入模式 -->
          <div class="grid gap-2 sm:grid-cols-2">
            <label class="manager-surface-muted flex cursor-pointer items-start gap-2.5 p-3">
              <input v-model="mode" type="radio" value="overwrite" class="text-blue-500" />
              <span><span class="block text-sm font-medium text-slate-700 dark:text-slate-200">覆盖导入</span><span class="mt-0.5 block text-xs text-slate-400">清空现有数据后恢复</span></span>
            </label>
            <label class="manager-surface-muted flex cursor-pointer items-start gap-2.5 p-3">
              <input v-model="mode" type="radio" value="merge" class="text-blue-500" />
              <span><span class="block text-sm font-medium text-slate-700 dark:text-slate-200">合并导入</span><span class="mt-0.5 block text-xs text-slate-400">保留现有数据并追加</span></span>
            </label>
          </div>

          <div class="flex gap-2">
            <button
              class="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              :disabled="importing"
              @click="handleImport"
            >
              {{ importing ? '导入中...' : '确认导入' }}
            </button>
            <button
              class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              @click="step = 'select'; importExport.importPreview.value = null"
            >
              取消
            </button>
          </div>
        </div>
      </template>
      </section>
    </div>

    <!-- 清空 -->
    <section class="mt-2 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50/60 p-5 dark:border-red-950 dark:bg-red-950/20">
      <div class="flex items-start gap-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-red-500 shadow-sm dark:bg-slate-900"><AlertTriangle :size="17" /></span>
        <div>
          <h3 class="text-sm font-semibold text-red-700 dark:text-red-300">危险操作</h3>
          <p class="mt-1 text-xs leading-5 text-red-600/70 dark:text-red-300/70">清空 Cookie Injector 与常用开发地址的全部数据，此操作不可恢复。</p>
        </div>
      </div>
      <button
        v-if="!showClearConfirm"
        class="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-600 hover:text-white dark:border-red-900 dark:bg-slate-900"
        @click="showClearConfirm = true"
      >清空所有数据</button>
      <div v-else class="flex items-center gap-2">
        <span class="text-xs font-medium text-red-600 dark:text-red-300">确定清空？</span>
        <button class="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700" @click="handleClear">确认</button>
        <button class="rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-white dark:hover:bg-slate-900" @click="showClearConfirm = false">取消</button>
      </div>
    </section>
  </div>
</template>
