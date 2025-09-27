import { MapProvider, MapCoordinates, MapViewState, MapMarker, MapSearchResult, MapProviderConfig, DetailedPlaceInfo } from '@/types/map-provider'

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

        // 通过 CSS 隐藏 info window
        const style = document.createElement('style')
        style.textContent = `
            .gm-style-iw {
                display: none !important;
            }
            .gm-style-iw-c {
                display: none !important;
            }
            .gm-style-iw-d {
                display: none !important;
            }
            .gm-style-iw-t {
                display: none !important;
            }
            .gm-style-iw-tc {
                display: none !important;
            }
        `
        document.head.appendChild(style)

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
            
            // 使用 Google Maps 的内置动画功能
            const duration = options?.duration || 1000 // 默认1秒动画
            
            // 启用地图动画
            map.setOptions({
                gestureHandling: 'cooperative', // 保持手势控制
                animation: (window as any).google.maps.Animation.DROP // 添加动画效果
            })
            
            // 计算距离，决定动画类型
            const latDiff = Math.abs(currentCenter.lat() - targetPosition.lat)
            const lngDiff = Math.abs(currentCenter.lng() - targetPosition.lng)
            const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)
            
            // 如果距离很大，使用 fitBounds 创建更平滑的大距离跳转
            if (distance > 0.1) {
                const bounds = new (window as any).google.maps.LatLngBounds()
                bounds.extend(targetPosition)
                
                // 使用 fitBounds 进行平滑过渡
                map.fitBounds(bounds, {
                    top: 50,
                    right: 50,
                    bottom: 50,
                    left: 50
                })
                
                // 如果指定了缩放级别，延迟设置
                if (zoom && Math.abs(currentZoom - targetZoom) > 0.1) {
                    setTimeout(() => {
                        map.setZoom(targetZoom)
                    }, duration * 0.7) // 在动画70%时设置缩放
                }
            } else {
                // 小距离移动，使用平滑的 panTo
                map.panTo(targetPosition)
                
                // 如果缩放级别有变化，延迟调整缩放
                if (Math.abs(currentZoom - targetZoom) > 0.1) {
                    setTimeout(() => {
                        map.setZoom(targetZoom)
                    }, duration * 0.5) // 在动画50%时设置缩放
                }
            }
            
            // 动画完成后恢复默认设置
            setTimeout(() => {
                map.setOptions({
                    animation: null,
                    gestureHandling: 'auto'
                })
            }, duration)
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
            title: marker.id,
            clickable: true
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

    onMapClick(mapInstance: GoogleMapInstance, callback: (coordinates: MapCoordinates, placeInfo?: DetailedPlaceInfo, clickPosition?: { x: number; y: number }, isMarkerClick?: boolean) => void): void {
        if (mapInstance?.map) {
            const listener = mapInstance.map.addListener('click', (event: any) => {
                if (event && event.latLng) {
                    try {
                        
                        const coordinates = {
                            latitude: event.latLng.lat(),
                            longitude: event.latLng.lng()
                        }
                        
                        // 获取鼠标点击的视口坐标 - 区分marker点击和地图点击
                        let clickPosition: { x: number; y: number } | undefined = undefined
                        
                        // 简单判断：如果存在placeId，说明点击的是Google Places的marker
                        const isMarkerClick = !!event.placeId
                        
                        // 优先使用 domEvent（这是实际的事件对象）
                        if (event.domEvent) {
                            clickPosition = {
                                x: event.domEvent.clientX,
                                y: event.domEvent.clientY
                            }
                        } else if (event.originalEvent) {
                            // 使用原始事件的clientX和clientY
                            clickPosition = {
                                x: event.originalEvent.clientX,
                                y: event.originalEvent.clientY
                            }
                        } else if (event.pixel) {
                            // 如果没有originalEvent，尝试使用pixel坐标
                            const mapDiv = mapInstance.map.getDiv()
                            const mapRect = mapDiv.getBoundingClientRect()
                            clickPosition = {
                                x: mapRect.left + event.pixel.x,
                                y: mapRect.top + event.pixel.y
                            }
                        }
                        
                        
                        // 构造placeInfo - 检查是否有更多可用的地点信息
                        const placeInfo = event.placeId ? {
                            name: event.place?.name || event.name || 'Google Place',
                            address: event.place?.formatted_address || event.address || 'Google Place',
                            placeId: event.placeId
                        } : undefined
                        
                        // 如果有 placeId，异步获取详细信息并更新回调
                        if (event.placeId && mapInstance?.map) {
                            try {
                                const placesService = new (window as any).google.maps.places.PlacesService(mapInstance.map)
                                placesService.getDetails({
                                    placeId: event.placeId,
                                    fields: ['name', 'formatted_address', 'formatted_phone_number', 'website', 'rating', 'user_ratings_total', 'price_level', 'opening_hours']
                                }, (place: any, status: any) => {
                                    if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && place) {
                                        // 构造包含真实信息的 placeInfo
                                        const detailedPlaceInfo = {
                                            name: place.name || 'Google Place',
                                            address: place.formatted_address || 'Google Place',
                                            placeId: event.placeId,
                                            // 添加更多详细信息
                                            phone: place.formatted_phone_number,
                                            website: place.website,
                                            rating: place.rating,
                                            user_ratings_total: place.user_ratings_total,
                                            price_level: place.price_level,
                                            opening_hours: place.opening_hours
                                        }
                                        
                                        // 重新调用回调，传递详细信息
                                        callback(coordinates, detailedPlaceInfo, clickPosition, isMarkerClick)
                                    } else {
                                        // 使用基本信息调用回调
                                        callback(coordinates, placeInfo, clickPosition, isMarkerClick)
                                    }
                                })
                            } catch (error) {
                                // 使用基本信息调用回调
                                callback(coordinates, placeInfo, clickPosition, isMarkerClick)
                            }
                        } else {
                            // 没有 placeId，直接调用回调
                            callback(coordinates, placeInfo, clickPosition, isMarkerClick)
                        }
                        
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
                const listener = marker.addListener('click', (event: any) => {
                    // 立即阻止所有默认行为
                    if (event.stop) {
                        event.stop()
                    }
                    
                    // 阻止事件冒泡和默认行为
                    if (event.originalEvent) {
                        event.originalEvent.stopPropagation()
                        event.originalEvent.preventDefault()
                        event.originalEvent.stopImmediatePropagation()
                    }
                    
                    // 阻止事件传播到地图
                    if (event.domEvent) {
                        event.domEvent.stopPropagation()
                        event.domEvent.preventDefault()
                        event.domEvent.stopImmediatePropagation()
                    }
                    
                    // 调用自定义回调
                    callback()
                    
                    // 返回 false 进一步阻止默认行为
                    return false
                })
                mapInstance.eventListeners.set(`marker_${markerId}`, listener)
            }
        }
    }

    // 添加标记鼠标悬停效果
    onMarkerHover(mapInstance: GoogleMapInstance, markerId: string, onMouseEnter: () => void, onMouseLeave: () => void): void {
        if (mapInstance?.markers.has(markerId)) {
            const marker = mapInstance.markers.get(markerId)
            if (marker) {
                // 鼠标进入事件
                const mouseEnterListener = marker.addListener('mouseover', () => {
                    onMouseEnter()
                })
                
                // 鼠标离开事件
                const mouseLeaveListener = marker.addListener('mouseout', () => {
                    onMouseLeave()
                })
                
                mapInstance.eventListeners.set(`marker_${markerId}_hover_enter`, mouseEnterListener)
                mapInstance.eventListeners.set(`marker_${markerId}_hover_leave`, mouseLeaveListener)
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
