<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { CookiePresetDefinition, CookiePresetGroup } from '@shared/types'
import {
  BadgeCheck, ChevronRight, Cookie, FolderKey, KeyRound, Pencil, Plus, Search, Trash2, X,
} from 'lucide-vue-next'

const props = defineProps<{ api: {
  groups: () => CookiePresetGroup[]
  presets: () => CookiePresetDefinition[]
  usedByPreset: (id: string) => Array<{ person: { name: string }; platform: { name: string } }>
  addGroup: (input: Pick<CookiePresetGroup, 'name'>) => Promise<CookiePresetGroup>
  updateGroup: (id: string, input: Pick<CookiePresetGroup, 'name'>) => Promise<void>
  removeGroup: (id: string) => Promise<void>
  addPreset: (input: Pick<CookiePresetDefinition, 'groupId' | 'key' | 'defaultValue'>) => Promise<CookiePresetDefinition>
  updatePreset: (id: string, input: Pick<CookiePresetDefinition, 'groupId' | 'key' | 'defaultValue'>) => Promise<void>
  removePreset: (id: string) => Promise<void>
} }>()

const emit = defineEmits<{ toast: [message: string, type: 'success' | 'error' | 'warning'] }>()

const selectedGroupId = ref('')
const selectedPresetId = ref('')
const search = ref('')
const groupEditorOpen = ref(false)
const editingGroup = shallowRef<CookiePresetGroup | null>(null)
const groupName = ref('')
const presetEditorOpen = ref(false)
const editingPreset = shallowRef<CookiePresetDefinition | null>(null)
const presetGroupId = ref('')
const presetKey = ref('')
const presetValue = ref('xxx')
const saving = ref(false)
const confirmDeleteGroup = shallowRef<CookiePresetGroup | null>(null)
const confirmDeletePreset = shallowRef<CookiePresetDefinition | null>(null)

const groups = computed(() => props.api.groups())
const presets = computed(() => props.api.presets())
const selectedGroup = computed(() => groups.value.find(group => group.id == selectedGroupId.value) || null)
const selectedPreset = computed(() => presets.value.find(preset => preset.id == selectedPresetId.value) || null)
const filteredPresets = computed(() => {
  const query = search.value.trim().toLowerCase()
  return presets.value.filter(preset =>
    preset.groupId == selectedGroupId.value && (!query || preset.key.toLowerCase().includes(query))
  )
})

watch(groups, current => {
  if (!current.some(group => group.id == selectedGroupId.value)) {
    selectedGroupId.value = current[0]?.id || ''
  }
}, { immediate: true })

watch([filteredPresets, selectedGroupId], ([current]) => {
  if (!current.some(preset => preset.id == selectedPresetId.value)) {
    selectedPresetId.value = current[0]?.id || ''
  }
}, { immediate: true })

function isBuiltin(id: string) {
  return id.startsWith('builtin-')
}

function openCreateGroup() {
  editingGroup.value = null
  groupName.value = ''
  groupEditorOpen.value = true
}

function openEditGroup(group: CookiePresetGroup) {
  editingGroup.value = group
  groupName.value = group.name
  groupEditorOpen.value = true
}

function openSelectedGroupEditor() {
  if (selectedGroup.value) openEditGroup(selectedGroup.value)
}

async function saveGroup() {
  if (!groupName.value.trim()) {
    emit('toast', '请填写 Cookie 预设分组名称', 'warning')
    return
  }
  saving.value = true
  try {
    if (editingGroup.value) {
      await props.api.updateGroup(editingGroup.value.id, { name: groupName.value.trim() })
      emit('toast', 'Cookie 预设分组已更新', 'success')
    } else {
      const group = await props.api.addGroup({ name: groupName.value.trim() })
      selectedGroupId.value = group.id
      emit('toast', 'Cookie 预设分组已添加', 'success')
    }
    groupEditorOpen.value = false
  } catch (error) {
    emit('toast', `保存失败：${(error as Error).message}`, 'error')
  } finally {
    saving.value = false
  }
}

function openCreatePreset() {
  if (!selectedGroup.value) return
  editingPreset.value = null
  presetGroupId.value = selectedGroup.value.id
  presetKey.value = ''
  presetValue.value = 'xxx'
  presetEditorOpen.value = true
}

function openEditPreset(preset: CookiePresetDefinition) {
  editingPreset.value = preset
  presetGroupId.value = preset.groupId
  presetKey.value = preset.key
  presetValue.value = preset.defaultValue
  presetEditorOpen.value = true
}

async function savePreset() {
  if (!presetGroupId.value || !presetKey.value.trim()) {
    emit('toast', '请选择分组并填写 Cookie Key', 'warning')
    return
  }
  saving.value = true
  try {
    const input = {
      groupId: presetGroupId.value,
      key: presetKey.value.trim(),
      defaultValue: presetValue.value,
    }
    if (editingPreset.value) {
      await props.api.updatePreset(editingPreset.value.id, input)
      emit('toast', 'Cookie Key 预设已更新', 'success')
    } else {
      const preset = await props.api.addPreset(input)
      selectedGroupId.value = preset.groupId
      selectedPresetId.value = preset.id
      emit('toast', 'Cookie Key 预设已添加', 'success')
    }
    presetEditorOpen.value = false
  } catch (error) {
    emit('toast', `保存失败：${(error as Error).message}`, 'error')
  } finally {
    saving.value = false
  }
}

async function removeGroup() {
  const group = confirmDeleteGroup.value
  if (!group) return
  try {
    await props.api.removeGroup(group.id)
    confirmDeleteGroup.value = null
    emit('toast', `已删除 Cookie 预设分组「${group.name}」`, 'success')
  } catch (error) {
    emit('toast', (error as Error).message, 'error')
  }
}

async function removePreset() {
  const preset = confirmDeletePreset.value
  if (!preset) return
  try {
    await props.api.removePreset(preset.id)
    confirmDeletePreset.value = null
    emit('toast', `已删除 Cookie Key「${preset.key}」`, 'success')
  } catch (error) {
    emit('toast', (error as Error).message, 'error')
  }
}
</script>

<template>
  <div class="manager-page flex min-h-[720px] flex-col">
    <header class="manager-page-header flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <span class="manager-page-icon text-amber-500"><Cookie :size="20" /></span>
        <div>
          <p class="manager-page-kicker">Cookie Key Registry</p>
          <h2 class="manager-page-title">Cookie 预设</h2>
          <p class="manager-page-description">按业务场景维护 Cookie Key 和默认值；平台按 Key 单独选择、覆盖和启停。</p>
        </div>
      </div>
      <button class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900" @click="openCreateGroup">
        <Plus :size="16" />添加预设分组
      </button>
    </header>

    <section class="manager-surface grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[220px_minmax(280px,0.8fr)_minmax(360px,1.2fr)]">
      <aside class="border-b border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 lg:border-b-0 lg:border-r">
        <div class="mb-2 flex items-center justify-between px-2">
          <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">预设分组</p>
          <span class="flex items-center gap-1">
            <span class="text-[10px] tabular-nums text-slate-400">{{ groups.length }}</span>
            <button v-if="selectedGroup" class="rounded p-1 text-slate-400 hover:bg-white hover:text-amber-600 dark:hover:bg-slate-900" title="编辑当前分组" @click="openSelectedGroupEditor"><Pencil :size="12" /></button>
          </span>
        </div>
        <div class="space-y-1">
          <button
            v-for="group in groups"
            :key="group.id"
            class="group flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left transition-colors"
            :class="selectedGroupId == group.id ? 'bg-white text-amber-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-amber-300 dark:ring-slate-700' : 'text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-900'"
            @click="selectedGroupId = group.id"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300"><FolderKey :size="15" /></span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1 truncate text-xs font-semibold">{{ group.name }}<BadgeCheck v-if="isBuiltin(group.id)" :size="12" class="shrink-0 text-sky-500" /></span>
              <span class="mt-0.5 block truncate text-[9px] text-slate-400">{{ presets.filter(preset => preset.groupId == group.id).length }} 个 Key</span>
            </span>
          </button>
        </div>
      </aside>

      <div class="flex min-h-[360px] flex-col border-b border-slate-200 dark:border-slate-800 lg:border-b-0 lg:border-r">
        <div class="border-b border-slate-100 p-3 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <div class="relative min-w-0 flex-1">
              <Search :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input v-model="search" class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900" placeholder="搜索 Cookie Key" />
            </div>
            <button class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40" :disabled="!selectedGroup" title="添加 Cookie Key" @click="openCreatePreset"><Plus :size="16" /></button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <button
            v-for="preset in filteredPresets"
            :key="preset.id"
            class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-xs transition-colors"
            :class="selectedPresetId == preset.id ? 'bg-amber-50 font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'"
            @click="selectedPresetId = preset.id"
          >
            <KeyRound :size="13" class="shrink-0 opacity-60" />
            <span class="min-w-0 flex-1 truncate font-mono">{{ preset.key }}</span>
            <ChevronRight :size="13" class="shrink-0 opacity-40" />
          </button>
          <div v-if="!filteredPresets.length" class="px-4 py-16 text-center text-xs text-slate-400">没有匹配的 Cookie Key</div>
        </div>
      </div>

      <article class="min-h-[400px] overflow-y-auto p-5">
        <template v-if="selectedGroup && selectedPreset">
          <div class="mb-5 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-500">{{ selectedGroup.name }}</p>
              <h3 class="mt-1 break-all font-mono text-lg font-semibold text-slate-800 dark:text-slate-100">{{ selectedPreset.key }}</h3>
              <p class="mt-2 text-xs text-slate-400">已绑定 {{ props.api.usedByPreset(selectedPreset.id).length }} 个业务平台</p>
            </div>
            <div class="flex shrink-0 gap-1">
              <button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-800" title="编辑 Key" @click="openEditPreset(selectedPreset)"><Pencil :size="16" /></button>
              <button class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-950/40" title="删除 Key" :disabled="isBuiltin(selectedPreset.id) || props.api.usedByPreset(selectedPreset.id).length > 0" @click="confirmDeletePreset = selectedPreset"><Trash2 :size="16" /></button>
            </div>
          </div>
          <div class="mb-3 flex items-center justify-between"><span class="text-xs font-semibold text-slate-600 dark:text-slate-300">默认 Value</span><span class="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500 dark:bg-slate-800">TEXT</span></div>
          <pre class="min-h-52 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6 text-amber-200">{{ selectedPreset.defaultValue }}</pre>
        </template>
        <template v-else-if="selectedGroup">
          <div class="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div><h3 class="font-semibold">{{ selectedGroup.name }}</h3><p class="mt-1 text-xs text-slate-400">选择或添加一个 Cookie Key。</p></div>
            <div class="flex gap-1">
              <button class="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-amber-600 dark:hover:bg-slate-800" title="编辑分组" @click="openEditGroup(selectedGroup)"><Pencil :size="16" /></button>
              <button class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-35" :disabled="isBuiltin(selectedGroupId) || presets.some(preset => preset.groupId == selectedGroupId)" title="删除分组" @click="confirmDeleteGroup = selectedGroup"><Trash2 :size="16" /></button>
            </div>
          </div>
        </template>
      </article>
    </section>
  </div>

  <Teleport to="body">
    <div v-if="groupEditorOpen" class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" @mousedown.self="groupEditorOpen = false">
      <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 class="font-semibold">{{ editingGroup ? '编辑预设分组' : '添加预设分组' }}</h3><button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="groupEditorOpen = false"><X :size="17" /></button></header>
        <div class="p-5"><label class="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">分组名称</label><input v-model="groupName" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950" placeholder="例如：微信预设" @keyup.enter="saveGroup" /></div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800"><button class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="groupEditorOpen = false">取消</button><button class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40" :disabled="saving" @click="saveGroup">{{ saving ? '保存中...' : '保存' }}</button></footer>
      </section>
    </div>

    <div v-if="presetEditorOpen" class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" @mousedown.self="presetEditorOpen = false">
      <section class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 class="font-semibold">{{ editingPreset ? '编辑 Cookie Key' : '添加 Cookie Key' }}</h3><button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="presetEditorOpen = false"><X :size="17" /></button></header>
        <div class="space-y-4 p-5">
          <div><label class="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">预设分组</label><select v-model="presetGroupId" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950"><option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option></select></div>
          <div><label class="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Cookie Key</label><input v-model="presetKey" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950" placeholder="例如：CooperateUser" /></div>
          <div><label class="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">默认 Value</label><textarea v-model="presetValue" rows="7" class="w-full resize-y rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-5 text-amber-200 outline-none focus:border-amber-500" /></div>
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800"><button class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="presetEditorOpen = false">取消</button><button class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40" :disabled="saving" @click="savePreset">{{ saving ? '保存中...' : '保存' }}</button></footer>
      </section>
    </div>

    <div v-if="confirmDeleteGroup || confirmDeletePreset" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
      <section class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <h3 class="font-semibold text-slate-800 dark:text-slate-100">确认删除</h3>
        <p class="mt-2 text-xs leading-5 text-slate-500">{{ confirmDeletePreset ? `确定删除 Cookie Key「${confirmDeletePreset.key}」吗？` : `确定删除预设分组「${confirmDeleteGroup?.name}」吗？` }}</p>
        <div class="mt-5 flex justify-end gap-2"><button class="rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="confirmDeleteGroup = null; confirmDeletePreset = null">取消</button><button class="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700" @click="confirmDeletePreset ? removePreset() : removeGroup()">删除</button></div>
      </section>
    </div>
  </Teleport>
</template>
