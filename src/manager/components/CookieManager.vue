<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import type { Cookie, Platform, Person } from '@shared/types'
import { Pencil, Trash2, Plus, Search, Columns2, Check, X, List } from 'lucide-vue-next'

const platformsApi = inject<any>('platformsApi')!
const cookiesApi = inject<any>('cookiesApi')!
const personsApi = inject<any>('personsApi')!
const toastEmit = inject<(msg: string, type: 'success' | 'error' | 'warning') => void>('showToast', () => {})

const cookies = ref<(Cookie & { platformName?: string; personName?: string })[]>([])
const searchQuery = ref('')
const editingId = ref<string | null>(null)
const editName = ref('')
const editValue = ref('')
const deleteTarget = ref<Cookie | null>(null)

// 新增状态
const isAdding = ref(false)
const newKey = ref('')
const newValue = ref('')
const newPlatformId = ref('')

// 批量模式
const bulkMode = ref(false)
const bulkText = ref('')
const bulkPlatformId = ref('')
const showOverwriteConfirm = ref(false)
const overwriteCount = ref(0)

// 平台选项（用于下拉选择）
interface PlatformOption { id: string; label: string }
const platformOptions = computed<PlatformOption[]>(() => {
  const options: PlatformOption[] = []
  const persons: Person[] = personsApi.list()
  persons.forEach((person: Person) => {
    const platforms: Platform[] = platformsApi.list(person.id)
    platforms.forEach((p: Platform) => {
      options.push({ id: p.id, label: `${person.name} / ${p.name}` })
    })
  })
  return options
})

// 过滤后的 Cookie 列表
const filteredCookies = computed(() => {
  if (!searchQuery.value.trim()) return cookies.value
  const q = searchQuery.value.toLowerCase()
  return cookies.value.filter(c =>
    (c.name && c.name.toLowerCase().includes(q)) ||
    (c.value && c.value.toLowerCase().includes(q)) ||
    (c.platformName && c.platformName.toLowerCase().includes(q))
  )
})

function refreshData() {
  const all: (Cookie & { platformName?: string; personName?: string })[] = []
  const persons: Person[] = personsApi.list()
  persons.forEach((person: Person) => {
    const platforms: Platform[] = platformsApi.list(person.id)
    platforms.forEach((platform: Platform) => {
      const list = cookiesApi.list(platform.id) as Cookie[]
      list.forEach(c => {
        all.push({ ...c, platformName: platform.name, personName: person.name })
      })
    })
  })
  cookies.value = all
}

function startAdd() {
  isAdding.value = true
  newKey.value = ''
  newValue.value = ''
  newPlatformId.value = platformOptions.value[0]?.id || ''
}

async function handleAdd() {
  const key = newKey.value.trim()
  const val = newValue.value.trim()
  if (!key || !val || !newPlatformId.value) {
    toastEmit('请填写完整的 Cookie 信息', 'warning')
    return
  }
  const existing = cookiesApi.findByName(newPlatformId.value, key)
  if (existing) {
    overwriteCount.value = 1
    showOverwriteConfirm.value = true
    return
  }
  await doSingleAdd()
}

async function doSingleAdd(overwrite = false) {
  const key = newKey.value.trim()
  const val = newValue.value.trim()

  if (overwrite) {
    const existing = cookiesApi.findByName(newPlatformId.value, key)
    if (existing) await cookiesApi.remove(existing.id)
  }

  await cookiesApi.add(newPlatformId.value, { name: key, value: val })
  toastEmit(overwrite ? '已覆盖 Cookie' : '已添加 Cookie', 'success')
  isAdding.value = false
  refreshData()
}

const confirmSingleOverwrite = () => doSingleAdd(true)

// 批量添加
function parseBulk(text: string): { name: string; value: string }[] {
  return text.split(';').map(pair => {
    const idx = pair.indexOf('=')
    if (idx <= 0) return { name: '', value: '' }
    return { name: pair.substring(0, idx).trim(), value: pair.substring(idx + 1).trim() }
  }).filter(p => p.name && p.value)
}

async function handleBulkAdd() {
  if (!bulkPlatformId.value || !bulkText.value.trim()) {
    toastEmit('请选择平台并输入 Cookie 数据', 'warning')
    return
  }

  const pairs = parseBulk(bulkText.value)
  if (pairs.length === 0) {
    toastEmit('未解析到有效的 Cookie 数据（格式：key1=val1;key2=val2）', 'warning')
    return
  }

  // 检测重复
  let duplicateCount = 0
  for (const pair of pairs) {
    if (cookiesApi.findByName(bulkPlatformId.value, pair.name)) {
      duplicateCount++
    }
  }

  if (duplicateCount > 0) {
    overwriteCount.value = duplicateCount
    showOverwriteConfirm.value = true
    return
  }

  await doBulkAdd()
}

async function doBulkAdd(overwrite = false) {
  const pairs = parseBulk(bulkText.value)
  let added = 0
  let skipped = 0

  for (const pair of pairs) {
    const existing = cookiesApi.findByName(bulkPlatformId.value, pair.name)
    if (existing) {
      if (overwrite) {
        await cookiesApi.remove(existing.id)
        await cookiesApi.add(bulkPlatformId.value, { name: pair.name, value: pair.value })
        added++
      } else {
        skipped++
      }
    } else {
      await cookiesApi.add(bulkPlatformId.value, { name: pair.name, value: pair.value })
      added++
    }
  }

  const msg = `已添加 ${added} 条 Cookie` + (skipped > 0 ? `，跳过 ${skipped} 条重复` : '')
  toastEmit(msg, 'success')
  bulkMode.value = false
  bulkText.value = ''
  refreshData()
}

const confirmBulkOverwrite = () => doBulkAdd(true)

function startEdit(cookie: Cookie & { platformName?: string }) {
  editingId.value = cookie.id
  editName.value = cookie.name
  editValue.value = cookie.value
}

async function saveEdit() {
  if (!editingId.value) return
  await cookiesApi.update(editingId.value, {
    name: editName.value.trim(),
    value: editValue.value.trim(),
  })
  toastEmit('已更新 Cookie', 'success')
  editingId.value = null
  refreshData()
}

function cancelEdit() { editingId.value = null }

async function handleDelete() {
  if (!deleteTarget.value) return
  await cookiesApi.remove(deleteTarget.value.id)
  toastEmit('已删除 Cookie', 'success')
  deleteTarget.value = null
  refreshData()
}

onMounted(refreshData)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">🍪 Cookie 管理</h2>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="bulkMode
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
          @click="bulkMode = !bulkMode; isAdding = false"
        >
          <Columns2 :size="14" />
          批量添加
        </button>
        <button
          v-if="!isAdding && !bulkMode"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
          @click="startAdd"
        >
          <Plus :size="16" />
          添加 Cookie
        </button>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="relative">
      <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        v-model="searchQuery"
        class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 placeholder:text-gray-400 transition-colors"
        placeholder="搜索 Cookie Key 或 Value..."
      />
    </div>

    <!-- 单个添加表单 -->
    <div v-if="isAdding" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">所属平台</label>
          <select v-model="newPlatformId" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100">
            <option v-for="opt in platformOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
          </select>
        </div>
        <div></div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Key</label>
          <input v-model="newKey" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100" placeholder="Cookie Key" @keyup.enter="handleAdd" />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Value</label>
          <input v-model="newValue" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100" placeholder="Cookie Value" @keyup.enter="handleAdd" />
        </div>
      </div>
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm transition-colors" @click="isAdding = false">取消</button>
        <button class="px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors" @click="handleAdd">添加</button>
      </div>
    </div>

    <!-- 批量添加 -->
    <div v-if="bulkMode" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
      <div>
        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">所属平台</label>
        <select v-model="bulkPlatformId" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100">
          <option value="">请选择平台</option>
          <option v-for="opt in platformOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cookie 数据（key1=val1;key2=val2）</label>
        <textarea
          v-model="bulkText"
          rows="4"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 font-mono"
          placeholder="token=abc123;userId=456;sig=xyz"
        ></textarea>
      </div>
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm transition-colors" @click="bulkMode = false; bulkText = ''">取消</button>
        <button class="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors" @click="handleBulkAdd">批量添加</button>
      </div>
    </div>

    <!-- Cookie 表格 -->
    <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-800/50 text-left">
              <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Key</th>
              <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Value</th>
              <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">所属平台</th>
              <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-24">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="cookie in filteredCookies" :key="cookie.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
              <!-- Key -->
              <td class="px-4 py-2.5">
                <template v-if="editingId === cookie.id">
                  <input
                    v-model="editName"
                    class="w-full px-2 py-1 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
                  />
                </template>
                <template v-else>
                  <span class="font-mono text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{{ cookie.name }}</span>
                </template>
              </td>
              <!-- Value -->
              <td class="px-4 py-2.5 max-w-xs">
                <template v-if="editingId === cookie.id">
                  <input
                    v-model="editValue"
                    class="w-full px-2 py-1 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
                  />
                </template>
                <template v-else>
                  <span class="text-xs text-gray-500 dark:text-gray-400 truncate block max-w-[200px]" :title="cookie.value">{{ cookie.value }}</span>
                </template>
              </td>
              <!-- 平台 -->
              <td class="px-4 py-2.5">
                <span class="text-xs text-gray-400 dark:text-gray-500">{{ cookie.personName }} / {{ cookie.platformName }}</span>
              </td>
              <!-- 操作 -->
              <td class="px-4 py-2.5">
                <div class="flex items-center gap-0.5">
                  <template v-if="editingId === cookie.id">
                    <button class="p-1 rounded text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20" @click="saveEdit"><Check :size="14" /></button>
                    <button class="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" @click="cancelEdit"><X :size="14" /></button>
                  </template>
                  <template v-else>
                    <button class="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20" @click="startEdit(cookie)" title="编辑">
                      <Pencil :size="14" />
                    </button>
                    <button class="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" @click="deleteTarget = cookie" title="删除">
                      <Trash2 :size="14" />
                    </button>
                  </template>
                </div>
              </td>
            </tr>
            <tr v-if="filteredCookies.length === 0">
              <td colspan="4" class="px-4 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                {{ searchQuery ? '未找到匹配的 Cookie' : '暂无 Cookie 数据' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 覆盖确认弹窗 -->
    <div v-if="showOverwriteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="showOverwriteConfirm = false">
      <div class="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-xl max-w-sm w-full mx-4">
        <p class="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">检测到重复</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
          有 {{ overwriteCount }} 条 Cookie Key 已存在，是否覆盖？
        </p>
        <div class="flex gap-2 justify-end">
          <button class="px-4 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm transition-colors" @click="showOverwriteConfirm = false">取消</button>
          <button v-if="bulkMode" class="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors" @click="showOverwriteConfirm = false; confirmBulkOverwrite()">覆盖</button>
          <button v-else class="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors" @click="showOverwriteConfirm = false; confirmSingleOverwrite()">覆盖</button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="deleteTarget = null">
      <div class="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-xl max-w-sm w-full mx-4">
        <p class="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">确认删除</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
          确定要删除 Cookie「<span class="font-medium font-mono">{{ deleteTarget.name }}</span>」吗？
        </p>
        <div class="flex gap-2 justify-end">
          <button class="px-4 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm transition-colors" @click="deleteTarget = null">取消</button>
          <button class="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors" @click="handleDelete">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
