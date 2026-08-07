import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const workflow = await readFile(
  new URL('../.github/workflows/release.yml', import.meta.url),
  'utf8'
)
const releaseNotes = await readFile(
  new URL(`../docs/releases/${packageJson.version}.md`, import.meta.url),
  'utf8'
)

test('当前版本提供对应发布说明', () => {
  assert.match(releaseNotes, new RegExp(`^# Work DevTools v${packageJson.version}`, 'm'))
  assert.match(releaseNotes, /## 升级注意事项/)
  assert.match(releaseNotes, /## 验证结果/)
  assert.match(releaseNotes, /## 安装方法/)
})

test('发布工作流校验标签版本并过滤版本 Markdown 中的验证结果', () => {
  assert.match(workflow, /tags:\s*\n\s*- 'v\*'/)
  assert.equal(packageJson.engines.node, '>=22.13.0')
  assert.match(workflow, /node-version: '22\.13\.0'/)
  assert.match(workflow, /expected_tag="v\$\{package_version\}"/)
  assert.match(workflow, /release_notes="docs\/releases\/\$\{package_version\}\.md"/)
  assert.match(workflow, /public_release_notes="\$\{RUNNER_TEMP\}\/work-devtools-\$\{PACKAGE_VERSION\}-release-notes\.md"/)
  assert.match(workflow, /\^## 验证结果\[\[:space:\]\]\*\$/)
  assert.match(workflow, /hidden && \/\^## \/ \{ hidden = 0 \}/)
  assert.match(workflow, /--notes-file "\$public_release_notes"/)
  assert.doesNotMatch(workflow, /--notes-file "\$RELEASE_NOTES"/)
  assert.match(workflow, /yarn test/)
  assert.match(workflow, /yarn zip/)
})
