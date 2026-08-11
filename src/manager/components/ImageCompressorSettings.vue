<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { ImageCompressorData, ImageCompressorEngine, ImageCompressorLocalOptions } from '@shared/types'
import { DEFAULT_LOCAL_OPTIONS, normalizeImageCompressorSettings } from '@shared/imageCompressor'
import { ImagePlus, KeyRound, Plus, Settings2, Eye, EyeOff, Check, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  data: ImageCompressorData
  saveData: (data: ImageCompressorData) => Promise<void>
}>()

const emit = defineEmits<{
  toast: [message: string, type: 'success' | 'error' | 'warning']
}>()

const local = ref<ImageCompressorLocalOptions>({ ...props.data.settings.local })
const defaultEngine = ref<ImageCompressorEngine>(props.data.settings.defaultEngine)
const tinifyApiKeys = ref<string[]>([...(props.data.settings.tinifyApiKeys || [])])
const tinifyKeyUsage = ref<number[]>([...(props.data.settings.tinifyKeyUsage || [])])
const showKeyMap = ref<Record<number, boolean>>({})
const saving = ref(false)

watch(
  () => props.data,
  next => {
    local.value = { ...next.settings.local }
    defaultEngine.value = next.settings.defaultEngine
    tinifyApiKeys.value = [...(next.settings.tinifyApiKeys || [])]
    tinifyKeyUsage.value = [...(next.settings.tinifyKeyUsage || [])]
  },
  { deep: true }
)

// 旧版本单 Key 互移至数组中
onMounted(async () => {
  if (tinifyApiKeys.value.length) return
  try {
    const legacyKey = 'work_devtools.image_compressor.tinify_api_key'
    const result = await chrome.storage.local.get(legacyKey)
    const value = (result[legacyKey] as string) || ''
    if (value.trim()) {
      tinifyApiKeys.value = [value.trim()]
      await chrome.storage.local.remove(legacyKey)
      await persistKeys()
    }
  } catch (error) {
    console.error('[ImageCompressor] 迁移旧 Key 失败:', error)
  }
})

async function persistKeys(): Promise<void> {
  const settings = normalizeImageCompressorSettings({
    defaultEngine: defaultEngine.value,
    local: local.value,
    tinifyApiKeys: tinifyApiKeys.value,
  })
  await props.saveData({ settings })
}

function addKey(): void {
  tinifyApiKeys.value = [...tinifyApiKeys.value, '']
}

function removeKey(index: number): void {
  const next = [...tinifyApiKeys.value]
  next.splice(index, 1)
  tinifyApiKeys.value = next.length ? next : ['']
  // 清理对应行的显示状态
  const newShow = { ...showKeyMap.value }
  delete newShow[index]
  showKeyMap.value = newShow
}

const canSave = computed(() => {
  const l = local.value
  return l.pngOptimizeLevel >= 0 && l.pngOptimizeLevel <= 6
    && l.jpegQuality >= 1 && l.jpegQuality <= 100
    && l.webpQuality >= 1 && l.webpQuality <= 100
    && l.maxEdge >= 0
})

async function saveSettings(): Promise<void> {
  if (!canSave.value) {
    emit('toast', '压缩参数超出允许范围,请检查', 'error')
    return
  }
  saving.value = true
  try {
    await persistKeys()
    emit('toast', '压缩设置已保存', 'success')
  } catch (error) {
    emit('toast', `保存设置失败:${(error as Error).message}`, 'error')
  } finally {
    saving.value = false
  }
}

function resetLocal(): void {
  local.value = { ...DEFAULT_LOCAL_OPTIONS }
}
</script>

<template>
  <div class="manager-page">
    <header class="manager-page-header">
      <div class="flex items-start gap-3">
        <span class="manager-page-icon"><Settings2 :size="20" /></span>
        <div>
          <p class="manager-page-kicker">Image Compressor Settings</p>
          <h2 class="manager-page-title">压缩设置</h2>
          <p class="manager-page-description">选择默认压缩引擎,调整本地 WASM 参数,并为 TinyPNG 云压缩配置 API Key。</p>
        </div>
      </div>
    </header>

    <div class="space-y-2">
      <!-- 默认引擎 -->
      <section class="manager-surface p-6">
        <div class="mb-5 flex items-center gap-2">
          <ImagePlus :size="16" class="text-sky-500" />
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">默认引擎</h3>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <label
            class="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-500/30"
            :class="defaultEngine == 'local'
              ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
              : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'"
          >
            <input v-model="defaultEngine" type="radio" value="local" class="mt-1 text-sky-600 focus:ring-sky-500" />
            <span>
              <span class="block text-sm font-semibold">本地 WASM</span>
              <span class="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">完全离线,零上传。PNG 走 oxipng 无损优化,JPEG/WebP 可控质量。</span>
            </span>
          </label>
          <label
            class="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-500/30"
            :class="defaultEngine == 'tinify'
              ? 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200'
              : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'"
          >
            <input v-model="defaultEngine" type="radio" value="tinify" class="mt-1 text-violet-600 focus:ring-violet-500" />
            <span>
              <span class="block text-sm font-semibold">TinyPNG 云压缩</span>
              <span class="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">压缩率更高,但需上传原图并配置 API Key。免费 500 次/月。</span>
            </span>
          </label>
        </div>
        <p v-if="defaultEngine == 'tinify' && !tinifyApiKeys.filter(k => k.trim()).length" class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
          已选择 TinyPNG 但未配置 API Key,压缩时会提示先填入 Key。
        </p>
      </section>

      <!-- 本地参数 -->
      <section class="manager-surface p-6">
        <div class="mb-5 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <Settings2 :size="16" class="text-sky-500" />
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">本地引擎参数</h3>
          </div>
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="resetLocal"
          >
            恢复默认
          </button>
        </div>
        <div class="grid gap-5 sm:grid-cols-2">
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            PNG 优化级别 (0-6)
            <input
              v-model.number="local.pngOptimizeLevel"
              type="number"
              min="0"
              max="6"
              class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <span class="mt-1.5 block text-[11px] font-normal text-slate-400">0 不优化;6 压缩率最高但最慢。</span>
          </label>
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            JPEG 质量 (1-100)
            <input
              v-model.number="local.jpegQuality"
              type="number"
              min="1"
              max="100"
              class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <span class="mt-1.5 block text-[11px] font-normal text-slate-400">数值越高质量越好、压缩率越低。</span>
          </label>
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            WebP 质量 (1-100)
            <input
              v-model.number="local.webpQuality"
              type="number"
              min="1"
              max="100"
              class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            最长边像素 (0 不限制)
            <input
              v-model.number="local.maxEdge"
              type="number"
              min="0"
              max="16384"
              class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <span class="mt-1.5 block text-[11px] font-normal text-slate-400">限制图片最长边,用于同时缩放与压缩。</span>
          </label>
        </div>
      </section>

      <!-- TinyPNG Key -->
      <section class="manager-surface p-6">
        <div class="mb-5 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <KeyRound :size="16" class="text-violet-500" />
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">TinyPNG API Key</h3>
          </div>
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-400 dark:hover:bg-sky-950"
            @click="addKey"
          >
            <Plus :size="13" />添加 Key
          </button>
        </div>
        <div class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
          每把 Key 独立配额(500 次/月),配置多把可自动切换。压缩时遇到配额耗尽自动尝试下一把。
        </div>
        <div class="mt-4 space-y-3">
          <div
            v-for="(key, index) in tinifyApiKeys"
            :key="index"
            class="flex items-center gap-2"
          >
            <span class="shrink-0 text-xs text-slate-400 w-5 tabular-nums">{{ index + 1 }}</span>
            <div class="relative flex-1">
              <input
                v-model="tinifyApiKeys[index]"
                :type="showKeyMap[index] ? 'text' : 'password'"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 font-mono text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                placeholder="在此粘贴 TinyPNG API Key"
                autocomplete="off"
                spellcheck="false"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                :title="showKeyMap[index] ? '隐藏 Key' : '显示 Key'"
                @click="showKeyMap[index] = !showKeyMap[index]"
              >
                <component :is="showKeyMap[index] ? EyeOff : Eye" :size="15" />
              </button>
            </div>
            <span
              v-if="tinifyKeyUsage[index] != null && tinifyKeyUsage[index] > 0"
              class="shrink-0 rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-semibold tabular-nums text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
              :title="`本月已用 ${tinifyKeyUsage[index]} 次`"
            >
              {{ tinifyKeyUsage[index] }}/500
            </span>
            <button
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              title="删除此 Key"
              @click="removeKey(index)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
        <p class="mt-2 text-[11px] text-slate-400">免费额度每月每 Key 500 次,超出后需付费。申请地址:tinify.com/developers</p>
      </section>

      <div class="flex justify-end gap-2">
        <button
          class="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canSave || saving"
          @click="saveSettings"
        >
          <Check :size="16" />
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
      </div>
    </div>
  </div>
</template>