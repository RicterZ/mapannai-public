import { MapProvider, MapCoordinates, MapViewState, MapMarker, MapSearchResult, MapProviderConfig } from '@/types/map-provider'
import Map, { MapRef, ViewState } from 'react-map-gl'
import { Marker as MapboxMarker } from 'react-map-gl'

export class MapboxProvider implements MapProvider {
    private mapInstance: MapRef | null = null
    private eventListeners = new globalThis.Map<string, Function>()

    async createMapInstance(container: HTMLElement, config: MapProviderConfig): Promise<MapRef> {
        // 这里返回MapRef，实际的地图创建由React组件处理
        return null as any // 实际实现中需要处理
    }

    destroyMapInstance(mapInstance: any): void {
        if (mapInstance) {
            // 清理事件监听器
            this.eventListeners.forEach((callback: Function, event: string) => {
                mapInstance.off(event, callback)
            })
            this.eventListeners.clear()
        }
    }

    setViewState(mapInstance: MapRef, viewState: MapViewState): void {
        if (mapInstance) {
            mapInstance.flyTo({
                center: [viewState.longitude, viewState.latitude],
                zoom: viewState.zoom,
                bearing: viewState.bearing || 0,
                pitch: viewState.pitch || 0,
            })
        }
    }

    getViewState(mapInstance: MapRef): MapViewState {
        if (!mapInstance) {
            throw new Error('Map instance not available')
        }
        
        const center = mapInstance.getCenter()
        return {
            longitude: center.lng,
            latitude: center.lat,
            zoom: mapInstance.getZoom(),
            bearing: mapInstance.getBearing(),
            pitch: mapInstance.getPitch(),
        }
    }

    flyTo(mapInstance: MapRef, coordinates: MapCoordinates, zoom?: number): void {
        if (mapInstance) {
            const currentZoom = zoom ?? mapInstance.getZoom()
            mapInstance.flyTo({
                center: [coordinates.longitude, coordinates.latitude],
                zoom: currentZoom,
                duration: 1000,
            })
        }
    }

    addMarker(mapInstance: MapRef, marker: MapMarker): any {
        // 返回MapboxMarker组件，由React组件渲染
        return {
            type: 'mapbox-marker',
            id: marker.id,
            longitude: marker.coordinates.longitude,
            latitude: marker.coordinates.latitude,
        }
    }

    removeMarker(mapInstance: MapRef, markerId: string): void {
        // Mapbox的标记移除由React组件处理
    }

    updateMarker(mapInstance: MapRef, marker: MapMarker): void {
        // Mapbox的标记更新由React组件处理
    }

    onMapClick(mapInstance: MapRef, callback: (coordinates: MapCoordinates, placeInfo?: { name: string; address: string; placeId: string }) => void): void {
        if (mapInstance) {
            const handler = (event: any) => {
                callback({
                    latitude: event.lngLat.lat,
                    longitude: event.lngLat.lng,
                })
            }
            mapInstance.on('click', handler)
            this.eventListeners.set('click', handler)
        }
    }

    onMarkerClick(mapInstance: MapRef, markerId: string, callback: () => void): void {
        // Mapbox的标记点击由React组件处理
    }

    onMapLoad(mapInstance: MapRef, callback: () => void): void {
        if (mapInstance) {
            const handler = () => callback()
            mapInstance.on('load', handler)
            this.eventListeners.set('load', handler)
        }
    }

    onMapError(mapInstance: MapRef, callback: (error: Error) => void): void {
        if (mapInstance) {
            const handler = (event: any) => callback(event.error)
            mapInstance.on('error', handler)
            this.eventListeners.set('error', handler)
        }
    }

    async searchPlaces(query: string, config: MapProviderConfig): Promise<MapSearchResult[]> {
        try {
            // 直接调用Mapbox搜索API
            const mapboxSearchUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
            const searchResponse = await fetch(`${mapboxSearchUrl}?access_token=${config.accessToken}&limit=10&language=zh-CN&country=JP`)

            if (!searchResponse.ok) {
                throw new Error(`Mapbox API 错误: ${searchResponse.status}`)
            }

            const searchData = await searchResponse.json()
            
            if (Array.isArray(searchData.features)) {
                return searchData.features.map((feature: any) => ({
                    name: feature.place_name,
                    coordinates: {
                        latitude: feature.center[1],
                        longitude: feature.center[0],
                    }
                }))
            }
            return []
        } catch (error) {
            console.error('Mapbox search error:', error)
            return []
        }
    }

    getMapStyle(config: MapProviderConfig): string {
        // 如果样式是 Google Maps 的样式名称，转换为 Mapbox 样式
        if (config.style === 'roadmap' || config.style === 'satellite' || config.style === 'hybrid' || config.style === 'terrain') {
            return 'mapbox://styles/mapbox/streets-zh-v1'
        }
        return config.style || 'mapbox://styles/mapbox/streets-zh-v1'
    }

    // 应用POI过滤的CSS样式
    applyPOIFilter(): void {
        // 创建CSS样式来隐藏特定的POI元素
        const style = document.createElement('style')
        style.id = 'mapbox-poi-filter'
        style.textContent = `
            /* 隐藏停车场相关POI */
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="parking"],
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="car_parking"],
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="parking_lot"] {
                display: none !important;
            }
            
            /* 隐藏医院相关POI */
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="hospital"],
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="medical"],
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="clinic"] {
                display: none !important;
            }
            
            /* 隐藏厕所相关POI */
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="toilet"],
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="restroom"],
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="bathroom"] {
                display: none !important;
            }
            
            /* 隐藏其他不需要的POI标签 */
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="atm"],
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="bank"],
            .mapboxgl-canvas-container .mapboxgl-marker[data-poi-type="gas_station"] {
                display: none !important;
            }
        `
        
        // 移除已存在的样式
        const existingStyle = document.getElementById('mapbox-poi-filter')
        if (existingStyle) {
            existingStyle.remove()
        }
        
        // 添加新样式
        document.head.appendChild(style)
    }

    getAttribution(): string {
        return '© Mapbox'
    }
}
