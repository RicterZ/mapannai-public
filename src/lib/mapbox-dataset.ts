import {
    MapboxDatasetConfig,
    MapboxMarkerFeature,
    MapboxFeatureProperties,
    MapboxDataset,
    MapboxFeatureCollection
} from '@/types/mapbox-dataset'
import { MarkerCoordinates } from '@/types/marker'

export class MapboxDatasetService {
    private config: MapboxDatasetConfig
    private baseUrl = 'https://api.mapbox.com/datasets/v1'

    constructor(config: MapboxDatasetConfig) {
        this.config = config
    }

    /**
     * 创建新的 Dataset
     */
    async createDataset(name: string, description?: string): Promise<MapboxDataset> {
        const response = await fetch(`${this.baseUrl}/${this.config.username}?access_token=${this.config.secretAccessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                description: description || `マップ案内 标记数据集 - ${new Date().toLocaleDateString('zh-CN')}`,
            }),
        })

        if (!response.ok) {
            throw new Error(`创建 Dataset 失败: ${response.status} ${response.statusText}`)
        }

        return response.json()
    }

    /**
     * 获取 Dataset 信息
     */
    async getDataset(datasetId: string): Promise<MapboxDataset> {
        const timestamp = Date.now()
        const response = await fetch(
            `${this.baseUrl}/${this.config.username}/${datasetId}?access_token=${this.config.secretAccessToken}&_t=${timestamp}`,
            {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            }
        )

        if (!response.ok) {
            throw new Error(`获取 Dataset 失败: ${response.status} ${response.statusText}`)
        }

        return response.json()
    }

    /**
     * 获取所有 Features
     */
    async getAllFeatures(datasetId: string): Promise<MapboxFeatureCollection> {
        // 添加时间戳参数破坏 Mapbox API 缓存
        const timestamp = Date.now()
        const response = await fetch(
            `${this.baseUrl}/${this.config.username}/${datasetId}/features?access_token=${this.config.secretAccessToken}&_t=${timestamp}`,
            {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            }
        )

        if (!response.ok) {
            throw new Error(`获取 Features 失败: ${response.status} ${response.statusText}`)
        }

        return response.json()
    }

    /**
     * 创建或更新 Feature (标记点)
     */
    async upsertFeature(
        datasetId: string,
        featureId: string,
        coordinates: MarkerCoordinates,
        properties: MapboxFeatureProperties
    ): Promise<MapboxMarkerFeature> {
        const feature: MapboxMarkerFeature = {
            id: featureId,
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [coordinates.longitude, coordinates.latitude],
            },
            properties,
        }

        const response = await fetch(
            `${this.baseUrl}/${this.config.username}/${datasetId}/features/${featureId}?access_token=${this.config.secretAccessToken}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(feature),
            }
        )

        if (!response.ok) {
            throw new Error(`保存 Feature 失败: ${response.status} ${response.statusText}`)
        }

        return response.json()
    }

    /**
     * 获取单个 Feature
     */
    async getFeature(datasetId: string, featureId: string): Promise<MapboxMarkerFeature> {
        const timestamp = Date.now()
        const response = await fetch(
            `${this.baseUrl}/${this.config.username}/${datasetId}/features/${featureId}?access_token=${this.config.secretAccessToken}&_t=${timestamp}`,
            {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            }
        )

        if (!response.ok) {
            throw new Error(`获取 Feature 失败: ${response.status} ${response.statusText}`)
        }

        return response.json()
    }

    /**
     * 删除 Feature
     */
    async deleteFeature(datasetId: string, featureId: string): Promise<void> {
        const response = await fetch(
            `${this.baseUrl}/${this.config.username}/${datasetId}/features/${featureId}?access_token=${this.config.secretAccessToken}`,
            {
                method: 'DELETE',
            }
        )

        if (!response.ok) {
            throw new Error(`删除 Feature 失败: ${response.status} ${response.statusText}`)
        }
    }

    /**
     * 列出所有 Datasets
     */
    async listDatasets(): Promise<MapboxDataset[]> {
        const response = await fetch(
            `${this.baseUrl}/${this.config.username}?access_token=${this.config.secretAccessToken}`
        )

        if (!response.ok) {
            throw new Error(`获取 Datasets 列表失败: ${response.status} ${response.statusText}`)
        }

        return response.json()
    }
} 