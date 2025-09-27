import { NextRequest, NextResponse } from 'next/server'
import { MapboxDatasetService } from '@/lib/mapbox-dataset'
import { config } from '@/lib/config'
import { MapboxFeatureProperties } from '@/types/mapbox-dataset'
import { MarkerCoordinates } from '@/types/marker'

// 初始化 Mapbox Dataset 服务
const datasetService = new MapboxDatasetService(config.map.mapbox.dataset)

/**
 * GET - 获取所有标记数据
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const datasetId = searchParams.get('datasetId') || config.map.mapbox.dataset.datasetId

        if (!datasetId) {
            return NextResponse.json(
                { error: '需要提供 datasetId' },
                { status: 400 }
            )
        }

        const featureCollection = await datasetService.getAllFeatures(datasetId)

        const response = NextResponse.json({
            success: true,
            data: featureCollection,
        })

        // 禁用缓存，确保获取最新数据
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')

        return response
    } catch (error) {
        console.error('获取标记数据失败:', error)
        return NextResponse.json(
            { error: '获取标记数据失败', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

/**
 * POST - 创建或更新标记
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { featureId, coordinates, properties, datasetId } = body

        if (!featureId || !coordinates || !properties) {
            return NextResponse.json(
                { error: '缺少必需参数: featureId, coordinates, properties' },
                { status: 400 }
            )
        }

        const targetDatasetId = datasetId || config.map.mapbox.dataset.datasetId

        if (!targetDatasetId) {
            return NextResponse.json(
                { error: '需要提供 datasetId' },
                { status: 400 }
            )
        }

        const feature = await datasetService.upsertFeature(
            targetDatasetId,
            featureId,
            coordinates as MarkerCoordinates,
            properties as MapboxFeatureProperties
        )

        const response = NextResponse.json({
            success: true,
            data: feature,
        })

        // 禁用缓存，确保数据更新后立即生效
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')

        return response
    } catch (error) {
        console.error('保存标记失败:', error)
        return NextResponse.json(
            { error: '保存标记失败', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

/**
 * DELETE - 删除标记
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const featureId = searchParams.get('featureId')
        const datasetId = searchParams.get('datasetId') || config.map.mapbox.dataset.datasetId

        if (!featureId || !datasetId) {
            return NextResponse.json(
                { error: '需要提供 featureId 和 datasetId' },
                { status: 400 }
            )
        }

        await datasetService.deleteFeature(datasetId, featureId)

        const response = NextResponse.json({
            success: true,
            message: '标记删除成功',
        })

        // 禁用缓存，确保删除操作立即生效
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')

        return response
    } catch (error) {
        console.error('删除标记失败:', error)
        return NextResponse.json(
            { error: '删除标记失败', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
} 