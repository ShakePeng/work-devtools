import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(
  new URL('../src/shared/composables/useWebDavSync.ts', import.meta.url),
  'utf8'
)
const clientSource = await readFile(
  new URL('../src/shared/webdav-client.ts', import.meta.url),
  'utf8'
)

test('WebDAV 默认地址使用示例域名', () => {
  assert.match(source, /DEFAULT_WEBDAV_ENDPOINT = 'https:\/\/webdav\.example\.com\/webdav\/work-devtools-sync\/'/)
  assert.doesNotMatch(source, /webdav\.happysoup\.cn/)
})

test('旧 WebDAV 目录连接会被重置且不会作为远端回退', () => {
  assert.match(clientSource, /pathSegments\.at\(-1\) == 'cookie-injector-sync'/)
  assert.match(source, /if \(isLegacyWebDavEndpoint\(endpoint\)\)/)
  assert.match(source, /config\.value = \{ \.\.\.DEFAULT_CONFIG \}/)
  assert.doesNotMatch(source, /readLegacyWebDavFile|LEGACY_WEBDAV_FILE_NAME/)
})
