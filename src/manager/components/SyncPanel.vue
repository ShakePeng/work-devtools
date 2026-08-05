<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Cloud,
  DownloadCloud,
  Eye,
  EyeOff,
  FolderLock,
  Link2,
  RefreshCw,
  Server,
  ShieldCheck,
  Unlink,
  UploadCloud,
} from 'lucide-vue-next'
import {
  DEFAULT_WEBDAV_ENDPOINT,
  type WebDavSyncApi,
} from '@shared/composables/useWebDavSync'

const props = defineProps<{
  webDavSync: WebDavSyncApi
  embedded?: boolean
}>()

const emit = defineEmits<{
  toast: [msg: string, type: 'success' | 'error' | 'warning']
}>()

const endpointInput = ref(DEFAULT_WEBDAV_ENDPOINT)
const usernameInput = ref('')
const passwordInput = ref('')
const showPassword = ref(false)
const confirmDisconnect = ref(false)
const testing = ref(false)
const connecting = ref(false)
const pushing = ref(false)
const pulling = ref(false)
const refreshing = ref(false)

const configured = computed(() => {
  const config = props.webDavSync.config.value
  return config.enabled && !!config.endpoint && !!config.username && !!config.password
})

const remoteStatus = computed(() => {
  if (props.webDavSync.remoteFileExists.value == null) return '未获取'
  return props.webDavSync.remoteFileExists.value ? '文件已存在' : '尚未创建'
})

watch(
  () => props.webDavSync.config.value,
  config => {
    endpointInput.value = config.endpoint || DEFAULT_WEBDAV_ENDPOINT
    usernameInput.value = config.username || ''
    if (!config.enabled) passwordInput.value = ''
  },
  { immediate: true, deep: true }
)

function validateInputs(): boolean {
  if (!endpointInput.value.trim()) {
    emit('toast', '请输入 WebDAV 目录地址', 'warning')
    return false
  }
  if (!usernameInput.value.trim()) {
    emit('toast', '请输入 WebDAV 用户名', 'warning')
    return false
  }
  if (!passwordInput.value) {
    emit('toast', '请输入 WebDAV 密码', 'warning')
    return false
  }
  return true
}

function formatTime(value: number | null): string {
  if (!value) return '未获取'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

async function handleTest() {
  if (!validateInputs()) return
  testing.value = true
  try {
    const result = await props.webDavSync.testConnection(
      endpointInput.value,
      usernameInput.value,
      passwordInput.value
    )
    emit('toast', result.success ? 'WebDAV 连接测试成功' : result.error || '连接测试失败', result.success ? 'success' : 'error')
  } finally {
    testing.value = false
  }
}

async function handleConnect() {
  if (!validateInputs()) return
  connecting.value = true
  try {
    const result = await props.webDavSync.connect(
      endpointInput.value,
      usernameInput.value,
      passwordInput.value
    )
    if (result.success) {
      passwordInput.value = ''
      emit('toast', 'WebDAV 连接已保存，请手动选择推送或拉取', 'success')
    } else {
      emit('toast', result.error || '保存连接失败', 'error')
    }
  } finally {
    connecting.value = false
  }
}

async function handlePush() {
  pushing.value = true
  try {
    const remoteNewer = await props.webDavSync.checkRemoteNewer()
    if (remoteNewer && !window.confirm('远端数据比本地更新，继续推送会覆盖远端数据。确定继续吗？')) return

    const result = await props.webDavSync.push(true)
    if (result.success && result.action != 'skip') {
      emit('toast', '推送成功', 'success')
    } else if (result.action == 'skip') {
      emit('toast', result.error || '无需推送，数据已是最新', 'warning')
    } else {
      emit('toast', result.error || '推送失败', 'error')
    }
  } catch (error) {
    emit('toast', error instanceof Error ? error.message : '读取远端状态失败', 'error')
  } finally {
    pushing.value = false
  }
}

async function handlePull() {
  pulling.value = true
  try {
    const localNewer = await props.webDavSync.checkLocalNewer()
    if (localNewer && !window.confirm('本地数据比远端更新，继续拉取会覆盖本地改动。确定继续吗？')) return

    const result = await props.webDavSync.pull(true)
    if (result.success && result.action != 'skip') {
      emit('toast', '拉取成功', 'success')
    } else if (result.action == 'skip') {
      emit('toast', '无需拉取，数据已是最新', 'warning')
    } else {
      emit('toast', result.error || '拉取失败', 'error')
    }
  } catch (error) {
    emit('toast', error instanceof Error ? error.message : '读取远端状态失败', 'error')
  } finally {
    pulling.value = false
  }
}

async function handleRefresh() {
  refreshing.value = true
  try {
    const result = await props.webDavSync.refreshRemote()
    emit('toast', result.success ? '远端状态已刷新' : result.error || '刷新失败', result.success ? 'success' : 'error')
  } finally {
    refreshing.value = false
  }
}

async function handleDisconnect() {
  await props.webDavSync.disconnect()
  confirmDisconnect.value = false
  emit('toast', '已断开 WebDAV 同步', 'success')
}
</script>

<template>
  <div :class="embedded ? '' : 'manager-page'">
    <header v-if="!embedded" class="manager-page-header">
      <div class="flex items-start gap-3">
        <span class="manager-page-icon"><Cloud :size="20" /></span>
        <div>
          <p class="manager-page-kicker">WebDAV Sync</p>
          <h2 class="manager-page-title">同步设置</h2>
          <p class="manager-page-description">通过 NAS WebDAV 手动推送或拉取数据，不会自动覆盖本地配置。</p>
        </div>
      </div>
      <span
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
        :class="configured
          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
          : 'bg-slate-200/70 text-slate-500 dark:bg-slate-800 dark:text-slate-400'"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="configured ? 'bg-emerald-500' : 'bg-slate-400'" />
        {{ configured ? 'WebDAV 已连接' : '尚未配置' }}
      </span>
    </header>

    <div v-if="!configured" class="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
      <section class="manager-surface space-y-5 p-6">
        <div class="flex items-center gap-2">
          <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <Server :size="16" />
          </span>
          <div>
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">连接 NAS WebDAV</h3>
            <p class="mt-0.5 text-xs text-slate-400">目录需提前在 NAS 中创建，并授予专用账号读写权限。</p>
          </div>
        </div>

        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">WebDAV 目录地址</span>
          <input
            v-model="endpointInput"
            type="url"
            spellcheck="false"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="https://webdav.example.com/webdav/work-devtools-sync/"
          />
          <span class="mt-1.5 block text-[11px] leading-5 text-slate-400">填写专用同步目录，不要包含 JSON 文件名；末尾斜杠会自动补齐。</span>
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">用户名</span>
            <input
              v-model="usernameInput"
              autocomplete="username"
              spellcheck="false"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="绿联 WebDAV 专用账号"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">密码</span>
            <span class="relative block">
              <input
                v-model="passwordInput"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 pr-11 text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="WebDAV 用户密码"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </span>
          </label>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            class="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-sky-200 hover:text-sky-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            :disabled="testing || connecting"
            @click="handleTest"
          >
            <Link2 :size="16" />
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
          <button
            class="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700 disabled:opacity-50"
            :disabled="testing || connecting"
            @click="handleConnect"
          >
            <Cloud :size="16" />
            {{ connecting ? '保存中...' : '保存连接' }}
          </button>
        </div>
      </section>

      <aside class="manager-surface flex flex-col justify-between p-6">
        <div>
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <FolderLock :size="18" />
          </span>
          <h3 class="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">目录与凭据</h3>
          <p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            同步文件只写入指定 WebDAV 目录。账号密码仅保存在当前浏览器扩展的本地存储，不会写入同步 JSON。
          </p>
        </div>
        <div class="mt-8 space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-400 dark:bg-slate-950/50">
          <p class="font-mono">/webdav/work-devtools-sync/</p>
          <p class="font-mono">└─ work-devtools-sync.json</p>
        </div>
      </aside>
    </div>

    <template v-else>
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <section class="manager-surface space-y-5 p-6">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="manager-section-label">Connection</p>
              <h3 class="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">WebDAV 连接信息</h3>
            </div>
            <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">已保存</span>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="manager-surface-muted p-4 sm:col-span-2">
              <p class="text-xs text-slate-400">目录地址</p>
              <p class="mt-1 break-all font-mono text-sm text-slate-700 dark:text-slate-300">{{ webDavSync.config.value.endpoint }}</p>
            </div>
            <div class="manager-surface-muted p-4">
              <p class="text-xs text-slate-400">用户名</p>
              <p class="mt-1 truncate text-sm text-slate-700 dark:text-slate-300">{{ webDavSync.config.value.username }}</p>
            </div>
            <div class="manager-surface-muted p-4">
              <p class="text-xs text-slate-400">密码</p>
              <p class="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300">••••••••</p>
            </div>
          </div>

          <div class="grid gap-2 pt-1 sm:grid-cols-2">
            <button
              class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
              :disabled="pushing || pulling"
              @click="handlePush"
            >
              <UploadCloud :size="15" />
              {{ pushing ? '推送中...' : '推送本地配置' }}
            </button>
            <button
              class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              :disabled="pushing || pulling"
              @click="handlePull"
            >
              <DownloadCloud :size="15" />
              {{ pulling ? '拉取中...' : '拉取 NAS 配置' }}
            </button>
          </div>

          <div class="border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              v-if="!confirmDisconnect"
              class="flex items-center gap-1.5 text-xs text-red-500 transition-colors hover:text-red-600"
              @click="confirmDisconnect = true"
            >
              <Unlink :size="14" />
              断开连接
            </button>
            <div v-else class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-slate-500 dark:text-slate-400">确定断开？只会清除本机账号密码，不会删除 NAS 文件。</span>
              <button class="text-xs font-medium text-red-500 hover:underline" @click="handleDisconnect">确认</button>
              <button class="text-xs text-slate-400 hover:underline" @click="confirmDisconnect = false">取消</button>
            </div>
          </div>
        </section>

        <aside class="manager-surface p-6">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="manager-section-label">Remote File</p>
              <h3 class="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">远端同步文件</h3>
            </div>
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <ShieldCheck :size="17" />
            </span>
          </div>

          <p class="mt-5 break-all rounded-xl bg-slate-950 px-3 py-2.5 font-mono text-xs text-slate-200">{{ webDavSync.remoteFileName }}</p>

          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-400">远端状态</dt>
              <dd class="font-medium text-slate-700 dark:text-slate-200">{{ remoteStatus }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-400">远端时间</dt>
              <dd class="text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{{ formatTime(webDavSync.status.value.remoteUpdatedAt) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-400">本地时间</dt>
              <dd class="text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{{ formatTime(webDavSync.localUpdatedAt.value) }}</dd>
            </div>
          </dl>

          <button
            class="mt-5 inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-sky-200 hover:text-sky-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            :disabled="refreshing"
            @click="handleRefresh"
          >
            <RefreshCw :size="14" :class="{ 'animate-spin': refreshing }" />
            {{ refreshing ? '刷新中...' : '刷新远端状态' }}
          </button>
        </aside>
      </div>
    </template>
  </div>
</template>
