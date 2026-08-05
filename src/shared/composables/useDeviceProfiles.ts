import { nanoid } from 'nanoid'
import type { CookieData, DeviceProfile } from '@shared/types'
import { normalizeDeviceProfiles } from '@shared/deviceProfiles'

export function useDeviceProfiles(data: { value: CookieData }, saveData: (data: CookieData) => Promise<void>) {
  function list(): DeviceProfile[] {
    return [...normalizeDeviceProfiles(data.value.deviceProfiles)].sort((a, b) => a.createdAt - b.createdAt)
  }

  function isUaInjectionEnabled(): boolean {
    return false
  }

  function available(): DeviceProfile[] {
    return isUaInjectionEnabled() ? list() : []
  }

  function find(id?: string): DeviceProfile | undefined {
    return id ? available().find(profile => profile.id == id) : undefined
  }

  function usedBy(profileId: string) {
    return data.value.persons.flatMap(person => person.platforms.filter(platform => platform.deviceProfileId == profileId).map(platform => ({ person, platform })))
  }

  async function add(input: Pick<DeviceProfile, 'name' | 'userAgent'>) {
    const now = Date.now()
    const profile: DeviceProfile = { id: nanoid(), ...input, createdAt: now, updatedAt: now }
    await saveData({ ...data.value, deviceProfiles: [...list(), profile] })
    return profile
  }

  async function update(id: string, input: Pick<DeviceProfile, 'name' | 'userAgent'>) {
    await saveData({
      ...data.value,
      deviceProfiles: list().map(profile => profile.id == id ? { ...profile, ...input, updatedAt: Date.now() } : profile),
    })
  }

  async function setUaInjectionEnabled(enabled: boolean): Promise<void> {
    if (enabled) throw new Error('设备UA预设功能正在优化，暂不可开启。')
    await saveData({ ...data.value, uaInjectionEnabled: false })
  }

  async function remove(id: string) {
    if (usedBy(id).length) throw new Error('该设备UA预设仍被平台使用，请先重新绑定相关平台。')
    await saveData({ ...data.value, deviceProfiles: list().filter(profile => profile.id != id) })
  }

  return { list, available, find, isUaInjectionEnabled, usedBy, add, update, setUaInjectionEnabled, remove }
}
