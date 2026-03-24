import { NextRequest, NextResponse } from 'next/server'
import { getDayById, upsertTripDay, deleteTripDay } from '@/lib/db/trip-service'

export const dynamic = 'force-dynamic'

// PUT /api/trips/[id]/days/[dayId]
export async function PUT(request: NextRequest, { params }: { params: { id: string; dayId: string } }) {
    try {
        const day = getDayById(params.dayId)
        if (!day || day.tripId !== params.id) return NextResponse.json({ error: '天不存在' }, { status: 404 })

        const body = await request.json()
        const updated = {
            ...day,
            title: body.title !== undefined ? (body.title?.trim() || undefined) : day.title,
            markerIds: body.markerIds !== undefined ? body.markerIds : day.markerIds,
            date: body.date || day.date,
        }

        upsertTripDay(updated)
        return NextResponse.json(updated)
    } catch (error) {
        console.error('更新天失败:', error)
        return NextResponse.json({ error: '更新天失败' }, { status: 500 })
    }
}

// DELETE /api/trips/[id]/days/[dayId]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; dayId: string } }) {
    try {
        deleteTripDay(params.dayId)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('删除天失败:', error)
        return NextResponse.json({ error: '删除天失败' }, { status: 500 })
    }
}
