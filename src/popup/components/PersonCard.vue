<script setup lang="ts">
import { ref } from 'vue'
import type { Person } from '@shared/types'
import PlatformList from './PlatformList.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { ChevronRight, User, Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  person: Person
  isExpanded: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{
  toggle: []
  remove: []
  update: [name: string]
  refresh: []
}>()

const isEditing = ref(false)
const editName = ref('')
const showConfirm = ref(false)

function startEdit() {
  editName.value = props.person.name
  isEditing.value = true
}

function saveEdit() {
  if (editName.value.trim()) {
    emit('update', editName.value.trim())
  }
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 dark:border-slate-800 dark:bg-slate-900">
    <!-- 头部 -->
    <div
      class="flex cursor-pointer select-none items-center gap-2.5 px-3 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
      @click="emit('toggle')"
    >
      <!-- 头像 -->
      <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950">
        <User :size="14" class="text-sky-600 dark:text-sky-400" />
      </div>

      <!-- 编辑删除按钮（名称前）-- 仅在非只读模式下显示 -->
      <div v-if="!props.readonly" class="flex items-center gap-0.5 shrink-0" @click.stop>
        <template v-if="isEditing">
          <button class="btn-primary !px-2.5 !py-1 text-xs" @click="saveEdit">保存</button>
          <button class="btn-ghost !px-2.5 !py-1 text-xs" @click="cancelEdit">取消</button>
        </template>
        <template v-else>
          <button class="btn-ghost !p-1.5" @click="startEdit" title="编辑">
            <Pencil :size="14" />
          </button>
          <button class="btn-danger !p-1.5" @click="showConfirm = true" title="删除">
            <Trash2 :size="14" />
          </button>
        </template>
      </div>

      <!-- 名称 / 编辑 -->
      <div class="flex-1 min-w-0">
        <template v-if="isEditing">
          <input
            v-model="editName"
            class="input-field text-sm !py-1"
            @keyup.enter="saveEdit"
            @keyup.escape="cancelEdit"
            @click.stop
          />
        </template>
        <template v-else>
          <p class="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{{ person.name }}</p>
          <p class="text-[10px] text-slate-400">{{ person.platforms.length }} 个平台</p>
        </template>
      </div>

      <!-- 展开箭头 -->
      <ChevronRight
        :size="16"
        class="text-gray-400 transition-transform duration-200 shrink-0"
        :class="{ 'rotate-90': isExpanded }"
      />
    </div>

    <!-- 展开：平台列表 -->
    <Transition name="collapse">
      <div v-if="isExpanded" class="border-t border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30">
        <div class="px-2.5 pb-2.5 pt-1.5 pl-5">
          <PlatformList :person-id="person.id" :readonly="props.readonly" @refresh="emit('refresh')" />
        </div>
      </div>
    </Transition>

    <!-- 删除确认 -->
    <ConfirmDialog
      v-if="showConfirm"
      title="删除人员"
      :message="`确定要删除「${person.name}」吗？其下的所有平台和 Cookie 也会被删除。`"
      confirm-text="删除"
      @confirm="emit('remove'); showConfirm = false"
      @cancel="showConfirm = false"
    />
  </div>
</template>
