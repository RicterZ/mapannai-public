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

    onMapClick(mapInstance: MapRef, callback: (coordinates: MapCoordinates) => void): void {
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

    getAttribution(): string {
        return '© Mapbox'
    }
}
