<script setup lang="ts">
import { computed, inject } from 'vue'
import type { CookieData, Platform } from '@shared/types'
import { Cookie, KeyRound } from 'lucide-vue-next'

const props = defineProps<{ platform: Platform }>()
const storageData = inject<{ value: CookieData }>('storageData')

const cookies = computed(() => props.platform.cookies.map(cookie => {
  const preset = cookie.presetId
    ? storageData?.value.cookiePresets.find(item => item.id == cookie.presetId)
    : undefined
  const group = preset
    ? storageData?.value.cookiePresetGroups.find(item => item.id == preset.groupId)
    : undefined
  return {
    ...cookie,
    groupName: group?.name || '自定义 Cookie',
  }
}))
</script>

<template>
  <div class="space-y-1.5">
    <p class="text-[9px] font-medium uppercase tracking-[0.12em] text-amber-500 dark:text-amber-300">Cookie configs</p>
    <div v-if="cookies.length" class="space-y-1">
      <article v-for="cookie in cookies" :key="cookie.id" class="rounded-lg border border-amber-100 bg-amber-50/50 px-2.5 py-2 dark:border-amber-950 dark:bg-amber-950/20">
        <div class="flex items-start gap-2">
          <Cookie :size="14" class="mt-0.5 shrink-0 text-amber-500" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">{{ cookie.name }}</p>
            <p class="mt-0.5 text-[9px] text-slate-400">{{ cookie.groupName }}</p>
          </div>
          <span class="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" :class="cookie.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'">{{ cookie.enabled ? '启用' : '停用' }}</span>
        </div>
        <p class="mt-1.5 flex items-center gap-1 truncate font-mono text-[10px] text-slate-400"><KeyRound :size="11" class="shrink-0" />{{ cookie.value || '(空)' }}</p>
      </article>
    </div>
    <div v-else class="flex flex-col items-center py-3 text-slate-400 dark:text-slate-500">
      <Cookie :size="20" class="mb-1 text-amber-300 dark:text-amber-800" />
      <span class="text-xs">还没有配置 Cookie</span>
    </div>
  </div>
</template>
