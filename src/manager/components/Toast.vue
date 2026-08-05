<script setup lang="ts">
import { ref, watch } from 'vue'
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-vue-next'

const props = defineProps<{
  message: string
  type: 'success' | 'error' | 'warning'
}>()

const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function show() {
  visible.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    visible.value = false
  }, 3000)
}

watch(() => props.message, (val) => {
  if (val) show()
}, { immediate: true })
</script>

<template>
  <Transition name="toast">
    <div
      v-if="visible && message"
      class="fixed right-5 top-5 z-[100] flex max-w-[380px] items-center gap-3 rounded-2xl border border-slate-200 bg-white py-3 pl-3 pr-4 text-sm shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
    >
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        :class="{
          'bg-green-100 dark:bg-green-900/30': type === 'success',
          'bg-red-100 dark:bg-red-900/30': type === 'error',
          'bg-amber-100 dark:bg-amber-900/30': type === 'warning',
        }"
      >
        <CheckCircle v-if="type === 'success'" :size="15" class="text-green-500" />
        <XCircle v-else-if="type === 'error'" :size="15" class="text-red-500" />
        <AlertTriangle v-else :size="15" class="text-amber-500" />
      </div>
      <span
        class="flex-1 text-xs font-medium"
        :class="{
          'text-green-800 dark:text-green-200': type === 'success',
          'text-red-800 dark:text-red-200': type === 'error',
          'text-amber-800 dark:text-amber-200': type === 'warning',
        }"
      >
        {{ message }}
      </span>
      <button class="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300" @click="visible = false">
        <X :size="14" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.toast-enter-active { transition: all 0.3s ease-out; }
.toast-leave-active { transition: all 0.2s ease-in; }
.toast-enter-from { opacity: 0; transform: translateX(30px); }
.toast-leave-to { opacity: 0; transform: translateX(30px); }
</style>
