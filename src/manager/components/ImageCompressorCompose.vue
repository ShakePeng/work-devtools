<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import JSZip from 'jszip'
import type { ImageCompressorSettings } from '@shared/types'
import {
  type CompressEngine,
  type CompressFormat,
  type CompressInput,
  type CompressResult,
  createTinifyEngine,
  formatExtension,
  inferFormatFromMime,
  localEngine,
  replaceExtension,
} from '@shared/imageCompressor'
import {
  Check,
  Download,
  FileImage,
  ImagePlus,
  Loader2,
  Package,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-vue-next'

const props = defineProps<{
  settings: ImageCompressorSettings
  saveSettings: (data: { settings: ImageCompressorSettings }) => Promise<void>
}>()

const emit = defineEmits<{
  toast: [message: string, type: 'success' | 'error' | 'warning']
}>()

type ItemStatus = 'pending' | 'processing' | 'done' | 'error'

interface QueueItem {
  id: string
  file: File
  name: string
  size: number
  status: ItemStatus
  result?: CompressResult
  error?: string
  selected: boolean
}

const queue = ref<QueueItem[]>([])
const engineChoice = ref<'local' | 'tinify'>(props.settings.defaultEngine)
const processing = ref(false)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
let counter = 0

const tinifyKeys = computed(() => props.settings.tinifyApiKeys || [])

function pickFiles(list: FileList | File[]): Array<File> {
  return Array.from(list).filter(f => f.type.startsWith('image/'))
}

function addFiles(files: Array<File>): void {
  if (!files.length) return
  for (const file of files) {
    queue.value.push({
      id: `item-${++counter}`,
      file,
      name: file.name || 'image',
      size: file.size,
      status: 'pending',
      selected: false,
    })
  }
}

function onFileInput(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files?.length) addFiles(pickFiles(input.files))
  input.value = ''
}

function onDrop(event: DragEvent): void {
  if (!event.dataTransfer?.files?.length) return
  event.preventDefault()
  addFiles(pickFiles(event.dataTransfer.files))
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
}

function removeItem(id: string): void {
  const index = queue.value.findIndex(item => item.id == id)
  if (index >= 0) queue.value.splice(index, 1)
}

function clearQueue(): void {
  queue.value = []
}

function clearDone(): void {
  queue.value = queue.value.filter(item => item.status != 'done')
}

const hasPending = computed(() => queue.value.some(item => item.status == 'pending'))
const hasDone = computed(() => queue.value.some(item => item.status == 'done'))
const selectedDone = computed(() => queue.value.filter(item => item.status == 'done' && item.selected))
const someSelected = computed(() => queue.value.some(item => item.selected))

function toggleSelect(id: string): void {
  const item = queue.value.find(i => i.id == id)
  if (item) item.selected = !item.selected
}

function selectAllDone(): void {
  const allDoneSelected = queue.value.every(item => item.status != 'done' || item.selected)
  queue.value.forEach(item => {
    if (item.status == 'done') item.selected = !allDoneSelected
  })
}

function getEngine(): { engine: CompressEngine | null; error: string | null } {
  if (engineChoice.value == 'tinify') {
    if (!tinifyKeys.value.length) {
      return { engine: null, error: '未配置 TinyPNG API Key,请先到「压缩设置」填入' }
    }
    return { engine: createTinifyEngine({ apiKeys: tinifyKeys.value }), error: null }
  }
  return { engine: localEngine, error: null }
}

async function updateKeyUsage(keyIndex: number, count: number | undefined): Promise<void> {
  if (count == null) return
  const usage = [...(props.settings.tinifyKeyUsage || new Array(tinifyKeys.value.length).fill(0))]
  usage[keyIndex] = count
  await props.saveSettings({
    settings: {
      defaultEngine: props.settings.defaultEngine,
      local: { ...props.settings.local },
      tinifyApiKeys: props.settings.tinifyApiKeys,
      tinifyKeyUsage: usage,
    },
  })
}

async function compressOne(item: QueueItem, engine: CompressEngine): Promise<void> {
  item.status = 'processing'
  try {
    const input: CompressInput = { blob: item.file, name: item.name }
    const result = await engine.compress(input, {
      local: props.settings.local,
      maxEdge: props.settings.local.maxEdge,
    })
    item.result = result
    item.status = 'done'
    item.selected = true
    // TinyPNG: 回写本月已用次数到 settings
    if (engineChoice.value == 'tinify') {
      const keyIndex = (result as any)._tinifyKeyIndex as number | undefined
      if (keyIndex != null && keyIndex >= 0) {
        void updateKeyUsage(keyIndex, result.compressionCount)
      }
    }
  } catch (error) {
    item.error = (error as Error).message
    item.status = 'error'
  }
}

async function compressAll(): Promise<void> {
  if (processing.value) return
  const { engine, error } = getEngine()
  if (error) {
    emit('toast', error, 'warning')
    return
  }
  if (!engine) {
    emit('toast', '压缩引擎未就绪', 'error')
    return
  }
  const pendingItems = queue.value.filter(item => item.status == 'pending')
  if (!pendingItems.length) {
    emit('toast', '没有待压缩的文件', 'warning')
    return
  }

  processing.value = true
  try {
    // 串行处理,避免主线程和大内存峰值
    for (const item of pendingItems) {
      await compressOne(item, engine)
    }
    const total = pendingItems.length
    const okNum = pendingItems.filter(i => i.status == 'done').length
    if (okNum == total) {
      emit('toast', `已压缩 ${okNum} 张图片`, 'success')
    } else {
      emit('toast', `完成 ${okNum}/${total},失败 ${total - okNum} 张`, 'warning')
    }
    if (engineChoice.value != props.settings.defaultEngine) {
      // 同步引擎选择到设置(异步,不阻塞)
      void props.saveSettings({ settings: { ...props.settings, defaultEngine: engineChoice.value } })
    }
  } finally {
    processing.value = false
  }
}

async function compressRetry(item: QueueItem): Promise<void> {
  const { engine, error } = getEngine()
  if (error) {
    emit('toast', error, 'warning')
    return
  }
  if (!engine) return
  await compressOne(item, engine)
}

function download(item: QueueItem): void {
  if (item.status != 'done' || !item.result) return
  triggerDownload(item.result.blob, item.result.name)
}

function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function downloadSelectedZip(): Promise<void> {
  const items = selectedDone.value
  if (!items.length) {
    emit('toast', '请勾选已完成的图片再打包下载', 'warning')
    return
  }
  try {
    const zip = new JSZip()
    const usedNames = new Set<string>()
    for (const item of items) {
      if (!item.result) continue
      let name = item.result.name
      while (usedNames.has(name)) {
        const dot = name.lastIndexOf('.')
        const base = dot > 0 ? name.slice(0, dot) : name
        const ext = dot > 0 ? name.slice(dot + 1) : ''
        name = ext ? `${base}_${Math.random().toString(36).slice(2, 6)}.${ext}` : `${base}_${Math.random().toString(36).slice(2, 6)}`
      }
      usedNames.add(name)
      zip.file(name, item.result.blob)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    triggerDownload(blob, `compressed-${stamp}.zip`)
    emit('toast', `已打包 ${items.length} 张图片`, 'success')
  } catch (error) {
    emit('toast', `打包下载失败:${(error as Error).message}`, 'error')
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i >= 2 ? 2 : 1)} ${units[i]}`
}

function compressRatio(item: QueueItem): string {
  if (!item.result) return ''
  const before = item.result.beforeBytes
  const after = item.result.afterBytes
  if (!before) return ''
  const ratio = Math.round((1 - after / before) * 100)
  if (ratio <= 0) return '已优化 0%'
  return `已优化 ${ratio}%`
}
</script>

<template>
  <div class="manager-page">
    <header class="manager-page-header">
      <div class="flex items-start gap-3">
        <span class="manager-page-icon"><ImagePlus :size="20" /></span>
        <div>
          <p class="manager-page-kicker">Image Compressor</p>
          <h2 class="manager-page-title">图片压缩</h2>
          <p class="manager-page-description">批量拖入或选择图片,使用本地 WASM 或 TinyPNG 云压缩,完成后可单张或打包下载。</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <div
          class="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-950/70"
          role="group"
          aria-label="压缩引擎选择"
        >
          <button
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
            :class="engineChoice == 'local'
              ? 'bg-white text-sky-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-sky-300 dark:ring-slate-700'
              : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'"
            @click="engineChoice = 'local'"
          >
            本地 WASM
          </button>
          <button
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
            :class="engineChoice == 'tinify'
              ? 'bg-white text-violet-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-violet-300 dark:ring-slate-700'
              : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'"
            @click="engineChoice = 'tinify'"
          >
            TinyPNG 云
          </button>
        </div>
      </div>
    </header>

    <div v-if="engineChoice == 'tinify'" class="mb-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-300">
      已选择 TinyPNG 云压缩,图片将上传到 TinyPNG 服务器处理。{{ tinifyKeys.length ? `已配置 ${tinifyKeys.length} 把 API Key。` : '当前未配置 API Key,请先到「压缩设置」填入。' }}
    </div>

    <section class="manager-surface mb-2 p-6">
      <div
        class="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center transition-colors hover:border-sky-300 hover:bg-sky-50/40 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-sky-800 dark:hover:bg-sky-950/20"
        @drop="onDrop"
        @dragover="onDragOver"
      >
        <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm dark:bg-slate-900 dark:text-sky-400">
          <Upload :size="26" />
        </span>
        <p class="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">拖入图片或点击选择</p>
        <p class="mt-1 text-xs text-slate-400">支持 PNG / JPEG / WebP,可批量选择</p>
        <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            class="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
            @click="fileInput?.click()"
          >
            <ImagePlus :size="16" />选择图片
          </button>
          <button
            v-if="hasPending"
            class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-800 dark:hover:text-sky-300"
            :disabled="processing"
            @click="compressAll"
          >
            <Sparkles :size="16" />
            {{ processing ? '压缩中...' : '开始压缩' }}
          </button>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="onFileInput"
        />
      </div>
    </section>

    <section v-if="queue.length" class="manager-surface mb-2 overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">压缩队列</p>
          <span class="text-xs text-slate-400">{{ queue.length }} 项</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-800 dark:hover:text-sky-300"
            :disabled="!hasDone || processing"
            @click="downloadSelectedZip"
          >
            <Package :size="14" />打包下载选中({{ selectedDone.length }})
          </button>
          <button
            v-if="someSelected"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="selectAllDone"
          >
            切换全选已完成
          </button>
          <button
            v-if="hasDone"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="clearDone"
          >
            清除已完成
          </button>
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40"
            @click="clearQueue"
          >
            <Trash2 :size="14" />清空队列
          </button>
        </div>
      </div>

      <div class="max-h-[560px] overflow-y-auto">
        <div class="divide-y divide-slate-100 dark:divide-slate-800">
          <div
            v-for="item in queue"
            :key="item.id"
            class="flex items-center gap-3 px-5 py-3.5"
            :class="item.status == 'error' ? 'bg-red-50/40 dark:bg-red-950/20' : ''"
          >
            <input
              v-if="item.status == 'done'"
              type="checkbox"
              :checked="item.selected"
              class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-950"
              @change="toggleSelect(item.id)"
            />
            <span
              v-else
              class="flex h-4 w-4 items-center justify-center"
            >
              <Loader2 v-if="item.status == 'processing'" :size="14" class="animate-spin text-sky-500" />
              <FileImage v-else :size="14" class="text-slate-300 dark:text-slate-600" />
            </span>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-slate-700 dark:text-slate-200" :title="item.name">{{ item.name }}</p>
              <p class="mt-0.5 text-xs text-slate-400">
                <span>{{ formatBytes(item.size) }}</span>
                <template v-if="item.status == 'done' && item.result">
                  <span class="mx-1.5">→</span>
                  <span class="text-emerald-600 dark:text-emerald-400">{{ formatBytes(item.result.afterBytes) }}</span>
                  <span class="ml-2 text-slate-500 dark:text-slate-400">{{ compressRatio(item) }}</span>
                  <span v-if="item.result.compressionCount != null" class="ml-2 text-violet-500 dark:text-violet-400">{{ item.result.compressionCount }}/500</span>
                </template>
                <template v-else-if="item.status == 'processing'">
                  <span class="text-sky-600 dark:text-sky-400">正在压缩...</span>
                </template>
                <template v-else-if="item.status == 'error'">
                  <span class="text-red-600 dark:text-red-400" :title="item.error">{{ item.error }}</span>
                </template>
              </p>
            </div>

            <div class="flex items-center gap-2">
              <button
                v-if="item.status == 'done'"
                class="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300"
                @click="download(item)"
              >
                <Download :size="13" />下载
              </button>
              <button
                v-if="item.status == 'pending' || item.status == 'error'"
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                :disabled="processing"
                @click="compressRetry(item)"
              >
                <Sparkles :size="13" />{{ item.status == 'error' ? '重试' : '压缩' }}
              </button>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800 dark:hover:text-red-400"
                title="移除"
                aria-label="移除"
                @click="removeItem(item.id)"
              >
                <X :size="15" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-else class="manager-surface mb-2 p-10 text-center">
      <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600">
        <FileImage :size="22" />
      </span>
      <p class="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">还没有图片</p>
      <p class="mt-1 text-xs text-slate-400">把图片拖入上方虚线区域,或点击「选择图片」按钮。</p>
    </section>
  </div>
</template>