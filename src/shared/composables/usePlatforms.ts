import { nanoid } from 'nanoid'
import type { Platform, Cookie, CookieData, PlatformBridgeMock, PlatformMode } from '@shared/types'
import { requirePlatformName } from '@shared/constants/platforms'

export function usePlatforms(data: { value: CookieData }, saveData: (d: CookieData) => Promise<void>) {
  function list(personId: string): Platform[] {
    const person = data.value.persons.find(p => p.id == personId)
    if (!person) return []
    return [...person.platforms].sort((a, b) => a.order - b.order)
  }

  function count(personId: string): number {
    const person = data.value.persons.find(p => p.id == personId)
    return person ? person.platforms.length : 0
  }

  async function add(
    personId: string,
    name: string,
    deviceProfileId?: string,
    bridges: PlatformBridgeMock[] = [],
    mode: PlatformMode = 'cookie',
    cookies: Cookie[] = []
  ): Promise<Platform> {
    const person = data.value.persons.find(p => p.id == personId)
    if (!person) throw new Error('人员不存在，请刷新后重试')
    const platformName = requirePlatformName(name)
    if (person.platforms.some(platform => platform.name == platformName)) {
      throw new Error(`该人员已存在平台「${platformName}」`)
    }
    const platform: Platform = {
      id: nanoid(),
      name: platformName,
      mode,
      createdAt: Date.now(),
      order: person.platforms.length,
      cookies: mode == 'cookie' ? cookies : [],
      deviceProfileId,
      bridges: mode == 'bridge' ? bridges : [],
    }
    const updated = {
      ...data.value,
      persons: data.value.persons.map(p =>
        p.id == personId
          ? { ...p, platforms: [...p.platforms, platform] }
          : p
      ),
    }
    await saveData(updated)
    return platform
  }

  async function update(
    id: string,
    name: string,
    deviceProfileId?: string,
    bridges?: PlatformBridgeMock[],
    cookies?: Cookie[]
  ): Promise<void> {
    const platformName = requirePlatformName(name)
    const owner = data.value.persons.find(person =>
      person.platforms.some(platform => platform.id == id)
    )
    if (!owner) throw new Error('平台不存在，请刷新后重试')
    if (owner.platforms.some(platform => platform.id != id && platform.name == platformName)) {
      throw new Error(`该人员已存在平台「${platformName}」`)
    }
    const updated = {
      ...data.value,
      persons: data.value.persons.map(p => ({
        ...p,
        platforms: p.platforms.map(pl =>
          pl.id == id ? {
            ...pl,
            name: platformName,
            ...(deviceProfileId == undefined ? {} : { deviceProfileId: deviceProfileId || undefined }),
            ...(bridges == undefined ? {} : { bridges: pl.mode == 'bridge' ? bridges : [] }),
            ...(cookies == undefined ? {} : { cookies: pl.mode == 'cookie' ? cookies : pl.cookies }),
          } : pl
        ),
      })),
    }
    await saveData(updated)
  }

  async function replace(id: string, replacement: Platform): Promise<void> {
    const platformName = requirePlatformName(replacement.name)
    const owner = data.value.persons.find(person =>
      person.platforms.some(platform => platform.id == id)
    )
    if (!owner) throw new Error('平台不存在，请刷新后重试')
    if (owner.platforms.some(platform => platform.id != id && platform.name == platformName)) {
      throw new Error(`该人员已存在平台「${platformName}」`)
    }
    const updated = {
      ...data.value,
      persons: data.value.persons.map(p => ({
        ...p,
        platforms: p.platforms.map(pl =>
          pl.id == id
            ? {
                ...replacement,
                name: platformName,
                id: pl.id,
                mode: pl.mode,
                createdAt: pl.createdAt,
                order: pl.order,
                cookies: pl.mode == 'cookie' ? replacement.cookies : pl.cookies,
                bridges: pl.mode == 'bridge' ? replacement.bridges : pl.bridges,
              }
            : pl
        ),
      })),
    }
    await saveData(updated)
  }

  async function remove(id: string): Promise<void> {
    // 嵌套结构下，删除 platform 自动级联删除其下的 cookies
    const updated = {
      ...data.value,
      persons: data.value.persons.map(p => ({
        ...p,
        platforms: p.platforms.filter(pl => pl.id != id),
      })),
    }
    await saveData(updated)
  }

  return { list, count, add, update, replace, remove }
}
