import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic';
/**
 * GET - 使用Mapbox Search API搜索地点
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q')
        const limit = searchParams.get('limit') || '5'

        if (!query) {
            return NextResponse.json(
                { error: '需要提供搜索关键词' },
                { status: 400 }
            )
        }

        // 调用Mapbox搜索API
        const mapboxSearchUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
        const searchResponse = await fetch(`${mapboxSearchUrl}?access_token=${config.map.mapbox.accessToken}&limit=${limit}&language=zh-CN&country=JP`)

        if (!searchResponse.ok) {
            throw new Error(`Mapbox API 错误: ${searchResponse.status}`)
        }

        const searchData = await searchResponse.json()

        // 转换为我们需要的格式
        const results = searchData.features?.map((feature: any) => ({
            id: feature.id,
            name: feature.place_name,
            coordinates: {
                longitude: feature.center[0],
                latitude: feature.center[1],
            },
            properties: feature.properties,
            bbox: feature.bbox,
        })) || []

        return NextResponse.json({
            success: true,
            data: results,
            query,
        })
    } catch (error) {
        console.error('搜索地点失败:', error)
        return NextResponse.json(
            { error: '搜索地点失败', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
} 