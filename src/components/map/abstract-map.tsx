'use client'

import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react'

import { MapProvider, MapCoordinates, MapViewState, MapProviderConfig } from '@/types/map-provider'
import { mapProviderFactory } from '@/lib/map-providers'
import { config } from '@/lib/config'
import { searchService } from '@/lib/api/search-service'
import { getPlaceIdFromCoordinates, getPlaceDetailsFromCoordinates } from '@/lib/google-places-reverse-geocoding'
// 内联的 Google Maps 加载函数
const loadGoogleMapsForSearch = async (apiKey: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        if (window.google && window.google.maps) {
            resolve()
            return
        }

        // 检查是否已有脚本正在加载
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
        if (existingScript) {
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

        // 创建脚本元素
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
        script.async = true
        script.defer = true
        script.crossOrigin = 'anonymous'
        script.onload = () => {
            const checkAPIReady = () => {
                if (window.google && window.google.maps && window.google.maps.Map) {
                    resolve()
                } else {
                    setTimeout(checkAPIReady, 50)
                }
            }
            setTimeout(checkAPIReady, 100)
        }
        script.onerror = () => {
            reject(new Error('Failed to load Google Maps API'))
        }
        document.head.appendChild(script)
    })
}
import { useMapStore } from '@/store/map-store'
import { MarkerCoordinates } from '@/types/marker'
import { MapMarker } from './common/map-marker'
import { MapPopup } from './mapbox/map-popup'
import { GoogleMapPopup } from './google/map-popup'
import { ConnectionLines } from './mapbox/connection-lines'
import GoogleMap from './google/map'
import { AddMarkerModal } from '@/components/modal/add-marker-modal'
import { EditMarkerModal } from '@/components/modal/edit-marker-modal'
import { LeftSidebar } from '@/components/sidebar/left-sidebar'
import { Sidebar } from '@/components/sidebar/sidebar'
import { cn } from '@/utils/cn'
import { MarkerIconType } from '@/types/marker'
import Map, { Marker as MapboxMarker, MapRef, ViewState, MapProvider as ReactMapProvider } from 'react-map-gl'

// 根据地图提供者导入相应的样式
import 'mapbox-gl/dist/mapbox-gl.css'

export const AbstractMap = () => {
    const mapRef = useRef<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [mapInitialized, setMapInitialized] = useState(false)
    const [loadingRetryCount, setLoadingRetryCount] = useState(0)
    const [dataLoaded, setDataLoaded] = useState(false)
    const [googleMapInstance, setGoogleMapInstance] = useState<any>(null)
    
    // Google Map 自定义 Popup 状态
    const [googlePopupVisible, setGooglePopupVisible] = useState(false)
    const [googlePopupCoordinates, setGooglePopupCoordinates] = useState<MarkerCoordinates | null>(null)
    const [googlePopupPlaceInfo, setGooglePopupPlaceInfo] = useState<{ name: string; address: string; placeId: string } | null>(null)
    const [googlePopupClickPosition, setGooglePopupClickPosition] = useState<{ x: number; y: number } | null>(null)
    const [googlePopupIsMarkerClick, setGooglePopupIsMarkerClick] = useState(false)
    
    // 存储地点名称，用于更新 popup title
    const [currentPlaceName, setCurrentPlaceName] = useState<string | undefined>(undefined)
    
    // 存储地点地址，用于显示在 popup 中
    const [currentPlaceAddress, setCurrentPlaceAddress] = useState<string | undefined>(undefined)
    
    // 地点反查结果缓存
    const placeCacheRef = useRef<Record<string, { name: string; address?: string }>>({})
    
    // 使用ref来跟踪popup状态，避免异步状态更新问题
    const googlePopupVisibleRef = useRef(false)
    
    // 获取当前地图提供者 - 使用 useMemo 避免重复创建
    const mapProvider = useMemo(() => mapProviderFactory.createProvider(config.map.provider), [config.map.provider])
    const mapConfig: MapProviderConfig = useMemo(() => ({
        accessToken: config.map[config.map.provider].accessToken,
        style: config.map[config.map.provider].style,
    }), [config.map.provider, config.map[config.map.provider].accessToken, config.map[config.map.provider].style])
    
    // 从localStorage恢复上次的坐标，如果没有则使用默认坐标
    const getInitialViewState = (): ViewState => {
        if (typeof window === 'undefined') {
            return {
                longitude: config.app.defaultCenter.longitude,
                latitude: config.app.defaultCenter.latitude,
                zoom: config.app.defaultZoom,
                bearing: 0,
                pitch: 0,
                padding: {
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                },
            }
        }
        
        try {
            const savedViewState = localStorage.getItem('mapViewState')
            if (savedViewState) {
                const parsed = JSON.parse(savedViewState)
                return {
                    longitude: parsed.longitude || config.app.defaultCenter.longitude,
                    latitude: parsed.latitude || config.app.defaultCenter.latitude,
                    zoom: parsed.zoom || config.app.defaultZoom,
                    bearing: parsed.bearing || 0,
                    pitch: parsed.pitch || 0,
                    padding: {
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                    },
                }
            }
        } catch (error) {
            console.warn('Failed to parse saved view state:', error)
        }
        
        return {
            longitude: config.app.defaultCenter.longitude,
            latitude: config.app.defaultCenter.latitude,
            zoom: config.app.defaultZoom,
            bearing: 0,
            pitch: 0,
            padding: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
            },
        }
    }
    
    const [viewState, setViewState] = useState<ViewState>(getInitialViewState())

    // 通用的位置保存函数
    const saveViewState = useCallback((viewState: { longitude: number; latitude: number; zoom: number; bearing?: number; pitch?: number }) => {
        try {
            localStorage.setItem('mapViewState', JSON.stringify({
                longitude: viewState.longitude,
                latitude: viewState.latitude,
                zoom: viewState.zoom,
                bearing: viewState.bearing || 0,
                pitch: viewState.pitch || 0,
            }))
        } catch (error) {
            console.warn('Failed to save view state to localStorage:', error)
        }
    }, [])

    // 城市快速跳转折叠状态
    const [isCityListOpen, setIsCityListOpen] = useState(false)

    // 右下角：搜索浮层与输入状态
    const [isSearchFabOpen, setIsSearchFabOpen] = useState(false)
    const [fabQuery, setFabQuery] = useState('')
    const [fabResults, setFabResults] = useState<any[]>([])
    const [fabQueryError, setFabQueryError] = useState('')
    const [fabCoordInput, setFabCoordInput] = useState('')
    const [fabCoordError, setFabCoordError] = useState('')

    const {
        markers,
        interactionState,
        addMarkerModal,
        editMarkerModal,
        leftSidebar,
        isLoading,
        error: storeError,
        openPopup,
        closePopup,
        selectMarker,
        openAddMarkerModal,
        closeAddMarkerModal,
        openEditMarkerModal,
        closeEditMarkerModal,
        toggleLeftSidebar,
        createMarkerFromModal,
        updateMarkerFromModal,
        loadMarkersFromDataset,
        clearError,
        openSidebar,
        closeSidebar,
    } = useMapStore()

    const { isPopupOpen, popupCoordinates, selectedMarkerId, isSidebarOpen } = interactionState

    // 自定义关闭标记详情函数，在移动端关闭时跳转到正中间
    const handleCloseSidebar = useCallback(() => {
        // 发送事件通知侧边栏重置添加模式
        const resetAddModeEvent = new CustomEvent('resetAddMode')
        window.dispatchEvent(resetAddModeEvent)
        
        closeSidebar()
        
        // 在移动端关闭标记详情时，跳转到正中间（修复之前的偏移）
        if (window.innerWidth < 1024 && selectedMarkerId) {
            const marker = markers.find(m => m.id === selectedMarkerId)
            if (marker && mapRef.current) {
                // 延迟执行，确保侧边栏已经关闭
                setTimeout(() => {
                    if (mapRef.current) {
                        mapProvider.flyTo(mapRef.current, {
                            longitude: marker.coordinates.longitude,
                            latitude: marker.coordinates.latitude,
                        }, 15)
                    }
                }, 300)
            }
        }
    }, [closeSidebar, selectedMarkerId, markers, mapProvider])

    // 地图初始化成功后设置状态
    const handleMapLoad = useCallback(() => {
        setMapInitialized(true)
        setError(null) // 清除可能的错误
        
        // 如果是Mapbox地图，应用POI过滤
        if (config.map.provider === 'mapbox') {
            try {
                // 动态导入MapboxProvider并应用POI过滤
                import('@/lib/map-providers/mapbox-provider').then(({ MapboxProvider }) => {
                    const mapboxProvider = new MapboxProvider()
                    mapboxProvider.applyPOIFilter()
                })
            } catch (error) {
                console.warn('无法应用Mapbox POI过滤:', error)
            }
        }
    }, [])

    // 监听跳转到中心的事件
    useEffect(() => {
        const handleJumpToCenter = (event: CustomEvent) => {
            const { coordinates, zoom } = event.detail
            if (mapRef.current) {
                mapProvider.flyTo(mapRef.current, coordinates, zoom)
            }
        }

        window.addEventListener('jumpToCenter', handleJumpToCenter as EventListener)
        return () => {
            window.removeEventListener('jumpToCenter', handleJumpToCenter as EventListener)
        }
    }, [mapProvider])

    // Google Map Popup 关闭处理
    const handleCloseGooglePopup = useCallback(() => {
        setGooglePopupVisible(false)
        setGooglePopupCoordinates(null)
        setGooglePopupPlaceInfo(null)
        setGooglePopupClickPosition(null)
        setGooglePopupIsMarkerClick(false)
        googlePopupVisibleRef.current = false
    }, [])

    // 监听地图缩放，重新计算Popup位置
    useEffect(() => {
        if (!googlePopupVisible || !googleMapInstance) return

        let zoomTimeout: NodeJS.Timeout | null = null

        const handleMapZoom = () => {
            // 防抖处理，避免频繁更新
            if (zoomTimeout) {
                clearTimeout(zoomTimeout)
            }
            
            zoomTimeout = setTimeout(() => {
                // 触发Popup位置重新计算
                if (googlePopupClickPosition) {
                    // 强制重新计算位置
                    setGooglePopupClickPosition({ ...googlePopupClickPosition })
                }
            }, 50) // 50ms防抖
        }

        // 监听地图缩放和移动事件
        if (googleMapInstance.map) {
            const zoomListener = googleMapInstance.map.addListener('zoom_changed', handleMapZoom)
            const moveListener = googleMapInstance.map.addListener('center_changed', handleMapZoom)
            
            return () => {
                if (zoomTimeout) {
                    clearTimeout(zoomTimeout)
                }
                if (zoomListener) {
                    (window as any).google.maps.event.removeListener(zoomListener)
                }
                if (moveListener) {
                    (window as any).google.maps.event.removeListener(moveListener)
                }
            }
        }
    }, [googlePopupVisible, googleMapInstance, googlePopupClickPosition])

    // Google Map Popup 添加标记处理
    const handleGooglePopupAddMarker = useCallback(() => {
        if (googlePopupCoordinates) {
            openAddMarkerModal(googlePopupCoordinates, googlePopupPlaceInfo?.name)
            handleCloseGooglePopup()
        }
    }, [googlePopupCoordinates, googlePopupPlaceInfo, openAddMarkerModal, handleCloseGooglePopup])

    // 地图flyTo功能
    const handleFlyTo = useCallback((coordinates: { longitude: number; latitude: number }, zoom?: number) => {
        if (config.map.provider === 'google') {
            // Google Maps 处理
            if (googleMapInstance) {
                // 在移动端有标记详情时，调整跳转位置
                if (window.innerWidth < 1024) {
                    // 计算偏移量：在zoom 15时，需要合适的偏移量让目标位置出现在上半屏中间
                    const offset = -0.0035 // 纬度偏移量，向下偏移约0.4km
                    const adjustedCoordinates = {
                        longitude: coordinates.longitude,
                        latitude: coordinates.latitude + offset,
                    }
                    
                    // 延迟执行，确保标记详情已经打开
                    setTimeout(() => {
                        if (googleMapInstance) {
                            mapProvider.flyTo(googleMapInstance, adjustedCoordinates, zoom)
                        }
                    }, 100)
                } else {
                    // 正常跳转
                    mapProvider.flyTo(googleMapInstance, coordinates, zoom)
                }
            }
        } else {
            // Mapbox 处理
            if (mapRef.current) {
                // 在移动端有标记详情时，调整跳转位置
                if (window.innerWidth < 1024) {
                    // 计算偏移量：在zoom 15时，需要合适的偏移量让目标位置出现在上半屏中间
                    const offset = -0.0035 // 纬度偏移量，向下偏移约0.4km
                    const adjustedCoordinates = {
                        longitude: coordinates.longitude,
                        latitude: coordinates.latitude + offset,
                    }
                    
                    // 延迟执行，确保标记详情已经打开
                    setTimeout(() => {
                        if (mapRef.current) {
                            mapProvider.flyTo(mapRef.current, adjustedCoordinates, zoom)
                        }
                    }, 100)
                } else {
                    // 正常跳转
                    mapProvider.flyTo(mapRef.current, coordinates, zoom)
                }
            }
        }
    }, [isSidebarOpen, mapProvider, googleMapInstance, config.map.provider])

    // 城市快速跳转功能
    const handleCityJump = useCallback((cityKey: keyof typeof config.cities) => {
        const city = config.cities[cityKey]
        if (config.map.provider === 'google') {
            // Google Maps 处理
            if (googleMapInstance) {
                mapProvider.flyTo(googleMapInstance, {
                    longitude: city.coordinates.longitude,
                    latitude: city.coordinates.latitude,
                }, city.zoom)
            }
        } else {
            // Mapbox 处理
            if (mapRef.current) {
                mapProvider.flyTo(mapRef.current, {
                    longitude: city.coordinates.longitude,
                    latitude: city.coordinates.latitude,
                }, city.zoom)
            }
        }
    }, [mapProvider, googleMapInstance, config.map.provider])

    // 右下角悬浮搜索：地点搜索
    const handleFabSearch = useCallback(async () => {
        const input = fabQuery.trim()
        if (!input) {
            setFabQueryError('请输入搜索关键词')
            return
        }
        try {
            // 使用统一的搜索服务，支持混合搜索功能
            const results = await searchService.searchPlaces(input, 10, 'zh-CN')
            setFabResults(results)
        } catch (e) {
            setFabQueryError('搜索失败，请稍后再试')
        }
    }, [fabQuery])

    const handleFabResultClick = useCallback((result: any) => {
        if (!result?.coordinates) return
        
        // 清除之前的地点名称和地址，避免显示缓存的结果
        setCurrentPlaceName(undefined)
        setCurrentPlaceAddress(undefined)
        
        // 异步获取 placeId（不阻塞主流程）
        getPlaceIdAsync({
            latitude: result.coordinates.latitude,
            longitude: result.coordinates.longitude
        })
        
        // 根据搜索结果类型智能调整缩放级别
        let zoomLevel = 16 // 默认缩放级别
        
        // 如果搜索结果名称包含特定关键词，调整缩放级别
        const name = result.name?.toLowerCase() || ''
        
        if (name.includes('城市') || name.includes('市') || name.includes('县') || name.includes('区')) {
            // 城市级别，使用较小的缩放
            zoomLevel = 12
        } else if (name.includes('国家') || name.includes('省') || name.includes('州')) {
            // 国家/省级别，使用更小的缩放
            zoomLevel = 8
        } else if (name.includes('街道') || name.includes('路') || name.includes('街')) {
            // 街道级别，使用较大的缩放
            zoomLevel = 18
        } else if (name.includes('建筑') || name.includes('大厦') || name.includes('商场') || name.includes('酒店')) {
            // 具体建筑，使用最大的缩放
            zoomLevel = 19
        } else {
            // 默认地点，使用中等缩放
            zoomLevel = 16
        }
        
        // 跳转到搜索结果位置
        handleFlyTo({ longitude: result.coordinates.longitude, latitude: result.coordinates.latitude }, zoomLevel)
        
        // 自动弹出添加标记的 popup
        setTimeout(() => {
            if (config.map.provider === 'google') {
                // 对于Google地图，使用Google专用的popup显示逻辑
                setGooglePopupCoordinates({
                    latitude: result.coordinates.latitude,
                    longitude: result.coordinates.longitude
                })
                setGooglePopupPlaceInfo({
                    name: result.name || '搜索结果',
                    address: result.formatted_address || result.address || '',
                    placeId: result.place_id || result.id || ''
                })
                setGooglePopupClickPosition(null)
                setGooglePopupIsMarkerClick(false)
                setGooglePopupVisible(true)
                googlePopupVisibleRef.current = true
            } else {
                // 对于其他地图提供者，使用通用popup
                openPopup({
                    latitude: result.coordinates.latitude,
                    longitude: result.coordinates.longitude
                })
            }
        }, 500) // 等待地图跳转动画完成
        
        setIsSearchFabOpen(false)
    }, [handleFlyTo, openPopup])

    // 右下角悬浮搜索：坐标跳转
    const handleFabCoordinateJump = useCallback(() => {
        const input = fabCoordInput.trim()
        if (!input) {
            setFabCoordError('请输入坐标')
            return
        }
        const patterns = [
            /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/,
            /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,
        ]
        let latitude: number | null = null
        let longitude: number | null = null
        for (const pattern of patterns) {
            const match = input.match(pattern)
            if (match) {
                latitude = parseFloat(match[1])
                longitude = parseFloat(match[2])
                break
            }
        }
        if (latitude === null || longitude === null) {
            setFabCoordError('坐标格式错误，请使用"纬度, 经度"格式')
            return
        }
        if (latitude < -90 || latitude > 90) {
            setFabCoordError('纬度必须在-90到90之间')
            return
        }
        if (longitude < -180 || longitude > 180) {
            setFabCoordError('经度必须在-180到180之间')
            return
        }
        handleFlyTo({ longitude, latitude }, 16)
        setIsSearchFabOpen(false)
    }, [fabCoordInput, handleFlyTo])

    // 静默重试加载数据
    const silentRetryLoad = useCallback(async () => {
        if (loadingRetryCount >= 3 || dataLoaded) return // 如果已加载成功，不再重试

        try {
            await loadMarkersFromDataset()
            setLoadingRetryCount(0) // 成功后重置计数
            setDataLoaded(true) // 标记数据已加载
        } catch (error) {
            console.warn(`数据加载重试 ${loadingRetryCount + 1}/3 失败:`, error)
            setLoadingRetryCount(prev => prev + 1)

            // 延迟重试
            setTimeout(() => {
                if (loadingRetryCount < 2) {
                    silentRetryLoad()
                }
            }, 2000 * (loadingRetryCount + 1)) // 2s, 4s, 6s 延迟
        }
    }, [loadMarkersFromDataset, loadingRetryCount, dataLoaded])

    // 页面加载时从 Dataset 加载标记（静默失败，防止重复加载）
    useEffect(() => {
        if (dataLoaded) return // 如果已经加载过，不再重复加载

        const loadData = async () => {
            try {
                await loadMarkersFromDataset()
                setDataLoaded(true)
            } catch (error) {
                console.warn('初始数据加载失败，将进行静默重试:', error)
                // 不设置错误状态，让地图正常显示
                silentRetryLoad()
            }
        }

        loadData()
    }, [loadMarkersFromDataset, silentRetryLoad, dataLoaded])

    // 监听严重错误（只有地图本身无法加载才显示错误页面）
    useEffect(() => {
        if (storeError) {
            // 如果地图已经初始化，只显示通知而不阻塞整个界面
            if (mapInitialized) {
                console.error('存储错误（地图已加载）:', storeError)
                // 3秒后自动清除错误
                const timer = setTimeout(() => {
                    clearError()
                }, 3000)
                return () => clearTimeout(timer)
            } else {
                // 地图未初始化时，可能是严重错误
                setError(storeError)
                const timer = setTimeout(() => {
                    clearError()
                    setError(null)
                }, 5000)
                return () => clearTimeout(timer)
            }
        }
    }, [storeError, clearError, mapInitialized])

    // 地图错误处理
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            console.error('Map error:', event.error)
            if (event.error?.message?.includes('mapbox') || event.error?.message?.includes('token')) {
                setError('Mapbox token 无效或已过期，请检查配置')
            }
        }

        window.addEventListener('error', handleError)
        return () => window.removeEventListener('error', handleError)
    }, [])

    // 生成缓存键的函数
    const generateCacheKey = useCallback((coordinates: { latitude: number; longitude: number }, zoom: number) => {
        // 根据缩放级别确定精度 - 扩大缓存范围
        // zoom 1-4: 0.2度精度 (约22km)
        // zoom 5-8: 0.02度精度 (约2.2km)  
        // zoom 9-12: 0.002度精度 (约220m)
        // zoom 13-16: 0.0002度精度 (约22m)
        // zoom 17+: 0.0001度精度 (约11m)
        let precision = 0.2
        if (zoom >= 5) precision = 0.02
        if (zoom >= 9) precision = 0.002
        if (zoom >= 13) precision = 0.0002
        if (zoom >= 17) precision = 0.0001
        
        const lat = Math.round(coordinates.latitude / precision) * precision
        const lng = Math.round(coordinates.longitude / precision) * precision
        const zoomLevel = Math.floor(zoom / 3) * 3 // 将缩放级别分组，每3级一组，进一步扩大范围
        
        return `${lat.toFixed(4)},${lng.toFixed(4)},${zoomLevel}`
    }, [])

    // 异步获取 Google Maps placeId 的通用函数
    const getPlaceIdAsync = useCallback(async (coordinates: { latitude: number; longitude: number }) => {
        try {
            console.log('🔍 开始获取坐标的 placeId:', coordinates)
            
            // 检查是否有 Google Maps API 密钥
            const googleApiKey = config.map.google.accessToken
            if (!googleApiKey || googleApiKey === 'your_google_api_key_here') {
                console.log('⚠️ Google Maps API 密钥未配置，跳过 placeId 获取')
                return
            }
            
            // 获取当前缩放级别
            const currentZoom = mapRef.current?.getZoom?.() || 11
            
            // 生成缓存键
            const cacheKey = generateCacheKey(coordinates, currentZoom)
            
            // 检查缓存
            if (placeCacheRef.current[cacheKey]) {
                const cachedData = placeCacheRef.current[cacheKey]
                console.log('✅ 使用缓存的地点信息:', cachedData)
                setCurrentPlaceName(cachedData.name)
                if (cachedData.address) {
                    setCurrentPlaceAddress(cachedData.address)
                }
                return
            }
            
            // 如果 Google Maps API 未加载，先动态加载
            if (!window.google || !window.google.maps) {
                console.log('Google Maps API 未加载，尝试动态加载...')
                try {
                    await loadGoogleMapsForSearch(googleApiKey)
                } catch (loadError) {
                    console.error('无法加载 Google Maps API:', loadError)
                    return
                }
            }
            
            // 获取基本 placeId 信息
            const placeIdResult = await getPlaceIdFromCoordinates(
                coordinates.latitude, 
                coordinates.longitude, 
                googleApiKey
            )
            
            if (placeIdResult.placeId) {
                console.log('✅ 找到 placeId:', placeIdResult.placeId)
                console.log('📍 地点信息:', {
                    placeId: placeIdResult.placeId,
                    name: placeIdResult.name,
                    address: placeIdResult.address,
                    types: placeIdResult.types
                })
                
                // 尝试获取更详细的信息
                const detailedResult = await getPlaceDetailsFromCoordinates(
                    coordinates.latitude, 
                    coordinates.longitude, 
                    googleApiKey
                )
                
                let finalPlaceName = ''
                
                if (detailedResult.placeId) {
                    console.log('🏢 详细地点信息:', detailedResult)
                    
                    // 优先使用详细的地点名称
                    if (detailedResult.name) {
                        finalPlaceName = detailedResult.name
                    } else if (placeIdResult.name) {
                        // 如果没有详细名称，使用基本地理编码结果
                        finalPlaceName = placeIdResult.name
                    }
                } else {
                    // 如果没有详细信息，使用基本地理编码结果
                    if (placeIdResult.name) {
                        finalPlaceName = placeIdResult.name
                    }
                }
                
                // 更新 popup title 和地址
                if (finalPlaceName) {
                    setCurrentPlaceName(finalPlaceName)
                }
                
                // 设置地址信息
                let finalAddress = ''
                if (detailedResult.address) {
                    finalAddress = detailedResult.address
                    setCurrentPlaceAddress(detailedResult.address)
                } else if (placeIdResult.address) {
                    finalAddress = placeIdResult.address
                    setCurrentPlaceAddress(placeIdResult.address)
                }
                
                // 存储到缓存
                if (finalPlaceName) {
                    placeCacheRef.current[cacheKey] = {
                        name: finalPlaceName,
                        address: finalAddress || undefined
                    }
                    console.log('💾 地点信息已缓存:', { name: finalPlaceName, address: finalAddress })
                }
            } else {
                console.log('❌ 未找到 placeId')
                // 如果没有找到 placeId，清除地点名称
                setCurrentPlaceName(undefined)
            }
        } catch (error) {
            console.error('❌ 获取 placeId 时出错:', error)
        }
    }, [])

    const handleMapClick = useCallback(async (event: any, placeInfo?: { name: string; address: string; placeId: string }, clickPosition?: { x: number; y: number }, isMarkerClick?: boolean) => {
        // 直接从store获取最新状态，避免闭包中的旧状态
        const currentState = useMapStore.getState()
        const currentSidebarOpen = currentState.interactionState.isSidebarOpen
        const currentSelectedMarkerId = currentState.interactionState.selectedMarkerId
        
        try {
            // 对于 Google Maps，显示自定义 Popup
            if (config.map.provider === 'google') {
                // Google Provider 传递的是 coordinates 对象，不是 event 对象
                if (event && event.latitude && event.longitude) {
                    // 当右侧栏打开时，首次点击仅关闭右侧栏
                    if (currentSidebarOpen) {
                        handleCloseSidebar()
                        return
                    }
                    
                    // 检查是否是点击Google Maps自带的clickable marker
                    const isGoogleMarkerClick = placeInfo && placeInfo.placeId
                    
                    if (isGoogleMarkerClick) {
                        // 点击Google Maps自带的clickable marker，显示对应的popup
                        googlePopupVisibleRef.current = true
                        
                        setGooglePopupCoordinates({
                            latitude: event.latitude,
                            longitude: event.longitude
                        })
                        setGooglePopupPlaceInfo(placeInfo)
                        setGooglePopupClickPosition(clickPosition || null)
                        setGooglePopupIsMarkerClick(true)
                        setGooglePopupVisible(true)
                        return
                    }
                    
                    // 如果popup已经显示，点击空白区域时隐藏它
                    if (googlePopupVisibleRef.current) {
                        handleCloseGooglePopup()
                        return
                    }
                    // 更新ref状态
                    googlePopupVisibleRef.current = true
                    
                    setGooglePopupCoordinates({
                        latitude: event.latitude,
                        longitude: event.longitude
                    })
                    setGooglePopupPlaceInfo(placeInfo || null)
                    setGooglePopupClickPosition(clickPosition || null)
                    setGooglePopupIsMarkerClick(isMarkerClick || false)
                    setGooglePopupVisible(true)
                }
                return
            }

            // 对于 Mapbox，保持原有的处理逻辑
            // Prevent map click when clicking on markers
            if (event.originalEvent?.target &&
                (event.originalEvent.target as HTMLElement).closest('.map-marker')) {
                return
            }

            // Prevent map click when clicking on popup
            if (event.originalEvent?.target &&
                (event.originalEvent.target as HTMLElement).closest('.map-popup')) {
                return
            }

            // Mapbox 事件对象格式
            let coordinates: MarkerCoordinates
            if (event.lngLat && event.lngLat.lat !== undefined && event.lngLat.lng !== undefined) {
                coordinates = {
                    latitude: event.lngLat.lat,
                    longitude: event.lngLat.lng,
                }
            } else {
                console.warn('Mapbox click event missing lngLat:', event)
                return
            }

            // 当右侧栏打开时，首次点击仅关闭右侧栏
            if (isSidebarOpen) {
                handleCloseSidebar()
                return
            }

            // If popup is open, close it and clear selected marker
            if (isPopupOpen) {
                closePopup()
                // 清除选中的标记状态
                selectMarker(null)
            } else {
                // 如果有选中的标记，只清除选中状态，不打开添加popup
                if (selectedMarkerId) {
                    selectMarker(null)
                } else {
                    // 清除之前的地点名称和地址，避免显示缓存的结果
                    setCurrentPlaceName(undefined)
                    setCurrentPlaceAddress(undefined)
                    
                    // 没有选中标记时，打开添加新标记的popup
                    openPopup(coordinates, placeInfo?.name, placeInfo)
                    
                    // 只有在显示 popup 时才异步获取 placeId
                    getPlaceIdAsync(coordinates)
                }
            }
        } catch (err) {
            console.error('Map click error:', err)
            // 不设置严重错误，只是控制台输出
        }
    }, [isPopupOpen, isSidebarOpen, openPopup, closePopup, closeSidebar, selectMarker, selectedMarkerId, handleCloseGooglePopup])

    const handleMarkerClick = useCallback((markerId: string) => {
        try {
            const marker = markers.find(m => m.id === markerId)
            if (!marker) return

            // 关闭可能存在的弹窗
            closePopup()
            
            // 关闭Google Maps popup（如果存在）
            if (config.map.provider === 'google' && googlePopupVisibleRef.current) {
                handleCloseGooglePopup()
            }

            // 检查是否处于添加模式 - 通过自定义事件获取状态
            let isAddingMode = false
            const checkEvent = new CustomEvent('checkAddingMode', {
                detail: { callback: (result: boolean) => { isAddingMode = result } }
            })
            window.dispatchEvent(checkEvent)

            // 等待回调执行
            setTimeout(() => {
                if (isAddingMode) {
                    // 触发添加标记事件
                    const addEvent = new CustomEvent('addMarkerToChain', {
                        detail: { markerId }
                    })
                    window.dispatchEvent(addEvent)
                    return
                }

                // 选择标记并打开右侧详情栏
                selectMarker(markerId)
                openSidebar()
            }, 0)
        } catch (err) {
            console.error('Marker click error:', err)
        }
    }, [markers, selectMarker, openSidebar, closePopup, handleCloseGooglePopup])

    const handleAddMarker = useCallback((placeName?: string) => {
        try {
            if (!popupCoordinates) return

            // 打开新增弹窗而不是直接添加marker，传递地点名称
            openAddMarkerModal(popupCoordinates, placeName)
        } catch (err) {
            console.error('Add marker error:', err)
        }
    }, [popupCoordinates, openAddMarkerModal])

    const handleEditMarker = useCallback((markerId: string) => {
        try {
            // 打开编辑弹窗而不是直接选择marker
            openEditMarkerModal(markerId)
        } catch (err) {
            console.error('Edit marker error:', err)
        }
    }, [openEditMarkerModal])

    const handleDeleteMarker = useCallback((markerId: string) => {
        try {
            const { deleteMarker } = useMapStore.getState()
            deleteMarker(markerId)
            closePopup()
        } catch (err) {
            console.error('Delete marker error:', err)
        }
    }, [closePopup])

    const handleSaveNewMarker = useCallback(async (data: {
        coordinates: MarkerCoordinates
        name: string
        iconType: MarkerIconType
    }) => {
        try {
            const markerId = await createMarkerFromModal(data)
            
            // 创建标记后不再自动打开编辑模态框
        } catch (err) {
            console.error('Save new marker error:', err)
        }
    }, [createMarkerFromModal, openEditMarkerModal])

    const handleUpdateMarker = useCallback((data: {
        markerId: string
        title?: string
        headerImage?: string
        markdownContent: string
    }) => {
        try {
            updateMarkerFromModal(data)
        } catch (err) {
            console.error('Update marker error:', err)
        }
    }, [updateMarkerFromModal])

    const handleRetry = useCallback(() => {
        setError(null)
        setLoadingRetryCount(0)
        setDataLoaded(false) // 重置数据加载状态
        // 重新尝试加载数据
        loadMarkersFromDataset().then(() => {
            setDataLoaded(true)
        }).catch(error => {
            console.error('重试加载失败:', error)
            setError('加载失败，请检查网络连接')
        })
    }, [loadMarkersFromDataset])

    // 检查 access token 是否设置
    if (!mapConfig.accessToken) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-yellow-50">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                    <div className="text-yellow-500 text-6xl mb-4">🔑</div>
                    <h2 className="text-xl font-semibold text-yellow-800 mb-2">地图配置缺失</h2>
                    <p className="text-yellow-600 mb-4">
                        请设置地图 API Key：
                    </p>
                    <div className="text-left bg-gray-100 p-4 rounded text-sm">
                        {config.map.provider === 'mapbox' ? (
                            <div>
                                <p className="font-semibold mb-2">Mapbox 配置：</p>
                                <p>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token</p>
                                <p className="text-xs text-gray-500 mt-2">
                                    获取 token: <a href="https://account.mapbox.com/access-tokens/" target="_blank" className="text-blue-500">https://account.mapbox.com/access-tokens/</a>
                                </p>
                            </div>
                        ) : config.map.provider === 'google' ? (
                            <div>
                                <p className="font-semibold mb-2">Google Maps 配置：</p>
                                <p>NEXT_PUBLIC_GOOGLE_ACCESS_TOKEN=your_google_api_key</p>
                                <p className="text-xs text-gray-500 mt-2">
                                    获取 API Key: <a href="https://console.cloud.google.com/" target="_blank" className="text-blue-500">Google Cloud Console</a>
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p className="font-semibold mb-2">当前提供者：{config.map.provider}</p>
                                <p>请设置相应的 API Key</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // 只有地图本身加载失败才显示错误页面
    if (error && !mapInitialized) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-red-50">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                    <div className="text-red-500 text-6xl mb-4">⚠️</div>
                    <h2 className="text-xl font-semibold text-red-800 mb-2">地图加载错误</h2>
                    <p className="text-red-600 mb-4">{error}</p>
                    <div className="space-y-2">
                        <button
                            onClick={handleRetry}
                            className="block w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        >
                            重试
                        </button>
                        <p className="text-xs text-gray-500">
                            如果问题持续，请检查地图配置是否有效
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full h-screen full-height map-container relative">
            {/* 数据加载指示器（非阻塞） */}
            {isLoading && (
                <div className="absolute top-4 right-4 z-50 bg-blue-600 text-white px-3 py-2 rounded-md shadow-lg">
                    <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span className="text-sm">同步中...</span>
                    </div>
                </div>
            )}

            {/* 数据加载错误通知（非阻塞） */}
            {storeError && mapInitialized && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-amber-500 text-white px-4 py-2 rounded-md shadow-lg flex items-center space-x-2">
                    <span className="text-sm">⚠️ {storeError}</span>
                    <button
                        onClick={() => clearError()}
                        className="text-white hover:text-amber-200"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* 重试提示（数据加载失败时） */}
            {loadingRetryCount > 0 && loadingRetryCount < 3 && (
                <div className="absolute top-16 right-4 z-50 bg-gray-600 text-white px-3 py-2 rounded-md shadow-lg text-sm">
                    数据加载重试中... ({loadingRetryCount}/3)
                </div>
            )}

            {/* 城市快速跳转（可折叠） */}
            <div className="absolute left-4 top-4 z-50">
                <div className="flex flex-col items-start space-y-2">
                    {/* 标记按钮：打开左侧栏（标记列表） */}
                    <button
                        onClick={toggleLeftSidebar}
                        className={cn(
                            'w-12 h-12 rounded-full shadow-lg border border-gray-200 bg-white',
                            'flex items-center justify-center',
                            'hover:bg-blue-50 hover:border-blue-300 transition-all duration-200',
                            'focus:outline-none'
                        )}
                        aria-label="打开标记列表"
                        title="打开标记列表"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>

                    {/* 搜索悬浮按钮：打开半屏浮层 */}
                    <button
                        onClick={() => setIsSearchFabOpen(true)}
                        className={cn(
                            'w-12 h-12 rounded-full shadow-lg border border-gray-200 bg-white',
                            'flex items-center justify-center',
                            'hover:bg-blue-50 hover:border-blue-300 transition-all duration-200',
                            'focus:outline-none'
                        )}
                        aria-label="查找或跳转"
                        title="查找或跳转"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>

                    {/* 城市快速跳转按钮 */}
                    <button
                        onClick={() => setIsCityListOpen(!isCityListOpen)}
                        className={cn(
                            'w-12 h-12 rounded-full shadow-lg border border-gray-200 bg-white',
                            'flex items-center justify-center',
                            'hover:bg-blue-50 hover:border-blue-300 transition-all duration-200',
                            'focus:outline-none'
                        )}
                        aria-expanded={isCityListOpen}
                        aria-label={isCityListOpen ? '收起城市快速跳转' : '展开城市快速跳转'}
                        title={isCityListOpen ? '收起城市快速跳转' : '展开城市快速跳转'}
                    >
                        {isCityListOpen ? (
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        )}
                    </button>

                    {/* 城市列表：向下展开 */}
                    <div className={cn(
                        'overflow-hidden transition-all duration-300 ease-out',
                        isCityListOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                    )}>
                        <div className="flex flex-col items-start space-y-2 mt-2">
                            {Object.entries(config.cities).map(([cityKey, city]) => (
                                <button
                                    key={cityKey}
                                    onClick={() => handleCityJump(cityKey as keyof typeof config.cities)}
                                    className={cn(
                                        'px-4 py-2 bg-white rounded-lg shadow-lg border border-gray-200',
                                        'text-sm font-medium text-gray-700',
                                        'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700',
                                        'transition-all duration-200',
                                        'focus:outline-none',
                                        'flex items-center space-x-2',
                                        'transform transition-transform duration-200',
                                        isCityListOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                                    )}
                                    style={{
                                        transitionDelay: isCityListOpen ? `${Object.keys(config.cities).indexOf(cityKey) * 50}ms` : '0ms'
                                    }}
                                    title={`跳转到${city.name}`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>{city.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 左侧边栏 */}
            <LeftSidebar onFlyTo={handleFlyTo} />

            {/* 右侧详情栏 */}
            <Sidebar />

            {/* 根据配置渲染对应的地图组件 */}
            {config.map.provider === 'google' ? (
                <>
                    <GoogleMap
                        config={mapConfig}
                        markers={markers}
                        onMapClick={handleMapClick}
                        onMarkerClick={handleMarkerClick}
                        onMapLoad={handleMapLoad}
                        onMapInstanceReady={(mapInstance) => {
                            setGoogleMapInstance(mapInstance)
                            // 设置mapRef为Google地图实例
                            mapRef.current = mapInstance
                        }}
                        onMapMove={(viewState) => {
                            // 使用通用位置保存函数
                            saveViewState({
                                longitude: viewState.longitude,
                                latitude: viewState.latitude,
                                zoom: viewState.zoom,
                                bearing: 0, // Google Maps 不支持 bearing
                                pitch: 0,  // Google Maps 不支持 pitch
                            })
                        }}
                        initialViewState={{
                            longitude: viewState.longitude,
                            latitude: viewState.latitude,
                            zoom: viewState.zoom
                        }}
                        onMapError={(error: Error) => {
                            if (error.message?.includes('API key') || error.message?.includes('Unauthorized')) {
                                setError('Google Maps API Key 无效，请检查配置')
                            } else {
                                setError('Google Maps 初始化失败')
                            }
                        }}
                        style={{ 
                            width: '100%', 
                            height: '100%'
                        }}
                    />
                    
                </>
            ) : (
                <MapboxMapComponent
                    ref={mapRef}
                    viewState={viewState}
                    onMove={(evt) => {
                        setViewState(evt.viewState)
                        // 使用通用位置保存函数
                        saveViewState({
                            longitude: evt.viewState.longitude,
                            latitude: evt.viewState.latitude,
                            zoom: evt.viewState.zoom,
                            bearing: evt.viewState.bearing,
                            pitch: evt.viewState.pitch,
                        })
                    }}
                    onLoad={handleMapLoad}
                    onClick={handleMapClick}
                    mapboxAccessToken={mapConfig.accessToken}
                    mapStyle={mapProvider.getMapStyle(mapConfig)}
                    reuseMaps
                    attributionControl={false}
                    logoPosition="bottom-left"
                    doubleClickZoom={false}
                    style={{ 
                        width: '100%', 
                        height: '100%'
                    }}
                    onError={(event) => {
                        console.error('Map error:', event)
                        if (event.error?.message?.includes('Unauthorized') || event.error?.message?.includes('Invalid Token')) {
                            setError('地图token无效，请检查配置')
                        } else {
                            setError('地图初始化失败')
                        }
                    }}
                >
                {/* Render connection lines */}
                <ConnectionLines markers={markers} zoom={viewState.zoom} />

                {/* Render existing markers - 添加安全检查 */}
                {markers && markers.length > 0 && markers.map((marker) => {
                    // 确保marker有必要的属性
                    if (!marker || !marker.id || !marker.coordinates) {
                        return null
                    }

                    return (
                        <MapboxMarker
                            key={marker.id}
                            longitude={marker.coordinates.longitude}
                            latitude={marker.coordinates.latitude}
                            anchor="center"
                        >
                            <MapMarker
                                marker={marker}
                                isSelected={marker.id === selectedMarkerId}
                                onClick={() => handleMarkerClick(marker.id)}
                                zoom={viewState.zoom}
                            />
                        </MapboxMarker>
                    )
                })}

                {/* Render popup：仅用于空白处添加标记，不再用于标记操作 */}
                {isPopupOpen && popupCoordinates && (
                    <MapPopup
                        coordinates={popupCoordinates}
                        selectedMarkerId={selectedMarkerId}
                        onAddMarker={handleAddMarker}
                        onEditMarker={handleEditMarker}
                        onDeleteMarker={handleDeleteMarker}
                        onClose={closePopup}
                        placeName={currentPlaceName}
                        placeAddress={currentPlaceAddress}
                    />
                )}
                </MapboxMapComponent>
            )}

            {/* 右下角：搜索侧边栏（桌面端右侧弹出，移动端半屏） */}
            {isSearchFabOpen && (
                <div className="fixed inset-0 z-[60]">
                    <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setIsSearchFabOpen(false)} />
                    <div className={cn(
                        'absolute bg-white shadow-2xl flex flex-col',
                        // 移动端：下半屏显示，全宽
                        'right-0 bottom-0 h-[50vh] w-full animate-slide-in-bottom',
                        // PC端：正常右侧显示
                        'lg:right-0 lg:top-0 lg:bottom-0 lg:w-80 lg:h-auto lg:max-w-sm lg:animate-slide-in-right'
                    )} style={{ 
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
                    }}>
                        <div className="w-full flex items-center justify-center py-2 lg:hidden">
                            <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
                        </div>
                        <div className="px-4 py-3 border-b border-gray-200 bg-blue-50 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900">搜索</h3>
                                </div>
                                <button
                                    onClick={() => setIsSearchFabOpen(false)}
                                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 min-h-0">
                            <div className="space-y-6">
                                {/* 坐标跳转 - 上方 */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-gray-800 flex items-center">
                                        <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                        坐标跳转
                                    </h4>
                                    <div className="relative">
                                        <input type="text" value={fabCoordInput} onChange={(e) => { setFabCoordInput(e.target.value); if (fabCoordError) setFabCoordError('') }} onKeyDown={(e) => { if (e.key === 'Enter') handleFabCoordinateJump() }} placeholder="输入坐标，如: 35.452, 139.638" className={cn('w-full h-9 pl-9 pr-12 border rounded-md text-sm', fabCoordError ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500', 'focus:outline-none transition-colors duration-200')} />
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            </svg>
                                        </div>
                                        <button onClick={handleFabCoordinateJump} className={cn('absolute right-2 top-1/2 -translate-y-1/2', 'px-2 py-1 text-xs font-medium rounded', 'bg-blue-600 text-white hover:bg-blue-700', 'focus:outline-none', 'transition-colors duration-200')}>跳转</button>
                                    </div>
                                    {fabCoordError && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{fabCoordError}</div>}
                                </div>

                                {/* 地点搜索 - 下方 */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-gray-800 flex items-center">
                                        <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        地点搜索
                                    </h4>
                                    <div className="relative">
                                        <input type="text" value={fabQuery} onChange={(e) => { setFabQuery(e.target.value); if (fabQueryError) setFabQueryError(''); if (e.target.value.trim() === '') setFabResults([]) }} onKeyDown={(e) => { if (e.key === 'Enter') handleFabSearch() }} placeholder="输入关键字，如：东京" className={cn('w-full h-9 pl-9 pr-12 border rounded-md text-sm', fabQueryError ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500', 'focus:outline-none transition-colors duration-200')} />
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                        <button onClick={handleFabSearch} className={cn('absolute right-2 top-1/2 -translate-y-1/2', 'px-2 py-1 text-xs font-medium rounded', 'bg-blue-600 text-white hover:bg-blue-700', 'focus:outline-none', 'transition-colors duration-200')}>搜索</button>
                                    </div>
                                    {fabQueryError && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{fabQueryError}</div>}
                                    {fabResults.length > 0 && (
                                        <div className="space-y-2 animate-pop-in">
                                            {fabResults.map((r: any, idx: number) => (
                                                <button key={`${r.name}-${idx}`} onClick={() => handleFabResultClick(r)} className={cn('w-full p-3 bg-white rounded-lg border border-gray-200', 'hover:border-blue-300 hover:shadow-md', 'transition-all duration-200', 'focus:outline-none', 'text-left')}>
                                                    <div className="flex items-start space-x-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-sm font-medium text-gray-900 truncate">{r.name}</h4>
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-1 truncate">{r.coordinates?.latitude?.toFixed?.(6)}, {r.coordinates?.longitude?.toFixed?.(6)}</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* 新增标记弹窗 */}
            <AddMarkerModal
                coordinates={addMarkerModal.coordinates || { latitude: 0, longitude: 0 }}
                isOpen={addMarkerModal.isOpen}
                onClose={closeAddMarkerModal}
                onSave={handleSaveNewMarker}
                placeName={addMarkerModal.placeName || undefined}
                placeAddress={currentPlaceAddress}
            />

            {/* 编辑标记弹窗 */}
            <EditMarkerModal
                marker={editMarkerModal.markerId ? markers.find(m => m.id === editMarkerModal.markerId) || null : null}
                isOpen={editMarkerModal.isOpen}
                onClose={closeEditMarkerModal}
                onSave={handleUpdateMarker}
            />

            {/* Google Map 自定义 Popup */}
            {config.map.provider === 'google' && googlePopupVisible && googlePopupCoordinates && (
                <GoogleMapPopup
                        coordinates={googlePopupCoordinates}
                        isVisible={googlePopupVisible}
                        onClose={handleCloseGooglePopup}
                        onAddMarker={handleGooglePopupAddMarker}
                        placeId={googlePopupPlaceInfo?.placeId}
                        placeName={googlePopupPlaceInfo?.name}
                        clickPosition={googlePopupClickPosition || undefined}
                        isMarkerClick={googlePopupIsMarkerClick}
                        mapInstance={googleMapInstance}
                    />
            )}
        </div>
    )
}


// Mapbox组件包装器
interface MapboxMapComponentProps {
    ref: React.Ref<MapRef>
    viewState: ViewState
    onMove: (evt: any) => void
    onLoad: () => void
    onClick: (event: any) => void
    mapboxAccessToken: string
    mapStyle: string
    reuseMaps: boolean
    attributionControl: boolean
    logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right"
    doubleClickZoom: boolean
    style: React.CSSProperties
    onError: (event: any) => void
    children: React.ReactNode
}

const MapboxMapComponent = React.forwardRef<MapRef, MapboxMapComponentProps>((props, ref) => {
    const { viewState, ...restProps } = props
    return (
        <ReactMapProvider>
            <Map
                ref={ref}
                {...restProps}
                initialViewState={viewState}
            />
        </ReactMapProvider>
    )
})

MapboxMapComponent.displayName = 'MapboxMapComponent'
