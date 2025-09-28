// Google Directions API 服务
// 用于获取步行路径数据，供 Mapbox 地图使用
// 使用后端 API 调用，避免前端加载 Google Maps API

import { config } from '@/lib/config'

export interface GoogleDirectionsRequest {
    origin: { lat: number; lng: number }
    destination: { lat: number; lng: number }
}

export interface GoogleDirectionsResponse {
    path: Array<{ lat: number; lng: number }>
    distance: number
    duration: number
}

class GoogleDirectionsService {
    private apiKey: string

    constructor(apiKey: string) {
        this.apiKey = apiKey
    }

    async getWalkingRoute(request: GoogleDirectionsRequest): Promise<GoogleDirectionsResponse> {
        try {
            // 使用后端 API 调用 Google Directions
            const response = await fetch('/api/directions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    origin: request.origin,
                    destination: request.destination,
                    mode: 'walking'
                })
            })

            if (!response.ok) {
                throw new Error(`Directions API request failed: ${response.status}`)
            }

            const data = await response.json()
            return data
        } catch (error) {
            console.error('Google Directions API error:', error)
            // 返回直线路径作为后备方案
            return {
                path: [
                    { lat: request.origin.lat, lng: request.origin.lng },
                    { lat: request.destination.lat, lng: request.destination.lng }
                ],
                distance: 0,
                duration: 0
            }
        }
    }

    // 保持向后兼容的方法名
    async getDirections(request: GoogleDirectionsRequest): Promise<GoogleDirectionsResponse> {
        return this.getWalkingRoute(request)
    }
}

// 创建单例实例
export const googleDirectionsService = new GoogleDirectionsService(config.map.google.accessToken)
