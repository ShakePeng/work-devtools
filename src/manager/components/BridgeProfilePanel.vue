<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { BridgeAdapter, BridgeMethodDefinition, BridgeProvider, JsonValue } from '@shared/types'
import { TC_APP_BRIDGE_PROVIDER_ID } from '@shared/bridgeProfiles'
import {
  BadgeCheck, Box, Braces, ChevronRight, Code2, Pencil, Plus, Search, ShieldAlert, Trash2, X,
} from 'lucide-vue-next'

const props = defineProps<{ api: {
  providers: () => BridgeProvider[]
  methods: () => BridgeMethodDefinition[]
  usedByMethod: (id: string) => Array<{ person: { name: string }; platform: { name: string } }>
  addProvider: (input: Pick<BridgeProvider, 'name' | 'adapter'>) => Promise<BridgeProvider>
  updateProvider: (id: string, input: Pick<BridgeProvider, 'name' | 'adapter'>) => Promise<void>
  removeProvider: (id: string) => Promise<void>
  addMethod: (input: Pick<BridgeMethodDefinition, 'providerId' | 'objectPath' | 'method' | 'defaultValue'>) => Promise<BridgeMethodDefinition>
  updateMethod: (id: string, input: Pick<BridgeMethodDefinition, 'providerId' | 'objectPath' | 'method' | 'defaultValue'>) => Promise<void>
  removeMethod: (id: string) => Promise<void>
} }>()

const emit = defineEmits<{ toast: [message: string, type: 'success' | 'error' | 'warning'] }>()

const selectedProviderId = ref('')
const selectedMethodId = ref('')
const search = ref('')
const providerEditorOpen = ref(false)
const editingProvider = shallowRef<BridgeProvider | null>(null)
const providerName = ref('')
const providerDelivery = ref<BridgeAdapter['delivery']>('callback')
const providerCallbackKey = ref('callback')
const providerWrapper = ref<BridgeAdapter['wrapper']>('raw')
const providerWrapperField = ref('CBData')
const methodEditorOpen = ref(false)
const editingMethod = shallowRef<BridgeMethodDefinition | null>(null)
const methodProviderId = ref('')
const methodObjectPath = ref('')
const methodName = ref('')
const methodJson = ref('{}')
const saving = ref(false)
const confirmDeleteProvider = shallowRef<BridgeProvider | null>(null)
const confirmDeleteMethod = shallowRef<BridgeMethodDefinition | null>(null)

const providers = computed(() => props.api.providers())
const methods = computed(() => props.api.methods())
const selectedProvider = computed(() => providers.value.find(item => item.id == selectedProviderId.value) || null)
const selectedMethod = computed(() => methods.value.find(item => item.id == selectedMethodId.value) || null)
const providerMethods = computed(() => {
  const query = search.value.trim().toLowerCase()
  return methods.value.filter(item => {
    if (item.providerId != selectedProviderId.value) return false
    const fullName = `${item.objectPath.join('.')}.${item.method}`.toLowerCase()
    return !query || fullName.includes(query)
  })
})
const methodGroups = computed(() => {
  const groups = new Map<string, BridgeMethodDefinition[]>()
  providerMethods.value.forEach(method => {
    const key = method.objectPath.join('.')
    groups.set(key, [...(groups.get(key) || []), method])
  })
  return [...groups.entries()]
})
const methodJsonError = computed(() => {
  try {
    JSON.parse(methodJson.value)
    return null
  } catch (error) {
    return (error as Error).message
  }
})

watch(providers, current => {
  if (!current.some(item => item.id == selectedProviderId.value)) {
    selectedProviderId.value = current[0]?.id || ''
  }
}, { immediate: true })

watch([providerMethods, selectedProviderId], ([current]) => {
  if (!current.some(item => item.id == selectedMethodId.value)) {
    selectedMethodId.value = current[0]?.id || ''
  }
}, { immediate: true })

function providerAdapterLabel(provider: BridgeProvider) {
  if (provider.adapter.delivery == 'callback') {
    const wrapper = provider.adapter.wrapper == 'json-string-field'
      ? `${provider.adapter.wrapperField || 'CBData'} · JSON 字符串`
      : '原始数据'
    return `Callback · ${wrapper}`
  }
  if (provider.adapter.delivery == 'promise') return 'Promise'
  if (provider.adapter.delivery == 'return') return '同步返回'
  return '无返回值'
}

function providerHasMethods(providerId: string) {
  return methods.value.some(item => item.providerId == providerId)
}

function openCreateProvider() {
  editingProvider.value = null
  providerName.value = ''
  providerDelivery.value = 'callback'
  providerCallbackKey.value = 'callback'
  providerWrapper.value = 'raw'
  providerWrapperField.value = 'CBData'
  providerEditorOpen.value = true
}

function openEditProvider(provider: BridgeProvider) {
  editingProvider.value = provider
  providerName.value = provider.name
  providerDelivery.value = provider.adapter.delivery
  providerCallbackKey.value = provider.adapter.callbackKey || 'callback'
  providerWrapper.value = provider.adapter.wrapper
  providerWrapperField.value = provider.adapter.wrapperField || 'CBData'
  providerEditorOpen.value = true
}

async function saveProvider() {
  if (!providerName.value.trim()) {
    emit('toast', '请填写 Bridge 系统名称', 'warning')
    return
  }
  saving.value = true
  try {
    const builtin = editingProvider.value?.id == TC_APP_BRIDGE_PROVIDER_ID
    const adapter: BridgeAdapter = builtin
      ? editingProvider.value!.adapter
      : {
          delivery: providerDelivery.value,
          callbackKey: providerDelivery.value == 'callback' ? providerCallbackKey.value.trim() || 'callback' : undefined,
          wrapper: providerWrapper.value,
          wrapperField: providerWrapper.value == 'json-string-field' ? providerWrapperField.value.trim() || 'CBData' : undefined,
          delayMs: 0,
        }
    if (editingProvider.value) {
      await props.api.updateProvider(editingProvider.value.id, { name: providerName.value.trim(), adapter })
      emit('toast', 'Bridge 系统已更新', 'success')
    } else {
      const provider = await props.api.addProvider({ name: providerName.value.trim(), adapter })
      selectedProviderId.value = provider.id
      emit('toast', 'Bridge 系统已添加', 'success')
    }
    providerEditorOpen.value = false
  } catch (error) {
    emit('toast', `保存失败：${(error as Error).message}`, 'error')
  } finally {
    saving.value = false
  }
}

function openCreateMethod() {
  editingMethod.value = null
  methodProviderId.value = selectedProviderId.value
  methodObjectPath.value = ''
  methodName.value = ''
  methodJson.value = '{}'
  methodEditorOpen.value = true
}

function openEditMethod(method: BridgeMethodDefinition) {
  editingMethod.value = method
  methodProviderId.value = method.providerId
  methodObjectPath.value = method.objectPath.join('.')
  methodName.value = method.method
  methodJson.value = JSON.stringify(method.defaultValue, null, 2)
  methodEditorOpen.value = true
}

async function saveMethod() {
  if (!methodProviderId.value || !methodObjectPath.value.trim() || !methodName.value.trim()) {
    emit('toast', '请填写系统、对象路径和方法名', 'warning')
    return
  }
  if (methodJsonError.value) {
    emit('toast', `默认值 JSON 语法错误：${methodJsonError.value}`, 'error')
    return
  }
  saving.value = true
  try {
    const input = {
      providerId: methodProviderId.value,
      objectPath: methodObjectPath.value.split('.').map(item => item.trim()).filter(Boolean),
      method: methodName.value.trim(),
      defaultValue: JSON.parse(methodJson.value) as JsonValue,
    }
    if (editingMethod.value) {
      await props.api.updateMethod(editingMethod.value.id, input)
      emit('toast', 'Bridge 方法已更新', 'success')
    } else {
      const method = await props.api.addMethod(input)
      selectedProviderId.value = method.providerId
      selectedMethodId.value = method.id
      emit('toast', 'Bridge 方法已添加', 'success')
    }
    methodEditorOpen.value = false
  } catch (error) {
    emit('toast', `保存失败：${(error as Error).message}`, 'error')
  } finally {
    saving.value = false
  }
}

async function removeProvider() {
  const provider = confirmDeleteProvider.value
  if (!provider) return
  try {
    await props.api.removeProvider(provider.id)
    emit('toast', `已删除 Bridge 系统「${provider.name}」`, 'success')
    confirmDeleteProvider.value = null
  } catch (error) {
    emit('toast', (error as Error).message, 'error')
  }
}

async function removeMethod() {
  const method = confirmDeleteMethod.value
  if (!method) return
  try {
    await props.api.removeMethod(method.id)
    emit('toast', `已删除 Bridge 方法「${method.method}」`, 'success')
    confirmDeleteMethod.value = null
  } catch (error) {
    emit('toast', (error as Error).message, 'error')
  }
}
</script>

<template>
  <div class="manager-page flex min-h-[720px] flex-col">
    <header class="manager-page-header flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <span class="manager-page-icon"><Code2 :size="20" /></span>
        <div>
          <p class="manager-page-kicker">Runtime Mock Registry</p>
          <h2 class="manager-page-title">Bridge 预设</h2>
          <p class="manager-page-description">按系统集中维护 Bridge 方法和默认返回值；业务平台选择方法后可单独覆盖返回值。</p>
        </div>
      </div>
      <button class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900" @click="openCreateProvider">
        <Plus :size="16" />添加 Bridge 系统
      </button>
    </header>

    <section class="manager-surface grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[220px_minmax(280px,0.8fr)_minmax(360px,1.2fr)]">
      <aside class="border-b border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 lg:border-b-0 lg:border-r">
        <div class="mb-2 flex items-center justify-between px-2">
          <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Bridge 系统</p>
          <span class="text-[10px] tabular-nums text-slate-400">{{ providers.length }}</span>
        </div>
        <div class="space-y-1">
          <button
            v-for="provider in providers"
            :key="provider.id"
            class="group flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left transition-colors"
            :class="selectedProviderId == provider.id ? 'bg-white text-sky-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-sky-300 dark:ring-slate-700' : 'text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-900'"
            @click="selectedProviderId = provider.id"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300"><Box :size="15" /></span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1 truncate text-xs font-semibold">{{ provider.name }}<BadgeCheck v-if="provider.id == TC_APP_BRIDGE_PROVIDER_ID" :size="12" class="shrink-0 text-sky-500" /></span>
              <span class="mt-0.5 block truncate text-[9px] text-slate-400">{{ methods.filter(item => item.providerId == provider.id).length }} 个方法</span>
            </span>
          </button>
        </div>
      </aside>

      <div class="flex min-h-[360px] flex-col border-b border-slate-200 dark:border-slate-800 lg:border-b-0 lg:border-r">
        <div class="border-b border-slate-100 p-3 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <div class="relative min-w-0 flex-1">
              <Search :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input v-model="search" class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900" placeholder="搜索命名空间或方法" />
            </div>
            <button class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40" :disabled="!selectedProvider" title="添加方法" @click="openCreateMethod"><Plus :size="16" /></button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <div v-for="[namespace, items] in methodGroups" :key="namespace" class="mb-3">
            <p class="px-2 py-1.5 font-mono text-[10px] font-semibold text-slate-400">{{ namespace }}</p>
            <button
              v-for="method in items"
              :key="method.id"
              class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors"
              :class="selectedMethodId == method.id ? 'bg-sky-50 font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'"
              @click="selectedMethodId = method.id"
            >
              <Braces :size="13" class="shrink-0 opacity-60" />
              <span class="min-w-0 flex-1 truncate font-mono">{{ method.method }}</span>
              <ChevronRight :size="13" class="shrink-0 opacity-40" />
            </button>
          </div>
          <div v-if="!methodGroups.length" class="px-4 py-16 text-center text-xs text-slate-400">没有匹配的 Bridge 方法</div>
        </div>
      </div>

      <article class="min-h-[400px] overflow-y-auto p-5">
        <template v-if="selectedProvider && selectedMethod">
          <div class="mb-5 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-500">{{ selectedProvider.name }}</p>
              <h3 class="mt-1 break-all font-mono text-lg font-semibold text-slate-800 dark:text-slate-100">{{ selectedMethod.objectPath.join('.') }}.{{ selectedMethod.method }}</h3>
              <p class="mt-2 text-xs text-slate-400">{{ providerAdapterLabel(selectedProvider) }} · 已绑定 {{ props.api.usedByMethod(selectedMethod.id).length }} 个业务平台</p>
            </div>
            <div class="flex shrink-0 gap-1">
              <button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800" title="编辑方法" @click="openEditMethod(selectedMethod)"><Pencil :size="16" /></button>
              <button class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-950/40" title="删除方法" :disabled="selectedMethod.id.startsWith('builtin-') || props.api.usedByMethod(selectedMethod.id).length > 0" @click="confirmDeleteMethod = selectedMethod"><Trash2 :size="16" /></button>
            </div>
          </div>
          <div class="mb-3 flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">默认返回值</span>
            <span class="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500 dark:bg-slate-800">JSON</span>
          </div>
          <pre class="min-h-80 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6 text-emerald-300">{{ JSON.stringify(selectedMethod.defaultValue, null, 2) }}</pre>
        </template>
        <template v-else-if="selectedProvider">
          <div class="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div><h3 class="font-semibold">{{ selectedProvider.name }}</h3><p class="mt-1 text-xs text-slate-400">{{ providerAdapterLabel(selectedProvider) }}</p></div>
            <div class="flex gap-1">
              <button class="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-sky-600 dark:hover:bg-slate-800" @click="openEditProvider(selectedProvider)"><Pencil :size="16" /></button>
              <button class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-35" :disabled="selectedProvider.id.startsWith('builtin-') || providerHasMethods(selectedProvider.id)" @click="confirmDeleteProvider = selectedProvider"><Trash2 :size="16" /></button>
            </div>
          </div>
        </template>
        <p v-else class="py-20 text-center text-sm text-slate-400">请先添加 Bridge 系统</p>

        <div v-if="selectedProvider" class="mt-5 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
          <div><p class="text-xs font-semibold text-slate-600 dark:text-slate-300">系统返回机制</p><p class="mt-1 text-[11px] text-slate-400">{{ providerAdapterLabel(selectedProvider) }}；业务平台不会重复选择。</p></div>
          <button class="rounded-lg px-3 py-2 text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40" @click="openEditProvider(selectedProvider)">编辑系统</button>
        </div>
      </article>
    </section>

    <Teleport to="body">
      <div v-if="providerEditorOpen" class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" @mousedown.self="providerEditorOpen = false">
        <section class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"><div><p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-500">Bridge System</p><h3 class="mt-1 font-semibold">{{ editingProvider ? '编辑 Bridge 系统' : '添加 Bridge 系统' }}</h3></div><button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="providerEditorOpen = false"><X :size="17" /></button></header>
          <div class="space-y-4 p-5">
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">系统名称<input v-model="providerName" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950" placeholder="例如：同程 App" /></label>
            <div v-if="editingProvider?.id == TC_APP_BRIDGE_PROVIDER_ID" class="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-5 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">同程 App 固定使用 callback，并通过 CBData 返回 JSON 字符串。</div>
            <template v-else>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">系统调用方式<select v-model="providerDelivery" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="callback">Callback</option><option value="promise">Promise</option><option value="return">同步返回</option><option value="void">无返回值</option></select></label>
              <label v-if="providerDelivery == 'callback'" class="block text-xs font-semibold text-slate-600 dark:text-slate-300">Callback 参数名<input v-model="providerCallbackKey" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950" /></label>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">返回值包装<select v-model="providerWrapper" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="raw">直接返回 JSON 值</option><option value="json-string-field">放入字段并转成 JSON 字符串</option></select></label>
              <label v-if="providerWrapper == 'json-string-field'" class="block text-xs font-semibold text-slate-600 dark:text-slate-300">包装字段<input v-model="providerWrapperField" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950" /></label>
            </template>
          </div>
          <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800"><button class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="providerEditorOpen = false">取消</button><button class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50" :disabled="saving" @click="saveProvider">{{ saving ? '保存中...' : '保存系统' }}</button></footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="methodEditorOpen" class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" @mousedown.self="methodEditorOpen = false">
        <section class="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"><div><p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-500">Bridge Method</p><h3 class="mt-1 font-semibold">{{ editingMethod ? '编辑 Bridge 方法' : '添加 Bridge 方法' }}</h3></div><button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="methodEditorOpen = false"><X :size="17" /></button></header>
          <div class="min-h-0 space-y-4 overflow-y-auto p-5">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">Bridge 系统<select v-model="methodProviderId" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"><option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ provider.name }}</option></select></label>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">对象路径<input v-model="methodObjectPath" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="_tc_bridge_user" /></label>
            </div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">方法名<input v-model="methodName" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="get_device_info" /></label>
            <div><div class="mb-2 flex items-center justify-between"><label class="text-xs font-semibold text-slate-600 dark:text-slate-300">默认返回值</label><span v-if="methodJsonError" class="text-[10px] text-red-500">{{ methodJsonError }}</span></div><textarea v-model="methodJson" rows="14" spellcheck="false" class="w-full resize-y rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6 text-emerald-300 outline-none focus:border-sky-500" /></div>
          </div>
          <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800"><button class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="methodEditorOpen = false">取消</button><button class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50" :disabled="saving || !!methodJsonError" @click="saveMethod">{{ saving ? '保存中...' : '保存方法' }}</button></footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="confirmDeleteProvider || confirmDeleteMethod" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4">
        <section class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
          <div class="flex gap-3"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950"><ShieldAlert :size="17" /></span><div><h3 class="font-semibold">确认删除</h3><p class="mt-1 text-sm leading-6 text-slate-500">确定删除「{{ confirmDeleteProvider?.name || confirmDeleteMethod?.method }}」吗？</p></div></div>
          <div class="mt-5 flex justify-end gap-2"><button class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="confirmDeleteProvider = null; confirmDeleteMethod = null">取消</button><button class="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700" @click="confirmDeleteProvider ? removeProvider() : removeMethod()">删除</button></div>
        </section>
      </div>
    </Teleport>
  </div>
</template>
