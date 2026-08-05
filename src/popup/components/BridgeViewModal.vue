<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { CookieData, Platform } from '@shared/types'
import { Braces, Check, Code2, Copy, List, X } from 'lucide-vue-next'

const props = defineProps<{ platform: Platform }>()
const emit = defineEmits<{ close: [] }>()
const storageData = inject<{ value: CookieData }>('storageData')
const copied = ref(false)
const viewMode = ref<'list' | 'json'>('list')

const bridges = computed(() => (props.platform.bridges || []).map(bridge => {
  const method = storageData?.value.bridgeMethods.find(item => item.id == bridge.methodId)
  const provider = method ? storageData?.value.bridgeProviders.find(item => item.id == method.providerId) : undefined
  return {
    ...bridge,
    title: method ? `${method.objectPath.join('.')}.${method.method}` : bridge.methodId,
    providerName: provider?.name || '未知 Bridge 系统',
  }
}))

const json = computed(() => JSON.stringify(Object.fromEntries(bridges.value.map(bridge => [bridge.title, {
  enabled: bridge.enabled,
  value: bridge.value,
}])), null, 2))

async function copyJson() {
  try {
    await navigator.clipboard.writeText(json.value)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = json.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center" @click.self="emit('close')">
      <div class="absolute inset-0 bg-black/30" />
      <section class="relative flex max-h-[80vh] w-full max-w-[440px] flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-800 mx-4">
        <header class="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3.5 dark:border-gray-700/50">
          <div><h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ platform.name }}</h2><p class="mt-0.5 text-xs text-violet-500 dark:text-violet-300">{{ bridges.length }} 个 Bridge Mock</p></div>
          <div class="flex items-center gap-1">
            <button class="btn-ghost !px-2 !py-1 text-xs" :class="viewMode == 'list' ? 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300' : ''" title="列表视图" @click="viewMode = 'list'"><List :size="13" /></button>
            <button class="btn-ghost !px-2 !py-1 text-xs" :class="viewMode == 'json' ? 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300' : ''" title="JSON 视图" @click="viewMode = 'json'"><Braces :size="13" /></button>
            <button class="btn-ghost !p-1.5 rounded-full" @click="emit('close')"><X :size="16" /></button>
          </div>
        </header>

        <div v-if="viewMode == 'list'" class="flex-1 overflow-y-auto p-4">
          <div v-if="bridges.length" class="space-y-2">
            <article v-for="bridge in bridges" :key="bridge.methodId" class="rounded-xl border border-violet-100 bg-violet-50/50 p-3 dark:border-violet-950 dark:bg-violet-950/20">
              <div class="flex items-start gap-2"><Code2 :size="15" class="mt-0.5 shrink-0 text-violet-500" /><div class="min-w-0 flex-1"><code class="block break-all text-xs font-semibold text-slate-700 dark:text-slate-200">{{ bridge.title }}</code><p class="mt-1 text-[10px] text-slate-400">{{ bridge.providerName }}</p></div><span class="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" :class="bridge.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'">{{ bridge.enabled ? '启用' : '停用' }}</span></div>
              <pre class="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-950 p-2.5 text-[10px] leading-5 text-emerald-300">{{ JSON.stringify(bridge.value, null, 2) }}</pre>
            </article>
          </div>
          <div v-else class="flex flex-col items-center justify-center py-10 text-slate-400"><Code2 :size="28" class="mb-2 text-violet-300" /><p class="text-sm">还没有配置 Bridge Mock</p></div>
        </div>

        <div v-else class="flex-1 overflow-y-auto p-4">
          <div class="relative"><button class="absolute right-2 top-2 btn-ghost !p-1.5 rounded-lg" title="复制 JSON" @click="copyJson"><Check v-if="copied" :size="14" class="text-emerald-500" /><Copy v-else :size="14" /></button><pre class="overflow-x-auto whitespace-pre rounded-xl bg-slate-950 p-4 pr-10 text-xs font-mono text-emerald-300">{{ json }}</pre></div>
        </div>

        <footer class="shrink-0 border-t border-gray-100 px-4 py-2.5 text-center text-xs text-gray-400 dark:border-gray-700/50">{{ viewMode == 'json' ? '可复制当前 Bridge 返回值配置' : '展开查看每个方法的实际返回值' }}</footer>
      </section>
    </div>
  </Teleport>
</template>
