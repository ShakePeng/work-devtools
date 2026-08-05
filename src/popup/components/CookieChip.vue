<script setup lang="ts">
import type { Cookie } from '@shared/types'
import { X } from 'lucide-vue-next'

defineProps<{ cookie: Cookie; readonly?: boolean }>()
const emit = defineEmits<{
  edit: []
  remove: []
}>()
</script>

<template>
  <div
    class="group flex w-full cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 transition-all duration-150 hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300 dark:hover:border-sky-800 dark:hover:bg-sky-950/40"
    @click="emit('edit')"
  >
    <span class="min-w-0 flex-1 truncate font-mono font-semibold text-slate-700 dark:text-slate-200">{{ cookie.name }}</span>
    <span class="shrink-0 font-mono text-slate-300">=</span>
    <span class="min-w-0 flex-1 truncate font-mono text-slate-400">{{ cookie.value || '(空)' }}</span>
    <button
      v-if="!$props.readonly"
      class="ml-0.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-500 transition-all shrink-0"
      @click.stop="emit('remove')"
      title="删除"
    >
      <X :size="11" />
    </button>
  </div>
</template>
