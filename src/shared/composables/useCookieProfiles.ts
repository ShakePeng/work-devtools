import { nanoid } from 'nanoid'
import type {
  CookieData,
  CookiePresetDefinition,
  CookiePresetGroup,
} from '@shared/types'
import {
  normalizeCookiePresetGroups,
  normalizeCookiePresets,
} from '@shared/cookieProfiles'

type GroupInput = Pick<CookiePresetGroup, 'name'>
type PresetInput = Pick<CookiePresetDefinition, 'groupId' | 'key' | 'defaultValue'>

export function useCookieProfiles(data: { value: CookieData }, saveData: (data: CookieData) => Promise<void>) {
  function groups(): CookiePresetGroup[] {
    return [...normalizeCookiePresetGroups(data.value.cookiePresetGroups)]
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  function presets(): CookiePresetDefinition[] {
    return [...normalizeCookiePresets(data.value.cookiePresets, groups())]
      .sort((a, b) => a.key.localeCompare(b.key))
  }

  function usedByPreset(presetId: string) {
    return data.value.persons.flatMap(person =>
      person.platforms
        .filter(platform => platform.cookies.some(cookie => cookie.presetId == presetId))
        .map(platform => ({ person, platform }))
    )
  }

  function validateGroupInput(input: GroupInput): GroupInput {
    const name = input.name.trim()
    if (!name) throw new Error('请填写 Cookie 预设分组名称。')
    return { name }
  }

  function validatePresetInput(input: PresetInput): PresetInput {
    if (!groups().some(group => group.id == input.groupId)) throw new Error('Cookie 预设分组不存在。')
    const key = input.key.trim()
    if (!key) throw new Error('请填写 Cookie Key。')
    return { groupId: input.groupId, key, defaultValue: input.defaultValue }
  }

  async function addGroup(input: GroupInput) {
    const normalized = validateGroupInput(input)
    if (groups().some(group => group.name == normalized.name)) throw new Error('已存在同名 Cookie 预设分组。')
    const now = Date.now()
    const group: CookiePresetGroup = { id: nanoid(), ...normalized, createdAt: now, updatedAt: now }
    await saveData({ ...data.value, cookiePresetGroups: [...groups(), group] })
    return group
  }

  async function updateGroup(id: string, input: GroupInput) {
    const normalized = validateGroupInput(input)
    if (groups().some(group => group.id != id && group.name == normalized.name)) {
      throw new Error('已存在同名 Cookie 预设分组。')
    }
    await saveData({
      ...data.value,
      cookiePresetGroups: groups().map(group =>
        group.id == id ? { ...group, ...normalized, updatedAt: Date.now() } : group
      ),
    })
  }

  async function removeGroup(id: string) {
    if (presets().some(preset => preset.groupId == id)) throw new Error('该分组下仍有 Cookie Key，请先删除 Key。')
    await saveData({ ...data.value, cookiePresetGroups: groups().filter(group => group.id != id) })
  }

  async function addPreset(input: PresetInput) {
    const normalized = validatePresetInput(input)
    if (presets().some(preset => preset.key == normalized.key)) throw new Error('该 Cookie Key 已存在。')
    const now = Date.now()
    const preset: CookiePresetDefinition = { id: nanoid(), ...normalized, createdAt: now, updatedAt: now }
    await saveData({ ...data.value, cookiePresets: [...presets(), preset] })
    return preset
  }

  async function updatePreset(id: string, input: PresetInput) {
    const normalized = validatePresetInput(input)
    if (presets().some(preset => preset.id != id && preset.key == normalized.key)) {
      throw new Error('该 Cookie Key 已存在。')
    }
    await saveData({
      ...data.value,
      cookiePresets: presets().map(preset =>
        preset.id == id ? { ...preset, ...normalized, updatedAt: Date.now() } : preset
      ),
    })
  }

  async function removePreset(id: string) {
    if (usedByPreset(id).length) throw new Error('该 Cookie Key 仍被业务平台使用，请先从相关平台移除。')
    await saveData({ ...data.value, cookiePresets: presets().filter(preset => preset.id != id) })
  }

  return {
    groups,
    presets,
    usedByPreset,
    addGroup,
    updateGroup,
    removeGroup,
    addPreset,
    updatePreset,
    removePreset,
  }
}
