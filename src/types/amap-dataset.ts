// 高德地图数据集相关类型定义

// 高德地图数据集配置
export interface AmapDatasetConfig {
    accessToken: string
    style: string
    datasetId?: string
}

// 高德地图特征属性
export interface AmapFeatureProperties {
    // Markdown 内容
    markdownContent: string
    headerImage?: string
    iconType: string
    next: string[]
    metadata: {
        id: string
        title: string
        description: string
        createdAt: string
        updatedAt: string
        isPublished: boolean
    }
}

// 高德地图标记特征
export interface AmapMarkerFeature {
    id: string
    type: 'Feature'
    geometry: {
        type: 'Point'
        coordinates: [number, number]
    }
    properties: AmapFeatureProperties
}

// 高德地图数据集
export interface AmapDataset {
    id: string
    name: string
    description?: string
    created: string
    modified: string
    features: number
    size: number
}

// 高德地图特征集合
export interface AmapFeatureCollection {
    type: 'FeatureCollection'
    features: AmapMarkerFeature[]
}

// 高德地图搜索API响应
export interface AmapSearchResponse {
    status: string
    count: string
    infocode: string
    pois: AmapPOI[]
}

// 高德地图POI
export interface AmapPOI {
    id: string
    name: string
    type: string
    typecode: string
    address: string
    location: string // "经度,纬度"
    tel: string
    distance: string
    business_area: string
    cityname: string
    adname: string
    importance: string
    shopinfo: string
    photos: AmapPhoto[]
}

// 高德地图照片
export interface AmapPhoto {
    title: string
    url: string
}
