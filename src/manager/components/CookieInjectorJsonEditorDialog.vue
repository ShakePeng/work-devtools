<script setup lang="ts">
import type { CookieData } from '@shared/types'
import JsonEditorDialog from './JsonEditorDialog.vue'

const props = defineProps<{
  data: CookieData
  validateData: (data: unknown) => CookieData
  saveData: (data: CookieData) => Promise<void>
}>()

const emit = defineEmits<{
  close: []
  toast: [message: string, type: 'success' | 'error' | 'warning']
}>()

function validateCookieInjectorData(data: unknown): CookieData {
  return props.validateData(data)
}

async function saveCookieInjectorData(data: unknown): Promise<void> {
  await props.saveData(data as CookieData)
}

function forwardToast(
  message: string,
  type: 'success' | 'error' | 'warning'
): void {
  emit('toast', message, type)
}
</script>

<template>
  <JsonEditorDialog
    dialog-id="cookie-injector-json"
    title="Cookie Injector JSON"
    scope-path="tools.cookieInjector"
    scope-description="仅保存 Cookie Injector 数据。"
    overwrite-label="确认覆盖 Cookie Injector"
    success-message="Cookie Injector JSON 已保存"
    :data="data"
    :normalize-data="validateCookieInjectorData"
    :save-data="saveCookieInjectorData"
    @close="emit('close')"
    @toast="forwardToast"
  />
</template>
