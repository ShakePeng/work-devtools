<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import type { Person } from '@shared/types'
import { Pencil, Trash2, Plus, GripVertical, Check, X } from 'lucide-vue-next'

const personsApi = inject<any>('personsApi')!
const platformsApi = inject<any>('platformsApi')!
const toastEmit = inject<(msg: string, type: 'success' | 'error' | 'warning') => void>('showToast', () => {})

const persons = ref<Person[]>([])
const newName = ref('')
const isAdding = ref(false)
const editingId = ref<string | null>(null)
const editName = ref('')
const deleteTarget = ref<Person | null>(null)

// 每个人员的平台和 cookie 数量
const platformCounts = computed(() => {
  const map: Record<string, number> = {}
  persons.value.forEach(p => {
    map[p.id] = platformsApi.list(p.id).length
  })
  return map
})

function refresh() {
  persons.value = personsApi.list()
}

function startAdd() {
  newName.value = ''
  isAdding.value = true
}

async function handleAdd() {
  const name = newName.value.trim()
  if (!name) return
  await personsApi.add(name)
  newName.value = ''
  isAdding.value = false
  toastEmit(`已添加人员「${name}」`, 'success')
  refresh()
}

function startEdit(person: Person) {
  editingId.value = person.id
  editName.value = person.name
}

async function saveEdit() {
  if (!editingId.value) return
  const name = editName.value.trim()
  if (!name) {
    cancelEdit()
    return
  }
  await personsApi.update(editingId.value, name)
  toastEmit('已更新人员名称', 'success')
  editingId.value = null
  refresh()
}

function cancelEdit() {
  editingId.value = null
}

async function handleDelete() {
  if (!deleteTarget.value) return
  await personsApi.remove(deleteTarget.value.id)
  toastEmit(`已删除人员「${deleteTarget.value.name}」及关联数据`, 'success')
  deleteTarget.value = null
  refresh()
}

onMounted(refresh)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">👤 人员管理</h2>
      <button
        v-if="!isAdding"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
        @click="startAdd"
      >
        <Plus :size="16" />
        新增人员
      </button>
    </div>

    <!-- 新增表单 -->
    <div v-if="isAdding" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex gap-3">
      <input
        v-model="newName"
        class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
        placeholder="输入人员名称"
        @keyup.enter="handleAdd"
        @keyup.escape="isAdding = false; newName = ''"
      />
      <button class="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors" @click="handleAdd">添加</button>
      <button class="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm transition-colors" @click="isAdding = false; newName = ''">取消</button>
    </div>

    <!-- 数据表格 -->
    <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50 dark:bg-gray-800/50 text-left">
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-10"></th>
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">名称</th>
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">平台数</th>
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">创建时间</th>
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-32">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr v-for="person in persons" :key="person.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
            <td class="px-4 py-3 text-gray-300 dark:text-gray-600">
              <GripVertical :size="14" />
            </td>
            <td class="px-4 py-3">
              <template v-if="editingId === person.id">
                <div class="flex items-center gap-2">
                  <input
                    v-model="editName"
                    class="flex-1 px-2 py-1 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
                    @keyup.enter="saveEdit"
                    @keyup.escape="cancelEdit"
                  />
                  <button class="p-1 rounded text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20" @click="saveEdit"><Check :size="14" /></button>
                  <button class="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" @click="cancelEdit"><X :size="14" /></button>
                </div>
              </template>
              <template v-else>
                <span class="font-medium text-gray-800 dark:text-gray-100">{{ person.name }}</span>
              </template>
            </td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium">
                {{ platformCounts[person.id] || 0 }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs">
              {{ new Date(person.createdAt).toLocaleDateString('zh-CN') }}
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-0.5">
                <button class="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" @click="startEdit(person)" title="编辑">
                  <Pencil :size="14" />
                </button>
                <button class="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" @click="deleteTarget = person" title="删除">
                  <Trash2 :size="14" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="persons.length === 0">
            <td colspan="5" class="px-4 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
              暂无人员数据，点击「新增人员」开始添加
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="deleteTarget = null">
      <div class="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-xl max-w-sm w-full mx-4">
        <p class="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">确认删除</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
          确定要删除「<span class="font-medium text-gray-700 dark:text-gray-300">{{ deleteTarget.name }}</span>」吗？该操作会同时删除该人员下的所有平台和 Cookie 数据，不可恢复。
        </p>
        <div class="flex gap-2 justify-end">
          <button class="px-4 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm transition-colors" @click="deleteTarget = null">取消</button>
          <button class="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors" @click="handleDelete">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
