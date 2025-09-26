'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import Map, { Marker as MapboxMarker, MapRef, ViewState } from 'react-map-gl'
import { config } from '@/lib/config'
import { useMapStore } from '@/store/map-store'
import { MarkerCoordinates } from '@/types/marker'
import { MapMarker } from './map-marker'
import { MapPopup } from './map-popup'
import { AddMarkerModal } from '@/components/modal/add-marker-modal'
import { EditMarkerModal } from '@/components/modal/edit-marker-modal'
import { LeftSidebar } from '@/components/sidebar/left-sidebar'
import { Sidebar } from '@/components/sidebar/sidebar'
import { cn } from '@/utils/cn'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MarkerIconType } from '@/types/marker'

export const InteractiveMap = () => {
    const mapRef = useRef<MapRef>(null)
    const [error, setError] = useState<string | null>(null)
    const [mapInitialized, setMapInitialized] = useState(false)
    const [loadingRetryCount, setLoadingRetryCount] = useState(0)
    const [dataLoaded, setDataLoaded] = useState(false) // 新增：防止重复加载
    const [viewState, setViewState] = useState<ViewState>({
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
    })

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
        console.log('handleCloseSidebar called', { selectedMarkerId, windowWidth: window.innerWidth })
        closeSidebar()
        
        // 在移动端关闭标记详情时，跳转到正中间（修复之前的偏移）
        if (window.innerWidth < 1024 && selectedMarkerId) {
            const marker = markers.find(m => m.id === selectedMarkerId)
            console.log('Found marker for center jump:', marker)
            if (marker && mapRef.current) {
                // 延迟执行，确保侧边栏已经关闭
                setTimeout(() => {
                    if (mapRef.current) {
                        console.log('Jumping to center:', marker.coordinates)
                        // 跳转到正中间，无偏移
                        mapRef.current.flyTo({
                            center: [marker.coordinates.longitude, marker.coordinates.latitude],
                            zoom: 15,
                            duration: 1000,
                        })
                    }
                }, 300)
            }
        }
    }, [closeSidebar, selectedMarkerId, markers, mapRef])

    // 地图初始化成功后设置状态
    const handleMapLoad = useCallback(() => {
        console.log('地图初始化成功')
        setMapInitialized(true)
        setError(null) // 清除可能的错误
    }, [])

    // 监听跳转到中心的事件
    useEffect(() => {
        const handleJumpToCenter = (event: CustomEvent) => {
            const { coordinates, zoom } = event.detail
            if (mapRef.current) {
                console.log('Received jumpToCenter event:', coordinates)
                mapRef.current.flyTo({
                    center: [coordinates.longitude, coordinates.latitude],
                    zoom: zoom || 15,
                    duration: 1000,
                })
            }
        }

        window.addEventListener('jumpToCenter', handleJumpToCenter as EventListener)
        return () => {
            window.removeEventListener('jumpToCenter', handleJumpToCenter as EventListener)
        }
    }, [])

    // 地图flyTo功能
    const handleFlyTo = useCallback((coordinates: { longitude: number; latitude: number }, zoom?: number) => {
        if (mapRef.current) {
            const currentZoom = zoom ?? mapRef.current.getZoom()
            
            // 在移动端有标记详情时，调整跳转位置
            if (window.innerWidth < 1024) {
                // 计算偏移量：在zoom 15时，需要合适的偏移量让目标位置出现在上半屏中间
                // zoom 15时，1度纬度约111km，0.01度约1.1km
                // 考虑到下半屏被遮挡，需要向下偏移约0.4km，让目标位置出现在上半屏中间
                const offset = -0.0035 // 纬度偏移量，向下偏移约0.4km
                const adjustedLatitude = coordinates.latitude + offset
                
                // 延迟执行，确保标记详情已经打开
                setTimeout(() => {
                    if (mapRef.current) {
                        mapRef.current.flyTo({
                            center: [coordinates.longitude, adjustedLatitude],
                            zoom: currentZoom,
                            duration: 1000,
                        })
                    }
                }, 100)
            } else {
                // 正常跳转
                mapRef.current.flyTo({
                    center: [coordinates.longitude, coordinates.latitude],
                    zoom: currentZoom,
                    duration: 1000,
                })
            }
        }
    }, [isSidebarOpen])

    // 城市快速跳转功能
    const handleCityJump = useCallback((cityKey: keyof typeof config.cities) => {
        const city = config.cities[cityKey]
        if (mapRef.current) {
            mapRef.current.flyTo({
                center: [city.coordinates.longitude, city.coordinates.latitude],
                zoom: city.zoom,
                duration: 1500,
            })
        }
    }, [])

    // 右下角悬浮搜索：地点搜索
    const handleFabSearch = useCallback(async () => {
        const input = fabQuery.trim()
        if (!input) {
            setFabQueryError('请输入搜索关键词')
            return
        }
        try {
            const response = await fetch(`/api/mapbox-search?q=${encodeURIComponent(input)}&limit=10`)
            const data = await response.json()
            setFabResults(Array.isArray(data?.data) ? data.data : [])
        } catch (e) {
            setFabQueryError('搜索失败，请稍后再试')
        }
    }, [fabQuery])

    const handleFabResultClick = useCallback((result: any) => {
        if (!result?.coordinates) return
        handleFlyTo({ longitude: result.coordinates.longitude, latitude: result.coordinates.latitude }, 14)
        setIsSearchFabOpen(false)
    }, [handleFlyTo])

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
        handleFlyTo({ longitude, latitude }, 14)
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
                console.log('初始数据加载成功')
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

    const handleMapClick = useCallback((event: any) => {
        try {
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

            const coordinates: MarkerCoordinates = {
                latitude: event.lngLat.lat,
                longitude: event.lngLat.lng,
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
                // Open popup for adding new marker
                openPopup(coordinates)
            }
        } catch (err) {
            console.error('Map click error:', err)
            // 不设置严重错误，只是控制台输出
        }
    }, [isPopupOpen, isSidebarOpen, openPopup, closePopup, closeSidebar, selectMarker])

    const handleMarkerClick = useCallback((markerId: string) => {
        try {
            const marker = markers.find(m => m.id === markerId)
            if (!marker) return

            // 关闭可能存在的弹窗
            closePopup()

            // 选择标记并打开右侧详情栏
            selectMarker(markerId)
            openSidebar()
        } catch (err) {
            console.error('Marker click error:', err)
        }
    }, [markers, selectMarker, openSidebar, closePopup])

    const handleAddMarker = useCallback(() => {
        try {
            if (!popupCoordinates) return

            // 打开新增弹窗而不是直接添加marker
            openAddMarkerModal(popupCoordinates)
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
            console.log('新标记已创建:', markerId, data)
            
            // 创建标记后自动打开编辑模态框
            openEditMarkerModal(markerId)
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
            console.log('标记已更新:', data.markerId)
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
                            如果问题持续，请检查 Mapbox token 是否有效
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
                    {/* 搜索悬浮按钮：打开半屏浮层 */}
                    <button
                        onClick={() => setIsSearchFabOpen(true)}
                        className={cn(
                            'w-12 h-12 rounded-full shadow-lg border border-gray-200 bg-white',
                            'flex items-center justify-center',
                            'hover:bg-blue-50 hover:border-blue-300 transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                        )}
                        aria-label="查找或跳转"
                        title="查找或跳转"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>

                    {/* 标记按钮：打开左侧栏（标记列表） */}
                    <button
                        onClick={toggleLeftSidebar}
                        className={cn(
                            'w-12 h-12 rounded-full shadow-lg border border-gray-200 bg-white',
                            'flex items-center justify-center',
                            'hover:bg-blue-50 hover:border-blue-300 transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                        )}
                        aria-label="打开标记列表"
                        title="打开标记列表"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>

                    {/* 城市快速跳转按钮 */}
                    <button
                        onClick={() => setIsCityListOpen(!isCityListOpen)}
                        className={cn(
                            'w-12 h-12 rounded-full shadow-lg border border-gray-200 bg-white',
                            'flex items-center justify-center',
                            'hover:bg-blue-50 hover:border-blue-300 transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
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
                                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
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

            <Map
                ref={mapRef}
                {...viewState}
                onMove={(evt) => setViewState(evt.viewState)}
                onLoad={handleMapLoad}
                onClick={handleMapClick}

                mapboxAccessToken={config.mapbox.accessToken}
                mapStyle={config.mapbox.style}
                reuseMaps
                attributionControl={false}
                logoPosition="bottom-left"
                doubleClickZoom={false}
                style={{ width: '100%', height: '100%' }}
                onError={(event) => {
                    console.error('Mapbox error:', event)
                    if (event.error?.message?.includes('Unauthorized') || event.error?.message?.includes('Invalid Token')) {
                        setError('Mapbox token 无效，请检查配置')
                    } else {
                        setError('地图初始化失败')
                    }
                }}
            >
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
                            anchor="bottom"
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
                    />
                )}
            </Map>
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
                                    <input type="text" value={fabCoordInput} onChange={(e) => { setFabCoordInput(e.target.value); if (fabCoordError) setFabCoordError('') }} onKeyDown={(e) => { if (e.key === 'Enter') handleFabCoordinateJump() }} placeholder="输入坐标，如: 35.452, 139.638" className={cn('w-full h-9 pl-9 pr-12 border rounded-md text-sm', fabCoordError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500', 'focus:outline-none focus:ring-2 transition-colors duration-200')} />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                    </div>
                                    <button onClick={handleFabCoordinateJump} className={cn('absolute right-2 top-1/2 -translate-y-1/2', 'px-2 py-1 text-xs font-medium rounded', 'bg-blue-600 text-white hover:bg-blue-700', 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2', 'transition-colors duration-200')}>跳转</button>
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
                                    <input type="text" value={fabQuery} onChange={(e) => { setFabQuery(e.target.value); if (fabQueryError) setFabQueryError(''); if (e.target.value.trim() === '') setFabResults([]) }} onKeyDown={(e) => { if (e.key === 'Enter') handleFabSearch() }} placeholder="输入关键字，如：东京" className={cn('w-full h-9 pl-9 pr-12 border rounded-md text-sm', fabQueryError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500', 'focus:outline-none focus:ring-2 transition-colors duration-200')} />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <button onClick={handleFabSearch} className={cn('absolute right-2 top-1/2 -translate-y-1/2', 'px-2 py-1 text-xs font-medium rounded', 'bg-blue-600 text-white hover:bg-blue-700', 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2', 'transition-colors duration-200')}>搜索</button>
                                </div>
                                {fabQueryError && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{fabQueryError}</div>}
                                {fabResults.length > 0 && (
                                    <div className="space-y-2 animate-pop-in">
                                        {fabResults.map((r: any, idx: number) => (
                                            <button key={`${r.name}-${idx}`} onClick={() => handleFabResultClick(r)} className={cn('w-full p-3 bg-white rounded-lg border border-gray-200', 'hover:border-blue-300 hover:shadow-md', 'transition-all duration-200', 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2', 'text-left')}>
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
            />

            {/* 编辑标记弹窗 */}
            <EditMarkerModal
                marker={editMarkerModal.markerId ? markers.find(m => m.id === editMarkerModal.markerId) || null : null}
                isOpen={editMarkerModal.isOpen}
                onClose={closeEditMarkerModal}
                onSave={handleUpdateMarker}
            />
        </div>
    )
} 