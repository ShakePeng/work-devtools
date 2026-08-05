<script setup lang="ts">
import { computed, inject } from 'vue'
import type { CookieData, Platform } from '@shared/types'
import { Braces, Code2 } from 'lucide-vue-next'

const props = defineProps<{ platform: Platform }>()
const storageData = inject<{ value: CookieData }>('storageData')

const bridges = computed(() => (props.platform.bridges || []).map(bridge => {
  const method = storageData?.value.bridgeMethods.find(item => item.id == bridge.methodId)
  const provider = method ? storageData?.value.bridgeProviders.find(item => item.id == method.providerId) : undefined
  return {
    ...bridge,
    title: method ? `${method.objectPath.join('.')}.${method.method}` : bridge.methodId,
    providerName: provider?.name || '未知 Bridge 系统',
    valueText: JSON.stringify(bridge.value),
  }
}))
</script>

<template>
  <div class="space-y-1.5">
    <p class="text-[9px] font-medium uppercase tracking-[0.12em] text-violet-500 dark:text-violet-300">Bridge mocks</p>
    <div v-if="bridges.length" class="space-y-1">
      <article v-for="bridge in bridges" :key="bridge.methodId" class="rounded-lg border border-violet-100 bg-violet-50/50 px-2.5 py-2 dark:border-violet-950 dark:bg-violet-950/20">
        <div class="flex items-start gap-2">
          <Code2 :size="14" class="mt-0.5 shrink-0 text-violet-500" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">{{ bridge.title }}</p>
            <p class="mt-0.5 text-[9px] text-slate-400">{{ bridge.providerName }}</p>
          </div>
          <span class="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" :class="bridge.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'">{{ bridge.enabled ? '启用' : '停用' }}</span>
        </div>
        <p class="mt-1.5 flex items-center gap-1 truncate font-mono text-[10px] text-slate-400"><Braces :size="11" class="shrink-0" />{{ bridge.valueText }}</p>
      </article>
    </div>
    <div v-else class="flex flex-col items-center py-3 text-slate-400 dark:text-slate-500">
      <Code2 :size="20" class="mb-1 text-violet-300 dark:text-violet-800" />
      <span class="text-xs">还没有配置 Bridge Mock</span>
    </div>
  </div>
</template>
