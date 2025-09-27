'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { GoogleProvider, GoogleMapInstance } from '@/lib/map-providers/google-provider'
import { MapProviderConfig } from '@/types/map-provider'
import { Marker } from '@/types/marker'
import { MapMarker } from '@/types/map-provider'
import { GoogleConnectionLines } from './google-connection-lines'

interface GoogleMapProps {
    config: MapProviderConfig
    markers: Marker[]
    onMapClick?: (coordinates: { latitude: number; longitude: number }, placeInfo?: { name: string; address: string; placeId: string }, clickPosition?: { x: number; y: number }, isMarkerClick?: boolean) => void
    onMarkerClick?: (markerId: string) => void
    onMapLoad?: () => void
    onMapError?: (error: Error) => void
    onMapMove?: (viewState: { longitude: number; latitude: number; zoom: number }) => void
    onMapInstanceReady?: (mapInstance: GoogleMapInstance) => void
    initialViewState?: { longitude: number; latitude: number; zoom: number }
    className?: string
    style?: React.CSSProperties
}

// 声明全局 Google Maps API 类型
declare global {
    interface Window {
        google: any
        initGoogleMaps: () => void
    }
}

export const GoogleMap: React.FC<GoogleMapProps> = ({
    config,
    markers,
    onMapClick,
    onMarkerClick,
    onMapLoad,
    onMapError,
    onMapMove,
    onMapInstanceReady,
    initialViewState,
    className = '',
    style = {}
}) => {
    const mapRef = useRef<HTMLDivElement>(null)
    const [mapInstance, setMapInstance] = useState<GoogleMapInstance | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const googleProvider = useRef<GoogleProvider>(new GoogleProvider())

    // 加载 Google Maps API
    const loadGoogleMapsAPI = useCallback(() => {
        return new Promise<void>((resolve, reject) => {
            if (window.google && window.google.maps) {
                resolve()
                return
            }

            if (document.querySelector('script[src*="maps.googleapis.com"]')) {
                // API 正在加载中，等待加载完成
                const checkLoaded = () => {
                    if (window.google && window.google.maps) {
                        resolve()
                    } else {
                        setTimeout(checkLoaded, 100)
                    }
                }
                checkLoaded()
                return
            }

            const script = document.createElement('script')
            script.src = `https://maps.googleapis.com/maps/api/js?key=${config.accessToken}&libraries=places`
            script.async = true
            script.defer = true
            script.onload = () => resolve()
            script.onerror = (error) => {
                reject(new Error('Failed to load Google Maps API'))
            }
            document.head.appendChild(script)
        })
    }, [config.accessToken])


    // 处理标记点击
    const handleMarkerClick = useCallback((markerId: string) => {
        if (onMarkerClick) {
            onMarkerClick(markerId)
        }
    }, [onMarkerClick])

    // 更新标记
    useEffect(() => {
        if (!mapInstance) return

        // 清除现有标记
        mapInstance.markers.forEach(marker => marker.setMap(null))
        mapInstance.markers.clear()

        // 添加新标记
        markers.forEach(marker => {
            const mapMarker: MapMarker = {
                id: marker.id,
                coordinates: {
                    latitude: marker.coordinates.latitude,
                    longitude: marker.coordinates.longitude
                }
            }

            const googleMarker = googleProvider.current.addMarker(mapInstance, mapMarker)
            
            // 设置标记点击事件
            if (onMarkerClick) {
                googleProvider.current.onMarkerClick(mapInstance, marker.id, () => handleMarkerClick(marker.id))
            }

            // 设置标记悬停效果
            googleProvider.current.onMarkerHover(
                mapInstance, 
                marker.id, 
                () => {
                    // 鼠标进入：降低透明度到0.9
                    if (marker.content.iconType) {
                        const iconConfig = getMarkerIconConfig(marker.content.iconType)
                        if (iconConfig) {
                            const currentZoom = mapInstance.map.getZoom()
                            const shouldRenderAsDot = currentZoom < 13
                            const svgIcon = createSimpleSVGIcon(iconConfig.emoji, iconConfig.color, shouldRenderAsDot, 0.9, true)
                            googleMarker.setIcon({
                                url: svgIcon,
                                scaledSize: new (window as any).google.maps.Size(
                                    shouldRenderAsDot ? 10 : 32, 
                                    shouldRenderAsDot ? 10 : 32
                                ),
                                anchor: new (window as any).google.maps.Point(
                                    shouldRenderAsDot ? 5 : 16, 
                                    shouldRenderAsDot ? 5 : 16
                                )
                            })
                        }
                    }
                },
                () => {
                    // 鼠标离开：恢复透明度到0.7
                    if (marker.content.iconType) {
                        const iconConfig = getMarkerIconConfig(marker.content.iconType)
                        if (iconConfig) {
                            const currentZoom = mapInstance.map.getZoom()
                            const shouldRenderAsDot = currentZoom < 13
                            const svgIcon = createSimpleSVGIcon(iconConfig.emoji, iconConfig.color, shouldRenderAsDot, 0.7, false)
                            googleMarker.setIcon({
                                url: svgIcon,
                                scaledSize: new (window as any).google.maps.Size(
                                    shouldRenderAsDot ? 10 : 32, 
                                    shouldRenderAsDot ? 10 : 32
                                ),
                                anchor: new (window as any).google.maps.Point(
                                    shouldRenderAsDot ? 5 : 16, 
                                    shouldRenderAsDot ? 5 : 16
                                )
                            })
                        }
                    }
                }
            )

            // 设置标记图标（使用与Mapbox相同的图标系统）
            if (marker.content.iconType) {
                const iconConfig = getMarkerIconConfig(marker.content.iconType)
                if (iconConfig) {
                    // 获取当前缩放级别
                    const currentZoom = mapInstance.map.getZoom()
                    const shouldRenderAsDot = currentZoom < 13
                    
                    
                    // 创建SVG图标，使用emoji和颜色，默认透明度0.7，添加动画效果
                    const svgIcon = createSimpleSVGIcon(iconConfig.emoji, iconConfig.color, shouldRenderAsDot, 0.7, false)
                    googleMarker.setIcon({
                        url: svgIcon,
                        scaledSize: new (window as any).google.maps.Size(
                            shouldRenderAsDot ? 10 : 32, 
                            shouldRenderAsDot ? 10 : 32
                        ),
                        anchor: new (window as any).google.maps.Point(
                            shouldRenderAsDot ? 5 : 16, 
                            shouldRenderAsDot ? 5 : 16
                        )
                    })
                }
            }
        })
        
        // 设置缩放事件监听器（每次markers更新时重新设置）
        const setupZoomListener = () => {
            if (!mapInstance) return
            
            // 移除旧的缩放监听器
            if (mapInstance.eventListeners.has('zoom_changed')) {
                const oldListener = mapInstance.eventListeners.get('zoom_changed')
                if (oldListener) {
                    (window as any).google.maps.event.removeListener(oldListener)
                }
                mapInstance.eventListeners.delete('zoom_changed')
            }

            // 添加新的缩放监听器
            const zoomListener = mapInstance.map.addListener('zoom_changed', () => {
                // 获取当前缩放级别
                const currentZoom = mapInstance.map.getZoom()
                
                // 延迟执行，避免频繁更新
                setTimeout(() => {
                    if (mapInstance) {
                        const shouldRenderAsDot = currentZoom < 13
                        
                        // 重新渲染所有标记
                        mapInstance.markers.forEach((googleMarker, markerId) => {
                            if (googleMarker) {
                                // 从当前markers props中查找标记数据
                                const marker = markers.find(m => m.id === markerId)
                                
                                if (marker && marker.content.iconType) {
                                    const iconConfig = getMarkerIconConfig(marker.content.iconType)
                                    
                                    if (iconConfig) {
                                        const svgIcon = createSimpleSVGIcon(iconConfig.emoji, iconConfig.color, shouldRenderAsDot, 0.7, false)
                                        
                                        // 确保图标正确设置
                                        try {
                                            const iconOptions = {
                                                url: svgIcon,
                                                scaledSize: new (window as any).google.maps.Size(
                                                    shouldRenderAsDot ? 10 : 32, 
                                                    shouldRenderAsDot ? 10 : 32
                                                ),
                                                anchor: new (window as any).google.maps.Point(
                                                    shouldRenderAsDot ? 5 : 16, 
                                                    shouldRenderAsDot ? 5 : 16
                                                )
                                            }
                                            
                                            googleMarker.setIcon(iconOptions)
                                            
                                            // 强制刷新标记显示
                                            googleMarker.setMap(null)
                                            googleMarker.setMap(mapInstance.map)
                                        } catch (error) {
                                            console.error(`更新标记 ${markerId} 图标失败:`, error)
                                        }
                                    }
                                }
                            }
                        })
                    }
                }, 100)
            })
            
            // 存储缩放监听器
            mapInstance.eventListeners.set('zoom_changed', zoomListener)
        }

        // 设置缩放监听器
        setupZoomListener()
    }, [mapInstance, markers, onMarkerClick, handleMarkerClick])

    // 初始化地图
    useEffect(() => {
        let isMounted = true
        
        const initMap = async () => {
            if (!mapRef.current) {
                // 如果容器未准备好，延迟重试
                setTimeout(() => {
                    if (isMounted) {
                        initMap()
                    }
                }, 200)
                return
            }

            try {
                setIsLoading(true)
                setError(null)

                await loadGoogleMapsAPI()
                
                if (!isMounted || !mapRef.current) return
                
                const instance = await googleProvider.current.createMapInstance(mapRef.current, config)
                
                if (!isMounted) return
                
                setMapInstance(instance)

                // 通知父组件地图实例已准备好
                if (onMapInstanceReady) {
                    onMapInstanceReady(instance)
                }

                // 设置初始位置（如果提供）
                if (initialViewState) {
                    googleProvider.current.setViewState(instance, {
                        longitude: initialViewState.longitude,
                        latitude: initialViewState.latitude,
                        zoom: initialViewState.zoom
                    })
                }

                // 设置事件监听器
                if (onMapClick) {
                    googleProvider.current.onMapClick(instance, (coordinates, placeInfo, clickPosition, isMarkerClick) => {
                        // 直接传递coordinates作为event参数，因为AbstractMap期望的是coordinates对象
                        onMapClick(coordinates, placeInfo, clickPosition, isMarkerClick)
                    })
                }

                // 缩放监听器现在在useEffect中设置，这里不需要重复设置

                if (onMapLoad) {
                    googleProvider.current.onMapLoad(instance, onMapLoad)
                }

                if (onMapError) {
                    googleProvider.current.onMapError(instance, onMapError)
                }

                // 添加位置变化监听器
                if (onMapMove) {
                    googleProvider.current.onMapMove(instance, onMapMove)
                }
            } catch (err) {
                if (!isMounted) return
                
                const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Google Maps'
                setError(errorMessage)
                if (onMapError) {
                    onMapError(new Error(errorMessage))
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        // 延迟初始化，确保容器准备好
        const timer = setTimeout(() => {
            initMap()
        }, 100)

        return () => {
            isMounted = false
            clearTimeout(timer)
            if (mapInstance) {
                googleProvider.current.destroyMapInstance(mapInstance)
            }
        }
    }, []) // 只在组件挂载时执行一次

    // 获取标记图标配置（与Mapbox保持一致）
    const getMarkerIconConfig = (iconType: string) => {
        const iconMap: Record<string, { emoji: string; color: string }> = {
            'activity': { emoji: '🎯', color: '#f97316' }, // orange-500
            'location': { emoji: '📍', color: '#ec4899' }, // pink-500
            'hotel': { emoji: '🏨', color: '#22c55e' }, // green-500
            'shopping': { emoji: '🛍️', color: '#a855f7' }, // purple-500
            'food': { emoji: '🍜', color: '#71717a' }, // zinc-500
            'landmark': { emoji: '🌆', color: '#a855f7' }, // purple-500
            'park': { emoji: '🎡', color: '#64748b' }, // slate-500
            'natural': { emoji: '🗻', color: '#d946ef' }, // fuchsia-500
            'culture': { emoji: '⛩️', color: '#6b7280' } // gray-500
        }
        return iconMap[iconType] || iconMap['location']
    }

    // 创建简化的SVG图标，与Mapbox样式一致
    const createSimpleSVGIcon = (emoji: string, color: string, isDot: boolean = false, opacity: number = 0.7, isHover: boolean = false): string => {
        if (isDot) {
            // 小圆点模式：只显示纯色圆点，不显示emoji
            const svg = `
                <svg width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="5" cy="5" r="4" fill="${color}" opacity="${opacity}" stroke="white" stroke-width="1"/>
                </svg>
            `
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
        } else {
            // 正常模式：显示emoji和颜色，与Mapbox样式一致
            const svg = `
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="14" fill="${color}" opacity="${opacity}" stroke="white" stroke-width="2"/>
                    <text x="16" y="20" text-anchor="middle" font-size="14" fill="white" opacity="${opacity}">${emoji}</text>
                </svg>
            `
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
        }
    }

    return (
        <div className={`relative w-full h-full ${className}`} style={style}>
            {/* 地图容器 - 始终渲染 */}
            <div 
                ref={mapRef} 
                className="w-full h-full"
            />
            
            {/* 连接线组件 */}
            <GoogleConnectionLines 
                mapInstance={mapInstance} 
                markers={markers} 
            />
            
            {/* 加载状态覆盖层 */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90 z-10">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <div className="text-gray-600">正在加载地图...</div>
                    </div>
                </div>
            )}
            
            {/* 错误状态覆盖层 */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-90 z-10">
                    <div className="text-center">
                        <div className="text-red-500 text-lg font-semibold mb-2">地图加载失败</div>
                        <div className="text-gray-600">{error}</div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default GoogleMap
