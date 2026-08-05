<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WorkDevToolsData, Person, Platform, Cookie } from '@shared/types'
import { X, FileJson, ChevronRight, AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{
  importExport: any
  saveData: (d: WorkDevToolsData) => Promise<void>
  clearAll: () => Promise<void>
}>()

const emit = defineEmits<{
  close: []
  toast: [msg: string, type: 'success' | 'error' | 'warning']
}>()

const mode = ref<'overwrite' | 'merge'>('overwrite')
const step = ref<'select' | 'preview'>('select')

// 树形展开状态
const expandedPersons = ref<Set<string>>(new Set())
const expandedPlatforms = ref<Set<string>>(new Set())

function togglePerson(id: string) {
  if (expandedPersons.value.has(id)) {
    expandedPersons.value.delete(id)
  } else {
    expandedPersons.value.add(id)
  }
  expandedPersons.value = new Set(expandedPersons.value)
}

function togglePlatform(id: string) {
  if (expandedPlatforms.value.has(id)) {
    expandedPlatforms.value.delete(id)
  } else {
    expandedPlatforms.value.add(id)
  }
  expandedPlatforms.value = new Set(expandedPlatforms.value)
}

// 构建树形数据（已是嵌套结构，直接展示）
const treeData = computed(() => {
  const preview = props.importExport.importPreview.value
  if (!preview) return []
  return preview.data.tools.cookieInjector.persons as Person[]
})

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    const preview = props.importExport.previewFile(text)
    if (preview) {
      step.value = 'preview'
    } else {
      emit('toast', props.importExport.importError.value || '文件格式错误', 'error')
    }
  }
  reader.readAsText(file)
}

async function doImport() {
  if (!props.importExport.importPreview.value) return
  const importData = props.importExport.importPreview.value.data
  try {
    if (mode.value == 'overwrite') {
      const newData = props.importExport.buildOverwriteData(importData)
      await props.saveData(newData)
    } else {
      const merged = props.importExport.mergeData(importData)
      await props.saveData(merged)
    }
    emit('toast', '导入成功', 'success')
    emit('close')
  } catch (e) {
    emit('toast', `导入失败: ${(e as Error).message}`, 'error')
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center" @click.self="emit('close')">
      <div class="absolute inset-0 bg-black/30" />
      <div class="relative w-full max-w-[380px] max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 mx-4">
        <!-- 头部 -->
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FileJson :size="16" class="text-blue-500" />
            导入数据
          </h2>
          <button class="btn-ghost !p-1 rounded-full" @click="emit('close')">
            <X :size="16" />
          </button>
        </div>

        <!-- Step 1: 选择文件 -->
        <div v-if="step === 'select'" class="space-y-4">
          <label
            class="flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-center"
          >
            <FileJson :size="32" class="text-gray-300 dark:text-gray-600" />
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">点击选择 JSON 文件</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">支持 .json 格式的导出文件</p>
            </div>
            <input type="file" accept=".json" class="hidden" @change="handleFileSelect" />
          </label>

          <div class="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 flex gap-2">
            <AlertTriangle :size="16" class="text-amber-500 shrink-0 mt-0.5" />
            <div class="text-xs text-amber-700 dark:text-amber-300">
              <p class="font-medium mb-1">导入说明</p>
              <ul class="list-disc list-inside space-y-0.5 text-amber-600 dark:text-amber-400">
                <li>「覆盖」将清空现有数据</li>
                <li>「合并」将保留现有数据并追加新数据</li>
                <li>导入会自动重新生成 ID，避免冲突</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Step 2: 预览 & 导入 -->
        <div v-if="step === 'preview'" class="space-y-4">
          <!-- 树形预览 -->
          <div>
            <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">数据预览</h3>
            <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 max-h-[280px] overflow-y-auto space-y-1">
              <template v-for="person in treeData" :key="person.id">
                <!-- 人员 -->
                <div
                  class="flex items-center gap-1.5 py-1 px-1.5 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  @click="togglePerson(person.id)"
                >
                  <ChevronRight
                    :size="12"
                    class="text-gray-400 transition-transform duration-150 shrink-0"
                    :class="{ 'rotate-90': expandedPersons.has(person.id) }"
                  />
                  <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ person.name }}</span>
                  <span class="text-[11px] text-gray-400 ml-auto">{{ person.platforms.length }} 平台</span>
                </div>

                <!-- 平台 & Cookie -->
                <template v-if="expandedPersons.has(person.id)">
                  <div v-for="platform in person.platforms" :key="platform.id" class="ml-5 space-y-0.5">
                    <div
                      class="flex items-center gap-1.5 py-1 px-1.5 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      @click="togglePlatform(platform.id)"
                    >
                      <ChevronRight
                        :size="10"
                        class="text-gray-400 transition-transform duration-150 shrink-0"
                        :class="{ 'rotate-90': expandedPlatforms.has(platform.id) }"
                      />
                      <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ platform.name }}</span>
                      <span class="text-[10px] text-gray-400 ml-auto">{{ platform.cookies.length }} Cookie</span>
                    </div>
                    <div v-if="expandedPlatforms.has(platform.id)" class="ml-5 space-y-0.5">
                      <div
                        v-for="cookie in platform.cookies"
                        :key="cookie.id"
                        class="text-[11px] text-gray-500 dark:text-gray-400 px-1.5 py-0.5 font-mono truncate"
                      >
                        {{ cookie.name }} = {{ cookie.value || '(空)' }}
                      </div>
                    </div>
                  </div>
                </template>
              </template>
            </div>
          </div>

          <!-- 导入模式 -->
          <div>
            <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">导入模式</h3>
            <div class="space-y-2">
              <label
                class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                :class="mode === 'overwrite'
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'"
              >
                <div
                  class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                  :class="mode === 'overwrite'
                    ? 'border-blue-500'
                    : 'border-gray-300 dark:border-gray-500'"
                >
                  <div v-if="mode === 'overwrite'" class="w-2 h-2 rounded-full bg-blue-500" />
                </div>
                <div>
                  <span
                    class="text-sm font-medium"
                    :class="mode === 'overwrite' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'"
                  >覆盖导入</span>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">清空现有数据，使用导入数据替换</p>
                </div>
                <input type="radio" value="overwrite" v-model="mode" class="hidden" />
              </label>

              <label
                class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                :class="mode === 'merge'
                  ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-500'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'"
              >
                <div
                  class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                  :class="mode === 'merge'
                    ? 'border-orange-400'
                    : 'border-gray-300 dark:border-gray-500'"
                >
                  <div v-if="mode === 'merge'" class="w-2 h-2 rounded-full bg-orange-400" />
                </div>
                <div>
                  <span
                    class="text-sm font-medium"
                    :class="mode === 'merge' ? 'text-orange-700 dark:text-orange-300' : 'text-gray-700 dark:text-gray-300'"
                  >合并导入</span>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">保留现有数据，追加导入的新数据</p>
                </div>
                <input type="radio" value="merge" v-model="mode" class="hidden" />
              </label>
            </div>
          </div>

          <!-- 确认按钮 -->
          <button class="btn-primary w-full" @click="doImport">
            确认导入
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
