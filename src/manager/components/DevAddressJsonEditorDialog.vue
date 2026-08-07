<script setup lang="ts">
import type { DevAddressesData } from '@shared/types'
import { normalizeDevAddressesData } from '@shared/devAddresses'
import JsonEditorDialog from './JsonEditorDialog.vue'

const props = defineProps<{
  data: DevAddressesData
  saveData: (data: DevAddressesData) => Promise<void>
}>()

const emit = defineEmits<{
  close: []
  toast: [message: string, type: 'success' | 'error' | 'warning']
}>()

async function saveNormalizedData(data: unknown): Promise<void> {
  await props.saveData(data as DevAddressesData)
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
    dialog-id="dev-address-json"
    title="常用开发地址 JSON"
    scope-path="tools.devAddresses"
    scope-description="仅保存常用开发地址数据。"
    overwrite-label="确认覆盖常用开发地址"
    success-message="常用开发地址 JSON 已保存"
    :data="data"
    :normalize-data="normalizeDevAddressesData"
    :save-data="saveNormalizedData"
    @close="emit('close')"
    @toast="forwardToast"
  />
</template>
