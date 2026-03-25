import { NextRequest, NextResponse } from 'next/server'
import { getTripById, upsertTrip, deleteTrip, getTripDays } from '@/lib/db/trip-service'

export const dynamic = 'force-dynamic'

// GET /api/trips/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const trip = getTripById(params.id)
        if (!trip) return NextResponse.json({ error: '旅行不存在' }, { status: 404 })

        const days = getTripDays(params.id)
        return NextResponse.json({ ...trip, days })
    } catch (error) {
        console.error('获取旅行详情失败:', error)
        return NextResponse.json({ error: '获取旅行详情失败' }, { status: 500 })
    }
}

// PUT /api/trips/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const trip = getTripById(params.id)
        if (!trip) return NextResponse.json({ error: '旅行不存在' }, { status: 404 })

        const body = await request.json()
        const updated = {
            ...trip,
            ...body,
            id: trip.id, // immutable
            updatedAt: new Date().toISOString(),
        }

        upsertTrip(updated)
        return NextResponse.json(updated)
    } catch (error) {
        console.error('更新旅行失败:', error)
        return NextResponse.json({ error: '更新旅行失败' }, { status: 500 })
    }
}

// DELETE /api/trips/[id] — deletes trip and all its days (CASCADE)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        // deleteTrip cascades to trip_days via ON DELETE CASCADE
        deleteTrip(params.id)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('删除旅行失败:', error)
        return NextResponse.json({ error: '删除旅行失败' }, { status: 500 })
    }
}
