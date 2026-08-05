<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import type { Person, Platform, PlatformMode } from '@shared/types'
import { Pencil, Trash2, Plus, ChevronRight, Check, Code2, Cookie, X } from 'lucide-vue-next'

const personsApi = inject<any>('personsApi')!
const platformsApi = inject<any>('platformsApi')!
const cookiesApi = inject<any>('cookiesApi')!
const toastEmit = inject<(msg: string, type: 'success' | 'error' | 'warning') => void>('showToast', () => {})

const persons = ref<Person[]>([])
const platforms = ref<Platform[]>([])
const expandedPersons = ref<Set<string>>(new Set())
const editingId = ref<string | null>(null)
const editName = ref('')
const deleteTarget = ref<Platform | null>(null)

// 新增平台状态
const addingForPerson = ref<string | null>(null)
const newPlatformName = ref('')
const newPlatformMode = ref<PlatformMode>('cookie')

// 每个平台的 Cookie 数量
const cookieCounts = computed(() => {
  const map: Record<string, number> = {}
  platforms.value.forEach(p => {
    map[p.id] = cookiesApi.list(p.id).length
  })
  return map
})

function refreshData() {
  persons.value = personsApi.list()
  platforms.value = []
  // 收集所有平台（按人员分组展示用）
  persons.value.forEach(person => {
    const pList = platformsApi.list(person.id)
    platforms.value.push(...pList)
  })
}

function getPersonPlatforms(_personId: string): Platform[] {
  // 旧版兼容：Platform 类型已不再含 personId，直接返回全部（该组件已停用）
  return platforms.value
}

function togglePerson(id: string) {
  if (expandedPersons.value.has(id)) {
    expandedPersons.value.delete(id)
  } else {
    expandedPersons.value.add(id)
  }
  expandedPersons.value = new Set(expandedPersons.value)
}

function startAdd(personId: string) {
  addingForPerson.value = personId
  newPlatformName.value = ''
  newPlatformMode.value = 'cookie'
}

async function handleAdd(personId: string) {
  const name = newPlatformName.value.trim()
  if (!name) return
  await platformsApi.add(personId, name, undefined, [], newPlatformMode.value)
  const person = persons.value.find(p => p.id === personId)
  toastEmit(`已为「${person?.name || ''}」添加平台「${name}」`, 'success')
  addingForPerson.value = null
  expandedPersons.value.add(personId)
  refreshData()
}

function startEdit(platform: Platform) {
  editingId.value = platform.id
  editName.value = platform.name
}

async function saveEdit() {
  if (!editingId.value) return
  const name = editName.value.trim()
  if (!name) { cancelEdit(); return }
  await platformsApi.update(editingId.value, name)
  toastEmit('已更新平台名称', 'success')
  editingId.value = null
  refreshData()
}

function cancelEdit() { editingId.value = null }

async function handleDelete() {
  if (!deleteTarget.value) return
  await platformsApi.remove(deleteTarget.value.id)
  toastEmit(`已删除平台「${deleteTarget.value.name}」及关联 Cookie`, 'success')
  deleteTarget.value = null
  refreshData()
}

onMounted(refreshData)
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">🖥️ 平台管理</h2>

    <!-- 按人员分组 -->
    <div v-if="persons.length === 0" class="text-center py-12 text-gray-400 text-sm">
      暂无人员数据，请先在「人员管理」中添加人员
    </div>

    <div v-for="person in persons" :key="person.id" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <!-- 人员头部 -->
      <button
        class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
        @click="togglePerson(person.id)"
      >
        <ChevronRight
          :size="16"
          class="text-gray-400 transition-transform shrink-0"
          :class="{ 'rotate-90': expandedPersons.has(person.id) }"
        />
        <span class="font-medium text-sm text-gray-800 dark:text-gray-100">{{ person.name }}</span>
        <span class="ml-auto text-xs text-gray-400">{{ getPersonPlatforms(person.id).length }} 个平台</span>
      </button>

      <!-- 展开内容 -->
      <div v-if="expandedPersons.has(person.id)" class="border-t border-gray-100 dark:border-gray-800">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-800/50 text-left">
              <th class="px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">平台名称</th>
              <th class="px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">Cookie 数</th>
              <th class="px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">创建时间</th>
              <th class="px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 w-24">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50 dark:divide-gray-800/50">
            <tr v-for="platform in getPersonPlatforms(person.id)" :key="platform.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
              <td class="px-4 py-2.5">
                <template v-if="editingId === platform.id">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="editName"
                      class="flex-1 px-2 py-0.5 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
                      @keyup.escape="cancelEdit"
                    />
                    <button class="p-1 rounded text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20" @click="saveEdit"><Check :size="14" /></button>
                    <button class="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" @click="cancelEdit"><X :size="14" /></button>
                  </div>
                </template>
                <template v-else>
                  <span class="text-gray-800 dark:text-gray-100">{{ platform.name }}</span>
                </template>
              </td>
              <td class="px-4 py-2.5">
                <span class="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-medium">
                  {{ cookieCounts[platform.id] || 0 }}
                </span>
              </td>
              <td class="px-4 py-2.5 text-gray-400 dark:text-gray-500 text-xs">
                {{ new Date(platform.createdAt).toLocaleDateString('zh-CN') }}
              </td>
              <td class="px-4 py-2.5">
                <div class="flex items-center gap-0.5">
                  <button class="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20" @click="startEdit(platform)" title="编辑">
                    <Pencil :size="14" />
                  </button>
                  <button class="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" @click="deleteTarget = platform" title="删除">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 新增平台 -->
        <div v-if="addingForPerson === person.id" class="flex gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <input
            v-model="newPlatformName"
            class="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
            placeholder="平台名称"
            @keyup.escape="addingForPerson = null; newPlatformName = ''"
          />
          <button class="inline-flex items-center gap-1 rounded-lg border px-2 text-xs" :class="newPlatformMode == 'cookie' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-400'" @click="newPlatformMode = 'cookie'"><Cookie :size="12" />Cookie</button>
          <button class="inline-flex items-center gap-1 rounded-lg border px-2 text-xs" :class="newPlatformMode == 'bridge' ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-400'" @click="newPlatformMode = 'bridge'"><Code2 :size="12" />Bridge</button>
          <button class="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-colors" @click="handleAdd(person.id)">添加</button>
          <button class="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs transition-colors" @click="addingForPerson = null; newPlatformName = ''">取消</button>
        </div>

        <div class="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
          <button
            v-if="addingForPerson !== person.id"
            class="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 transition-colors"
            @click="startAdd(person.id)"
          >
            <Plus :size="12" />
            添加平台
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="deleteTarget = null">
      <div class="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-xl max-w-sm w-full mx-4">
        <p class="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">确认删除</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
          确定要删除平台「<span class="font-medium">{{ deleteTarget.name }}</span>」吗？该操作将同时删除该平台下的所有 Cookie 数据。
        </p>
        <div class="flex gap-2 justify-end">
          <button class="px-4 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm transition-colors" @click="deleteTarget = null">取消</button>
          <button class="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors" @click="handleDelete">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
