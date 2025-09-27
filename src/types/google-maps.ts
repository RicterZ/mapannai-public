// Google Maps 相关类型定义

// Google Maps API 类型声明
declare global {
    interface Window {
        google: any
    }
}

// Google Maps 地图实例类型
export interface GoogleMapInstance {
    map: any
    markers: Map<string, any>
    eventListeners: Map<string, any>
}

// Google Maps 配置选项
export interface GoogleMapConfig {
    apiKey: string
    style: GoogleMapStyle
    center?: {
        lat: number
        lng: number
    }
    zoom?: number
    mapTypeId?: string
    styles?: any[]
    disableDefaultUI?: boolean
    zoomControl?: boolean
    mapTypeControl?: boolean
    scaleControl?: boolean
    streetViewControl?: boolean
    rotateControl?: boolean
    fullscreenControl?: boolean
}

// Google Maps 样式类型
export type GoogleMapStyle = 
    | 'roadmap' 
    | 'satellite' 
    | 'hybrid' 
    | 'terrain' 
    | 'dark' 
    | 'light'

// Google Maps 标记配置
export interface GoogleMarkerConfig {
    position: {
        lat: number
        lng: number
    }
    title?: string
    icon?: string | any
    animation?: string
    draggable?: boolean
    clickable?: boolean
    zIndex?: number
}

// Google Maps 搜索结果
export interface GoogleSearchResult {
    place_id: string
    name: string
    formatted_address: string
    geometry: {
        location: {
            lat: number
            lng: number
        }
    }
    types: string[]
    rating?: number
    user_ratings_total?: number
    price_level?: number
    photos?: Array<{
        photo_reference: string
        height: number
        width: number
    }>
}

// Google Maps 地点详情
export interface GooglePlaceDetails {
    place_id: string
    name: string
    formatted_address: string
    geometry: {
        location: {
            lat: number
            lng: number
        }
        viewport: {
            northeast: { lat: number; lng: number }
            southwest: { lat: number; lng: number }
        }
    }
    types: string[]
    rating?: number
    user_ratings_total?: number
    price_level?: number
    opening_hours?: {
        open_now: boolean
        weekday_text: string[]
    }
    photos?: Array<{
        photo_reference: string
        height: number
        width: number
    }>
    reviews?: Array<{
        author_name: string
        rating: number
        text: string
        time: number
    }>
}

// Google Maps 方向服务配置
export interface GoogleDirectionsConfig {
    origin: string | { lat: number; lng: number }
    destination: string | { lat: number; lng: number }
    travelMode: string
    waypoints?: Array<{
        location: string | { lat: number; lng: number }
        stopover: boolean
    }>
    avoidHighways?: boolean
    avoidTolls?: boolean
    optimizeWaypoints?: boolean
}

// Google Maps 地理编码结果
export interface GoogleGeocodeResult {
    address_components: Array<{
        long_name: string
        short_name: string
        types: string[]
    }>
    formatted_address: string
    geometry: {
        location: {
            lat: number
            lng: number
        }
        location_type: string
        viewport: {
            northeast: { lat: number; lng: number }
            southwest: { lat: number; lng: number }
        }
    }
    place_id: string
    types: string[]
}

// Google Maps 事件类型
export type GoogleMapEventType = 
    | 'click'
    | 'dblclick'
    | 'rightclick'
    | 'mousedown'
    | 'mouseup'
    | 'mouseover'
    | 'mouseout'
    | 'dragstart'
    | 'drag'
    | 'dragend'
    | 'idle'
    | 'bounds_changed'
    | 'center_changed'
    | 'zoom_changed'
    | 'tilt_changed'
    | 'heading_changed'

// Google Maps 错误类型
export interface GoogleMapsError {
    code: number
    message: string
    status: string
}

// Google Maps 服务状态
export type GoogleServiceStatus = string