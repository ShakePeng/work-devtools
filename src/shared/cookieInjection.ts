/**
 * Secure Cookie 只能用于 HTTPS。HTTP 本地开发页必须使用普通 Cookie。
 */
export function shouldUseSecureCookie(targetUrl: string): boolean {
  const protocol = new URL(targetUrl).protocol
  if (protocol != 'http:' && protocol != 'https:') {
    throw new Error('Cookie 注入仅支持 HTTP/HTTPS 页面')
  }
  return protocol == 'https:'
}
