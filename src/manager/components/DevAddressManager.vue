<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { nanoid } from 'nanoid'
import type {
  DevAddressProject,
  DevAddressesData,
  DevEnvironment,
  DevPage,
} from '@shared/types'
import {
  buildDevPageUrl,
  normalizeDevAddressesData,
  normalizeDevPagePath,
} from '@shared/devAddresses'
import {
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  FileCode2,
  FolderKanban,
  Globe2,
  Link2,
  Pencil,
  Plus,
  Server,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-vue-next'

const props = defineProps<{
  data: DevAddressesData
  saveData: (data: DevAddressesData) => Promise<void>
}>()

const emit = defineEmits<{
  toast: [message: string, type: 'success' | 'error' | 'warning']
}>()

type DeleteTarget =
  | { type: 'project'; project: DevAddressProject }
  | { type: 'page'; project: DevAddressProject; page: DevPage }

const selectedProjectId = ref<string | null>(null)
const switchingEnvironment = ref(false)
const deleteTarget = ref<DeleteTarget | null>(null)
const deleting = ref(false)

const projectEditorOpen = ref(false)
const editingProjectId = ref<string | null>(null)
const projectName = ref('')
const projectWikiUrl = ref('')
const projectNote = ref('')
const projectEnvironments = ref<DevEnvironment[]>([])
const projectDefaultEnvironmentId = ref('')
const projectError = ref<string | null>(null)
const projectSaving = ref(false)

const pageEditorOpen = ref(false)
const pageEditorProjectId = ref('')
const editingPageId = ref<string | null>(null)
const pageName = ref('')
const pagePath = ref('')
const pageError = ref<string | null>(null)
const pageSaving = ref(false)

const selectedProject = computed(() =>
  props.data.projects.find(project => project.id == selectedProjectId.value) || null
)

const selectedEnvironment = computed(() => {
  const project = selectedProject.value
  if (!project) return null
  return project.environments.find(environment =>
    environment.id == project.defaultEnvironmentId
  ) || project.environments[0] || null
})

watch(
  () => props.data.projects,
  projects => {
    if (!projects.length) {
      selectedProjectId.value = null
      return
    }
    if (!projects.some(project => project.id == selectedProjectId.value)) {
      selectedProjectId.value = projects[0].id
    }
  },
  { immediate: true }
)

function cloneData(): DevAddressesData {
  return {
    projects: props.data.projects.map(project => ({
      ...project,
      environments: project.environments.map(environment => ({ ...environment })),
      pages: project.pages.map(page => ({ ...page })),
    })),
  }
}

function openAddProject(): void {
  const environmentId = nanoid()
  editingProjectId.value = null
  projectName.value = ''
  projectWikiUrl.value = ''
  projectNote.value = ''
  projectEnvironments.value = [{ id: environmentId, name: '', baseUrl: '' }]
  projectDefaultEnvironmentId.value = environmentId
  projectError.value = null
  projectEditorOpen.value = true
}

function openEditProject(project: DevAddressProject): void {
  editingProjectId.value = project.id
  projectName.value = project.name
  projectWikiUrl.value = project.wikiUrl || ''
  projectNote.value = project.note || ''
  projectEnvironments.value = project.environments.map(environment => ({ ...environment }))
  projectDefaultEnvironmentId.value = project.defaultEnvironmentId
  projectError.value = null
  projectEditorOpen.value = true
}

function addEnvironment(): void {
  projectEnvironments.value = [
    ...projectEnvironments.value,
    { id: nanoid(), name: '', baseUrl: '' },
  ]
}

function removeEnvironment(environmentId: string): void {
  if (projectEnvironments.value.length == 1) {
    projectError.value = '项目至少需要保留一个环境。'
    return
  }
  projectEnvironments.value = projectEnvironments.value.filter(environment =>
    environment.id != environmentId
  )
  if (projectDefaultEnvironmentId.value == environmentId) {
    projectDefaultEnvironmentId.value = projectEnvironments.value[0].id
  }
  projectError.value = null
}

async function saveProject(): Promise<void> {
  projectError.value = null
  projectSaving.value = true
  try {
    const current = editingProjectId.value
      ? props.data.projects.find(project => project.id == editingProjectId.value)
      : undefined
    const project: DevAddressProject = {
      id: current?.id || nanoid(),
      name: projectName.value,
      wikiUrl: projectWikiUrl.value,
      note: projectNote.value,
      defaultEnvironmentId: projectDefaultEnvironmentId.value,
      environments: projectEnvironments.value.map(environment => ({ ...environment })),
      pages: current?.pages.map(page => ({ ...page })) || [
        { id: nanoid(), name: '健康检查', path: '/health' },
      ],
    }
    const next = cloneData()
    const index = next.projects.findIndex(item => item.id == current?.id)
    if (index >= 0) next.projects[index] = project
    else next.projects.push(project)

    const normalized = normalizeDevAddressesData(next)
    await props.saveData(normalized)
    selectedProjectId.value = project.id
    projectEditorOpen.value = false
    emit('toast', current ? '项目已更新' : '项目已添加', 'success')
  } catch (error) {
    projectError.value = (error as Error).message
  } finally {
    projectSaving.value = false
  }
}

function openAddPage(project: DevAddressProject): void {
  pageEditorProjectId.value = project.id
  editingPageId.value = null
  pageName.value = ''
  pagePath.value = ''
  pageError.value = null
  pageEditorOpen.value = true
}

function openEditPage(project: DevAddressProject, page: DevPage): void {
  pageEditorProjectId.value = project.id
  editingPageId.value = page.id
  pageName.value = page.name
  pagePath.value = page.path
  pageError.value = null
  pageEditorOpen.value = true
}

async function savePage(): Promise<void> {
  pageError.value = null
  pageSaving.value = true
  try {
    const next = cloneData()
    const project = next.projects.find(item => item.id == pageEditorProjectId.value)
    if (!project) throw new Error('项目不存在，请刷新后重试。')
    const current = editingPageId.value
      ? project.pages.find(page => page.id == editingPageId.value)
      : undefined
    const page: DevPage = {
      id: current?.id || nanoid(),
      name: pageName.value,
      path: normalizeDevPagePath(pagePath.value),
    }
    const index = project.pages.findIndex(item => item.id == current?.id)
    if (index >= 0) project.pages[index] = page
    else project.pages.push(page)

    await props.saveData(normalizeDevAddressesData(next))
    pageEditorOpen.value = false
    emit('toast', current ? '页面已更新' : '页面已添加', 'success')
  } catch (error) {
    pageError.value = (error as Error).message
  } finally {
    pageSaving.value = false
  }
}

async function changeDefaultEnvironment(environmentId: string): Promise<void> {
  const project = selectedProject.value
  if (!project) return
  if (environmentId == project.defaultEnvironmentId) return

  switchingEnvironment.value = true
  try {
    const next = cloneData()
    const target = next.projects.find(item => item.id == project.id)
    if (!target) throw new Error('项目不存在，请刷新后重试。')
    target.defaultEnvironmentId = environmentId
    await props.saveData(normalizeDevAddressesData(next))
    const environment = target.environments.find(item => item.id == environmentId)
    emit('toast', `默认环境已切换为「${environment?.name || '未命名环境'}」`, 'success')
  } catch (error) {
    emit('toast', `切换环境失败：${(error as Error).message}`, 'error')
  } finally {
    switchingEnvironment.value = false
  }
}

async function copyText(value: string, successMessage: string): Promise<void> {
  try {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      if (!copied) throw new Error('浏览器拒绝了剪贴板操作')
    }
    emit('toast', successMessage, 'success')
  } catch (error) {
    emit('toast', `复制失败：${(error as Error).message}`, 'error')
  }
}

async function copyPageAddress(page: DevPage): Promise<void> {
  const environment = selectedEnvironment.value
  if (!environment) {
    emit('toast', '当前项目没有可用环境', 'error')
    return
  }
  try {
    const url = buildDevPageUrl(environment.baseUrl, page.path)
    await copyText(url, `已复制「${environment.name} · ${page.name}」地址`)
  } catch (error) {
    emit('toast', `生成地址失败：${(error as Error).message}`, 'error')
  }
}

async function openPageAddress(page: DevPage): Promise<void> {
  const environment = selectedEnvironment.value
  if (!environment) {
    emit('toast', '当前项目没有可用环境', 'error')
    return
  }
  try {
    const url = buildDevPageUrl(environment.baseUrl, page.path)
    await chrome.tabs.create({ url })
  } catch (error) {
    emit('toast', `打开页面失败：${(error as Error).message}`, 'error')
  }
}

async function copyWiki(project: DevAddressProject): Promise<void> {
  if (project.wikiUrl) await copyText(project.wikiUrl, `已复制「${project.name}」Wiki 地址`)
}

async function openWiki(project: DevAddressProject): Promise<void> {
  if (!project.wikiUrl) return
  try {
    await chrome.tabs.create({ url: project.wikiUrl })
  } catch (error) {
    emit('toast', `打开 Wiki 失败：${(error as Error).message}`, 'error')
  }
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  try {
    const next = cloneData()
    if (target.type == 'project') {
      next.projects = next.projects.filter(project => project.id != target.project.id)
    } else {
      const project = next.projects.find(item => item.id == target.project.id)
      if (!project) throw new Error('项目不存在，请刷新后重试。')
      project.pages = project.pages.filter(page => page.id != target.page.id)
    }
    await props.saveData(normalizeDevAddressesData(next))
    emit('toast', target.type == 'project' ? '项目已删除' : '页面已删除', 'success')
    deleteTarget.value = null
  } catch (error) {
    emit('toast', `删除失败：${(error as Error).message}`, 'error')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="manager-page">
    <header class="manager-page-header">
      <div class="flex items-start gap-3">
        <span class="manager-page-icon"><Link2 :size="20" /></span>
        <div>
          <p class="manager-page-kicker">Development Links</p>
          <h2 class="manager-page-title">常用开发地址</h2>
          <p class="manager-page-description">按项目维护环境域名和页面 path，选择默认环境后可快速复制完整页面地址。</p>
        </div>
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
        @click="openAddProject"
      >
        <Plus :size="16" />添加项目
      </button>
    </header>

    <div class="grid min-h-[560px] gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside class="manager-surface flex min-h-0 flex-col overflow-hidden">
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <p class="manager-section-label">Projects</p>
            <p class="mt-1 text-xs text-slate-400">{{ data.projects.length }} 个项目</p>
          </div>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800"
            title="添加项目"
            aria-label="添加项目"
            @click="openAddProject"
          >
            <Plus :size="16" />
          </button>
        </div>

        <div v-if="data.projects.length" class="min-h-0 flex-1 space-y-1 overflow-y-auto p-2.5">
          <button
            v-for="project in data.projects"
            :key="project.id"
            class="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors"
            :class="selectedProjectId == project.id
              ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900'
              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/70'"
            @click="selectedProjectId = project.id"
          >
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              :class="selectedProjectId == project.id
                ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-900 dark:text-sky-400'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'"
            >
              <FolderKanban :size="17" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">{{ project.name }}</span>
              <span class="mt-0.5 block truncate text-[10px] opacity-60">{{ project.environments.length }} 环境 · {{ project.pages.length }} 页面</span>
            </span>
          </button>
        </div>

        <div v-else class="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600"><FolderKanban :size="22" /></span>
          <p class="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">还没有项目</p>
          <p class="mt-1 text-xs leading-5 text-slate-400">先添加项目和环境，再维护常用页面 path。</p>
          <button class="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:border-slate-700 dark:hover:bg-sky-950" @click="openAddProject">添加第一个项目</button>
        </div>
      </aside>

      <section class="manager-surface min-w-0 overflow-hidden">
        <div v-if="selectedProject" class="flex h-full min-h-0 flex-col">
          <header class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 dark:border-slate-800">
            <div class="flex min-w-0 items-start gap-3">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400"><FolderKanban :size="20" /></span>
              <div class="min-w-0">
                <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Project</p>
                <h3 class="mt-0.5 truncate text-lg font-semibold text-slate-800 dark:text-slate-100">{{ selectedProject.name }}</h3>
                <p class="mt-1 text-xs text-slate-400">{{ selectedProject.environments.length }} 个环境 · {{ selectedProject.pages.length }} 个页面</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" @click="openEditProject(selectedProject)"><Pencil :size="14" />编辑项目</button>
              <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40" title="删除项目" aria-label="删除项目" @click="deleteTarget = { type: 'project', project: selectedProject }"><Trash2 :size="15" /></button>
            </div>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto p-5">
            <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
              <section class="manager-surface-muted p-4">
                <div class="mb-3 flex items-center gap-2">
                  <Server :size="15" class="text-sky-500" />
                  <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-200">当前环境</h4>
                  <span class="ml-auto inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400"><Check :size="11" />{{ switchingEnvironment ? '正在保存...' : '自动保存为默认' }}</span>
                </div>
                <fieldset
                  class="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]"
                  :disabled="switchingEnvironment"
                >
                  <legend class="sr-only">选择当前环境</legend>
                  <label
                    v-for="environment in selectedProject.environments"
                    :key="environment.id"
                    class="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-500/30"
                    :class="environment.id == selectedProject.defaultEnvironmentId
                      ? 'border-sky-300 bg-sky-50 text-sky-800 shadow-sm dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-900 dark:hover:bg-sky-950/30'"
                    :title="environment.name"
                  >
                    <input
                      type="radio"
                      name="current-environment"
                      :value="environment.id"
                      :checked="environment.id == selectedProject.defaultEnvironmentId"
                      class="shrink-0 border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-wait dark:border-slate-600 dark:bg-slate-950"
                      @change="changeDefaultEnvironment(environment.id)"
                    />
                    <span class="truncate font-medium">{{ environment.name }}</span>
                  </label>
                </fieldset>
                <code class="mt-3 block truncate rounded-lg bg-slate-950 px-3 py-2.5 text-xs text-emerald-300" :title="selectedEnvironment?.baseUrl">{{ selectedEnvironment?.baseUrl }}</code>
              </section>

              <section class="manager-surface-muted p-4">
                <div class="mb-3 flex items-center gap-2">
                  <BookOpen :size="15" class="text-amber-500" />
                  <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-200">项目资料</h4>
                </div>
                <template v-if="selectedProject.wikiUrl">
                  <p class="truncate text-xs text-slate-500 dark:text-slate-400" :title="selectedProject.wikiUrl">{{ selectedProject.wikiUrl }}</p>
                  <div class="mt-3 flex gap-2">
                    <button class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" @click="copyWiki(selectedProject)"><Copy :size="13" />复制 Wiki</button>
                    <button class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" @click="openWiki(selectedProject)"><ExternalLink :size="13" />打开 Wiki</button>
                  </div>
                </template>
                <p v-else class="text-xs leading-5 text-slate-400">未设置 Wiki 地址，可在项目编辑中补充。</p>
              </section>
            </div>

            <section v-if="selectedProject.note" class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
              <p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Note</p>
              <p class="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{{ selectedProject.note }}</p>
            </section>

            <div class="mb-3 mt-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-200">常用页面</h4>
                <p class="mt-0.5 text-xs text-slate-400">复制或跳转时自动组合当前环境地址与页面 path。</p>
              </div>
              <button class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700" @click="openAddPage(selectedProject)"><Plus :size="14" />添加页面</button>
            </div>

            <div v-if="selectedProject.pages.length" class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <div class="divide-y divide-slate-100 dark:divide-slate-800">
                <div v-for="page in selectedProject.pages" :key="page.id" class="flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-950/40">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><FileCode2 :size="16" /></span>
                  <div class="min-w-[180px] flex-1">
                    <p class="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{{ page.name }}</p>
                    <code class="mt-1 block truncate text-xs text-slate-400" :title="page.path">{{ page.path }}</code>
                  </div>
                  <button class="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300" @click="copyPageAddress(page)"><Copy :size="13" />复制完整地址</button>
                  <button class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-800 dark:hover:text-sky-300" @click="openPageAddress(page)"><ExternalLink :size="13" />跳转</button>
                  <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800" title="编辑页面" aria-label="编辑页面" @click="openEditPage(selectedProject, page)"><Pencil :size="14" /></button>
                  <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40" title="删除页面" aria-label="删除页面" @click="deleteTarget = { type: 'page', project: selectedProject, page }"><Trash2 :size="14" /></button>
                </div>
              </div>
            </div>

            <div v-else class="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-800">
              <FileCode2 :size="24" class="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">还没有常用页面</p>
              <p class="mt-1 text-xs text-slate-400">添加页面名称和 path 后，即可按环境复制或跳转完整地址。</p>
              <button class="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:border-slate-700 dark:hover:bg-sky-950" @click="openAddPage(selectedProject)">添加第一个页面</button>
            </div>
          </div>
        </div>

        <div v-else class="flex min-h-[560px] flex-col items-center justify-center px-8 text-center">
          <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600"><Globe2 :size="28" /></span>
          <h3 class="mt-5 text-base font-semibold text-slate-700 dark:text-slate-200">选择或创建项目</h3>
          <p class="mt-2 max-w-sm text-sm leading-6 text-slate-400">项目将环境域名与页面 path 分开维护，切换环境后无需重复编辑页面地址。</p>
        </div>
      </section>
    </div>

    <Teleport to="body">
      <div v-if="projectEditorOpen" class="fixed inset-0 z-[80] flex justify-end bg-slate-950/45 backdrop-blur-[1px]" @click.self="projectEditorOpen = false">
        <section class="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-slate-900">
          <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Project Settings</p>
              <h3 class="mt-0.5 text-base font-semibold text-slate-800 dark:text-slate-100">{{ editingProjectId ? '编辑项目' : '添加项目' }}</h3>
            </div>
            <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="关闭" @click="projectEditorOpen = false"><X :size="17" /></button>
          </header>

          <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">项目名称<input v-model="projectName" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950" placeholder="例如：机票保险 H5" /></label>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">Wiki 地址（可选）<input v-model="projectWikiUrl" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950" placeholder="https://wiki.example.com/project" /></label>
            </div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">备注（可选）<textarea v-model="projectNote" rows="3" class="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950" placeholder="记录代理、账号或其他非敏感开发说明" /></label>

            <section>
              <div class="mb-3 flex items-center justify-between gap-3">
                <div><p class="text-xs font-semibold text-slate-700 dark:text-slate-200">环境与域名</p><p class="mt-0.5 text-[11px] text-slate-400">地址必须包含 http:// 或 https://，可包含端口、path、查询参数或锚点。</p></div>
                <button class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:border-slate-700 dark:hover:bg-sky-950" @click="addEnvironment"><Plus :size="13" />添加环境</button>
              </div>
              <div class="space-y-3">
                <div v-for="(environment, index) in projectEnvironments" :key="environment.id" class="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[32px_150px_minmax(0,1fr)_32px] dark:border-slate-800 dark:bg-slate-950/50">
                  <label class="flex items-center justify-center" :title="projectDefaultEnvironmentId == environment.id ? '当前默认环境' : '设为默认环境'"><input v-model="projectDefaultEnvironmentId" type="radio" :value="environment.id" class="text-sky-600 focus:ring-sky-500" /></label>
                  <input v-model="environment.name" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900" :placeholder="index == 0 ? '测试环境' : '环境名称'" />
                  <input v-model="environment.baseUrl" class="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none ring-sky-500/30 focus:border-sky-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900" placeholder="https://dev.example.com/app" />
                  <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/40" :disabled="projectEnvironments.length == 1" title="删除环境" @click="removeEnvironment(environment.id)"><Trash2 :size="14" /></button>
                </div>
              </div>
              <p class="mt-2 text-[11px] text-slate-400">单选按钮用于设置项目默认环境，切换项目时会自动恢复。</p>
            </section>

            <div v-if="projectError" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{{ projectError }}</div>
          </div>

          <footer class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="projectEditorOpen = false">取消</button>
            <button class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50" :disabled="projectSaving" @click="saveProject">{{ projectSaving ? '保存中...' : '保存项目' }}</button>
          </footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="pageEditorOpen" class="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]" @click.self="pageEditorOpen = false">
        <section class="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
          <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div><p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Page Path</p><h3 class="mt-0.5 text-base font-semibold text-slate-800 dark:text-slate-100">{{ editingPageId ? '编辑页面' : '添加页面' }}</h3></div>
            <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="关闭" @click="pageEditorOpen = false"><X :size="17" /></button>
          </header>
          <div class="space-y-4 p-5">
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">页面名称<input v-model="pageName" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950" placeholder="例如：订单详情" /></label>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">页面 path<input v-model="pagePath" class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950" placeholder="/order/detail?from=dev" /><span class="mt-1.5 block text-[11px] font-normal text-slate-400">可包含查询参数和锚点，保存时自动补充开头的 /。</span></label>
            <div v-if="pageError" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{{ pageError }}</div>
          </div>
          <footer class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800"><button class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="pageEditorOpen = false">取消</button><button class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50" :disabled="pageSaving" @click="savePage">{{ pageSaving ? '保存中...' : '保存页面' }}</button></footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="deleteTarget" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
        <section class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
          <div class="flex gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950"><ShieldAlert :size="18" /></span>
            <div><h3 class="font-semibold text-slate-800 dark:text-slate-100">确认删除{{ deleteTarget.type == 'project' ? '项目' : '页面' }}</h3><p class="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400"><template v-if="deleteTarget.type == 'project'">项目「{{ deleteTarget.project.name }}」及其 {{ deleteTarget.project.environments.length }} 个环境、{{ deleteTarget.project.pages.length }} 个页面将被删除。</template><template v-else>页面「{{ deleteTarget.page.name }}」将从项目「{{ deleteTarget.project.name }}」中删除。</template></p></div>
          </div>
          <div class="mt-5 flex justify-end gap-2"><button class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="deleteTarget = null">取消</button><button class="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50" :disabled="deleting" @click="confirmDelete">{{ deleting ? '删除中...' : '确认删除' }}</button></div>
        </section>
      </div>
    </Teleport>
  </div>
</template>
