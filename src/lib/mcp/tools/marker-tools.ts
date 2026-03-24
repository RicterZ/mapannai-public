/**
 * MCP Marker Tools
 * Marker CRUD operations exposed as MCP tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { datasetService } from '@/lib/api/dataset-service'
import { mapProviderFactory } from '@/lib/map/providers'
import { config } from '@/lib/config'
import { MarkerIconType } from '@/types/marker'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { isWithinDistance } from '@/utils/distance'

function generateCoordinateHash(latitude: number, longitude: number): string {
  const lat = Math.round(latitude * 1000000) / 1000000
  const lng = Math.round(longitude * 1000000) / 1000000
  return crypto.createHash('md5').update(`${lat},${lng}`).digest('hex')
}

async function searchPlaceCoordinates(name: string): Promise<{ latitude: number; longitude: number }> {
  const googleProvider = mapProviderFactory.createGoogleServerProvider()
  const mapConfig = { accessToken: config.map.google.accessToken, style: 'custom' }
  const t = Date.now()
  const results = await googleProvider.searchPlaces(name, mapConfig, 'JP')
  console.log(`[MCP] searchPlaces "${name}"  +${Date.now() - t}ms  hits=${results?.length ?? 0}`)
  if (!results || results.length === 0) {
    throw new Error(`找不到地点: ${name}`)
  }
  return results[0].coordinates
}

export function registerMarkerTools(server: McpServer) {
  // list_markers
  server.tool(
    'list_markers',
    '获取地图上所有已保存的 marker（地点标记）列表，包含坐标、标题、图标类型和内容',
    {},
    async () => {
      const t0 = Date.now()
      const datasetId = config.map.mapbox.dataset?.datasetId
      if (!datasetId) throw new Error('未配置 MAPBOX_DATASET_ID')

      const featureCollection = await datasetService.getAllFeatures(datasetId)
      const markers = featureCollection.features
        .filter(f => f.id && f.geometry?.coordinates?.length >= 2)
        .map(f => {
          const props = f.properties || {}
          const meta = props.metadata || {}
          return {
            id: f.id,
            coordinates: {
              latitude: f.geometry.coordinates[1],
              longitude: f.geometry.coordinates[0],
            },
            title: meta.title || '未命名标记',
            iconType: props.iconType || 'location',
            markdownContent: props.markdownContent || '',
            next: props.next || [],
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt,
          }
        })

      console.log(`[MCP] list_markers  total=${markers.length}  +${Date.now() - t0}ms`)
      return {
        content: [{ type: 'text', text: JSON.stringify(markers, null, 2) }],
      }
    }
  )

  // create_marker
  server.tool(
    'create_marker',
    '按地点名称搜索坐标并在地图上创建一个新的 marker。支持批量创建。',
    {
      places: z.array(z.object({
        name: z.string().describe('地点名称（用于搜索坐标）'),
        iconType: z.enum(['activity', 'location', 'hotel', 'shopping', 'food', 'landmark', 'park', 'natural', 'culture', 'transit'])
          .describe('图标类型'),
        content: z.string().optional().describe('Markdown 格式的描述内容'),
      })).min(1).describe('要创建的地点列表（支持批量）'),
    },
    async ({ places }) => {
      const t0 = Date.now()
      const datasetId = config.map.mapbox.dataset?.datasetId
      if (!datasetId) throw new Error('未配置 MAPBOX_DATASET_ID')
      console.log(`[MCP] create_marker  count=${places.length}  names=${places.map(p => p.name).join(', ')}`)

      const results = []
      for (const place of places) {
        try {
          const coordinates = await searchPlaceCoordinates(place.name)
          const coordinateHash = generateCoordinateHash(coordinates.latitude, coordinates.longitude)
          const featureId = `coord_${coordinateHash}`

          // 检查是否已存在（10米内去重）
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
            results.push({
              id: existing.id,
              name: place.name,
              status: 'existing',
              coordinates: {
                latitude: existing.geometry.coordinates[1],
                longitude: existing.geometry.coordinates[0],
              },
            })
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
              description: 'MCP 创建的标记',
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
              isPublished: true,
              coordinateHash,
            },
          }

          await datasetService.upsertFeature(datasetId, featureId, coordinates, properties)
          results.push({
            id: featureId,
            name: place.name,
            status: 'created',
            coordinates,
          })
        } catch (err) {
          results.push({
            name: place.name,
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      console.log(`[MCP] create_marker done  +${Date.now() - t0}ms  results=${JSON.stringify(results.map(r => ({ name: r.name, status: r.status })))}`)
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      }
    }
  )

  // update_marker
  server.tool(
    'update_marker',
    '更新地图上已有 marker 的标题、Markdown 内容或图标类型',
    {
      markerId: z.string().describe('要更新的 marker ID'),
      title: z.string().optional().describe('新的标题'),
      markdownContent: z.string().optional().describe('新的 Markdown 内容'),
      iconType: z.enum(['activity', 'location', 'hotel', 'shopping', 'food', 'landmark', 'park', 'natural', 'culture', 'transit'])
        .optional().describe('新的图标类型'),
    },
    async ({ markerId, title, markdownContent, iconType }) => {
      const datasetId = config.map.mapbox.dataset?.datasetId
      if (!datasetId) throw new Error('未配置 MAPBOX_DATASET_ID')

      const allFeatures = await datasetService.getAllFeatures(datasetId)
      const feature = allFeatures.features.find(f => f.id === markerId)
      if (!feature) throw new Error(`未找到 marker: ${markerId}`)

      const coordinates = {
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
      }
      const existingProps = feature.properties || {}
      const existingMeta = existingProps.metadata || {}

      const now = new Date()
      const updatedProperties = {
        ...existingProps,
        markdownContent: markdownContent !== undefined ? markdownContent : existingProps.markdownContent,
        iconType: iconType !== undefined ? iconType : existingProps.iconType,
        metadata: {
          ...existingMeta,
          title: title !== undefined ? title : existingMeta.title,
          updatedAt: now.toISOString(),
        },
      }

      await datasetService.upsertFeature(datasetId, markerId, coordinates, updatedProperties)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, id: markerId, updatedAt: now.toISOString() }, null, 2),
        }],
      }
    }
  )

  // delete_marker
  server.tool(
    'delete_marker',
    '从地图上删除指定的 marker',
    {
      markerId: z.string().describe('要删除的 marker ID'),
    },
    async ({ markerId }) => {
      const datasetId = config.map.mapbox.dataset?.datasetId
      if (!datasetId) throw new Error('未配置 MAPBOX_DATASET_ID')

      await datasetService.deleteFeature(datasetId, markerId)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, deleted: markerId }, null, 2),
        }],
      }
    }
  )
}
