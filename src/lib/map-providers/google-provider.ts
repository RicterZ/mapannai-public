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
        
        const mapOptions = {
            zoom: 11,
            center: { lat: 35.6895, lng: 139.6917 }, // 默认东京
            mapTypeId: this.getGoogleMapTypeId(config.style || 'roadmap'),
            styles: this.getMapStyles(config.style || 'roadmap'),
            // 禁用地图控件
            mapTypeControl: false,        // 禁用地图类型控件（地形、卫星等）
            streetViewControl: false,     // 禁用街景控件
            fullscreenControl: false,    // 禁用全屏控件
            zoomControl: true,           // 保留缩放控件
            scaleControl: false,          // 禁用比例尺控件
            rotateControl: false,         // 禁用旋转控件
            panControl: false,           // 禁用平移控件
        }
        
        const map = new (window as any).google.maps.Map(container, mapOptions)

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

    flyTo(mapInstance: GoogleMapInstance, coordinates: MapCoordinates, zoom?: number, options?: { 
        duration?: number, 
        easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' 
    }): void {
        if (mapInstance?.map) {
            const map = mapInstance.map
            
            // 获取当前位置和缩放级别
            const currentCenter = map.getCenter()
            const currentZoom = map.getZoom()
            
            // 计算目标位置
            const targetPosition = {
                lat: coordinates.latitude,
                lng: coordinates.longitude
            }
            const targetZoom = zoom || currentZoom
            
            // 如果位置和缩放级别都没有变化，直接返回
            if (currentCenter && 
                Math.abs(currentCenter.lat() - targetPosition.lat) < 0.0001 &&
                Math.abs(currentCenter.lng() - targetPosition.lng) < 0.0001 &&
                Math.abs(currentZoom - targetZoom) < 0.1) {
                return
            }
            
            // 计算距离，决定动画类型
            const latDiff = Math.abs(currentCenter.lat() - targetPosition.lat)
            const lngDiff = Math.abs(currentCenter.lng() - targetPosition.lng)
            const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)
            
            // 如果距离很大，使用更平滑的动画
            if (distance > 0.1) {
                // 使用 fitBounds 创建更平滑的大距离跳转
                const bounds = new (window as any).google.maps.LatLngBounds()
                bounds.extend(targetPosition)
                
                // 设置合适的缩放级别
                if (zoom) {
                    map.fitBounds(bounds, {
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0
                    })
                    
                    // 延迟设置精确的缩放级别
                    setTimeout(() => {
                        map.setZoom(targetZoom)
                    }, 300)
                } else {
                    map.fitBounds(bounds)
                }
            } else {
                // 小距离移动，使用平滑的 panTo
                map.panTo(targetPosition)
            }
            
            // 如果缩放级别有变化，平滑调整缩放
            if (Math.abs(currentZoom - targetZoom) > 0.1) {
                // 延迟执行缩放动画，让位置移动先完成
                setTimeout(() => {
                    const zoomDifference = targetZoom - currentZoom
                    const animationSteps = Math.min(Math.abs(zoomDifference) * 2, 20)
                    const stepDuration = options?.duration ? options.duration / animationSteps : 30
                    
                    let currentStep = 0
                    
                    // 根据选项选择缓动函数
                    const getEasingFunction = (easing: string = 'easeOut') => {
                        switch (easing) {
                            case 'linear':
                                return (t: number) => t
                            case 'easeIn':
                                return (t: number) => t * t
                            case 'easeOut':
                                return (t: number) => 1 - Math.pow(1 - t, 3)
                            case 'easeInOut':
                                return (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
                            default:
                                return (t: number) => 1 - Math.pow(1 - t, 3)
                        }
                    }
                    
                    const easingFunction = getEasingFunction(options?.easing)
                    
                    const animateZoom = () => {
                        if (currentStep < animationSteps) {
                            const progress = currentStep / animationSteps
                            const easedProgress = easingFunction(progress)
                            const newZoom = currentZoom + (zoomDifference * easedProgress)
                            
                            map.setZoom(newZoom)
                            currentStep++
                            setTimeout(animateZoom, stepDuration)
                        } else {
                            map.setZoom(targetZoom)
                        }
                    }
                    
                    animateZoom()
                }, distance > 0.1 ? 200 : 0) // 大距离移动时延迟更久
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

    onMapClick(mapInstance: GoogleMapInstance, callback: (coordinates: MapCoordinates, placeName?: string) => void): void {
        if (mapInstance?.map) {
            const listener = mapInstance.map.addListener('click', async (event: any) => {
                // Google Maps 事件对象结构
                if (event && event.latLng) {
                    try {
                        const coordinates = {
                            latitude: event.latLng.lat(),
                            longitude: event.latLng.lng()
                        }
                        
                        // 尝试获取地点名称
                        let placeName: string | undefined
                        try {
                            if (window.google && window.google.maps && window.google.maps.places) {
                                const service = new window.google.maps.places.PlacesService(document.createElement('div'))
                                const request = {
                                    location: event.latLng,
                                    radius: 50, // 50米范围内搜索
                                    fields: ['name']
                                }
                                
                                const results = await new Promise<any[]>((resolve, reject) => {
                                    service.nearbySearch(request, (results: any, status: any) => {
                                        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                                            resolve(results)
                                        } else {
                                            resolve([])
                                        }
                                    })
                                })
                                
                                if (results.length > 0) {
                                    placeName = results[0].name
                                }
                            }
                        } catch (error) {
                            console.warn('Failed to get place name:', error)
                        }
                        
                        callback(coordinates, placeName)
                    } catch (error) {
                        console.error('Error processing map click:', error)
                    }
                }
            })
            mapInstance.eventListeners.set('click', listener)
        }
    }

    onMapMove(mapInstance: GoogleMapInstance, callback: (viewState: MapViewState) => void): void {
        if (mapInstance?.map) {
            const listener = mapInstance.map.addListener('center_changed', () => {
                try {
                    const center = mapInstance.map.getCenter()
                    const zoom = mapInstance.map.getZoom()
                    if (center) {
                        callback({
                            longitude: center.lng(),
                            latitude: center.lat(),
                            zoom: zoom || 11
                        })
                    }
                } catch (error) {
                    console.error('Error processing map move:', error)
                }
            })
            mapInstance.eventListeners.set('center_changed', listener)
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
