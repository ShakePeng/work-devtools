<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { EditorView as CodeMirrorEditorView } from 'codemirror'
import {
  AlertTriangle,
  Braces,
  Check,
  LoaderCircle,
  RotateCcw,
  Save,
  WandSparkles,
  X,
} from 'lucide-vue-next'

const props = defineProps<{
  data: unknown
  dialogId: string
  title: string
  scopePath: string
  scopeDescription: string
  overwriteLabel: string
  successMessage: string
  normalizeData: (value: unknown) => unknown
  saveData: (data: unknown) => Promise<void>
}>()

const emit = defineEmits<{
  close: []
  toast: [message: string, type: 'success' | 'error' | 'warning']
}>()

const editorHost = ref<HTMLElement | null>(null)
const jsonSnapshot = ref(JSON.stringify(props.data, null, 2) || '')
const jsonText = ref(jsonSnapshot.value)
const syntaxError = ref<string | null>(null)
const businessError = ref<string | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const overwriteConfirmed = ref(false)

const dirty = computed(() => jsonText.value != jsonSnapshot.value)
const invalid = computed(() => !!syntaxError.value || !!businessError.value)
const titleId = computed(() => `${props.dialogId}-title`)
const scopeId = computed(() => `${props.dialogId}-scope`)

let editorView: CodeMirrorEditorView | null = null
let disposed = false
let overlayPressOnOverlay = false

function validateJson(value: string): { data: unknown } | null {
  syntaxError.value = null
  businessError.value = null

  if (!value.trim()) {
    syntaxError.value = 'JSON 内容不能为空。'
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch (error) {
    syntaxError.value = (error as Error).message
    return null
  }

  try {
    return { data: props.normalizeData(parsed) }
  } catch (error) {
    businessError.value = (error as Error).message
    return null
  }
}

function handleTextChange(value: string): void {
  jsonText.value = value
  overwriteConfirmed.value = false
  validateJson(value)
}

function replaceEditorText(value: string): void {
  if (!editorView) {
    handleTextChange(value)
    return
  }

  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: value },
  })
  editorView.focus()
}

function formatJson(): void {
  if (loading.value || loadError.value || saving.value) return

  try {
    const formatted = JSON.stringify(JSON.parse(jsonText.value), null, 2)
    replaceEditorText(formatted)
  } catch {
    emit('toast', 'JSON 语法有误，修正后再格式化', 'warning')
    editorView?.focus()
  }
}

function restoreJson(): void {
  if (loading.value || loadError.value || saving.value || !dirty.value) return
  replaceEditorText(jsonSnapshot.value)
}

function requestClose(): void {
  if (saving.value) return
  if (dirty.value && !window.confirm('存在未保存的 JSON 修改，确定关闭吗？')) return
  emit('close')
}

function handleOverlayMousedown(event: MouseEvent): void {
  overlayPressOnOverlay = event.target == event.currentTarget
}

function closeFromOverlay(event: MouseEvent): void {
  if (!overlayPressOnOverlay || event.target != event.currentTarget) return
  overlayPressOnOverlay = false
  requestClose()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key != 'Escape' || event.defaultPrevented) return
  requestClose()
}

async function saveJson(): Promise<void> {
  if (loading.value || loadError.value || saving.value) return

  const normalized = validateJson(jsonText.value)
  if (!normalized) {
    emit('toast', '请先修正 JSON 中的错误', 'warning')
    editorView?.focus()
    return
  }
  if (!dirty.value) {
    emit('toast', '数据未修改', 'warning')
    return
  }
  if (!overwriteConfirmed.value) {
    overwriteConfirmed.value = true
    return
  }

  saving.value = true
  try {
    await props.saveData(normalized.data)
    emit('toast', props.successMessage, 'success')
    emit('close')
  } catch (error) {
    emit('toast', `保存 JSON 失败：${(error as Error).message}`, 'error')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  validateJson(jsonText.value)
  await nextTick()

  try {
    const [
      { basicSetup, EditorView },
      { json, jsonParseLinter },
      { lintGutter, linter },
      { indentLess, indentMore },
      { oneDark },
    ] = await Promise.all([
      import('codemirror'),
      import('@codemirror/lang-json'),
      import('@codemirror/lint'),
      import('@codemirror/commands'),
      import('@codemirror/theme-one-dark'),
    ])

    if (disposed || !editorHost.value) return

    const editorLayoutTheme = EditorView.theme({
      '&': {
        height: '100%',
        fontSize: '13px',
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        lineHeight: '1.65',
      },
      '.cm-content': { padding: '14px 0' },
      '.cm-line': { padding: '0 16px 0 8px' },
      '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy #e06c75' },
      '.cm-diagnostic-error': { borderLeftColor: '#e06c75' },
    })

    editorView = new EditorView({
      parent: editorHost.value,
      doc: jsonText.value,
      extensions: [
        basicSetup,
        json(),
        linter(jsonParseLinter()),
        lintGutter(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': props.title,
          'aria-describedby': scopeId.value,
          spellcheck: 'false',
        }),
        EditorView.domEventHandlers({
          keydown(event, view) {
            if (event.key != 'Tab') return false
            event.preventDefault()
            return event.shiftKey ? indentLess(view) : indentMore(view)
          },
        }),
        EditorView.updateListener.of(update => {
          if (update.docChanged) handleTextChange(update.state.doc.toString())
        }),
        oneDark,
        editorLayoutTheme,
      ],
    })
    editorView.focus()
  } catch (error) {
    loadError.value = `编辑器加载失败：${(error as Error).message}`
    emit('toast', loadError.value, 'error')
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('keydown', handleKeydown)
  editorView?.destroy()
  editorView = null
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[1px]"
      @mousedown="handleOverlayMousedown"
      @click="closeFromOverlay"
    >
      <section
        class="flex h-[80vh] max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <header class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400"><Braces :size="19" /></span>
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Raw JSON Editor</p>
              <h3 :id="titleId" class="truncate text-base font-semibold text-slate-800 dark:text-slate-100">{{ title }}</h3>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="loadError || syntaxError || businessError" class="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 dark:bg-red-950/50 dark:text-red-300">校验失败</span>
            <span v-else-if="dirty" class="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">已修改</span>
            <span v-else class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"><Check :size="11" />当前快照</span>
            <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" title="关闭" aria-label="关闭 JSON 编辑器" @click="requestClose"><X :size="17" /></button>
          </div>
        </header>

        <div class="flex min-h-0 flex-1 flex-col bg-slate-950">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
            <p :id="scopeId" class="text-xs leading-5 text-slate-400">当前内容对应 <code class="text-sky-300">{{ scopePath }}</code>，{{ scopeDescription }}</p>
            <div class="flex items-center gap-2">
              <button class="json-editor-action" :disabled="loading || !!loadError || saving" @click="formatJson"><WandSparkles :size="13" />格式化</button>
              <button class="json-editor-action" :disabled="loading || !!loadError || saving || !dirty" @click="restoreJson"><RotateCcw :size="13" />还原</button>
            </div>
          </div>

          <div v-if="businessError" class="flex items-start gap-2 border-b border-red-900/80 bg-red-950/70 px-4 py-2.5 text-xs leading-5 text-red-200" role="alert">
            <AlertTriangle :size="15" class="mt-0.5 shrink-0 text-red-400" />
            <span>{{ businessError }}</span>
          </div>

          <div class="relative min-h-0 flex-1">
            <div ref="editorHost" class="h-full min-h-0 overflow-hidden" />
            <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-slate-950 text-sm text-slate-400">
              <LoaderCircle :size="18" class="mr-2 animate-spin text-sky-400" />正在加载编辑器...
            </div>
            <div v-else-if="loadError" class="absolute inset-0 flex items-center justify-center bg-slate-950 p-8 text-center text-sm text-red-300">
              <div><AlertTriangle :size="24" class="mx-auto mb-3 text-red-400" /><p>{{ loadError }}</p></div>
            </div>
          </div>
        </div>

        <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <p class="text-xs text-slate-400">支持搜索、折叠、撤销/重做和 Tab 缩进。</p>
          <div class="flex items-center gap-2">
            <button class="rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" :disabled="saving" @click="requestClose">取消</button>
            <button
              class="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              :class="overwriteConfirmed ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-600 hover:bg-sky-700'"
              :disabled="loading || !!loadError || invalid || saving"
              @click="saveJson"
            >
              <LoaderCircle v-if="saving" :size="14" class="animate-spin" />
              <Save v-else :size="14" />
              {{ saving ? '保存中...' : overwriteConfirmed ? overwriteLabel : '保存' }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.json-editor-action {
  @apply inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40;
}
</style>
