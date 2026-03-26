/**
 * Next.js API 认证中间件
 *
 * 保护所有 /api/* 路由，支持三种 token 传递方式：
 *   1. Authorization: Bearer <token>  （前端 fetchWithAuth 使用）
 *   2. x-api-token: <token>           （服务端内部调用使用）
 *   3. ?token=<token>                 （MCP Claude Desktop 使用）
 *
 * 若 API_TOKEN 环境变量未设置，则跳过认证（向后兼容本地开发）。
 */

import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const apiToken = process.env.API_TOKEN
  // 未配置 token 时跳过认证
  if (!apiToken) return NextResponse.next()

  // MCP SSE POST 消息只带 sessionId，不带 token（token 已在 GET 建连时验证过）
  // sessionId 本身即为访问凭证，此处跳过二次校验
  if (request.nextUrl.pathname === '/api/mcp' && request.method === 'POST') {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('authorization')
  const xApiToken = request.headers.get('x-api-token')
  const queryToken = request.nextUrl.searchParams.get('token')

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (xApiToken ?? queryToken)

  if (token !== apiToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
