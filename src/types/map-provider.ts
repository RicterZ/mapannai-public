// 通用地图接口定义
export interface MapCoordinates {
    latitude: number
    longitude: number
}

export interface MapViewState {
    longitude: number
    latitude: number
    zoom: number
    bearing?: number
    pitch?: number
    padding?: {
        top: number
        bottom: number
        left: number
        right: number
    }
}

export interface MapMarker {
    id: string
    coordinates: MapCoordinates
    // 其他标记属性可以根据需要扩展
}

export interface MapSearchResult {
    name: string
    coordinates: MapCoordinates
    // 其他搜索结果属性
}

// 详细的地点信息接口
export interface DetailedPlaceInfo {
    name: string
    address: string
    placeId: string
    phone?: string
    website?: string
    rating?: number
    user_ratings_total?: number
    price_level?: number
    opening_hours?: any
}

export interface MapProviderConfig {
    accessToken: string
    style?: string
    // 其他配置项
}

// 地图提供者接口
export interface MapProvider {
    // 地图实例相关
    createMapInstance(container: HTMLElement, config: MapProviderConfig): Promise<any>
    destroyMapInstance(mapInstance: any): void
    
    // 视图控制
    setViewState(mapInstance: any, viewState: MapViewState): void
    getViewState(mapInstance: any): MapViewState
    flyTo(mapInstance: any, coordinates: MapCoordinates, zoom?: number): void
    
    // 标记管理
    addMarker(mapInstance: any, marker: MapMarker): any
    removeMarker(mapInstance: any, markerId: string): void
    updateMarker(mapInstance: any, marker: MapMarker): void
    
    // 事件处理
    onMapClick(mapInstance: any, callback: (coordinates: MapCoordinates, placeInfo?: DetailedPlaceInfo, clickPosition?: { x: number; y: number }, isMarkerClick?: boolean) => void): void
    onMarkerClick(mapInstance: any, markerId: string, callback: () => void): void
    onMapLoad(mapInstance: any, callback: () => void): void
    onMapError(mapInstance: any, callback: (error: Error) => void): void
    
    // 搜索功能
    searchPlaces(query: string, config: MapProviderConfig): Promise<MapSearchResult[]>
    
    // 样式和配置
    getMapStyle(config: MapProviderConfig): string
    getAttribution(): string
}

// 地图提供者类型
export type MapProviderType = 'mapbox' | 'google'

// 地图提供者工厂接口
export interface MapProviderFactory {
    createProvider(type: MapProviderType): MapProvider
    getSupportedProviders(): MapProviderType[]
}
