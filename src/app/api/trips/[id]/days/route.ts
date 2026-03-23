import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { config } from '@/lib/config'
import { getAllTripDays, upsertTripDay, getAllTrips } from '@/lib/api/dataset-service'
import { TripDay } from '@/types/trip'

export const dynamic = 'force-dynamic'

// GET /api/trips/[id]/days
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const datasetId = config.map.mapbox.dataset?.datasetId
        if (!datasetId) return NextResponse.json({ error: '未配置 MAPBOX_DATASET_ID' }, { status: 500 })

        const days = await getAllTripDays(datasetId)
        const tripDays = days
            .filter(d => d.tripId === params.id)
            .sort((a, b) => a.date.localeCompare(b.date))

        return NextResponse.json(tripDays)
    } catch (error) {
        console.error('获取天列表失败:', error)
        return NextResponse.json({ error: '获取天列表失败' }, { status: 500 })
    }
}

// POST /api/trips/[id]/days — add a single day
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const datasetId = config.map.mapbox.dataset?.datasetId
        if (!datasetId) return NextResponse.json({ error: '未配置 MAPBOX_DATASET_ID' }, { status: 500 })

        // Validate trip exists
        const trips = await getAllTrips(datasetId)
        if (!trips.find(t => t.id === params.id)) {
            return NextResponse.json({ error: '旅行不存在' }, { status: 404 })
        }

        const body = await request.json()
        const { date, title, markerIds } = body
        if (!date) return NextResponse.json({ error: '日期不能为空' }, { status: 400 })

        const day: TripDay = {
            id: `day_${uuidv4()}`,
            tripId: params.id,
            date,
            title: title?.trim() || undefined,
            markerIds: markerIds || [],
        }

        await upsertTripDay(datasetId, day)
        return NextResponse.json(day)
    } catch (error) {
        console.error('新增天失败:', error)
        return NextResponse.json({ error: '新增天失败' }, { status: 500 })
    }
}
