/**
 * 带 Token 认证的 fetch 封装
 *
 * 自动从 localStorage 读取 token 并注入 Authorization: Bearer 头。
 * 收到 401 时：清除本地 token 并派发 mapannai:unauthorized 事件，
 * 由 AuthModal 监听后弹出重新输入弹窗。
 */

import { getToken, clearToken } from './auth'

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init?.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(input, { ...init, headers })

  if (res.status === 401) {
    clearToken()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mapannai:unauthorized'))
    }
  }

  return res
}
