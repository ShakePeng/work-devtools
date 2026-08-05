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
      class="fixed right-3 top-3 z-[100] flex max-w-[360px] items-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-2.5 pl-3 pr-3.5 text-sm shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
    >
      <!-- 图标 -->
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
        <AlertTriangle v-else :size="15" :class="type === 'warning' ? 'text-amber-500' : ''" />
      </div>

      <!-- 文字 -->
      <span
        class="flex-1 text-xs font-medium"
        :class="{
          'text-green-800 dark:text-green-200': type === 'success',
          'text-red-800 dark:text-red-200': type === 'error',
          'text-amber-800 dark:text-amber-200': type === 'warning',
        }"
      >{{ message }}</span>

      <!-- 关闭 -->
      <button class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="visible = false">
        <X :size="14" />
      </button>
    </div>
  </Transition>
</template>
