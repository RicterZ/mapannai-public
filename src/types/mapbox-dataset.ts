import { OutputData } from '@editorjs/editorjs'

// Mapbox Dataset 配置
export interface MapboxDatasetConfig {
    username: string
    secretAccessToken: string
    datasetId?: string // 可选，如果未提供会自动创建
}

// 存储在 GeoJSON Feature properties 中的数据结构
export interface MapboxFeatureProperties {
    // Editor.js 内容
    editorData: OutputData

    // 头图信息
    headerImage?: {
        url: string
        alt?: string
        caption?: string
    }

    // 元数据
    metadata: {
        id: string
        title?: string
        description?: string
        createdAt: string
        updatedAt: string
        createdBy?: string
        updatedBy?: string
        tags?: string[]
        category?: string
        isPublished: boolean
    }

    // 其他自定义属性
    customData?: Record<string, any>
}

// Mapbox GeoJSON Feature 结构
export interface MapboxMarkerFeature {
    id: string
    type: 'Feature'
    geometry: {
        type: 'Point'
        coordinates: [number, number] // [longitude, latitude]
    }
    properties: MapboxFeatureProperties
}

// Dataset API 响应
export interface MapboxDataset {
    owner: string
    id: string
    created: string
    modified: string
    bounds: [number, number, number, number]
    features: number
    size: number
    name?: string
    description?: string
}

// Feature Collection 响应
export interface MapboxFeatureCollection {
    type: 'FeatureCollection'
    features: MapboxMarkerFeature[]
} 