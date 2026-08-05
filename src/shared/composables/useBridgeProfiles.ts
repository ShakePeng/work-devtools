import { nanoid } from 'nanoid'
import type {
  BridgeAdapter,
  BridgeMethodDefinition,
  BridgeProvider,
  CookieData,
  JsonValue,
} from '@shared/types'
import {
  cloneJsonValue,
  isValidBridgePathSegment,
  normalizeBridgeAdapter,
  normalizeBridgeMethods,
  normalizeBridgeProviders,
} from '@shared/bridgeProfiles'

type ProviderInput = Pick<BridgeProvider, 'name' | 'adapter'>
type MethodInput = Pick<BridgeMethodDefinition, 'providerId' | 'objectPath' | 'method' | 'defaultValue'>

export function useBridgeProfiles(data: { value: CookieData }, saveData: (data: CookieData) => Promise<void>) {
  function providers(): BridgeProvider[] {
    return [...normalizeBridgeProviders(data.value.bridgeProviders)].sort((a, b) => a.createdAt - b.createdAt)
  }

  function methods(): BridgeMethodDefinition[] {
    return [...normalizeBridgeMethods(data.value.bridgeMethods, providers())]
      .sort((a, b) => `${a.objectPath.join('.')}.${a.method}`.localeCompare(`${b.objectPath.join('.')}.${b.method}`))
  }

  function usedByMethod(methodId: string) {
    return data.value.persons.flatMap(person =>
      person.platforms
        .filter(platform => platform.bridges?.some(bridge => bridge.methodId == methodId))
        .map(platform => ({ person, platform }))
    )
  }

  function validateProviderInput(input: ProviderInput): ProviderInput {
    const name = input.name.trim()
    if (!name) throw new Error('请填写 Bridge 系统名称。')
    return { name, adapter: normalizeBridgeAdapter(input.adapter) }
  }

  function validateMethodInput(input: MethodInput): MethodInput {
    if (!providers().some(provider => provider.id == input.providerId)) throw new Error('Bridge 系统不存在。')
    if (!input.objectPath.length || !input.objectPath.every(isValidBridgePathSegment)) {
      throw new Error('对象路径格式不正确，例如：_tc_bridge_user')
    }
    if (!isValidBridgePathSegment(input.method)) throw new Error('方法名格式不正确，例如：get_device_info')
    return {
      providerId: input.providerId,
      objectPath: [...input.objectPath],
      method: input.method,
      defaultValue: cloneJsonValue(input.defaultValue),
    }
  }

  async function addProvider(input: ProviderInput) {
    const normalized = validateProviderInput(input)
    if (providers().some(provider => provider.name == normalized.name)) throw new Error('已存在同名 Bridge 系统。')
    const now = Date.now()
    const provider: BridgeProvider = {
      id: nanoid(),
      ...normalized,
      createdAt: now,
      updatedAt: now,
    }
    await saveData({ ...data.value, bridgeProviders: [...providers(), provider] })
    return provider
  }

  async function updateProvider(id: string, input: ProviderInput) {
    const normalized = validateProviderInput(input)
    if (providers().some(provider => provider.id != id && provider.name == normalized.name)) {
      throw new Error('已存在同名 Bridge 系统。')
    }
    await saveData({
      ...data.value,
      bridgeProviders: providers().map(provider =>
        provider.id == id ? { ...provider, ...normalized, updatedAt: Date.now() } : provider
      ),
    })
  }

  async function removeProvider(id: string) {
    if (methods().some(method => method.providerId == id)) throw new Error('该 Bridge 系统下仍有方法，请先删除方法。')
    await saveData({ ...data.value, bridgeProviders: providers().filter(provider => provider.id != id) })
  }

  async function addMethod(input: MethodInput) {
    const normalized = validateMethodInput(input)
    if (methods().some(item =>
      item.providerId == normalized.providerId
      && item.method == normalized.method
      && item.objectPath.join('.') == normalized.objectPath.join('.')
    )) throw new Error('该 Bridge 方法已存在。')
    const now = Date.now()
    const method: BridgeMethodDefinition = {
      id: nanoid(),
      ...normalized,
      createdAt: now,
      updatedAt: now,
    }
    await saveData({ ...data.value, bridgeMethods: [...methods(), method] })
    return method
  }

  async function updateMethod(id: string, input: MethodInput) {
    const normalized = validateMethodInput(input)
    if (methods().some(item =>
      item.id != id
      && item.providerId == normalized.providerId
      && item.method == normalized.method
      && item.objectPath.join('.') == normalized.objectPath.join('.')
    )) throw new Error('该 Bridge 方法已存在。')
    await saveData({
      ...data.value,
      bridgeMethods: methods().map(method =>
        method.id == id ? { ...method, ...normalized, updatedAt: Date.now() } : method
      ),
    })
  }

  async function removeMethod(id: string) {
    if (usedByMethod(id).length) throw new Error('该 Bridge 方法仍被业务平台使用，请先从相关平台移除。')
    await saveData({ ...data.value, bridgeMethods: methods().filter(method => method.id != id) })
  }

  return {
    providers,
    methods,
    usedByMethod,
    addProvider,
    updateProvider,
    removeProvider,
    addMethod,
    updateMethod,
    removeMethod,
  }
}
