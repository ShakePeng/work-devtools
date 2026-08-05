import { nanoid } from 'nanoid'
import type { Person, CookieData } from '@shared/types'

export function usePersons(data: { value: CookieData }, saveData: (d: CookieData) => Promise<void>) {
  function list(): Person[] {
    return [...data.value.persons].sort((a, b) => a.order - b.order)
  }

  async function add(name: string): Promise<Person> {
    const person: Person = {
      id: nanoid(),
      name: name.trim(),
      createdAt: Date.now(),
      order: data.value.persons.length,
      platforms: [],
    }
    const updated = {
      ...data.value,
      persons: [...data.value.persons, person],
    }
    await saveData(updated)
    return person
  }

  async function update(id: string, name: string): Promise<void> {
    const updated = {
      ...data.value,
      persons: data.value.persons.map(p =>
        p.id === id ? { ...p, name: name.trim() } : p
      ),
    }
    await saveData(updated)
  }

  async function replace(id: string, replacement: Person): Promise<void> {
    const updated = {
      ...data.value,
      persons: data.value.persons.map(p =>
        p.id === id
          ? {
              ...replacement,
              id: p.id,
              createdAt: p.createdAt,
              order: p.order,
              platforms: replacement.platforms.map(platform => {
                const current = p.platforms.find(item => item.id == platform.id)
                if (!current) return platform
                return {
                  ...platform,
                  mode: current.mode,
                  cookies: current.mode == 'cookie' ? platform.cookies : current.cookies,
                  bridges: current.mode == 'bridge' ? platform.bridges : current.bridges,
                }
              }),
            }
          : p
      ),
    }
    await saveData(updated)
  }

  async function remove(id: string): Promise<void> {
    // 嵌套结构下，删除人员即自动删除其下的 platforms 和 cookies
    const updated = {
      ...data.value,
      persons: data.value.persons.filter(p => p.id !== id),
    }
    await saveData(updated)
  }

  async function reorder(ids: string[]): Promise<void> {
    const updated = {
      ...data.value,
      persons: data.value.persons.map(p => ({
        ...p,
        order: ids.indexOf(p.id),
      })),
    }
    await saveData(updated)
  }

  return { list, add, update, replace, remove, reorder }
}
