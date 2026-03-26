/**
 * 客户端 API Token 工具函数
 *
 * Token 存储在 localStorage 中，仅在浏览器端可用。
 */

const TOKEN_KEY = 'mapannai_token'

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token)
}

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
}
