/**
 * MCP Trip Tools
 * Trip and TripDay management exposed as MCP tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { config } from '@/lib/config'
import {
    getAllTrips,
    upsertTrip,
    deleteTrip as deleteTripFromDataset,
    getAllTripDays,
    upsertTripDay,
    datasetService,
} from '@/lib/api/dataset-service'
import { Trip, TripDay } from '@/types/trip'
import { v4 as uuidv4 } from 'uuid'

function getDatasetId(): string {
    const id = config.map.mapbox.dataset?.datasetId
    if (!id) throw new Error('未配置 MAPBOX_DATASET_ID')
    return id
}

export function registerTripTools(server: McpServer) {

    // list_trips
    server.tool(
        'list_trips',
        '获取所有旅行列表，包含每次旅行的天数和地点数量',
        {},
        async () => {
            const datasetId = getDatasetId()
            const [trips, days] = await Promise.all([
                getAllTrips(datasetId),
                getAllTripDays(datasetId),
            ])
            const result = trips
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map(trip => {
                    const tripDays = days.filter(d => d.tripId === trip.id)
                    const totalMarkers = new Set(tripDays.flatMap(d => d.markerIds)).size
                    return {
                        id: trip.id,
                        name: trip.name,
                        description: trip.description,
                        startDate: trip.startDate,
                        endDate: trip.endDate,
                        dayCount: tripDays.length,
                        markerCount: totalMarkers,
                    }
                })
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
    )

    // get_trip_detail
    server.tool(
        'get_trip_detail',
        '获取单次旅行的详情，包含所有天和每天的 marker 列表',
        { tripId: z.string().describe('旅行 ID') },
        async ({ tripId }) => {
            const datasetId = getDatasetId()
            const [trips, days] = await Promise.all([
                getAllTrips(datasetId),
                getAllTripDays(datasetId),
            ])
            const trip = trips.find(t => t.id === tripId)
            if (!trip) throw new Error(`旅行不存在: ${tripId}`)

            const tripDays = days
                .filter(d => d.tripId === tripId)
                .sort((a, b) => a.date.localeCompare(b.date))

            const result = { ...trip, days: tripDays }
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
    )

    // create_trip
    server.tool(
        'create_trip',
        '创建一次新旅行，并根据日期范围自动生成每天的行程（TripDay）',
        {
            name: z.string().describe('旅行名称，例如「东京2024春」'),
            startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('开始日期 YYYY-MM-DD'),
            endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('结束日期 YYYY-MM-DD'),
            description: z.string().optional().describe('旅行备注'),
        },
        async ({ name, startDate, endDate, description }) => {
            if (startDate > endDate) throw new Error('开始日期不能晚于结束日期')
            const datasetId = getDatasetId()
            const now = new Date().toISOString()
            const tripId = `trip_${uuidv4()}`

            const trip: Trip = {
                id: tripId, name, description, startDate, endDate,
                createdAt: now, updatedAt: now,
            }

            const days: TripDay[] = []
            const cursor = new Date(startDate)
            const end = new Date(endDate)
            while (cursor <= end) {
                days.push({
                    id: `day_${uuidv4()}`,
                    tripId,
                    date: cursor.toISOString().slice(0, 10),
                    markerIds: [],
                })
                cursor.setDate(cursor.getDate() + 1)
            }

            await upsertTrip(datasetId, trip)
            await Promise.all(days.map(d => upsertTripDay(datasetId, d)))

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ ...trip, days }, null, 2),
                }],
            }
        }
    )

    // add_day_to_trip
    server.tool(
        'add_day_to_trip',
        '手动为旅行添加一天',
        {
            tripId: z.string().describe('旅行 ID'),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('日期 YYYY-MM-DD'),
            title: z.string().optional().describe('当天自定义标题'),
        },
        async ({ tripId, date, title }) => {
            const datasetId = getDatasetId()
            const day: TripDay = { id: `day_${uuidv4()}`, tripId, date, title, markerIds: [] }
            await upsertTripDay(datasetId, day)
            return { content: [{ type: 'text', text: JSON.stringify(day, null, 2) }] }
        }
    )

    // assign_marker_to_day
    server.tool(
        'assign_marker_to_day',
        '将已有 marker 加入旅行的某天行程',
        {
            tripId: z.string().describe('旅行 ID'),
            dayId: z.string().describe('天 ID（来自 get_trip_detail）'),
            markerId: z.string().describe('Marker ID'),
        },
        async ({ tripId, dayId, markerId }) => {
            const datasetId = getDatasetId()
            const days = await getAllTripDays(datasetId)
            const day = days.find(d => d.id === dayId && d.tripId === tripId)
            if (!day) throw new Error(`天不存在: ${dayId}`)

            if (!day.markerIds.includes(markerId)) {
                const updated = { ...day, markerIds: [...day.markerIds, markerId] }
                await upsertTripDay(datasetId, updated)
            }

            // Update marker's tripDayEntries
            const fc = await datasetService.getAllFeatures(datasetId)
            const feature = fc.features.find(f => f.id === markerId)
            if (feature) {
                const existing = feature.properties?.tripDayEntries || []
                if (!existing.some((e: any) => e.tripId === tripId && e.dayId === dayId)) {
                    const updatedProps = {
                        ...feature.properties,
                        tripDayEntries: [...existing, { tripId, dayId }],
                    }
                    const coords = {
                        latitude: feature.geometry.coordinates[1],
                        longitude: feature.geometry.coordinates[0],
                    }
                    await datasetService.upsertFeature(datasetId, markerId, coords, updatedProps)
                }
            }

            return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] }
        }
    )

    // plan_trip_day
    server.tool(
        'plan_trip_day',
        '旅行规划工具：按名称创建地点 marker 并加入旅行的某一天',
        {
            tripId: z.string().describe('旅行 ID'),
            dayId: z.string().describe('天 ID'),
            places: z.array(z.object({
                name: z.string().describe('地点名称'),
                iconType: z.enum(['activity', 'location', 'hotel', 'shopping', 'food', 'landmark', 'park', 'natural', 'culture', 'transit']),
                content: z.string().optional().describe('Markdown 备注'),
            })).min(1).describe('按访问顺序排列的地点列表'),
        },
        async ({ tripId, dayId, places }) => {
            const datasetId = getDatasetId()
            const days = await getAllTripDays(datasetId)
            const day = days.find(d => d.id === dayId && d.tripId === tripId)
            if (!day) throw new Error(`天不存在: ${dayId}`)

            // Use the existing create_marker logic via internal API
            const { mapProviderFactory } = await import('@/lib/map/providers')
            const { isWithinDistance } = await import('@/utils/distance')
            const crypto = (await import('crypto')).default

            const results = []
            for (const place of places) {
                try {
                    const googleProvider = mapProviderFactory.createGoogleServerProvider()
                    const mapCfg = { accessToken: config.map.google.accessToken, style: 'custom' }
                    const searchResults = await googleProvider.searchPlaces(place.name, mapCfg, 'JP')
                    if (!searchResults?.length) throw new Error(`找不到: ${place.name}`)

                    const coordinates = searchResults[0].coordinates
                    const lat = Math.round(coordinates.latitude * 1e6) / 1e6
                    const lng = Math.round(coordinates.longitude * 1e6) / 1e6
                    const hash = crypto.createHash('md5').update(`${lat},${lng}`).digest('hex')
                    const featureId = `coord_${hash}`

                    const allFeatures = await datasetService.getAllFeatures(datasetId)
                    const existing = allFeatures.features.find(f =>
                        f.id === featureId ||
                        (f.geometry?.coordinates && isWithinDistance(
                            coordinates.latitude, coordinates.longitude,
                            f.geometry.coordinates[1], f.geometry.coordinates[0], 10
                        ))
                    )

                    let markerId = featureId
                    if (!existing) {
                        const now = new Date().toISOString()
                        await datasetService.upsertFeature(datasetId, featureId, coordinates, {
                            markdownContent: place.content || '',
                            headerImage: null,
                            iconType: place.iconType,
                            next: [],
                            tripDayEntries: [{ tripId, dayId }],
                            metadata: {
                                id: featureId, title: place.name,
                                description: 'MCP 行程规划', isPublished: true,
                                createdAt: now, updatedAt: now, coordinateHash: hash,
                            },
                        })
                    } else {
                        markerId = existing.id
                        const existingEntries = existing.properties?.tripDayEntries || []
                        if (!existingEntries.some((e: any) => e.tripId === tripId && e.dayId === dayId)) {
                            const coords = {
                                latitude: existing.geometry.coordinates[1],
                                longitude: existing.geometry.coordinates[0],
                            }
                            await datasetService.upsertFeature(datasetId, markerId, coords, {
                                ...existing.properties,
                                tripDayEntries: [...existingEntries, { tripId, dayId }],
                            })
                        }
                    }

                    // Append to day
                    const freshDays = await getAllTripDays(datasetId)
                    const freshDay = freshDays.find(d => d.id === dayId)!
                    if (!freshDay.markerIds.includes(markerId)) {
                        await upsertTripDay(datasetId, { ...freshDay, markerIds: [...freshDay.markerIds, markerId] })
                    }

                    results.push({ name: place.name, id: markerId, status: existing ? 'existing' : 'created', coordinates })
                } catch (err) {
                    results.push({ name: place.name, id: null, status: 'error', error: err instanceof Error ? err.message : String(err) })
                }
            }

            return { content: [{ type: 'text', text: JSON.stringify({ dayId, results }, null, 2) }] }
        }
    )

    // reorder_day_markers
    server.tool(
        'reorder_day_markers',
        '调整某天行程中 marker 的顺序',
        {
            tripId: z.string().describe('旅行 ID'),
            dayId: z.string().describe('天 ID'),
            markerIds: z.array(z.string()).describe('新的 marker 顺序（完整列表）'),
        },
        async ({ tripId, dayId, markerIds }) => {
            const datasetId = getDatasetId()
            const days = await getAllTripDays(datasetId)
            const day = days.find(d => d.id === dayId && d.tripId === tripId)
            if (!day) throw new Error(`天不存在: ${dayId}`)
            await upsertTripDay(datasetId, { ...day, markerIds })
            return { content: [{ type: 'text', text: JSON.stringify({ success: true, dayId, markerIds }) }] }
        }
    )

    // delete_trip
    server.tool(
        'delete_trip',
        '删除旅行及其所有天（不删除 marker 本身）',
        { tripId: z.string().describe('旅行 ID') },
        async ({ tripId }) => {
            const datasetId = getDatasetId()
            const days = await getAllTripDays(datasetId)
            const tripDays = days.filter(d => d.tripId === tripId)
            await Promise.all([
                deleteTripFromDataset(datasetId, tripId),
                ...tripDays.map(d => {
                    const { deleteTripDay } = require('@/lib/api/dataset-service')
                    return deleteTripDay(datasetId, d.id)
                }),
            ])
            return { content: [{ type: 'text', text: JSON.stringify({ success: true, deletedDays: tripDays.length }) }] }
        }
    )
}
