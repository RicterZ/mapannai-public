#!/usr/bin/env node
/**
 * MapAnNai MCP Server — stdio transport
 *
 * Claude Code / Claude Desktop (local) config:
 * {
 *   "mcpServers": {
 *     "mapannai": {
 *       "command": "npx",
 *       "args": ["tsx", "mcp-server.ts"],
 *       "cwd": "/path/to/mapannai-public"
 *     }
 *   }
 * }
 */

import 'dotenv/config'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from './src/lib/mcp/server.js'

async function main() {
  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
