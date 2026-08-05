<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'

defineProps<{
  title: string
  message: string
  confirmText?: string
  cancelText?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[60] flex items-center justify-center" @click.self="emit('cancel')">
      <div class="absolute inset-0 bg-black/30" />
      <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 mx-4 max-w-[320px] w-full">
        <!-- 警告图标 -->
        <div class="w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
          <AlertTriangle :size="22" class="text-red-500" />
        </div>

        <!-- 标题 + 内容 -->
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">{{ title }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{{ message }}</p>

        <!-- 按钮 -->
        <div class="flex gap-2.5 justify-end mt-4">
          <button class="btn-ghost text-sm" @click="emit('cancel')">
            {{ cancelText || '取消' }}
          </button>
          <button
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg
                   bg-red-500 hover:bg-red-600 active:bg-red-700
                   text-white font-medium text-sm transition-all duration-150"
            @click="emit('confirm')"
          >
            {{ confirmText || '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
