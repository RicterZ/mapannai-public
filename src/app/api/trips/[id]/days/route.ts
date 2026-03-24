import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getTripById, getTripDays, upsertTripDay } from '@/lib/db/trip-service'
import { TripDay } from '@/types/trip'

export const dynamic = 'force-dynamic'

// GET /api/trips/[id]/days
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const days = getTripDays(params.id)
        return NextResponse.json(days)
    } catch (error) {
        console.error('获取天列表失败:', error)
        return NextResponse.json({ error: '获取天列表失败' }, { status: 500 })
    }
}

// POST /api/trips/[id]/days — add a single day
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        // Validate trip exists
        const trip = getTripById(params.id)
        if (!trip) return NextResponse.json({ error: '旅行不存在' }, { status: 404 })

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

        upsertTripDay(day)
        return NextResponse.json(day)
    } catch (error) {
        console.error('新增天失败:', error)
        return NextResponse.json({ error: '新增天失败' }, { status: 500 })
    }
}
