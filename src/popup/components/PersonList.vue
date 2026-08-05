<script setup lang="ts">
import { ref, inject, onMounted, watch } from 'vue'
import type { Person } from '@shared/types'
import { STORAGE_KEYS } from '@shared/storageKeys'
import PersonCard from './PersonCard.vue'
import { Plus, Cookie } from 'lucide-vue-next'

const personsApi = inject<any>('personsApi')!
const dataVersion = inject<any>('dataVersion')

const persons = ref<Person[]>([])
const expandedIds = ref<Set<string>>(new Set())
const newName = ref('')
const isAdding = ref(false)

// ============ 展开状态持久化 ============

const STORAGE_KEY_EXPANDED = STORAGE_KEYS.cookieInjector.expandedPersonIds
const LEGACY_STORAGE_KEY_EXPANDED = 'expanded_person_ids'

/** 将当前展开的人员 ID 保存到 chrome.storage.local */
async function saveExpandedIds() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY_EXPANDED]: [...expandedIds.value] })
  } catch (e) {
    console.error('[PersonList] saveExpandedIds error:', e)
  }
}

/** 从 chrome.storage.local 恢复展开的人员 ID */
async function loadExpandedIds() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEY_EXPANDED,
      LEGACY_STORAGE_KEY_EXPANDED,
    ])
    const currentIds = result[STORAGE_KEY_EXPANDED] as string[] | undefined
    const legacyIds = result[LEGACY_STORAGE_KEY_EXPANDED] as string[] | undefined
    const ids = currentIds || legacyIds
    if (ids && ids.length > 0) {
      expandedIds.value = new Set(ids)
    }
    if (!currentIds && legacyIds) {
      await chrome.storage.local.set({ [STORAGE_KEY_EXPANDED]: legacyIds })
    }
    if (legacyIds) {
      await chrome.storage.local.remove(LEGACY_STORAGE_KEY_EXPANDED)
    }
  } catch (e) {
    console.error('[PersonList] loadExpandedIds error:', e)
  }
}

// ============ 核心逻辑 ============

function refresh() {
  persons.value = personsApi.list()
}

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
  expandedIds.value = new Set(expandedIds.value)
  saveExpandedIds()
}

async function handleAdd() {
  if (!newName.value.trim()) return
  await personsApi.add(newName.value.trim())
  newName.value = ''
  isAdding.value = false
  refresh()
}

async function handleRemove(id: string) {
  await personsApi.remove(id)
  expandedIds.value.delete(id)
  refresh()
}

async function handleUpdate(id: string, name: string) {
  await personsApi.update(id, name)
  refresh()
}

onMounted(async () => {
  await loadExpandedIds()
  refresh()
})

// 外部操作（导入/同步拉取）修改数据后，dataVersion 递增 → 刷新列表
if (dataVersion) {
  watch(dataVersion, () => {
    refresh()
  })
}

defineExpose({ refresh })
</script>

<template>
  <div class="space-y-2">
    <!-- 空状态 -->
    <div
      v-if="persons.length === 0 && !isAdding"
      class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-12 dark:border-slate-700 dark:bg-slate-900/60"
    >
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-950">
        <Cookie :size="28" class="text-sky-500" />
      </div>
      <h3 class="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">暂无可用数据</h3>
      <p class="max-w-[260px] text-center text-xs leading-5 text-slate-400">请点击右上角「管理」，添加人员、平台与 Cookie。</p>
    </div>

    <!-- 人员列表 -->
    <TransitionGroup name="list" tag="div" class="space-y-2">
      <PersonCard
        v-for="person in persons"
        :key="person.id"
        :person="person"
        :is-expanded="expandedIds.has(person.id)"
        :readonly="true"
        @toggle="toggleExpand(person.id)"
        @remove="handleRemove(person.id)"
        @update="(name: string) => handleUpdate(person.id, name)"
        @refresh="refresh"
      />
    </TransitionGroup>

    <!-- 新增输入（隐藏，所有增删操作移至管理页） -->
    <div v-if="false" class="card p-3">
      <div class="flex items-center gap-2">
        <input
          v-model="newName"
          class="input-field flex-1"
          placeholder="输入人员名称..."
          @keyup.enter="handleAdd"
          @keyup.escape="isAdding = false; newName = ''"
        />
        <button class="btn-primary text-xs !py-1.5" @click="handleAdd">添加</button>
        <button class="btn-ghost text-xs !py-1.5" @click="isAdding = false; newName = ''">取消</button>
      </div>
    </div>

    <!-- 底部添加按钮（隐藏，所有增删操作移至管理页） -->
    <button
      v-if="false"
      class="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-blue-300 hover:text-blue-500 dark:hover:border-blue-600 dark:hover:text-blue-400 transition-all duration-200 text-sm"
      @click="isAdding = true"
    >
      <Plus :size="14" />
      添加人员
    </button>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.97);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.97);
}
.list-move {
  transition: transform 0.3s ease;
}
</style>
