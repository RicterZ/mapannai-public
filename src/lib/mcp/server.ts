/**
 * MapAnNai MCP Server
 *
 * Exposes map operations as MCP tools for external AI assistants
 * (Claude Desktop, Cursor, etc.) to plan trips and manage markers.
 *
 * Transport: StreamableHTTP via /api/mcp
 *
 * Available tools:
 *   Markers: list_markers, create_marker, update_marker, delete_marker
 *   Search:  search_places, get_place_details, get_walking_directions
 *   Trips:   list_trips, get_trip_detail, create_trip, add_day_to_trip,
 *            assign_marker_to_day, plan_trip_day, reorder_day_markers, delete_trip
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerMarkerTools } from './tools/marker-tools'
import { registerSearchTools } from './tools/search-tools'
import { registerTripTools } from './tools/trip-tools'

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'mapannai',
    version: '1.0.0',
    description: `MapAnNai 交互式旅行地图编辑器。核心概念：Marker（地点标记）、Trip（旅行）、TripDay（旅行中的某天）。推荐 Workflow：1) create_trip 创建旅行 → 2) plan_trip_day 批量创建地点并加入某天。可调用 workflow prompt 获取完整使用指南。`,
  })

  // Register all tools
  registerMarkerTools(server)
  registerSearchTools(server)
  registerTripTools(server)

  // Prompt: workflow guide that AI clients can request
  server.prompt(
    'workflow',
    '获取 MapAnNai 的完整使用指南和工具 Workflow',
    {},
    () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `请介绍 MapAnNai 的完整使用方式，包括：
1. 核心概念（Marker、Trip、TripDay）
2. 规划新旅行的推荐步骤
3. 所有可用工具的列表和说明
4. 最佳实践和注意事项`,
        },
      }],
    })
  )

  return server
}

// Export factory — each request must get its own McpServer instance
// because McpServer binds 1:1 with a transport and cannot be reused
export { createMcpServer }
