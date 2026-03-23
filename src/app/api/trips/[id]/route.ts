import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import {
    getAllTrips,
    upsertTrip,
    deleteTrip,
    getAllTripDays,
    deleteTripDay,
} from '@/lib/api/dataset-service'

export const dynamic = 'force-dynamic'

// GET /api/trips/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const datasetId = config.map.mapbox.dataset?.datasetId
        if (!datasetId) return NextResponse.json({ error: '未配置 MAPBOX_DATASET_ID' }, { status: 500 })

        const trips = await getAllTrips(datasetId)
        const trip = trips.find(t => t.id === params.id)
        if (!trip) return NextResponse.json({ error: '旅行不存在' }, { status: 404 })

        const allDays = await getAllTripDays(datasetId)
        const days = allDays
            .filter(d => d.tripId === params.id)
            .sort((a, b) => a.date.localeCompare(b.date))

        return NextResponse.json({ ...trip, days })
    } catch (error) {
        console.error('获取旅行详情失败:', error)
        return NextResponse.json({ error: '获取旅行详情失败' }, { status: 500 })
    }
}

// PUT /api/trips/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const datasetId = config.map.mapbox.dataset?.datasetId
        if (!datasetId) return NextResponse.json({ error: '未配置 MAPBOX_DATASET_ID' }, { status: 500 })

        const trips = await getAllTrips(datasetId)
        const trip = trips.find(t => t.id === params.id)
        if (!trip) return NextResponse.json({ error: '旅行不存在' }, { status: 404 })

        const body = await request.json()
        const updated = {
            ...trip,
            ...body,
            id: trip.id, // immutable
            updatedAt: new Date().toISOString(),
        }

        await upsertTrip(datasetId, updated)
        return NextResponse.json(updated)
    } catch (error) {
        console.error('更新旅行失败:', error)
        return NextResponse.json({ error: '更新旅行失败' }, { status: 500 })
    }
}

// DELETE /api/trips/[id] — deletes trip and all its days (not markers)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const datasetId = config.map.mapbox.dataset?.datasetId
        if (!datasetId) return NextResponse.json({ error: '未配置 MAPBOX_DATASET_ID' }, { status: 500 })

        const allDays = await getAllTripDays(datasetId)
        const tripDays = allDays.filter(d => d.tripId === params.id)

        await Promise.all([
            deleteTrip(datasetId, params.id),
            ...tripDays.map(d => deleteTripDay(datasetId, d.id)),
        ])

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('删除旅行失败:', error)
        return NextResponse.json({ error: '删除旅行失败' }, { status: 500 })
    }
}
