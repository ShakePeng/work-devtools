import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(
  new URL('../src/shared/composables/useLocalStorage.ts', import.meta.url),
  'utf8'
)
const storageKeysSource = await readFile(
  new URL('../src/shared/storageKeys.ts', import.meta.url),
  'utf8'
)
const personListSource = await readFile(
  new URL('../src/popup/components/PersonList.vue', import.meta.url),
  'utf8'
)
const typesSource = await readFile(
  new URL('../src/shared/types/index.ts', import.meta.url),
  'utf8'
)
const workspaceDataSource = await readFile(
  new URL('../src/shared/workspaceData.ts', import.meta.url),
  'utf8'
)

test('Work DevTools 使用统一根数据键，工具状态保留独立命名空间', () => {
  assert.match(storageKeysSource, /data: 'work_devtools\.data'/)
  assert.match(storageKeysSource, /localMigrated: 'work_devtools\.local_migrated'/)
  assert.match(storageKeysSource, /expandedPersonIds: 'work_devtools\.cookie_injector\.expanded_person_ids'/)
  assert.match(storageKeysSource, /config: 'work_devtools\.webdav\.config'/)
})

test('业务数据只写入 storage.local', () => {
  assert.match(source, /chrome\.storage\.local\.set/)
  assert.doesNotMatch(source, /chrome\.storage\.sync\.set/)
})

test('首次升级时读取旧 storage.sync 数据并记录迁移状态', () => {
  assert.match(source, /readLegacySyncData/)
  assert.match(source, /chrome\.storage\.sync\.get/)
  assert.match(source, /LEGACY_STORAGE_KEY_LOCAL_MIGRATED = 'cookie_data_local_migrated'/)
})

test('两代旧本机 Cookie 数据写入根键后才删除旧键', () => {
  assert.match(source, /PREVIOUS_STORAGE_KEY_SINGLE = 'work_devtools\.cookie_injector\.data'/)
  assert.match(source, /LEGACY_STORAGE_KEY_SINGLE = 'cookie_data'/)
  const migrationSource = source.slice(
    source.indexOf('if (shouldPersist)'),
    source.indexOf('workspaceData.value = normalized')
  )
  assert.ok(migrationSource.indexOf('await writeLocalData(normalized)') >= 0)
  assert.ok(
    migrationSource.indexOf('await writeLocalData(normalized)')
      < migrationSource.indexOf('await removeLegacyLocalData()')
  )
})

test('持久化数据统一包裹到 tools.cookieInjector 且工具内不写元数据', () => {
  assert.match(source, /createWorkDevToolsData\(defaultData\)/)
  assert.match(source, /tools:\s*\{[\s\S]*cookieInjector:/)
  const defaultSource = source.slice(
    source.indexOf('function createDefaultData'),
    source.indexOf('function normalizeCookieData')
  )
  assert.doesNotMatch(defaultSource, /version:/)
  assert.doesNotMatch(defaultSource, /updatedAt:/)
  const cookieTypeSource = typesSource.slice(
    typesSource.indexOf('export interface CookieData'),
    typesSource.indexOf('export interface WorkDevToolsData')
  )
  assert.doesNotMatch(cookieTypeSource, /version:/)
  assert.doesNotMatch(cookieTypeSource, /updatedAt:/)
  assert.match(workspaceDataSource, /const \{ version: _version, updatedAt, \.\.\.cookieInjector \} = legacy/)
})

test('Popup 展开状态迁移到 Cookie Injector 命名空间', () => {
  assert.match(personListSource, /STORAGE_KEYS\.cookieInjector\.expandedPersonIds/)
  assert.match(personListSource, /LEGACY_STORAGE_KEY_EXPANDED = 'expanded_person_ids'/)
  assert.match(personListSource, /chrome\.storage\.local\.set\(\{ \[STORAGE_KEY_EXPANDED\]: legacyIds \}\)/)
  assert.match(personListSource, /chrome\.storage\.local\.remove\(LEGACY_STORAGE_KEY_EXPANDED\)/)
})

test('清空本机数据后不会再次从 storage.sync 恢复', () => {
  const clearAllSource = source.slice(source.indexOf('async function clearAll'))
  assert.match(clearAllSource, /\[STORAGE_KEY_LOCAL_MIGRATED\]: true/)
  assert.match(clearAllSource, /STORAGE_KEY_SINGLE/)
  assert.match(clearAllSource, /LEGACY_STORAGE_KEY_SINGLE/)
})
