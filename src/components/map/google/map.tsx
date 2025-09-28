'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { GoogleProvider, GoogleMapInstance } from '@/lib/map-providers/google-provider'
import { MapProviderConfig, MapMarker } from '@/types/map-provider'
import { Marker } from '@/types/marker'
import { GoogleConnectionLines } from './connection-lines'
import { GoogleMarkerOverlay } from './marker-overlay'
import { useMapStore } from '@/store/map-store'

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
    const markerOverlays = useRef<Map<string, GoogleMarkerOverlay>>(new Map())
    
    // 使用全局状态而不是本地状态
    const { interactionState } = useMapStore()
    const selectedMarkerId = interactionState.selectedMarkerId

    // 验证配置
    const validateConfig = useCallback(() => {
        if (!config.accessToken) {
            throw new Error('Google Maps API 密钥未配置，请检查 NEXT_PUBLIC_GOOGLE_ACCESS_TOKEN 环境变量')
        }
        
        if (config.accessToken === 'your_google_api_key_here' || config.accessToken.includes('your_')) {
            throw new Error('请设置正确的 Google Maps API 密钥，当前使用的是示例值')
        }
        
    }, [config])

    // 加载 Google Maps API - 使用最佳实践
    const loadGoogleMapsAPI = useCallback(() => {
        return new Promise<void>((resolve, reject) => {
            // 首先验证配置
            try {
                validateConfig()
            } catch (error) {
                reject(error)
                return
            }
            
            if (window.google && window.google.maps) {
                resolve()
                return
            }

            // 检查是否已有脚本正在加载
            const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
            if (existingScript) {
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

            // 创建脚本元素，使用最佳实践
            const script = document.createElement('script')
            script.src = `https://maps.googleapis.com/maps/api/js?key=${config.accessToken}&libraries=places&loading=async`
            script.async = true
            script.defer = true
            script.crossOrigin = 'anonymous' // 添加 CORS 支持
            script.onload = () => {
                // 等待 API 完全初始化，包括所有必要的组件
                const checkAPIReady = () => {
                    if (window.google && 
                        window.google.maps && 
                        window.google.maps.Map && 
                        window.google.maps.MapTypeId) {
                        resolve()
                    } else {
                        setTimeout(checkAPIReady, 50)
                    }
                }
                // 立即检查一次，然后开始轮询
                setTimeout(checkAPIReady, 100)
            }
            script.onerror = (error) => {
                console.error('Google Maps API loading failed:', error)
                reject(new Error('Failed to load Google Maps API'))
            }
            document.head.appendChild(script)
        })
    }, [config.accessToken])


    // 处理标记点击
    const handleMarkerClick = useCallback((markerId: string) => {
        // 不再需要本地状态管理，直接调用父组件的回调
        if (onMarkerClick) {
            onMarkerClick(markerId)
        }
    }, [onMarkerClick])

    // 更新标记 - 分离marker创建和选中状态更新
    useEffect(() => {
        if (!mapInstance) return

        // 清除现有overlay标记 - 同步清理
        markerOverlays.current.forEach(overlay => {
            try {
                overlay.destroy()
            } catch (error) {
                console.warn('Error destroying marker overlay during update:', error)
            }
        })
        markerOverlays.current.clear()

        // 清除现有Google标记
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

            // 创建自定义overlay
            const overlay = new GoogleMarkerOverlay(
                marker,
                () => handleMarkerClick(marker.id),
                marker.id === selectedMarkerId,
                mapInstance.map.getZoom()
            )

            // 设置overlay到地图
            overlay.setMap(mapInstance.map)
            
            // 存储overlay引用
            markerOverlays.current.set(marker.id, overlay)
        })
        
        // 注意：缩放级别更新现在由每个GoogleMarkerOverlay实例自己处理
        // 不需要在这里设置全局的缩放监听器
    }, [mapInstance, markers, handleMarkerClick])

    // 单独处理选中状态更新 - 避免重新创建所有marker
    useEffect(() => {
        if (!mapInstance) return

        // 更新所有现有marker的选中状态
        markerOverlays.current.forEach((overlay, markerId) => {
            const marker = markers.find(m => m.id === markerId)
            if (marker) {
                const isSelected = marker.id === selectedMarkerId
                overlay.updateMarker(
                    marker,
                    isSelected,
                    mapInstance.map.getZoom()
                )
            }
        })
    }, [mapInstance, markers, selectedMarkerId])

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
                
                if (!isMounted || !mapRef.current) {
                    return
                }
                
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
                
                let errorMessage = 'Failed to initialize Google Maps'
                if (err instanceof Error) {
                    errorMessage = err.message
                } else if (typeof err === 'string') {
                    errorMessage = err
                }
                
                // 添加更具体的错误信息
                if (errorMessage.includes('Google Maps API not loaded')) {
                    errorMessage = 'Google Maps API 未正确加载，请检查网络连接和 API 密钥'
                } else if (errorMessage.includes('Failed to load Google Maps API')) {
                    errorMessage = '无法加载 Google Maps API，请检查 API 密钥是否正确'
                } else if (errorMessage.includes('InvalidKeyMapError')) {
                    errorMessage = 'Google Maps API 密钥无效，请检查密钥配置'
                } else if (errorMessage.includes('QuotaExceededError')) {
                    errorMessage = 'Google Maps API 配额已超限，请检查使用量'
                }
                
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
            
            // 清理所有overlay - 使用异步清理避免竞态条件
            if (markerOverlays.current.size > 0) {
                // 延迟清理，确保React渲染完成
                setTimeout(() => {
                    markerOverlays.current.forEach(overlay => {
                        try {
                            overlay.destroy()
                        } catch (error) {
                            console.warn('Error destroying marker overlay:', error)
                        }
                    })
                    markerOverlays.current.clear()
                }, 0)
            }
            
            if (mapInstance) {
                try {
                    googleProvider.current.destroyMapInstance(mapInstance)
                } catch (error) {
                    console.warn('Error destroying map instance:', error)
                }
            }
        }
    }, []) // 只在组件挂载时执行一次


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
