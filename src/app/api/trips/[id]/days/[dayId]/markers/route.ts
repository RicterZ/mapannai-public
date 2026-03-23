import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { getAllTripDays, upsertTripDay, datasetService } from '@/lib/api/dataset-service'

export const dynamic = 'force-dynamic'

// POST /api/trips/[id]/days/[dayId]/markers — add marker to this day
export async function POST(request: NextRequest, { params }: { params: { id: string; dayId: string } }) {
    try {
        const datasetId = config.map.mapbox.dataset?.datasetId
        if (!datasetId) return NextResponse.json({ error: '未配置 MAPBOX_DATASET_ID' }, { status: 500 })

        const body = await request.json()
        const { markerId } = body
        if (!markerId) return NextResponse.json({ error: 'markerId 不能为空' }, { status: 400 })

        // 1. Update TripDay.markerIds
        const days = await getAllTripDays(datasetId)
        const day = days.find(d => d.id === params.dayId && d.tripId === params.id)
        if (!day) return NextResponse.json({ error: '天不存在' }, { status: 404 })

        if (!day.markerIds.includes(markerId)) {
            const updatedDay = { ...day, markerIds: [...day.markerIds, markerId] }
            await upsertTripDay(datasetId, updatedDay)
        }

        // 2. Update Marker.properties.tripDayEntries
        const fc = await datasetService.getAllFeatures(datasetId)
        const feature = fc.features.find(f => f.id === markerId)
        if (feature) {
            const existing: Array<{ tripId: string; dayId: string }> = feature.properties?.tripDayEntries || []
            const alreadyIn = existing.some(e => e.tripId === params.id && e.dayId === params.dayId)
            if (!alreadyIn) {
                const updatedProps = {
                    ...feature.properties,
                    tripDayEntries: [...existing, { tripId: params.id, dayId: params.dayId }],
                }
                const coords = {
                    latitude: feature.geometry.coordinates[1],
                    longitude: feature.geometry.coordinates[0],
                }
                await datasetService.upsertFeature(datasetId, markerId, coords, updatedProps)
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('添加标记到天失败:', error)
        return NextResponse.json({ error: '添加标记到天失败' }, { status: 500 })
    }
}

// DELETE /api/trips/[id]/days/[dayId]/markers/[markerId] is in a separate file
// But handle remove via DELETE on this route with body
export async function DELETE(request: NextRequest, { params }: { params: { id: string; dayId: string } }) {
    try {
        const datasetId = config.map.mapbox.dataset?.datasetId
        if (!datasetId) return NextResponse.json({ error: '未配置 MAPBOX_DATASET_ID' }, { status: 500 })

        const { markerId } = await request.json()
        if (!markerId) return NextResponse.json({ error: 'markerId 不能为空' }, { status: 400 })

        // 1. Remove from TripDay.markerIds
        const days = await getAllTripDays(datasetId)
        const day = days.find(d => d.id === params.dayId && d.tripId === params.id)
        if (day) {
            const updatedDay = { ...day, markerIds: day.markerIds.filter(id => id !== markerId) }
            await upsertTripDay(datasetId, updatedDay)
        }

        // 2. Remove from Marker.properties.tripDayEntries
        const fc = await datasetService.getAllFeatures(datasetId)
        const feature = fc.features.find(f => f.id === markerId)
        if (feature) {
            const existing: Array<{ tripId: string; dayId: string }> = feature.properties?.tripDayEntries || []
            const updatedEntries = existing.filter(e => !(e.tripId === params.id && e.dayId === params.dayId))
            const updatedProps = { ...feature.properties, tripDayEntries: updatedEntries }
            const coords = {
                latitude: feature.geometry.coordinates[1],
                longitude: feature.geometry.coordinates[0],
            }
            await datasetService.upsertFeature(datasetId, markerId, coords, updatedProps)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('从天移除标记失败:', error)
        return NextResponse.json({ error: '从天移除标记失败' }, { status: 500 })
    }
}
