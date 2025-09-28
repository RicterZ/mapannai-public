import { MapProvider, MapProviderConfig, MapSearchResult, MapCoordinates } from '@/types/map-provider'
import { config } from '@/lib/config'

/**
 * Google 服务器端地图提供者
 * 仅用于后端 API 调用，不用于前端地图显示
 */
export class GoogleServerProvider implements MapProvider {
    // 前端地图相关方法 - 不支持
    createMapInstance(): Promise<any> {
        throw new Error('GoogleServerProvider 不支持前端地图实例创建')
    }
    
    destroyMapInstance(): void {
        throw new Error('GoogleServerProvider 不支持前端地图实例销毁')
    }
    
    setViewState(): void {
        throw new Error('GoogleServerProvider 不支持前端视图控制')
    }
    
    getViewState(): any {
        throw new Error('GoogleServerProvider 不支持前端视图控制')
    }
    
    flyTo(): void {
        throw new Error('GoogleServerProvider 不支持前端地图控制')
    }
    
    addMarker(): any {
        throw new Error('GoogleServerProvider 不支持前端标记管理')
    }
    
    removeMarker(): void {
        throw new Error('GoogleServerProvider 不支持前端标记管理')
    }
    
    updateMarker(): void {
        throw new Error('GoogleServerProvider 不支持前端标记管理')
    }
    
    onMapClick(): void {
        throw new Error('GoogleServerProvider 不支持前端事件处理')
    }
    
    onMarkerClick(): void {
        throw new Error('GoogleServerProvider 不支持前端事件处理')
    }
    
    onMapLoad(): void {
        throw new Error('GoogleServerProvider 不支持前端事件处理')
    }
    
    onMapError(): void {
        throw new Error('GoogleServerProvider 不支持前端事件处理')
    }
    
    getMapStyle(): string {
        throw new Error('GoogleServerProvider 不支持前端样式')
    }
    
    getAttribution(): string {
        return 'Google Maps'
    }
    
    // 后端搜索功能 - 支持
    async searchPlaces(query: string, mapConfig: MapProviderConfig, country?: string): Promise<MapSearchResult[]> {
        try {
            const apiKey = mapConfig.accessToken
            if (!apiKey) {
                throw new Error('Google API Key 未配置')
            }
            
            // 构建搜索请求
            const baseUrl = `${config.map.google.baseUrl}/maps/api/place/textsearch/json`
            const params = new URLSearchParams({
                query,
                key: apiKey,
                language: 'zh-CN',
                region: country || 'JP'
            })
            
            const response = await fetch(`${baseUrl}?${params}`)
            
            if (!response.ok) {
                throw new Error(`Google Places API 请求失败: ${response.status}`)
            }
            
            const data = await response.json()
            
            if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                throw new Error(`Google Places API 错误: ${data.status} - ${data.error_message || 'Unknown error'}`)
            }
            
            // 转换结果格式
            return (data.results || []).map((place: any) => ({
                name: place.name,
                coordinates: {
                    latitude: place.geometry.location.lat,
                    longitude: place.geometry.location.lng
                },
                address: place.formatted_address,
                placeId: place.place_id,
                rating: place.rating,
                types: place.types
            }))
        } catch (error) {
            console.error('Google Places 搜索失败:', error)
            throw error
        }
    }
}