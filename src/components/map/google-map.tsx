'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { GoogleProvider, GoogleMapInstance } from '@/lib/map-providers/google-provider'
import { MapProviderConfig } from '@/types/map-provider'
import { Marker } from '@/types/marker'
import { MapMarker } from '@/types/map-provider'

interface GoogleMapProps {
    config: MapProviderConfig
    markers: Marker[]
    onMapClick?: (coordinates: { latitude: number; longitude: number }) => void
    onMarkerClick?: (markerId: string) => void
    onMapLoad?: () => void
    onMapError?: (error: Error) => void
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
            script.onerror = () => reject(new Error('Failed to load Google Maps API'))
            document.head.appendChild(script)
        })
    }, [config.accessToken])

    // 初始化地图
    const initializeMap = useCallback(async () => {
        if (!mapRef.current) return

        try {
            setIsLoading(true)
            setError(null)

            await loadGoogleMapsAPI()
            
            const instance = await googleProvider.current.createMapInstance(mapRef.current, config)
            setMapInstance(instance)

            // 设置事件监听器
            if (onMapClick) {
                googleProvider.current.onMapClick(instance, onMapClick)
            }

            if (onMapLoad) {
                googleProvider.current.onMapLoad(instance, onMapLoad)
            }

            if (onMapError) {
                googleProvider.current.onMapError(instance, onMapError)
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Google Maps'
            setError(errorMessage)
            if (onMapError) {
                onMapError(new Error(errorMessage))
            }
        } finally {
            setIsLoading(false)
        }
    }, [config, onMapClick, onMapLoad, onMapError, loadGoogleMapsAPI])

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

            // 设置标记图标（如果有的话）
            if (marker.content.iconType) {
                const iconUrl = getMarkerIconUrl(marker.content.iconType)
                if (iconUrl) {
                    googleMarker.setIcon({
                        url: iconUrl,
                        scaledSize: new (window as any).google.maps.Size(32, 32),
                        anchor: new (window as any).google.maps.Point(16, 32)
                    })
                }
            }
        })
    }, [mapInstance, markers, onMarkerClick, handleMarkerClick])

    // 初始化地图
    useEffect(() => {
        initializeMap()

        return () => {
            if (mapInstance) {
                googleProvider.current.destroyMapInstance(mapInstance)
            }
        }
    }, [initializeMap])

    // 获取标记图标URL
    const getMarkerIconUrl = (iconType: string): string | null => {
        // 这里可以根据 iconType 返回对应的图标URL
        // 可以使用本地图标或在线图标服务
        const iconMap: Record<string, string> = {
            'default': '/icons/marker-default.png',
            'restaurant': '/icons/marker-restaurant.png',
            'hotel': '/icons/marker-hotel.png',
            'attraction': '/icons/marker-attraction.png',
            'shopping': '/icons/marker-shopping.png',
            'transport': '/icons/marker-transport.png'
        }
        return iconMap[iconType] || iconMap['default']
    }

    if (error) {
        return (
            <div className={`flex items-center justify-center h-full bg-gray-100 ${className}`} style={style}>
                <div className="text-center">
                    <div className="text-red-500 text-lg font-semibold mb-2">地图加载失败</div>
                    <div className="text-gray-600">{error}</div>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center h-full bg-gray-100 ${className}`} style={style}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <div className="text-gray-600">正在加载地图...</div>
                </div>
            </div>
        )
    }

    return (
        <div 
            ref={mapRef} 
            className={`w-full h-full ${className}`} 
            style={style}
        />
    )
}

export default GoogleMap
