<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DeviceProfile } from '@shared/types'
import { BadgeCheck, Pencil, Plus, ShieldAlert, Smartphone, Trash2, X } from 'lucide-vue-next'

const props = defineProps<{ api: {
  list: () => DeviceProfile[]
  usedBy: (id: string) => Array<{ person: { name: string }; platform: { name: string } }>
  add: (input: Pick<DeviceProfile, 'name' | 'userAgent'>) => Promise<DeviceProfile>
  update: (id: string, input: Pick<DeviceProfile, 'name' | 'userAgent'>) => Promise<void>
  isUaInjectionEnabled: () => boolean
  setUaInjectionEnabled: (enabled: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
} }>()

const emit = defineEmits<{ toast: [message: string, type: 'success' | 'error' | 'warning'] }>()
const editing = ref<DeviceProfile | null>(null)
const editorOpen = ref(false)
const confirmDelete = ref<DeviceProfile | null>(null)
const name = ref('')
const userAgent = ref('')
const saving = ref(false)

const profiles = computed(() => props.api.list())
const uaInjectionEnabled = computed(() => props.api.isUaInjectionEnabled())
const isBuiltin = (profile: DeviceProfile) => profile.id.startsWith('builtin-')

function openCreate() {
  editing.value = null
  name.value = ''
  userAgent.value = ''
  editorOpen.value = true
}

function openEdit(profile: DeviceProfile) {
  editing.value = profile
  name.value = profile.name
  userAgent.value = profile.userAgent
  editorOpen.value = true
}

async function save() {
  if (!name.value.trim() || !userAgent.value.trim()) {
    emit('toast', '请填写预设名称和 User-Agent', 'warning')
    return
  }
  saving.value = true
  try {
    const input = { name: name.value.trim(), userAgent: userAgent.value.trim() }
    if (editing.value) await props.api.update(editing.value.id, input)
    else await props.api.add(input)
    emit('toast', editing.value ? '设备UA预设已更新' : '设备UA预设已添加', 'success')
    editing.value = null
    editorOpen.value = false
  } catch (error) {
    emit('toast', `保存失败：${(error as Error).message}`, 'error')
  } finally { saving.value = false }
}

async function remove() {
  const profile = confirmDelete.value
  if (!profile) return
  try {
    await props.api.remove(profile.id)
    emit('toast', `已删除设备UA预设「${profile.name}」`, 'success')
    confirmDelete.value = null
  } catch (error) {
    emit('toast', (error as Error).message, 'error')
  }
}

function explainOptimizing() {
  emit('toast', '设备UA预设功能正在优化，暂不可开启。', 'warning')
}
</script>

<template>
  <div class="manager-page">
    <header class="manager-page-header flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <span class="manager-page-icon"><Smartphone :size="20" /></span>
        <div>
          <p class="manager-page-kicker">Device Identity</p>
          <h2 class="manager-page-title">设备UA预设</h2>
          <p class="manager-page-description">设备UA预设功能正在优化，当前所有注入均使用浏览器默认 UA。</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left shadow-sm dark:border-amber-900/70 dark:bg-amber-950/30" title="设备UA预设功能正在优化，暂不可开启" @click="explainOptimizing">
          <span class="text-xs font-semibold text-amber-700 dark:text-amber-300">功能优化中</span>
          <span role="switch" :aria-checked="false" aria-label="UA 注入总开关，功能优化中" class="relative inline-flex h-6 w-11 cursor-not-allowed items-center rounded-full bg-slate-300 opacity-70 dark:bg-slate-700">
            <span class="h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm" />
          </span>
        </button>
        <button class="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400 shadow-sm dark:bg-slate-800 dark:text-slate-500" title="设备UA预设功能正在优化，暂不可编辑" @click="explainOptimizing"><Plus :size="16" />添加预设</button>
      </div>
    </header>

    <section class="manager-surface overflow-hidden">
      <div class="border-b border-slate-200 bg-slate-50/70 px-5 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
        设备UA预设功能正在优化，暂时不支持新增、编辑或开启注入；历史预设会保留，恢复后可继续使用。
      </div>
      <div class="divide-y divide-slate-100 dark:divide-slate-800">
        <article v-for="profile in profiles" :key="profile.id" class="flex flex-wrap items-center gap-4 p-5">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"><Smartphone :size="18" /></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2"><h3 class="font-semibold text-slate-800 dark:text-slate-100">{{ profile.name }}</h3><span v-if="isBuiltin(profile)" class="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:bg-sky-950 dark:text-sky-300"><BadgeCheck :size="11" />内置</span></div>
            <p class="mt-1 truncate font-mono text-xs text-slate-400" :title="profile.userAgent">{{ profile.userAgent }}</p>
            <p class="mt-1 text-[11px] text-slate-400">UA 预设 · 已绑定 {{ props.api.usedBy(profile.id).length }} 个平台</p>
          </div>
          <div class="flex shrink-0 gap-1">
            <button class="cursor-not-allowed rounded-lg p-2 text-slate-300 dark:text-slate-700" title="设备UA预设功能正在优化，暂不可编辑" @click="explainOptimizing"><Pencil :size="16" /></button>
            <button class="cursor-not-allowed rounded-lg p-2 text-slate-300 dark:text-slate-700" title="设备UA预设功能正在优化，暂不可编辑" @click="explainOptimizing"><Trash2 :size="16" /></button>
          </div>
        </article>
      </div>
    </section>

    <Teleport to="body"><div v-if="editorOpen" class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" @mousedown.self="editorOpen = false">
      <section class="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"><div><p class="text-xs font-medium uppercase tracking-[0.14em] text-sky-500">Device Profile</p><h3 class="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">{{ editing ? '编辑设备UA预设' : '添加设备UA预设' }}</h3></div><button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" @click="editorOpen = false"><X :size="17" /></button></header>
        <div class="space-y-4 p-5">
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">预设名称<input v-model="name" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950" placeholder="例如：支付宝" /></label>
          <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">User-Agent<textarea v-model="userAgent" rows="5" class="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950" placeholder="Mozilla/5.0 ..." /></label>
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800"><button class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="editorOpen = false">取消</button><button class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存预设' }}</button></footer>
      </section>
    </div></Teleport>

    <Teleport to="body"><div v-if="confirmDelete" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4"><section class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"><div class="flex gap-3"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950"><ShieldAlert :size="17" /></span><div><h3 class="font-semibold text-slate-800 dark:text-slate-100">删除设备UA预设</h3><p class="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">确定删除「{{ confirmDelete.name }}」吗？</p></div></div><div class="mt-5 flex justify-end gap-2"><button class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="confirmDelete = null">取消</button><button class="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700" @click="remove">删除</button></div></section></div></Teleport>
  </div>
</template>
