// 数据集服务抽象层
import { config } from '@/lib/config'
import { MarkerCoordinates } from '@/types/marker'

export interface DatasetFeature {
    id: string
    type: 'Feature'
    geometry: {
        type: 'Point'
        coordinates: [number, number]
    }
    properties: any
}

export interface DatasetFeatureCollection {
    type: 'FeatureCollection'
    features: DatasetFeature[]
}

export interface DatasetService {
    getAllFeatures(datasetId: string): Promise<DatasetFeatureCollection>
    upsertFeature(datasetId: string, featureId: string, coordinates: MarkerCoordinates, properties: any): Promise<DatasetFeature>
    deleteFeature(datasetId: string, featureId: string): Promise<void>
}

export class MapDatasetService implements DatasetService {
    private mapDataCache: Map<string, DatasetFeatureCollection> = new Map()
    private cacheTimestamps: Map<string, number> = new Map()
    private readonly CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

    constructor() {}

    async getAllFeatures(datasetId: string): Promise<DatasetFeatureCollection> {
        // 检查缓存是否有效
        const now = Date.now()
        const cacheTimestamp = this.cacheTimestamps.get(datasetId)

        if (cacheTimestamp && (now - cacheTimestamp) < this.CACHE_DURATION) {
            const cachedData = this.mapDataCache.get(datasetId)
            if (cachedData) {
                const age = now - cacheTimestamp
                console.log(`[Dataset] getAllFeatures HIT  age=${age}ms  features=${cachedData.features.length}`)
                return cachedData
            }
        }

        // 只支持 Mapbox 数据集
        const fetchStart = Date.now()
        console.log(`[Dataset] getAllFeatures MISS  fetching Mapbox...`)
        const result = await this.getMapboxFeatures(datasetId)
        console.log(`[Dataset] getAllFeatures DONE  +${Date.now() - fetchStart}ms  features=${result.features.length}`)
        return result
    }

    // 清理缓存的方法
    clearCache(datasetId?: string): void {
        if (datasetId) {
            this.mapDataCache.delete(datasetId)
            this.cacheTimestamps.delete(datasetId)
        } else {
            this.mapDataCache.clear()
            this.cacheTimestamps.clear()
        }
    }

    private async getMapboxFeatures(datasetId: string): Promise<DatasetFeatureCollection> {
        try {
            const username = config.map.mapbox.dataset.username
            const secretToken = config.map.mapbox.dataset.secretAccessToken
            const baseUrl = `https://api.mapbox.com/datasets/v1/${username}/${datasetId}/features`
            
            // 使用secret token作为access_token参数，参考原版实现
            const timestamp = Date.now()
            const response = await fetch(`${baseUrl}?access_token=${secretToken}&_t=${timestamp}`, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error('Mapbox API 错误详情:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                })
                throw new Error(`Mapbox API 错误: ${response.status} - ${errorText}`)
            }

            const data = await response.json()
            
            // 转换Mapbox格式到通用格式
            const featureCollection: DatasetFeatureCollection = {
                type: 'FeatureCollection' as const,
                features: data.features?.map((feature: any) => ({
                    id: feature.id,
                    type: 'Feature' as const,
                    geometry: feature.geometry,
                    properties: feature.properties
                })) || []
            }
            
            // 更新缓存
            this.mapDataCache.set(datasetId, featureCollection)
            this.cacheTimestamps.set(datasetId, Date.now())
            
            return featureCollection
        } catch (error) {
            console.error('获取Mapbox数据集失败:', error)
            
            // 如果是认证错误，提供更详细的错误信息
            if (error instanceof Error && error.message.includes('401')) {
                console.error('认证失败，请检查以下配置:')
                console.error('1. MAPBOX_SECRET_ACCESS_TOKEN 是否正确')
                console.error('2. MAPBOX_USERNAME 是否正确')
                console.error('3. MAPBOX_DATASET_ID 是否存在')
                console.error('4. Secret token 是否有 datasets:read 权限')
            }
            
            return {
                type: 'FeatureCollection',
                features: []
            }
        }
    }


    async upsertFeature(datasetId: string, featureId: string, coordinates: MarkerCoordinates, properties: any): Promise<DatasetFeature> {
        // 只支持 Mapbox 数据集
        const t = Date.now()
        const result = await this.upsertMapboxFeature(datasetId, featureId, coordinates, properties)
        console.log(`[Dataset] upsertFeature  id=${featureId}  +${Date.now() - t}ms`)

        // 写入成功后直接更新本地缓存（而非清除），避免 Mapbox 最终一致性延迟导致后续读取丢数据
        const cached = this.mapDataCache.get(datasetId)
        if (cached) {
            const idx = cached.features.findIndex(f => f.id === featureId)
            if (idx >= 0) {
                cached.features[idx] = result
            } else {
                cached.features.push(result)
            }
            this.cacheTimestamps.set(datasetId, Date.now())
        }

        return result
    }


    private async upsertMapboxFeature(datasetId: string, featureId: string, coordinates: MarkerCoordinates, properties: any): Promise<DatasetFeature> {
        try {
            const username = config.map.mapbox.dataset.username
            const secretToken = config.map.mapbox.dataset.secretAccessToken
            const baseUrl = `https://api.mapbox.com/datasets/v1/${username}/${datasetId}/features/${featureId}`
            
            const featureData = {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [coordinates.longitude, coordinates.latitude]
                },
                properties
            }

            const response = await fetch(`${baseUrl}?access_token=${secretToken}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(featureData)
            })

            if (!response.ok) {
                throw new Error(`Mapbox API 错误: ${response.status}`)
            }

            const data = await response.json()

            return {
                id: data.id,
                type: 'Feature',
                geometry: data.geometry,
                properties: data.properties
            }
        } catch (error) {
            console.error('创建/更新Mapbox特征失败:', error)
            throw error
        }
    }

    async deleteFeature(datasetId: string, featureId: string): Promise<void> {
        // 只支持 Mapbox 数据集
        await this.deleteMapboxFeature(datasetId, featureId)

        // 删除成功后直接从缓存移除，避免 Mapbox 最终一致性延迟
        const cached = this.mapDataCache.get(datasetId)
        if (cached) {
            cached.features = cached.features.filter(f => f.id !== featureId)
            this.cacheTimestamps.set(datasetId, Date.now())
        }
    }


    private async deleteMapboxFeature(datasetId: string, featureId: string): Promise<void> {
        try {
            const username = config.map.mapbox.dataset.username
            const secretToken = config.map.mapbox.dataset.secretAccessToken
            const baseUrl = `https://api.mapbox.com/datasets/v1/${username}/${datasetId}/features/${featureId}`
            
            const response = await fetch(`${baseUrl}?access_token=${secretToken}`, {
                method: 'DELETE'
            })

            if (!response.ok) {
                throw new Error(`Mapbox API 错误: ${response.status}`)
            }
        } catch (error) {
            console.error('删除Mapbox特征失败:', error)
            throw error
        }
    }
}

// 单例实例
export const datasetService = new MapDatasetService()
