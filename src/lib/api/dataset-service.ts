// 数据集服务抽象层
import { MapProvider, MapProviderConfig } from '@/types/map-provider'
import { mapProviderFactory } from '@/lib/map-providers'
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
    private mapProvider: MapProvider
    private mapConfig: MapProviderConfig

    constructor() {
        this.mapProvider = mapProviderFactory.createProvider(config.map.provider)
        this.mapConfig = {
            accessToken: config.map[config.map.provider].accessToken,
            style: config.map[config.map.provider].style,
        }
    }

    async getAllFeatures(datasetId: string): Promise<DatasetFeatureCollection> {
        // 根据当前地图提供者实现不同的数据集获取逻辑
        if (config.map.provider === 'mapbox') {
            return await this.getMapboxFeatures(datasetId)
        }
        
        // 其他地图提供者的实现
        console.log(`获取数据集 ${datasetId} 的所有特征 (${config.map.provider})`)
        return {
            type: 'FeatureCollection',
            features: []
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
            return {
                type: 'FeatureCollection',
                features: data.features?.map((feature: any) => ({
                    id: feature.id,
                    type: 'Feature',
                    geometry: feature.geometry,
                    properties: feature.properties
                })) || []
            }
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
        if (config.map.provider === 'mapbox') {
            return await this.upsertMapboxFeature(datasetId, featureId, coordinates, properties)
        }
        
        // 其他地图提供者的实现
        console.log(`创建/更新特征 ${featureId} 在数据集 ${datasetId} (${config.map.provider})`)
        return {
            id: featureId,
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [coordinates.longitude, coordinates.latitude]
            },
            properties
        }
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
        if (config.map.provider === 'mapbox') {
            return await this.deleteMapboxFeature(datasetId, featureId)
        }
        
        // 其他地图提供者的实现
        console.log(`删除特征 ${featureId} 从数据集 ${datasetId} (${config.map.provider})`)
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
