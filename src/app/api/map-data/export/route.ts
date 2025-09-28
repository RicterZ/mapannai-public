import { NextRequest, NextResponse } from 'next/server'
import { mapDataService } from '@/lib/map-data-service'

// 强制动态渲染，因为使用了查询参数
export const dynamic = 'force-dynamic'

/**
 * GET - 导出地图数据为 GeoJSON 格式
 */
export async function GET(request: NextRequest) {
    try {
        const mapId = request.nextUrl.searchParams.get('mapId')

        if (!mapId) {
            return NextResponse.json(
                { error: '需要提供 mapId' },
                { status: 400 }
            )
        }

        const geoJsonData = await mapDataService.exportAsGeoJSON(mapId)

        return NextResponse.json({
            success: true,
            data: geoJsonData,
        })
    } catch (error) {
        console.error('导出地图数据失败:', error)
        return NextResponse.json(
            { error: '导出地图数据失败', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
