<script setup lang="ts">
import { ref, inject, onMounted } from 'vue'
import type { Platform, PlatformMode } from '@shared/types'
import PlatformCard from './PlatformCard.vue'
import { Code2, Cookie, Plus } from 'lucide-vue-next'

const props = defineProps<{ personId: string; readonly?: boolean }>()
const emit = defineEmits<{ refresh: [] }>()

const platformsApi = inject<any>('platformsApi')!
const toastEmit = inject<(msg: string, type: 'success' | 'error' | 'warning') => void>('showToast', () => {})

const platforms = ref<Platform[]>([])
const expandedIds = ref<Set<string>>(new Set())
const isAdding = ref(false)
const newName = ref('')
const newMode = ref<PlatformMode>('cookie')

function refresh() {
  platforms.value = platformsApi.list(props.personId)
}

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
  expandedIds.value = new Set(expandedIds.value)
}

async function handleAdd() {
  if (!newName.value.trim()) return
  try {
    await platformsApi.add(props.personId, newName.value, undefined, [], newMode.value)
    newName.value = ''
    isAdding.value = false
    refresh()
    emit('refresh')
  } catch (error) {
    toastEmit((error as Error).message, 'error')
  }
}

async function handleRemove(id: string) {
  await platformsApi.remove(id)
  expandedIds.value.delete(id)
  refresh()
  emit('refresh')
}

async function handleUpdate(id: string, name: string) {
  try {
    await platformsApi.update(id, name)
    refresh()
  } catch (error) {
    toastEmit((error as Error).message, 'error')
  }
}

function startAdd() {
  newName.value = ''
  newMode.value = 'cookie'
  isAdding.value = true
}

function cancelAdd() {
  isAdding.value = false
  newName.value = ''
}

onMounted(refresh)
</script>

<template>
  <div class="space-y-1.5">
    <PlatformCard
      v-for="platform in platforms"
      :key="platform.id"
      :platform="platform"
      :is-expanded="expandedIds.has(platform.id)"
      :readonly="props.readonly"
      @toggle="toggleExpand(platform.id)"
      @remove="handleRemove(platform.id)"
      @update="(name: string) => handleUpdate(platform.id, name)"
      @refresh="refresh; emit('refresh')"
    />

    <!-- 新增平台 -->
    <div v-if="isAdding" class="card p-3">
      <div class="space-y-2">
        <input
          v-model="newName"
          class="input-field"
          placeholder="平台名称"
          @keyup.escape="cancelAdd"
        />
        <div class="grid grid-cols-2 gap-1.5">
          <button class="flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[10px] font-semibold" :class="newMode == 'cookie' ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'border-slate-200 text-slate-400 dark:border-slate-700'" @click="newMode = 'cookie'"><Cookie :size="12" />Cookie 模式</button>
          <button class="flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[10px] font-semibold" :class="newMode == 'bridge' ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300' : 'border-slate-200 text-slate-400 dark:border-slate-700'" @click="newMode = 'bridge'"><Code2 :size="12" />Bridge 模式</button>
        </div>
        <div class="flex gap-2">
          <button class="btn-primary text-xs flex-1" @click="handleAdd">添加</button>
          <button class="btn-ghost text-xs flex-1" @click="cancelAdd">取消</button>
        </div>
      </div>
    </div>

    <button
      v-if="!isAdding && !props.readonly"
      class="w-full flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-all duration-200 text-xs"
      @click="startAdd"
    >
      <Plus :size="12" />
      添加平台
    </button>

    <div
      v-if="platforms.length === 0 && !isAdding"
      class="text-center py-4 text-xs text-gray-400 dark:text-gray-500"
    >
      还没有添加平台
    </div>
  </div>
</template>
