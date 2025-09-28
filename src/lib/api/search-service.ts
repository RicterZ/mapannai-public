// 搜索服务抽象层
import { MapProvider, MapProviderConfig } from '@/types/map-provider'
import { mapProviderFactory } from '@/lib/map-providers'
import { config } from '@/lib/config'
import { loadGoogleMapsForSearch, isGoogleMapsLoaded } from '@/lib/google-maps-loader'

export interface SearchResult {
    id: string
    name: string
    coordinates: {
        longitude: number
        latitude: number
    }
    properties?: any
    bbox?: number[]
}

export interface SearchService {
    searchPlaces(query: string, limit?: number, language?: string, country?: string): Promise<SearchResult[]>
}

export class MapSearchService implements SearchService {
    private mapProvider: MapProvider
    private mapConfig: MapProviderConfig
    private searchProvider: MapProvider
    private searchConfig: MapProviderConfig

    constructor() {
        // 地图提供者（用于地图渲染）
        this.mapProvider = mapProviderFactory.createProvider(config.map.provider)
        this.mapConfig = {
            accessToken: config.map[config.map.provider].accessToken,
            style: config.map[config.map.provider].style,
        }
        
        // 搜索提供者（可以独立于地图提供者）
        this.searchProvider = mapProviderFactory.createProvider(config.map.searchProvider)
        this.searchConfig = {
            accessToken: config.map[config.map.searchProvider].accessToken,
            style: config.map[config.map.searchProvider].style,
        }
    }

    async searchPlaces(query: string, limit: number = 5, language: string = 'zh-CN', country?: string): Promise<SearchResult[]> {
        try {
            // 如果搜索提供者是 Google Maps 但 API 未加载，尝试动态加载
            if (config.map.searchProvider === 'google' && !isGoogleMapsLoaded()) {
                console.log('Google Maps API 未加载，尝试动态加载...')
                try {
                    await loadGoogleMapsForSearch(this.searchConfig.accessToken)
                } catch (loadError) {
                    console.error('无法加载 Google Maps API:', loadError)
                    // 如果加载失败，降级到地图提供者搜索
                    console.log('降级到地图提供者搜索')
                    const fallbackResults = await this.mapProvider.searchPlaces(query, this.mapConfig)
                    const limitedResults = fallbackResults.slice(0, limit)
                    
                    return limitedResults.map(result => ({
                        id: result.name,
                        name: result.name,
                        coordinates: result.coordinates,
                        properties: {},
                        bbox: undefined,
                    }))
                }
            }

            // 使用独立的搜索提供者（可以是 Google Maps，即使地图是 Mapbox）
            const results = await this.searchProvider.searchPlaces(query, this.searchConfig)
            
            // 限制结果数量
            const limitedResults = results.slice(0, limit)
            
            // 转换为统一格式
            return limitedResults.map(result => ({
                id: result.name, // 使用名称作为ID，实际实现中可能需要更复杂的ID生成
                name: result.name,
                coordinates: result.coordinates,
                properties: {},
                bbox: undefined,
            }))
        } catch (error) {
            console.error('搜索服务错误:', error)
            
            // 如果 Google Maps API 未加载，尝试降级到地图提供者的搜索
            if (error instanceof Error && error.message.includes('Google Maps API not loaded')) {
                console.log('Google Maps API 未加载，降级到地图提供者搜索')
                try {
                    const fallbackResults = await this.mapProvider.searchPlaces(query, this.mapConfig)
                    const limitedResults = fallbackResults.slice(0, limit)
                    
                    return limitedResults.map(result => ({
                        id: result.name,
                        name: result.name,
                        coordinates: result.coordinates,
                        properties: {},
                        bbox: undefined,
                    }))
                } catch (fallbackError) {
                    console.error('降级搜索也失败:', fallbackError)
                    throw new Error('搜索失败，请检查网络连接或稍后再试')
                }
            }
            
            throw new Error('搜索失败')
        }
    }
}

// 单例实例
export const searchService = new MapSearchService()
