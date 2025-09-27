import { MapProvider, MapCoordinates, MapViewState, MapMarker, MapSearchResult, MapProviderConfig } from '@/types/map-provider'

// Google Maps 相关类型定义
export interface GoogleMapInstance {
    map: any
    markers: Map<string, any>
    eventListeners: Map<string, any>
}

export class GoogleProvider implements MapProvider {
    private mapInstance: GoogleMapInstance | null = null
    private eventListeners = new Map<string, Function>()

    async createMapInstance(container: HTMLElement, config: MapProviderConfig): Promise<GoogleMapInstance> {
        // 确保 Google Maps API 已加载
        if (!window.google || !window.google.maps) {
            throw new Error('Google Maps API not loaded')
        }

        const map = new (window as any).google.maps.Map(container, {
            zoom: 11,
            center: { lat: 35.6895, lng: 139.6917 }, // 默认东京
            mapTypeId: this.getGoogleMapTypeId(config.style || 'roadmap'),
            styles: this.getMapStyles(config.style || 'roadmap'),
        })

        this.mapInstance = {
            map,
            markers: new Map(),
            eventListeners: new Map()
        }

        return this.mapInstance
    }

    destroyMapInstance(mapInstance: GoogleMapInstance): void {
        if (mapInstance) {
            // 清理所有标记
            mapInstance.markers.forEach(marker => marker.setMap(null))
            mapInstance.markers.clear()

            // 清理所有事件监听器
            mapInstance.eventListeners.forEach(listener => (window as any).google.maps.event.removeListener(listener))
            mapInstance.eventListeners.clear()

            // 清理地图实例
            if (mapInstance.map) {
                (window as any).google.maps.event.clearInstanceListeners(mapInstance.map)
            }
        }
        this.mapInstance = null
    }

    setViewState(mapInstance: GoogleMapInstance, viewState: MapViewState): void {
        if (mapInstance?.map) {
            mapInstance.map.setCenter({
                lat: viewState.latitude,
                lng: viewState.longitude
            })
            mapInstance.map.setZoom(viewState.zoom)
        }
    }

    getViewState(mapInstance: GoogleMapInstance): MapViewState {
        if (!mapInstance?.map) {
            throw new Error('Map instance not available')
        }

        const center = mapInstance.map.getCenter()
        const zoom = mapInstance.map.getZoom()

        return {
            longitude: center?.lng() || 0,
            latitude: center?.lat() || 0,
            zoom: zoom || 11
        }
    }

    flyTo(mapInstance: GoogleMapInstance, coordinates: MapCoordinates, zoom?: number): void {
        if (mapInstance?.map) {
            mapInstance.map.panTo({
                lat: coordinates.latitude,
                lng: coordinates.longitude
            })
            if (zoom) {
                mapInstance.map.setZoom(zoom)
            }
        }
    }

    addMarker(mapInstance: GoogleMapInstance, marker: MapMarker): any {
        if (!mapInstance?.map) {
            throw new Error('Map instance not available')
        }

        const googleMarker = new (window as any).google.maps.Marker({
            position: {
                lat: marker.coordinates.latitude,
                lng: marker.coordinates.longitude
            },
            map: mapInstance.map,
            title: marker.id
        })

        mapInstance.markers.set(marker.id, googleMarker)
        return googleMarker
    }

    removeMarker(mapInstance: GoogleMapInstance, markerId: string): void {
        if (mapInstance?.markers.has(markerId)) {
            const marker = mapInstance.markers.get(markerId)
            if (marker) {
                marker.setMap(null)
                mapInstance.markers.delete(markerId)
            }
        }
    }

    updateMarker(mapInstance: GoogleMapInstance, marker: MapMarker): void {
        if (mapInstance?.markers.has(marker.id)) {
            const googleMarker = mapInstance.markers.get(marker.id)
            if (googleMarker) {
                googleMarker.setPosition({
                    lat: marker.coordinates.latitude,
                    lng: marker.coordinates.longitude
                })
            }
        }
    }

    onMapClick(mapInstance: GoogleMapInstance, callback: (coordinates: MapCoordinates) => void): void {
        if (mapInstance?.map) {
            const listener = mapInstance.map.addListener('click', (event: any) => {
                if (event.latLng) {
                    callback({
                        latitude: event.latLng.lat(),
                        longitude: event.latLng.lng()
                    })
                }
            })
            mapInstance.eventListeners.set('click', listener)
        }
    }

    onMarkerClick(mapInstance: GoogleMapInstance, markerId: string, callback: () => void): void {
        if (mapInstance?.markers.has(markerId)) {
            const marker = mapInstance.markers.get(markerId)
            if (marker) {
                const listener = marker.addListener('click', callback)
                mapInstance.eventListeners.set(`marker_${markerId}`, listener)
            }
        }
    }

    onMapLoad(mapInstance: GoogleMapInstance, callback: () => void): void {
        if (mapInstance?.map) {
            const listener = mapInstance.map.addListener('idle', callback)
            mapInstance.eventListeners.set('idle', listener)
        }
    }

    onMapError(mapInstance: GoogleMapInstance, callback: (error: Error) => void): void {
        // Google Maps 的错误处理通常通过全局错误处理
        if (window.google && window.google.maps) {
            (window as any).google.maps.event.addListenerOnce(mapInstance.map, 'error', callback)
        }
    }

    async searchPlaces(query: string, config: MapProviderConfig): Promise<MapSearchResult[]> {
        if (!window.google || !window.google.maps) {
            throw new Error('Google Maps API not loaded')
        }

        return new Promise((resolve, reject) => {
            const service = new (window as any).google.maps.places.PlacesService(document.createElement('div'))
            
            const request: any = {
                query: query,
                fields: ['name', 'geometry']
            }

            service.textSearch(request, (results: any, status: any) => {
                if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && results) {
                    const searchResults: MapSearchResult[] = results.map((place: any) => ({
                        name: place.name || '',
                        coordinates: {
                            latitude: place.geometry?.location?.lat() || 0,
                            longitude: place.geometry?.location?.lng() || 0
                        }
                    }))
                    resolve(searchResults)
                } else {
                    reject(new Error(`Places search failed: ${status}`))
                }
            })
        })
    }

    getMapStyle(config: MapProviderConfig): string {
        return config.style || 'roadmap'
    }

    getAttribution(): string {
        return '© Google Maps'
    }

    private getGoogleMapTypeId(style: string): string {
        switch (style) {
            case 'satellite':
                return (window as any).google.maps.MapTypeId.SATELLITE
            case 'hybrid':
                return (window as any).google.maps.MapTypeId.HYBRID
            case 'terrain':
                return (window as any).google.maps.MapTypeId.TERRAIN
            default:
                return (window as any).google.maps.MapTypeId.ROADMAP
        }
    }

    private getMapStyles(style: string): any[] | undefined {
        // 可以根据需要返回自定义样式
        if (style === 'dark') {
            return [
                {
                    featureType: 'all',
                    elementType: 'geometry',
                    stylers: [{ color: '#242f3e' }]
                },
                {
                    featureType: 'all',
                    elementType: 'labels.text.stroke',
                    stylers: [{ light: -80 }]
                },
                {
                    featureType: 'all',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#746855' }]
                }
            ]
        }
        return undefined
    }
}
