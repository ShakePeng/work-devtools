export function isPlatformName(value: unknown): value is string {
  return typeof value == 'string' && !!value.trim()
}

export function requirePlatformName(value: unknown): string {
  if (isPlatformName(value)) return value.trim()
  throw new Error('请填写平台名称。')
}
