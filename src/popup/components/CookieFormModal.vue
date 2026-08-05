<script setup lang="ts">
import { ref, inject, computed, onMounted } from 'vue'
import type { Cookie } from '@shared/types'
import { createDefaultCookie } from '@shared/types'
import { X, Columns2, List } from 'lucide-vue-next'

const props = defineProps<{
  platformId: string
  cookieId: string | null
}>()

const emit = defineEmits<{ close: [] }>()

const cookiesApi = inject<any>('cookiesApi')!
const toastEmit = inject<(msg: string, type: 'success' | 'error' | 'warning') => void>('showToast', () => {})

const form = ref<Cookie>(createDefaultCookie())
const isEdit = computed(() => !!props.cookieId)
const saving = ref(false)

// 批量模式
const bulkMode = ref(false)
const bulkText = ref('')

// 覆盖确认
const showOverwriteSingle = ref(false)
const showOverwriteBulk = ref(false)
const overwriteCount = ref(0)

onMounted(() => {
  if (props.cookieId) {
    const cookies = cookiesApi.list(props.platformId) as Cookie[]
    const existing = cookies.find((c: Cookie) => c.id === props.cookieId)
    if (existing) {
      form.value = { ...existing }
    }
  }
})

/** 解析 a=1;b=2;c=3 格式 */
function parseBulk(input: string): { name: string; value: string }[] {
  const result: { name: string; value: string }[] = []
  const pairs = input.split(';')
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx <= 0) continue
    const name = pair.substring(0, eqIdx).trim()
    const value = pair.substring(eqIdx + 1).trim()
    if (name && value) {
      result.push({ name, value })
    }
  }
  return result
}

// 单个添加
async function handleSubmit() {
  const key = form.value.name.trim()
  const val = form.value.value.trim()

  if (!key) { toastEmit('请输入 Cookie Key', 'warning'); return }
  if (!val) { toastEmit('请输入 Cookie Value', 'warning'); return }

  // 检测重复（仅新增时）
  if (!isEdit.value) {
    const existing = cookiesApi.findByName(props.platformId, key)
    if (existing) {
      showOverwriteSingle.value = true
      return
    }
  }

  await doSingleAdd()
}

async function doSingleAdd(overwrite = false) {
  saving.value = true
  try {
    const key = form.value.name.trim()
    const payload = { name: key, value: form.value.value.trim() }

    if (overwrite) {
      const existing = cookiesApi.findByName(props.platformId, key)
      if (existing) {
        await cookiesApi.update(existing.id, payload)
      }
    } else if (isEdit.value) {
      await cookiesApi.update(props.cookieId!, payload)
    } else {
      await cookiesApi.add(props.platformId, payload)
    }

    toastEmit(overwrite ? 'Cookie 已覆盖' : isEdit.value ? 'Cookie 已更新' : 'Cookie 已添加', 'success')
    emit('close')
  } catch (e) {
    toastEmit(`操作失败: ${(e as Error).message}`, 'error')
  } finally {
    saving.value = false
    showOverwriteSingle.value = false
  }
}

/** 批量添加 */
async function handleBulkSubmit() {
  const parsed = parseBulk(bulkText.value)
  if (parsed.length === 0) {
    toastEmit('请输入有效的 Cookie 数据，格式：key1=val1;key2=val2', 'warning')
    return
  }

  // 检测重复
  const dupNames: string[] = []
  for (const item of parsed) {
    if (cookiesApi.findByName(props.platformId, item.name)) {
      dupNames.push(item.name)
    }
  }
  if (dupNames.length > 0) {
    showOverwriteBulk.value = true
    overwriteCount.value = dupNames.length
    return
  }

  await doBulkAdd()
}

async function doBulkAdd(overwrite = false) {
  const parsed = parseBulk(bulkText.value)
  saving.value = true
  try {
    let added = 0
    let overwritten = 0
    for (const item of parsed) {
      const existing = cookiesApi.findByName(props.platformId, item.name)
      if (existing) {
        if (overwrite) {
          await cookiesApi.update(existing.id, { name: item.name, value: item.value })
          overwritten++
        }
        // 不覆盖就跳过
      } else {
        await cookiesApi.add(props.platformId, { name: item.name, value: item.value })
        added++
      }
    }
    const parts: string[] = []
    if (added > 0) parts.push(`${added} 条新增`)
    if (overwritten > 0) parts.push(`${overwritten} 条覆盖`)
    toastEmit(`批量完成：${parts.join('，')}`, 'success')
    emit('close')
  } catch (e) {
    toastEmit(`批量添加失败: ${(e as Error).message}`, 'error')
  } finally {
    saving.value = false
    showOverwriteBulk.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center" @click.self="emit('close')">
      <div class="absolute inset-0 bg-black/30" />
      <div class="relative w-full max-w-[360px] max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 mx-4">
        <!-- 头部 -->
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {{ isEdit ? '编辑 Cookie' : '添加 Cookie' }}
          </h2>
          <div class="flex items-center gap-2">
            <!-- 批量/单个切换 -->
            <button
              v-if="!isEdit"
              class="text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1"
              @click="bulkMode = !bulkMode"
            >
              <List v-if="!bulkMode" :size="14" />
              <Columns2 v-else :size="14" />
              {{ bulkMode ? '单个' : '批量' }}
            </button>
            <button class="btn-ghost !p-1 rounded-full" @click="emit('close')">
              <X :size="16" />
            </button>
          </div>
        </div>

        <!-- 单个模式 -->
        <template v-if="!bulkMode">
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">名称</label>
              <input
                v-model="form.name"
                class="input-field"
                placeholder="例如：session_id"
                :disabled="isEdit"
                @keyup.enter="handleSubmit"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">值</label>
              <input
                v-model="form.value"
                class="input-field"
                placeholder="例如：abc123..."
                @keyup.enter="handleSubmit"
              />
            </div>
          </div>
        </template>

        <!-- 批量模式 -->
        <template v-else>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              批量输入（每行一条：key=value）
            </label>
            <textarea
              v-model="bulkText"
              class="input-field !h-32 resize-none font-mono text-xs"
              placeholder="session_id=abc123&#10;token=xyz789&#10;user_id=12345"
            />
            <div
              v-if="parseBulk(bulkText).length > 0"
              class="mt-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400"
            >
              识别到 {{ parseBulk(bulkText).length }} 条 Cookie
            </div>
          </div>
        </template>

        <!-- 按钮 -->
        <div class="flex gap-2.5 justify-end mt-4">
          <button class="btn-ghost text-sm" @click="emit('close')">取消</button>
          <button
            class="btn-primary text-sm"
            :disabled="saving"
            @click="bulkMode ? handleBulkSubmit() : handleSubmit()"
          >
            <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {{ isEdit ? '保存' : '添加' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 覆盖确认：单个 -->
    <div v-if="showOverwriteSingle" class="fixed inset-0 z-[60] flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40" />
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-5 mx-4 max-w-[300px] w-full">
        <p class="text-sm text-gray-700 dark:text-gray-300 mb-4">
          Cookie "{{ form.name }}" 已存在，是否覆盖？
        </p>
        <div class="flex gap-2 justify-end">
          <button class="btn-ghost text-xs" @click="showOverwriteSingle = false">取消</button>
          <button class="btn-primary text-xs" @click="doSingleAdd(true)">覆盖</button>
        </div>
      </div>
    </div>

    <!-- 覆盖确认：批量 -->
    <div v-if="showOverwriteBulk" class="fixed inset-0 z-[60] flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40" />
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-5 mx-4 max-w-[300px] w-full">
        <p class="text-sm text-gray-700 dark:text-gray-300 mb-4">
          有 {{ overwriteCount }} 条 Cookie 已存在，是否覆盖？
        </p>
        <div class="flex gap-2 justify-end">
          <button class="btn-ghost text-xs" @click="doBulkAdd(false); showOverwriteBulk = false">跳过</button>
          <button class="btn-primary text-xs" @click="doBulkAdd(true)">覆盖</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
