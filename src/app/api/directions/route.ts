import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { decode } from '@googlemaps/polyline-codec'

export const dynamic = 'force-dynamic';

/**
 * POST - 获取 Google Directions 路径数据
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { origin, destination, mode = 'walking' } = body

        if (!origin || !destination) {
            return NextResponse.json(
                { error: '需要提供起点和终点坐标' },
                { status: 400 }
            )
        }

        const apiKey = config.map.google.accessToken
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Google API Key 未配置' },
                { status: 500 }
            )
        }

        // 构建 Google Directions API 请求
        const baseUrl = `${config.map.google.baseUrl}/maps/api/directions/json`
        const params = new URLSearchParams({
            origin: `${origin.lat},${origin.lng}`,
            destination: `${destination.lat},${destination.lng}`,
            mode: mode,
            key: apiKey
        })

        const response = await fetch(`${baseUrl}?${params}`)
        
        if (!response.ok) {
            throw new Error(`Google Directions API 请求失败: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.status !== 'OK') {
            throw new Error(`Google Directions API 错误: ${data.status} - ${data.error_message || 'Unknown error'}`)
        }

        // 检查响应数据结构
        if (!data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
            throw new Error('Google Directions API 返回的路径数据为空')
        }

        // 提取路径数据
        const route = data.routes[0]
        if (!route.legs || !Array.isArray(route.legs) || route.legs.length === 0) {
            throw new Error('Google Directions API 返回的路径段数据为空')
        }
        
        const leg = route.legs[0]
        
        const path: Array<{ lat: number; lng: number }> = []
        const overviewPath = route.overview_path
        
        // 检查 overview_path 是否存在
        if (overviewPath && Array.isArray(overviewPath)) {
            overviewPath.forEach((point: any) => {
                path.push({
                    lat: point.lat,
                    lng: point.lng
                })
            })
        } else {
            // 如果没有 overview_path，尝试从 steps 中提取路径
            if (leg.steps && Array.isArray(leg.steps)) {
                leg.steps.forEach((step: any) => {
                    if (step.polyline && step.polyline.points) {
                        try {
                            // 解码 polyline 获取详细路径点
                            const decodedPath = decode(step.polyline.points)
                            decodedPath.forEach((point: [number, number]) => {
                                path.push({
                                    lat: point[0],
                                    lng: point[1]
                                })
                            })
                        } catch (error) {
                            console.warn('Polyline 解码失败:', error)
                        }
                    }
                })
            }
            
            // 如果仍然没有路径点，至少返回起点和终点
            if (path.length === 0) {
                path.push({
                    lat: leg.start_location.lat,
                    lng: leg.start_location.lng
                })
                path.push({
                    lat: leg.end_location.lat,
                    lng: leg.end_location.lng
                })
            }
        }

        return NextResponse.json({
            path,
            distance: leg.distance?.value || 0,
            duration: leg.duration?.value || 0
        })
    } catch (error) {
        console.error('获取路径数据失败:', error)
        return NextResponse.json(
            { error: '获取路径数据失败', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
