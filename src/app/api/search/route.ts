import { NextRequest, NextResponse } from 'next/server'
import { searchService } from '@/lib/api/search-service'

export const dynamic = 'force-dynamic';

/**
 * GET - 使用当前配置的地图提供者搜索地点
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q')
        const limit = parseInt(searchParams.get('limit') || '5')
        const language = searchParams.get('language') || 'zh-CN'
        const country = searchParams.get('country') || undefined

        if (!query) {
            return NextResponse.json(
                { error: '需要提供搜索关键词' },
                { status: 400 }
            )
        }

        // 使用抽象搜索服务
        const results = await searchService.searchPlaces(query, limit, language, country)

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
