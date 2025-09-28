import { NextRequest, NextResponse } from 'next/server'
import { mapDataService } from '@/lib/map-data-service'

/**
 * POST - 从 GeoJSON 导入地图数据
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { geoJsonData, mapName, mapDescription } = body

        if (!geoJsonData || !mapName) {
            return NextResponse.json(
                { error: '缺少必需参数: geoJsonData, mapName' },
                { status: 400 }
            )
        }

        const metadata = await mapDataService.importFromGeoJSON(geoJsonData, mapName, mapDescription)

        return NextResponse.json({
            success: true,
            data: metadata,
        })
    } catch (error) {
        console.error('导入地图数据失败:', error)
        return NextResponse.json(
            { error: '导入地图数据失败', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
