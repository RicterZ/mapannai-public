// 数据集服务抽象层
import { MapProvider, MapProviderConfig } from '@/types/map-provider'
import { mapProviderFactory } from '@/lib/map-providers'
import { config } from '@/lib/config'
import { MarkerCoordinates, Marker } from '@/types/marker'
import { useMapStore } from '@/store/map-store'
import { mapDataService } from '@/lib/map-data-service'

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
    private mapDataCache: Map<string, DatasetFeatureCollection> = new Map()

    constructor() {
        this.mapProvider = mapProviderFactory.createProvider(config.map.provider)
        this.mapConfig = {
            accessToken: config.map[config.map.provider].accessToken,
            style: config.map[config.map.provider].style,
        }
    }

    async getAllFeatures(datasetId: string): Promise<DatasetFeatureCollection> {
        console.log('获取所有特征，datasetId:', datasetId, 'provider:', config.map.provider)
        // 根据当前地图提供者实现不同的数据集获取逻辑
        if (config.map.provider === 'mapbox') {
            return await this.getMapboxFeatures(datasetId)
        } else if (config.map.provider === 'google') {
            return await this.getGoogleFeatures(datasetId)
        }
        
        // 其他地图提供者的实现
        return {
            type: 'FeatureCollection',
            features: []
        }
    }

    // 清理缓存的方法
    clearCache(datasetId?: string): void {
        if (datasetId) {
            this.mapDataCache.delete(datasetId)
            console.log('清理缓存:', datasetId)
        } else {
            this.mapDataCache.clear()
            console.log('清理所有缓存')
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
        } else if (config.map.provider === 'google') {
            return await this.upsertGoogleFeature(datasetId, featureId, coordinates, properties)
        }
        
        // 其他地图提供者的实现
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
        } else if (config.map.provider === 'google') {
            return await this.deleteGoogleFeature(datasetId, featureId)
        }
        
        // 其他地图提供者的实现
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

    // Google Maps 数据获取方法 - 使用 JSON 存储
    private async getGoogleFeatures(datasetId: string): Promise<DatasetFeatureCollection> {
        try {
            // 从缓存中获取数据集
            let dataset = this.mapDataCache.get(datasetId)
            if (dataset) {
                console.log('从缓存获取数据集:', datasetId, '特征数量:', dataset.features.length)
                return dataset
            }
            
            // 从 COS 存储获取数据
            try {
                const mapData = await mapDataService.getMapData(datasetId)
                
                if (mapData) {
                    console.log('从COS加载地图数据:', mapData.markers.length, '个标记')
                    // 将存储的标记转换为特征
                    const features: DatasetFeature[] = mapData.markers.map(storedMarker => {
                        console.log('转换标记:', storedMarker.id, 'next字段:', storedMarker.content.next)
                        return {
                            id: storedMarker.id,
                            type: 'Feature' as const,
                            geometry: {
                                type: 'Point' as const,
                                coordinates: [storedMarker.coordinates.longitude, storedMarker.coordinates.latitude]
                            },
                            properties: {
                                markdownContent: storedMarker.content.markdownContent,
                                headerImage: storedMarker.content.headerImage || null,
                                iconType: storedMarker.content.iconType || 'location',
                                next: storedMarker.content.next || [],
                                metadata: {
                                    id: storedMarker.id,
                                    title: storedMarker.content.title || '未命名标记',
                                    description: '用户创建的标记',
                                    createdAt: storedMarker.content.createdAt,
                                    updatedAt: storedMarker.content.updatedAt,
                                    isPublished: true,
                                }
                            }
                        }
                    })
                    
                    dataset = {
                        type: 'FeatureCollection',
                        features
                    }
                    
                    this.mapDataCache.set(datasetId, dataset)
                    console.log(`地图数据 ${datasetId} 已从COS加载`)
                    return dataset
                }
            } catch (cosError) {
                console.warn('从COS加载失败，尝试从map-store获取:', cosError)
            }
            
            // 如果COS失败，尝试从map-store获取标记数据
            if (typeof window !== 'undefined') {
                const mapStore = useMapStore.getState()
                const markers = mapStore.markers
                
                // 将标记转换为特征
                const features: DatasetFeature[] = markers.map(marker => ({
                    id: marker.id,
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: [marker.coordinates.longitude, marker.coordinates.latitude]
                    },
                    properties: {
                        markdownContent: marker.content.markdownContent,
                        headerImage: marker.content.headerImage || null,
                        iconType: marker.content.iconType || 'location',
                        next: marker.content.next || [],
                        metadata: {
                            id: marker.id,
                            title: marker.content.title || '未命名标记',
                            description: '用户创建的标记',
                            createdAt: marker.content.createdAt,
                            updatedAt: marker.content.updatedAt,
                            isPublished: true,
                        }
                    }
                }))
                
                dataset = {
                    type: 'FeatureCollection',
                    features
                }
                this.mapDataCache.set(datasetId, dataset)
                return dataset
            }
            
            // 如果数据集不存在，创建空的数据集
            const emptyDataset: DatasetFeatureCollection = {
                type: 'FeatureCollection',
                features: []
            }
            this.mapDataCache.set(datasetId, emptyDataset)
            return emptyDataset
        } catch (error) {
            console.error('获取地图数据失败:', error)
            return {
                type: 'FeatureCollection',
                features: []
            }
        }
    }

    private async upsertGoogleFeature(datasetId: string, featureId: string, coordinates: MarkerCoordinates, properties: any): Promise<DatasetFeature> {
        try {
            console.log('保存标记到Google Maps:', featureId, 'next字段:', properties.next)
            // 创建新特征
            const newFeature: DatasetFeature = {
                id: featureId,
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [coordinates.longitude, coordinates.latitude]
                },
                properties
            }
            
            // 获取现有地图数据
            let mapData = await mapDataService.getMapData(datasetId)
            
            if (!mapData) {
                // 创建新的地图数据
                mapData = {
                    id: datasetId,
                    name: `地图数据 ${datasetId}`,
                    description: '自动创建的地图数据',
                    markers: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: '1.0.0'
                }
            }
            
            // 查找并更新现有标记，或添加新标记
            const existingMarkerIndex = mapData.markers.findIndex(m => m.id === featureId)
            const now = new Date().toISOString()
            
            if (existingMarkerIndex >= 0) {
                // 更新现有标记
                mapData.markers[existingMarkerIndex] = {
                    id: featureId,
                    coordinates,
                    content: {
                        id: featureId,
                        title: properties.metadata?.title || properties.name || properties.title || '未命名标记',
                        markdownContent: properties.markdownContent || properties.description || properties.content || '',
                        iconType: properties.iconType || 'location',
                        next: properties.next || [],
                        createdAt: mapData.markers[existingMarkerIndex].content.createdAt,
                        updatedAt: now
                    },
                    createdAt: mapData.markers[existingMarkerIndex].createdAt,
                    updatedAt: now
                }
            } else {
                // 添加新标记
                const newStoredMarker = {
                    id: featureId,
                    coordinates,
                    content: {
                        id: featureId,
                        title: properties.metadata?.title || properties.name || properties.title || '未命名标记',
                        markdownContent: properties.markdownContent || properties.description || properties.content || '',
                        iconType: properties.iconType || 'location',
                        next: properties.next || [],
                        createdAt: now,
                        updatedAt: now
                    },
                    createdAt: now,
                    updatedAt: now
                }
                mapData.markers.push(newStoredMarker)
            }
            
            // 更新地图数据到 COS
            await mapDataService.updateMapData(mapData)
            
            // 更新缓存
            const dataset: DatasetFeatureCollection = {
                type: 'FeatureCollection',
                features: mapData.markers.map(marker => ({
                    id: marker.id,
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: [marker.coordinates.longitude, marker.coordinates.latitude]
                    },
                    properties: {
                        markdownContent: marker.content.markdownContent,
                        headerImage: marker.content.headerImage || null,
                        iconType: marker.content.iconType || 'location',
                        next: marker.content.next || [],
                        metadata: {
                            id: marker.id,
                            title: marker.content.title || '未命名标记',
                            description: '用户创建的标记',
                            createdAt: marker.content.createdAt,
                            updatedAt: marker.content.updatedAt,
                            isPublished: true,
                        }
                    }
                }))
            }
            this.mapDataCache.set(datasetId, dataset)
            
            // 与map-store集成：更新本地存储
            if (typeof window !== 'undefined') {
                const mapStore = useMapStore.getState()
                
                // 检查标记是否已存在
                const existingMarker = mapStore.markers.find(m => m.id === featureId)
                
                if (existingMarker) {
                    // 更新现有标记
                    mapStore.updateMarker(featureId, {
                        coordinates,
                        content: {
                            ...existingMarker.content,
                            title: properties.metadata?.title || properties.name || properties.title || '未命名标记',
                            markdownContent: properties.markdownContent || properties.description || properties.content || '',
                            iconType: properties.iconType || 'location',
                            updatedAt: new Date(now)
                        }
                    })
                } else {
                    // 创建新标记
                    const marker: Marker = {
                        id: featureId,
                        coordinates,
                        content: {
                            id: featureId,
                            title: properties.metadata?.title || properties.name || properties.title || '未命名标记',
                            markdownContent: properties.markdownContent || properties.description || properties.content || '',
                            iconType: properties.iconType || 'location',
                            next: properties.next || [],
                            createdAt: new Date(now),
                            updatedAt: new Date(now)
                        }
                    }
                    
                    // 直接添加到store中
                    mapStore.markers.push(marker)
                }
            }
            
            return newFeature
        } catch (error) {
            console.error('创建/更新地图特征失败:', error)
            throw error
        }
    }

    private async deleteGoogleFeature(datasetId: string, featureId: string): Promise<void> {
        try {
            // 获取地图数据
            const mapData = await mapDataService.getMapData(datasetId)
            if (!mapData) {
                return // 地图数据不存在，无需删除
            }
            
            // 从地图数据中移除标记
            mapData.markers = mapData.markers.filter(m => m.id !== featureId)
            mapData.updatedAt = new Date().toISOString()
            
            // 更新地图数据到 COS
            await mapDataService.updateMapData(mapData)
            
            // 更新缓存
            const dataset: DatasetFeatureCollection = {
                type: 'FeatureCollection',
                features: mapData.markers.map(marker => ({
                    id: marker.id,
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: [marker.coordinates.longitude, marker.coordinates.latitude]
                    },
                    properties: {
                        markdownContent: marker.content.markdownContent,
                        headerImage: marker.content.headerImage || null,
                        iconType: marker.content.iconType || 'location',
                        next: marker.content.next || [],
                        metadata: {
                            id: marker.id,
                            title: marker.content.title || '未命名标记',
                            description: '用户创建的标记',
                            createdAt: marker.content.createdAt,
                            updatedAt: marker.content.updatedAt,
                            isPublished: true,
                        }
                    }
                }))
            }
            this.mapDataCache.set(datasetId, dataset)
            
            // 与map-store集成：从地图中移除标记
            if (typeof window !== 'undefined') {
                const mapStore = useMapStore.getState()
                
                // 从store中移除标记
                mapStore.markers = mapStore.markers.filter(m => m.id !== featureId)
            }
            
            console.log(`地图数据 ${datasetId} 中的标记 ${featureId} 已删除`)
        } catch (error) {
            console.error('删除地图标记失败:', error)
            throw error
        }
    }
}

// 单例实例
export const datasetService = new MapDatasetService()
