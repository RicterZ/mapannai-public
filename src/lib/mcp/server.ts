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
 *   Chains:  list_trip_chains, create_trip_chain
 *   Search:  search_places, get_place_details, get_walking_directions
 *   Trips:   list_trips, get_trip_detail, create_trip, add_day_to_trip,
 *            assign_marker_to_day, plan_trip_day, reorder_day_markers, delete_trip
 *   Combo:   plan_day_trip
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { registerMarkerTools } from './tools/marker-tools'
import { registerChainTools } from './tools/chain-tools'
import { registerSearchTools } from './tools/search-tools'
import { registerTripTools } from './tools/trip-tools'
import { datasetService } from '@/lib/api/dataset-service'
import { mapProviderFactory } from '@/lib/map/providers'
import { config } from '@/lib/config'
import { MarkerIconType } from '@/types/marker'
import { isWithinDistance } from '@/utils/distance'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

function generateCoordinateHash(latitude: number, longitude: number): string {
  const lat = Math.round(latitude * 1000000) / 1000000
  const lng = Math.round(longitude * 1000000) / 1000000
  return crypto.createHash('md5').update(`${lat},${lng}`).digest('hex')
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'mapannai',
    version: '1.0.0',
    description: `MapAnNai 交互式旅行地图编辑器。核心概念：Marker（地点标记）、Trip（旅行）、TripDay（旅行中的某天）、Chain（路线连线）。推荐 Workflow：1) create_trip 创建旅行 → 2) plan_trip_day 批量创建地点并加入某天 → 3) create_trip_chain 连线。可调用 workflow prompt 获取完整使用指南。`,
  })

  // Register all tools
  registerMarkerTools(server)
  registerChainTools(server)
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
1. 核心概念（Marker、Trip、TripDay、Chain）
2. 规划新旅行的推荐步骤
3. 所有可用工具的列表和说明
4. 最佳实践和注意事项`,
        },
      }],
    })
  )

  // plan_day_trip — convenience tool: creates markers + chains in one call
  server.tool(
    'plan_day_trip',
    '旅游规划便利工具：按顺序创建一组地点 marker，并自动将它们串联为行程链。适合一次性规划一天的旅行路线。',
    {
      places: z.array(z.object({
        name: z.string().describe('地点名称'),
        iconType: z.enum(['activity', 'location', 'hotel', 'shopping', 'food', 'landmark', 'park', 'natural', 'culture'])
          .describe('图标类型'),
        content: z.string().optional().describe('Markdown 格式的备注内容'),
      })).min(2).describe('按访问顺序排列的地点列表（至少 2 个）'),
      tripName: z.string().optional().describe('行程名称，例如「东京第一天」'),
      description: z.string().optional().describe('行程描述'),
    },
    async ({ places, tripName, description }) => {
      const datasetId = config.map.mapbox.dataset?.datasetId
      if (!datasetId) throw new Error('未配置 MAPBOX_DATASET_ID')

      const googleProvider = mapProviderFactory.createGoogleServerProvider()
      const mapConfig = { accessToken: config.map.google.accessToken, style: 'custom' }

      const createdMarkerIds: string[] = []
      const results: Array<{ name: string; id: string | null; status: string; error?: string }> = []

      // Step 1: Create all markers
      for (const place of places) {
        try {
          const searchResults = await googleProvider.searchPlaces(place.name, mapConfig, 'JP')
          if (!searchResults || searchResults.length === 0) {
            results.push({ name: place.name, id: null, status: 'error', error: `找不到地点: ${place.name}` })
            continue
          }

          const coordinates = searchResults[0].coordinates
          const coordinateHash = generateCoordinateHash(coordinates.latitude, coordinates.longitude)
          const featureId = `coord_${coordinateHash}`

          // Deduplication check
          const allFeatures = await datasetService.getAllFeatures(datasetId)
          const existing = allFeatures.features.find(f =>
            f.id === featureId ||
            (f.geometry?.coordinates && isWithinDistance(
              coordinates.latitude, coordinates.longitude,
              f.geometry.coordinates[1], f.geometry.coordinates[0],
              10
            ))
          )

          if (existing) {
            createdMarkerIds.push(existing.id)
            results.push({ name: place.name, id: existing.id, status: 'existing' })
            continue
          }

          const now = new Date()
          const properties = {
            markdownContent: place.content || '',
            headerImage: null,
            iconType: place.iconType as MarkerIconType,
            next: [],
            metadata: {
              id: featureId,
              title: place.name,
              description: 'MCP 行程规划创建',
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
              isPublished: true,
              coordinateHash,
            },
          }

          await datasetService.upsertFeature(datasetId, featureId, coordinates, properties)
          createdMarkerIds.push(featureId)
          results.push({ name: place.name, id: featureId, status: 'created' })
        } catch (err) {
          results.push({
            name: place.name,
            id: null,
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      // Step 2: Create trip chain from successfully created markers
      const validMarkerIds = createdMarkerIds.filter(id => id !== null)
      let chain = null

      if (validMarkerIds.length >= 2) {
        const featureCollection = await datasetService.getAllFeatures(datasetId)
        const chainId = uuidv4()

        for (let i = 0; i < validMarkerIds.length - 1; i++) {
          const currentId = validMarkerIds[i]
          const nextId = validMarkerIds[i + 1]
          const feature = featureCollection.features.find(f => f.id === currentId)
          if (!feature) continue

          const coordinates = {
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0],
          }
          const properties = { ...feature.properties }
          const existingNext: string[] = properties.next || []
          if (!existingNext.includes(nextId)) {
            properties.next = [...existingNext, nextId]
          }
          await datasetService.upsertFeature(datasetId, currentId, coordinates, properties)
        }

        chain = {
          id: chainId,
          name: tripName || `行程 ${new Date().toLocaleString('zh-CN')}`,
          description: description || '',
          markerIds: validMarkerIds,
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            markers: results,
            chain,
            summary: `成功创建 ${results.filter(r => r.status !== 'error').length}/${places.length} 个地点，${chain ? '行程链创建成功' : '地点不足无法创建行程链'}`,
          }, null, 2),
        }],
      }
    }
  )

  return server
}

// Export factory — each request must get its own McpServer instance
// because McpServer binds 1:1 with a transport and cannot be reused
export { createMcpServer }
