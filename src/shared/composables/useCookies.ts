import { nanoid } from 'nanoid'
import type { Cookie, CookieData } from '@shared/types'

export function useCookies(data: { value: CookieData }, saveData: (d: CookieData) => Promise<void>) {
  function findPlatform(platformId: string) {
    for (const person of data.value.persons) {
      const platform = person.platforms.find(item => item.id == platformId)
      if (platform) return platform
    }
    return undefined
  }

  function list(platformId: string): Cookie[] {
    for (const person of data.value.persons) {
      const platform = person.platforms.find(pl => pl.id === platformId)
      if (platform) return platform.cookies
    }
    return []
  }

  function count(platformId: string): number {
    return list(platformId).length
  }

  function findByName(platformId: string, name: string): Cookie | undefined {
    return list(platformId).find(c => c.name === name)
  }

  async function add(
    platformId: string,
    cookie: Pick<Cookie, 'name' | 'value'> & Partial<Pick<Cookie, 'enabled' | 'presetId'>>
  ): Promise<Cookie> {
    const platform = findPlatform(platformId)
    if (!platform) throw new Error('平台不存在，请刷新后重试')
    if (platform.mode == 'bridge') throw new Error('Bridge 模式平台不能添加 Cookie')
    const newCookie: Cookie = {
      id: nanoid(),
      ...cookie,
      enabled: cookie.enabled != false,
    }
    const updated = {
      ...data.value,
      persons: data.value.persons.map(p => ({
        ...p,
        platforms: p.platforms.map(pl =>
          pl.id === platformId
            ? { ...pl, cookies: [...pl.cookies, newCookie] }
            : pl
        ),
      })),
    }
    await saveData(updated)
    return newCookie
  }

  async function update(id: string, updates: Partial<Cookie>): Promise<void> {
    const owner = data.value.persons
      .flatMap(person => person.platforms)
      .find(platform => platform.cookies.some(cookie => cookie.id == id))
    if (owner?.mode == 'bridge') throw new Error('Bridge 模式平台不能修改 Cookie')
    const updated = {
      ...data.value,
      persons: data.value.persons.map(p => ({
        ...p,
        platforms: p.platforms.map(pl => ({
          ...pl,
          cookies: pl.cookies.map(c =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
      })),
    }
    await saveData(updated)
  }

  async function remove(id: string): Promise<void> {
    const updated = {
      ...data.value,
      persons: data.value.persons.map(p => ({
        ...p,
        platforms: p.platforms.map(pl => ({
          ...pl,
          cookies: pl.cookies.filter(c => c.id !== id),
        })),
      })),
    }
    await saveData(updated)
  }

  return { list, count, findByName, add, update, remove }
}
