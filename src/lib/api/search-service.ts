// 搜索服务抽象层
import { MapProvider, MapProviderConfig } from '@/types/map-provider'
import { mapProviderFactory } from '@/lib/map-providers'
import { config } from '@/lib/config'

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

    constructor() {
        this.mapProvider = mapProviderFactory.createProvider(config.map.searchProvider)
        this.mapConfig = {
            accessToken: config.map[config.map.searchProvider].accessToken,
            style: config.map[config.map.searchProvider].style,
        }
    }

    async searchPlaces(query: string, limit: number = 5, language: string = 'zh-CN', country?: string): Promise<SearchResult[]> {
        try {
            // 使用地图提供者的搜索功能，传递国家参数
            const results = await this.mapProvider.searchPlaces(query, this.mapConfig, country)
            
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
            throw new Error('搜索失败')
        }
    }
}

// 单例实例
export const searchService = new MapSearchService()
