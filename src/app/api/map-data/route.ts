import { NextRequest, NextResponse } from 'next/server'
import { mapDataService } from '@/lib/map-data-service'

/**
 * GET - 获取地图数据列表或特定地图数据
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const mapId = searchParams.get('mapId')

        if (mapId) {
            // 获取特定地图数据
            const mapData = await mapDataService.getMapData(mapId)
            if (!mapData) {
                return NextResponse.json(
                    { error: '地图数据不存在' },
                    { status: 404 }
                )
            }

            return NextResponse.json({
                success: true,
                data: mapData,
            })
        } else {
            // 获取所有地图数据列表
            const mapList = await mapDataService.listMapData()
            return NextResponse.json({
                success: true,
                data: mapList,
            })
        }
    } catch (error) {
        console.error('获取地图数据失败:', error)
        return NextResponse.json(
            { error: '获取地图数据失败', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

/**
 * POST - 创建新的地图数据
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, name, description, markers } = body

        if (!id || !name || !markers) {
            return NextResponse.json(
                { error: '缺少必需参数: id, name, markers' },
                { status: 400 }
            )
        }

        const metadata = await mapDataService.saveMapData({
            id,
            name,
            description,
            markers
        })

        return NextResponse.json({
            success: true,
            data: metadata,
        })
    } catch (error) {
        console.error('创建地图数据失败:', error)
        return NextResponse.json(
            { error: '创建地图数据失败', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

/**
 * PUT - 更新地图数据
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, name, description, markers, createdAt } = body

        if (!id || !name || !markers) {
            return NextResponse.json(
                { error: '缺少必需参数: id, name, markers' },
                { status: 400 }
            )
        }

        const metadata = await mapDataService.updateMapData({
            id,
            name,
            description,
            markers,
            createdAt
        })

        return NextResponse.json({
            success: true,
            data: metadata,
        })
    } catch (error) {
        console.error('更新地图数据失败:', error)
        return NextResponse.json(
            { error: '更新地图数据失败', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

/**
 * DELETE - 删除地图数据
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const mapId = searchParams.get('mapId')

        if (!mapId) {
            return NextResponse.json(
                { error: '需要提供 mapId' },
                { status: 400 }
            )
        }

        await mapDataService.deleteMapData(mapId)

        return NextResponse.json({
            success: true,
            message: '地图数据删除成功',
        })
    } catch (error) {
        console.error('删除地图数据失败:', error)
        return NextResponse.json(
            { error: '删除地图数据失败', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
