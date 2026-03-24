/**
 * MCP Chain Tools
 * Trip chain management exposed as MCP tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import {
    getAllMarkers,
    getMarkerById,
    upsertMarker,
} from '@/lib/db/marker-service'

export function registerChainTools(server: McpServer) {
  // list_trip_chains
  server.tool(
    'list_trip_chains',
    '获取地图上所有行程链（Trip Chains）。行程链是一组按顺序相连的 marker，用于规划旅行路线。',
    {},
    async () => {
      const featureCollection = getAllMarkers()
      const markers = featureCollection.features.map(f => ({
        id: f.id,
        title: f.properties?.metadata?.title || '未命名标记',
        next: f.properties?.next || [],
      }))

      // 提取行程链：找到所有有 next 的 marker 作为起点
      const chains = markers
        .filter(m => m.next && m.next.length > 0)
        .map(m => ({
          startMarkerId: m.id,
          startMarkerTitle: m.title,
          markerIds: [m.id, ...m.next],
          length: 1 + m.next.length,
        }))

      return {
        content: [{ type: 'text', text: JSON.stringify(chains, null, 2) }],
      }
    }
  )

  // create_trip_chain
  server.tool(
    'create_trip_chain',
    '将多个 marker 按顺序串联为行程链，形成一条旅行路线。至少需要 2 个 marker ID。',
    {
      markerIds: z.array(z.string()).min(2).describe('按顺序排列的 marker ID 列表（至少 2 个）'),
      name: z.string().optional().describe('行程链名称'),
      description: z.string().optional().describe('行程描述'),
    },
    async ({ markerIds, name, description }) => {
      const chainId = uuidv4()

      // 为每个 marker（除最后一个）更新其 next 字段
      for (let i = 0; i < markerIds.length - 1; i++) {
        const currentId = markerIds[i]
        const nextId = markerIds[i + 1]

        const feature = getMarkerById(currentId)
        if (!feature) {
          throw new Error(`未找到 marker: ${currentId}`)
        }

        const coordinates = feature.geometry.coordinates
        const properties = { ...feature.properties }
        const existingNext: string[] = properties.next || []

        // 避免重复添加
        if (!existingNext.includes(nextId)) {
          properties.next = [...existingNext, nextId]
        }

        upsertMarker(currentId, coordinates[0], coordinates[1], properties)
      }

      const chain = {
        id: chainId,
        name: name || `行程 ${new Date().toLocaleString('zh-CN')}`,
        description: description || '',
        markerIds,
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(chain, null, 2) }],
      }
    }
  )
}
