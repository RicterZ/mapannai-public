import { cosService } from '../cos-client'
import { Marker, MarkerCoordinates, MarkerIconType } from '@/types/marker'

// JSON 存储中的标记接口（日期为字符串）
export interface StoredMarker {
    id: string
    coordinates: MarkerCoordinates
    content: {
        id: string
        title?: string
        headerImage?: string
        iconType?: MarkerIconType
        markdownContent: string
        next: string[]
        createdAt: string
        updatedAt: string
    }
    createdAt: string
    updatedAt: string
}

export interface MapData {
    id: string
    name: string
    description?: string
    markers: StoredMarker[]
    createdAt: string
    updatedAt: string
    version: string
}

export interface MapDataMetadata {
    id: string
    name: string
    description?: string
    markerCount: number
    createdAt: string
    updatedAt: string
    version: string
    dataUrl: string
}

export class MapDataService {
    private readonly dataFolder = 'map-data'
    private readonly metadataFolder = 'map-metadata'

    // 转换 Marker 到 StoredMarker
    private markerToStored(marker: Marker): StoredMarker {
        return {
            id: marker.id,
            coordinates: marker.coordinates,
            content: {
                id: marker.content.id,
                title: marker.content.title,
                headerImage: marker.content.headerImage,
                iconType: marker.content.iconType,
                markdownContent: marker.content.markdownContent,
                next: marker.content.next,
                createdAt: marker.content.createdAt.toISOString(),
                updatedAt: marker.content.updatedAt.toISOString()
            },
            createdAt: marker.content.createdAt.toISOString(),
            updatedAt: marker.content.updatedAt.toISOString()
        }
    }

    // 转换 StoredMarker 到 Marker
    private storedToMarker(stored: StoredMarker): Marker {
        return {
            id: stored.id,
            coordinates: stored.coordinates,
            content: {
                id: stored.content.id,
                title: stored.content.title,
                headerImage: stored.content.headerImage,
                iconType: stored.content.iconType,
                markdownContent: stored.content.markdownContent,
                next: stored.content.next,
                createdAt: new Date(stored.content.createdAt),
                updatedAt: new Date(stored.content.updatedAt)
            }
        }
    }

    // 保存地图数据到 COS
    async saveMapData(mapData: Omit<MapData, 'createdAt' | 'updatedAt' | 'version'>): Promise<MapDataMetadata> {
        const now = new Date().toISOString()
        const version = '1.0.0'
        
        const fullMapData: MapData = {
            ...mapData,
            createdAt: now,
            updatedAt: now,
            version
        }

        // 生成文件名
        const dataFilename = `${mapData.id}.json`
        const metadataFilename = `${mapData.id}-metadata.json`

        try {
            // 上传完整数据
            const dataResult = await cosService.uploadJson({
                data: fullMapData,
                filename: dataFilename,
                folder: this.dataFolder
            })

            // 创建元数据
            const metadata: MapDataMetadata = {
                id: mapData.id,
                name: mapData.name,
                description: mapData.description,
                markerCount: mapData.markers.length,
                createdAt: now,
                updatedAt: now,
                version,
                dataUrl: dataResult.url
            }

            // 上传元数据
            await cosService.uploadJson({
                data: metadata,
                filename: metadataFilename,
                folder: this.metadataFolder
            })

            return metadata
        } catch (error) {
            console.error('保存地图数据失败:', error)
            throw new Error('Failed to save map data to COS')
        }
    }

    // 更新地图数据
    async updateMapData(mapData: Omit<MapData, 'createdAt' | 'version'>): Promise<MapDataMetadata> {
        const now = new Date().toISOString()
        const version = '1.0.0'
        
        const fullMapData: MapData = {
            ...mapData,
            createdAt: now,
            updatedAt: now,
            version
        }

        const dataFilename = `${mapData.id}.json`
        const metadataFilename = `${mapData.id}-metadata.json`

        try {
            // 上传更新后的数据
            const dataResult = await cosService.uploadJson({
                data: fullMapData,
                filename: dataFilename,
                folder: this.dataFolder
            })

            // 更新元数据
            const metadata: MapDataMetadata = {
                id: mapData.id,
                name: mapData.name,
                description: mapData.description,
                markerCount: mapData.markers.length,
                createdAt: now,
                updatedAt: now,
                version,
                dataUrl: dataResult.url
            }

            await cosService.uploadJson({
                data: metadata,
                filename: metadataFilename,
                folder: this.metadataFolder
            })

            return metadata
        } catch (error) {
            console.error('更新地图数据失败:', error)
            throw new Error('Failed to update map data in COS')
        }
    }

    // 获取地图数据
    async getMapData(mapId: string): Promise<MapData | null> {
        try {
            const dataKey = `${this.dataFolder}/${mapId}.json`
            return await cosService.downloadJson(dataKey)
        } catch (error) {
            console.error('获取地图数据失败:', error)
            return null
        }
    }

    // 获取地图元数据
    async getMapMetadata(mapId: string): Promise<MapDataMetadata | null> {
        try {
            const metadataKey = `${this.metadataFolder}/${mapId}-metadata.json`
            return await cosService.downloadJson(metadataKey)
        } catch (error) {
            console.error('获取地图元数据失败:', error)
            return null
        }
    }

    // 列出所有地图数据
    async listMapData(): Promise<MapDataMetadata[]> {
        // 注意：这里需要实现列出 COS 中所有元数据文件的功能
        // 由于 COS SDK 的限制，我们可能需要维护一个索引文件
        try {
            // 获取索引文件
            const indexKey = `${this.metadataFolder}/index.json`
            const indexData = await cosService.downloadJson(indexKey)
            return indexData.maps || []
        } catch (error) {
            console.error('列出地图数据失败:', error)
            return []
        }
    }

    // 删除地图数据
    async deleteMapData(mapId: string): Promise<void> {
        try {
            const dataKey = `${this.dataFolder}/${mapId}.json`
            const metadataKey = `${this.metadataFolder}/${mapId}-metadata.json`
            
            await Promise.all([
                cosService.deleteJson(dataKey),
                cosService.deleteJson(metadataKey)
            ])

            // 更新索引文件
            await this.updateIndex(mapId, 'delete')
        } catch (error) {
            console.error('删除地图数据失败:', error)
            throw new Error('Failed to delete map data from COS')
        }
    }

    // 更新索引文件
    private async updateIndex(mapId: string, action: 'add' | 'delete' | 'update', metadata?: MapDataMetadata): Promise<void> {
        try {
            const indexKey = `${this.metadataFolder}/index.json`
            
            // 获取当前索引
            let indexData: { maps: MapDataMetadata[] } = { maps: [] }
            try {
                indexData = await cosService.downloadJson(indexKey)
            } catch (error) {
                // 索引文件不存在，创建新的
            }

            if (action === 'add' && metadata) {
                // 添加新的地图元数据
                const existingIndex = indexData.maps.findIndex(map => map.id === mapId)
                if (existingIndex >= 0) {
                    indexData.maps[existingIndex] = metadata
                } else {
                    indexData.maps.push(metadata)
                }
            } else if (action === 'delete') {
                // 删除地图元数据
                indexData.maps = indexData.maps.filter(map => map.id !== mapId)
            } else if (action === 'update' && metadata) {
                // 更新地图元数据
                const existingIndex = indexData.maps.findIndex(map => map.id === mapId)
                if (existingIndex >= 0) {
                    indexData.maps[existingIndex] = metadata
                }
            }

            // 上传更新后的索引
            await cosService.uploadJson({
                data: indexData,
                filename: 'index.json',
                folder: this.metadataFolder
            })
        } catch (error) {
            console.error('更新索引失败:', error)
            // 索引更新失败不应该阻止主要操作
        }
    }

    // 导出地图数据为 GeoJSON 格式
    async exportAsGeoJSON(mapId: string): Promise<any> {
        const mapData = await this.getMapData(mapId)
        if (!mapData) {
            throw new Error('Map data not found')
        }

        const features = mapData.markers.map(marker => ({
            type: 'Feature',
            id: marker.id,
            geometry: {
                type: 'Point',
                coordinates: [marker.coordinates.longitude, marker.coordinates.latitude]
            },
            properties: {
                id: marker.id,
                title: marker.content.title,
                iconType: marker.content.iconType,
                createdAt: marker.content.createdAt,
                updatedAt: marker.content.updatedAt
            }
        }))

        return {
            type: 'FeatureCollection',
            name: mapData.name,
            description: mapData.description,
            features
        }
    }

    // 从 GeoJSON 导入地图数据
    async importFromGeoJSON(geoJsonData: any, mapName: string, mapDescription?: string): Promise<MapDataMetadata> {
        if (geoJsonData.type !== 'FeatureCollection') {
            throw new Error('Invalid GeoJSON format')
        }

        const markers: Marker[] = geoJsonData.features.map((feature: any, index: number) => ({
            id: feature.id || `marker-${index}`,
            coordinates: {
                latitude: feature.geometry.coordinates[1],
                longitude: feature.geometry.coordinates[0]
            },
            content: {
                id: feature.id || `marker-${index}`,
                title: feature.properties.title || `Marker ${index + 1}`,
                headerImage: feature.properties.headerImage,
                iconType: feature.properties.iconType || 'location',
                markdownContent: feature.properties.markdownContent || '',
                next: feature.properties.next || [],
                createdAt: new Date(),
                updatedAt: new Date()
            }
        }))

        // 转换为StoredMarker
        const storedMarkers = markers.map(marker => this.markerToStored(marker))

        const mapId = `map-${Date.now()}`
        return await this.saveMapData({
            id: mapId,
            name: mapName,
            description: mapDescription,
            markers: storedMarkers
        })
    }
}

export const mapDataService = new MapDataService()
