/**
 * MCP Search & Directions Tools
 * Place search, place details, and walking directions exposed as MCP tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mapProviderFactory } from '@/lib/map/providers'
import { config } from '@/lib/config'
import { decode } from '@googlemaps/polyline-codec'

export function registerSearchTools(server: McpServer) {
  // search_places
  server.tool(
    'search_places',
    '使用 Google Places API 搜索地点，返回坐标、地址、评分等基础信息。适合在创建 marker 前先确认地点是否存在。',
    {
      query: z.string().describe('搜索关键词，例如「浅草寺」「新宿御苑」'),
      limit: z.number().int().min(1).max(10).optional().default(5).describe('返回结果数量（默认 5）'),
      country: z.string().optional().describe('限定搜索国家代码，例如 JP（日本）、CN（中国）'),
    },
    async ({ query, limit, country }) => {
      const googleProvider = mapProviderFactory.createGoogleServerProvider()
      const mapConfig = { accessToken: config.map.google.accessToken, style: 'custom' }

      const searchResults = await googleProvider.searchPlaces(query, mapConfig, country)
      const results = searchResults.slice(0, limit).map(r => ({
        name: r.name,
        coordinates: r.coordinates,
        address: r.address || '',
        placeId: r.placeId || '',
        rating: r.rating || null,
        types: r.types || [],
      }))

      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      }
    }
  )

  // get_place_details
  server.tool(
    'get_place_details',
    '根据坐标获取地点的详细信息，包括电话、网站、评分、营业时间、地点类型等。',
    {
      latitude: z.number().describe('纬度'),
      longitude: z.number().describe('经度'),
    },
    async ({ latitude, longitude }) => {
      const apiKey = config.map.google.accessToken
      if (!apiKey) throw new Error('未配置 GOOGLE_API_KEY')

      const baseUrl = config.map.google.baseUrl

      // Reverse Geocoding
      const geocodeParams = new URLSearchParams({
        latlng: `${latitude},${longitude}`,
        key: apiKey,
        language: 'zh-CN',
      })
      const geocodeRes = await fetch(`${baseUrl}/maps/api/geocode/json?${geocodeParams}`)
      if (!geocodeRes.ok) throw new Error(`Reverse Geocoding 请求失败: ${geocodeRes.status}`)

      const geocodeData = await geocodeRes.json()
      if (geocodeData.status !== 'OK') throw new Error(`Reverse Geocoding 错误: ${geocodeData.status}`)

      const firstResult = geocodeData.results?.[0]
      if (!firstResult) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ name: '未知地点', address: '无法获取地址', coordinates: { latitude, longitude } }) }],
        }
      }

      const placeId = firstResult.place_id
      let details: Record<string, unknown> = {
        name: firstResult.formatted_address,
        address: firstResult.formatted_address,
        placeId,
        coordinates: { latitude, longitude },
      }

      // Place Details
      if (placeId) {
        const detailsParams = new URLSearchParams({
          place_id: placeId,
          key: apiKey,
          language: 'zh-CN',
          fields: 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,price_level,opening_hours,types',
        })
        const detailsRes = await fetch(`${baseUrl}/maps/api/place/details/json?${detailsParams}`)
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json()
          if (detailsData.status === 'OK' && detailsData.result) {
            const r = detailsData.result
            details = {
              name: r.name || details.name,
              address: r.formatted_address || details.address,
              placeId,
              coordinates: { latitude, longitude },
              phone: r.formatted_phone_number,
              website: r.website,
              rating: r.rating,
              userRatingsTotal: r.user_ratings_total,
              priceLevel: r.price_level,
              openingHours: r.opening_hours,
              types: r.types,
            }
          }
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(details, null, 2) }],
      }
    }
  )

  // get_walking_directions
  server.tool(
    'get_walking_directions',
    '获取两点之间的步行路线，返回路径点、距离（米）和预计时间（秒）。',
    {
      origin: z.object({
        lat: z.number().describe('起点纬度'),
        lng: z.number().describe('起点经度'),
      }).describe('起点坐标'),
      destination: z.object({
        lat: z.number().describe('终点纬度'),
        lng: z.number().describe('终点经度'),
      }).describe('终点坐标'),
    },
    async ({ origin, destination }) => {
      const apiKey = config.map.google.accessToken
      if (!apiKey) throw new Error('未配置 GOOGLE_API_KEY')

      const baseUrl = config.map.google.baseUrl
      const params = new URLSearchParams({
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: 'walking',
        key: apiKey,
      })

      const res = await fetch(`${baseUrl}/maps/api/directions/json?${params}`)
      if (!res.ok) throw new Error(`Directions API 请求失败: ${res.status}`)

      const data = await res.json()
      if (data.status !== 'OK') throw new Error(`Directions API 错误: ${data.status}`)

      const route = data.routes?.[0]
      const leg = route?.legs?.[0]
      if (!leg) throw new Error('路径数据为空')

      const path: Array<{ lat: number; lng: number }> = []

      if (route.overview_path && Array.isArray(route.overview_path)) {
        route.overview_path.forEach((p: { lat: number; lng: number }) => path.push(p))
      } else if (leg.steps) {
        leg.steps.forEach((step: { polyline?: { points: string } }) => {
          if (step.polyline?.points) {
            try {
              decode(step.polyline.points).forEach(([lat, lng]: [number, number]) => path.push({ lat, lng }))
            } catch { /* skip invalid polyline */ }
          }
        })
      }

      if (path.length === 0) {
        path.push({ lat: leg.start_location.lat, lng: leg.start_location.lng })
        path.push({ lat: leg.end_location.lat, lng: leg.end_location.lng })
      }

      const result = {
        path,
        distance: leg.distance?.value || 0,
        duration: leg.duration?.value || 0,
        distanceText: leg.distance?.text || '',
        durationText: leg.duration?.text || '',
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    }
  )
}
