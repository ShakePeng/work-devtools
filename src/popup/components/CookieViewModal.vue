<script setup lang="ts">
import { ref, inject, onMounted, computed } from 'vue'
import type { Cookie } from '@shared/types'
import { X, Copy, Check, Braces, List, FileJson } from 'lucide-vue-next'

const props = defineProps<{ platformId: string; platformName: string }>()
const emit = defineEmits<{ close: []; refresh: [] }>()

const cookiesApi = inject<any>('cookiesApi')!

const cookies = ref<Cookie[]>([])
const copied = ref(false)
const viewMode = ref<'list' | 'json-flat' | 'json-deep'>('list')
const enabledCount = computed(() => cookies.value.filter(cookie => cookie.enabled).length)

/** 尝试将字符串值转为 number/boolean/null，否则保持原文 */
function coerceValue(v: string): unknown {
  if (!v) return ''
  // boolean
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null') return null
  // number（整数或小数）
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v)) {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return v
}

/** 尝试解析 query string 格式（a=1&b=2&c=3 或 a=1;b=2;c=3） */
function tryParseQueryString(val: string): Record<string, unknown> | null {
  if (!val.includes('=')) return null
  const hasSep = val.includes('&') || val.includes(';')
  if (!hasSep) return null

  const obj: Record<string, unknown> = {}
  const pairs = val.split(/[&;]/)
  let valid = false
  for (const pair of pairs) {
    const idx = pair.indexOf('=')
    if (idx <= 0) continue
    const k = pair.substring(0, idx).trim()
    const v = pair.substring(idx + 1).trim()
    if (k) {
      obj[k] = coerceValue(v)
      valid = true
    }
  }
  return valid ? obj : null
}

/** 尝试将字符串解析为结构化数据 */
function tryParseJson(val: string): unknown | null {
  if (!val) return null
  const trimmed = val.trim()

  // 1. 标准 JSON（以 { 或 [ 开头）
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed) } catch { /* fall through */ }
  }

  // 2. query string 格式：a=1&b=2&c=3
  const qs = tryParseQueryString(trimmed)
  if (qs != null) return qs

  return null
}

// 平铺 JSON：{ "key": "value" }
const jsonFlat = computed(() => {
  const obj: Record<string, string> = {}
  for (const c of cookies.value) {
    obj[c.name] = c.value
  }
  return JSON.stringify(obj, null, 2)
})

// 深度 JSON：value 能解析成 JSON 的就展开
const jsonDeep = computed(() => {
  const obj: Record<string, unknown> = {}
  for (const c of cookies.value) {
    const parsed = tryParseJson(c.value)
    obj[c.name] = parsed != null ? parsed : c.value
  }
  return JSON.stringify(obj, null, 2)
})

function refresh() {
  cookies.value = cookiesApi.list(props.platformId)
}

function copyJson() {
  const text = viewMode.value === 'json-deep' ? jsonDeep.value : jsonFlat.value
  navigator.clipboard.writeText(text).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  })
}

onMounted(refresh)
</script>

<template>
  <Teleport to="body">
    <!-- 主弹窗 -->
    <div class="fixed inset-0 z-50 flex items-center justify-center" @click.self="emit('close')">
      <div class="absolute inset-0 bg-black/30" />
      <div class="relative w-full max-w-[400px] max-h-[80vh] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-2xl mx-4">
        <!-- 头部 -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700/50 shrink-0">
          <div>
            <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ platformName }}</h2>
            <p class="text-xs text-amber-500 dark:text-amber-300 mt-0.5">{{ enabledCount }}/{{ cookies.length }} 条 Cookie 已启用</p>
          </div>
          <div class="flex items-center gap-1">
            <!-- 视图切换 -->
            <button
              class="btn-ghost !px-2 !py-1 text-xs"
              :class="viewMode === 'list' ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''"
              @click="viewMode = 'list'"
              title="列表视图"
            >
              <List :size="13" />
            </button>
            <button
              class="btn-ghost !px-2 !py-1 text-xs"
              :class="viewMode === 'json-flat' ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''"
              @click="viewMode = 'json-flat'"
              title="JSON 平铺"
            >
              <Braces :size="13" />
            </button>
            <button
              class="btn-ghost !px-2 !py-1 text-xs"
              :class="viewMode === 'json-deep' ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''"
              @click="viewMode = 'json-deep'"
              title="JSON 深度解析"
            >
              <FileJson :size="13" />
            </button>
            <button class="btn-ghost !p-1.5 rounded-full" @click="emit('close')">
              <X :size="16" />
            </button>
          </div>
        </div>

        <!-- 列表视图 -->
        <div v-if="viewMode === 'list'" class="flex-1 overflow-y-auto p-4">
          <div v-if="cookies.length === 0" class="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
            <p class="text-3xl mb-2">🍪</p>
            <p class="text-sm">还没有 Cookie</p>
          </div>
          <div v-else class="space-y-1">
            <div
              v-for="cookie in cookies"
              :key="cookie.id"
              class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <span class="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[140px]">{{ cookie.name }}</span>
              <span class="text-gray-300 dark:text-gray-600">=</span>
              <span class="text-sm text-gray-500 dark:text-gray-400 truncate flex-1 min-w-0 font-mono">{{ cookie.value || '(空)' }}</span>
              <span class="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" :class="cookie.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-900 dark:text-slate-400'">{{ cookie.enabled ? '启用' : '停用' }}</span>
            </div>
          </div>
        </div>

        <!-- JSON 平铺视图 -->
        <div
          v-if="viewMode === 'json-flat'"
          class="flex-1 overflow-y-auto p-4"
        >
          <p class="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">JSON 平铺</p>
          <div v-if="cookies.length === 0" class="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
            <p class="text-3xl mb-2">🍪</p>
            <p class="text-sm">还没有 Cookie</p>
          </div>
          <div v-else class="relative">
            <button
              class="absolute top-2 right-2 btn-ghost !p-1.5 rounded-lg"
              title="复制 JSON"
              @click="copyJson"
            >
              <Check v-if="copied" :size="14" class="text-green-500" />
              <Copy v-else :size="14" />
            </button>
            <pre class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 pr-10 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre">{{ jsonFlat }}</pre>
          </div>
        </div>

        <!-- JSON 深度视图 -->
        <div
          v-if="viewMode === 'json-deep'"
          class="flex-1 overflow-y-auto p-4"
        >
          <p class="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">JSON 深度解析</p>
          <div v-if="cookies.length === 0" class="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
            <p class="text-3xl mb-2">🍪</p>
            <p class="text-sm">还没有 Cookie</p>
          </div>
          <div v-else class="relative">
            <button
              class="absolute top-2 right-2 btn-ghost !p-1.5 rounded-lg"
              title="复制 JSON"
              @click="copyJson"
            >
              <Check v-if="copied" :size="14" class="text-green-500" />
              <Copy v-else :size="14" />
            </button>
            <pre class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 pr-10 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre">{{ jsonDeep }}</pre>
          </div>
        </div>

        <!-- 底部提示 -->
        <div class="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700/50 text-center text-xs text-gray-400 dark:text-gray-500 shrink-0">
          <template v-if="viewMode === 'json-flat'">点击右上角按钮复制平铺 JSON</template>
          <template v-else-if="viewMode === 'json-deep'">value 能解析为 JSON 的已自动展开</template>
          <template v-else>点击右上角 {} 图标切换到 JSON 视图</template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
