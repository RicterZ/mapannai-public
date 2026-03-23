/**
 * MCP SSE Endpoint
 *
 * type: "sse" protocol:
 *   GET  /api/mcp              → opens SSE stream, emits endpoint URL
 *   POST /api/mcp?sessionId=   → client sends messages
 *
 * .mcp.json:
 * { "mcpServers": { "mapannai": { "type": "sse", "url": "http://localhost:3000/api/mcp" } } }
 */

import { NextRequest } from 'next/server'
import { createMcpServer } from '@/lib/mcp/server'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'

export const dynamic = 'force-dynamic'

// sessionId → transport (in-memory, single process)
const sessions = new Map<string, SSEServerTransport>()

export async function GET(request: NextRequest): Promise<Response> {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // Minimal ServerResponse shim that writes into the TransformStream
  const shimRes = {
    writeHead(_status: number, _headers?: Record<string, string>) { return this },
    write(chunk: string) {
      writer.write(encoder.encode(chunk)).catch(() => {})
      return true
    },
    end() {
      writer.close().catch(() => {})
    },
    setHeader() { return this },
    getHeader() { return undefined },
    on() { return this },
    once() { return this },
    emit() { return false },
    socket: null,
  } as any

  const transport = new SSEServerTransport('/api/mcp', shimRes)
  const sessionId = transport.sessionId
  sessions.set(sessionId, transport)

  const server = createMcpServer()
  // connect() calls transport.start() internally — do NOT call start() again
  server.connect(transport).catch((err) => {
    console.error('[MCP SSE] connect error:', err)
    sessions.delete(sessionId)
    writer.close().catch(() => {})
  })

  // Clean up on disconnect
  request.signal.addEventListener('abort', () => {
    sessions.delete(sessionId)
    writer.close().catch(() => {})
  })

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function POST(request: NextRequest): Promise<Response> {
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return new Response('Missing sessionId', { status: 400 })

  const transport = sessions.get(sessionId)
  if (!transport) return new Response('Session not found — reconnect', { status: 404 })

  // Parse body ourselves and pass as parsedBody to skip raw-body parsing
  const parsedBody = await request.json()

  const shimReq = {
    method: 'POST',
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
  } as any

  let status = 202
  const shimRes = {
    writeHead(s: number) { status = s; return this },
    end() {},
    setHeader() { return this },
    getHeader() { return undefined },
    on() { return this },
  } as any

  await transport.handlePostMessage(shimReq, shimRes, parsedBody)

  return new Response(null, { status })
}
