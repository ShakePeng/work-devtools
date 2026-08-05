<script setup lang="ts">
import type { Person } from '@shared/types'
import type { Selection } from './data-manager-types'
import { ChevronRight, Code2, Cookie, PanelLeftClose, Plus, User } from 'lucide-vue-next'

defineProps<{
  persons: Person[]
  selection: Selection
  expandedPersons: Set<string>
}>()

const emit = defineEmits<{
  'toggle-person': [personId: string]
  'select-person': [personId: string]
  'select-platform': [personId: string, platformId: string]
  'add-platform': [personId: string]
  close: []
}>()
</script>

<template>
  <aside class="flex h-full w-[300px] shrink-0 flex-col border-r border-slate-200/80 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/35">
    <div class="flex h-12 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Navigation</p>
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">人员与平台</p>
      </div>
      <button
        class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 lg:hidden dark:hover:bg-slate-800 dark:hover:text-slate-200"
        title="关闭导航"
        @click="emit('close')"
      >
        <PanelLeftClose :size="17" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      <div v-if="persons.length === 0" class="px-4 py-10 text-center text-xs leading-5 text-slate-400">
        添加人员后，平台层级会显示在这里。
      </div>

      <div v-for="person in persons" :key="person.id" class="mb-1">
        <div
          class="group flex items-center gap-1 rounded-xl transition-colors"
          :class="selection?.type === 'person' && selection.personId === person.id
            ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700'
            : 'hover:bg-white/70 dark:hover:bg-slate-900/60'"
        >
          <button
            class="ml-1 flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            :aria-label="expandedPersons.has(person.id) ? '折叠平台' : '展开平台'"
            @click.stop="emit('toggle-person', person.id)"
          >
            <ChevronRight :size="15" class="transition-transform" :class="{ 'rotate-90': expandedPersons.has(person.id) }" />
          </button>
          <button
            class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-1 text-left"
            @click="emit('select-person', person.id)"
          >
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
              <User :size="14" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">{{ person.name }}</span>
              <span class="block text-[11px] text-slate-400">{{ person.platforms.length }} 个平台</span>
            </span>
          </button>
          <button
            class="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sky-500 transition-colors hover:bg-sky-100 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950 dark:hover:text-sky-200"
            :aria-label="`为${person.name}添加平台`"
            :title="`为「${person.name}」添加平台`"
            @click.stop="emit('add-platform', person.id)"
          >
            <Plus :size="15" />
          </button>
        </div>

        <div v-if="expandedPersons.has(person.id)" class="ml-[22px] border-l border-slate-200 py-1 pl-3 dark:border-slate-800">
          <button
            v-for="platform in person.platforms"
            :key="platform.id"
            class="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors"
            :class="selection?.type === 'platform' && selection.platformId === platform.id
              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
              : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'"
            @click="emit('select-platform', person.id, platform.id)"
          >
            <Code2 v-if="platform.mode == 'bridge'" :size="14" class="shrink-0 text-violet-500" />
            <Cookie v-else :size="14" class="shrink-0 text-amber-500" />
            <span class="min-w-0 flex-1 truncate text-sm">{{ platform.name }}</span>
            <span class="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-400 dark:bg-slate-900/70">
              {{ platform.mode == 'bridge' ? platform.bridges?.filter(item => item.enabled).length || 0 : platform.cookies.length }}
            </span>
          </button>
          <p v-if="person.platforms.length === 0" class="px-3 py-2 text-[11px] text-slate-400">暂无平台</p>
        </div>
      </div>
    </div>
  </aside>
</template>
