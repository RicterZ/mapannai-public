// 搜索服务 - 统一使用 /api/search 端点
export interface SearchResult {
    id: string
    name: string
    coordinates: {
        longitude: number
        latitude: number
    }
    address?: string
    placeId?: string
    rating?: number
    types?: string[]
    properties?: any
    bbox?: number[]
}

export interface SearchService {
    searchPlaces(query: string, limit?: number, language?: string, country?: string): Promise<SearchResult[]>
}

export class MapSearchService implements SearchService {
    constructor() {
        // 不再需要地图提供者配置
    }

    async searchPlaces(query: string, limit: number = 5, language: string = 'zh-CN', country?: string): Promise<SearchResult[]> {
        try {
            // 直接调用 /api/search 端点
            const params = new URLSearchParams({
                q: query,
                limit: limit.toString(),
                language: language,
                country: country || 'JP'
            })
            
            const url = `/api/search?${params}`
            console.log(`🔍 调用搜索API: ${url}`)
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            
            if (!response.ok) {
                throw new Error(`搜索API错误: ${response.status} ${response.statusText}`)
            }
            
            const result = await response.json()
            
            if (!result.success) {
                throw new Error(result.error || '搜索失败')
            }
            
            return result.data || []
        } catch (error) {
            console.error('搜索服务错误:', error)
            throw new Error('搜索失败')
        }
    }
}

// 单例实例
export const searchService = new MapSearchService()
