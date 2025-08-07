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
    } = useMapStore()

    const { isPopupOpen, popupCoordinates, selectedMarkerId } = interactionState

    // 地图初始化成功后设置状态
    const handleMapLoad = useCallback(() => {
        console.log('地图初始化成功')
        setMapInitialized(true)
        setError(null) // 清除可能的错误
    }, [])

    // 地图flyTo功能
    const handleFlyTo = useCallback((coordinates: { longitude: number; latitude: number }, zoom?: number) => {
        if (mapRef.current) {
            const currentZoom = zoom ?? mapRef.current.getZoom()
            mapRef.current.flyTo({
                center: [coordinates.longitude, coordinates.latitude],
                zoom: currentZoom,
                duration: 1000,
            })
        }
    }, [])

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
    }, [isPopupOpen, openPopup, closePopup, selectMarker])

    const handleMarkerClick = useCallback((markerId: string) => {
        try {
            const marker = markers.find(m => m.id === markerId)
            if (!marker) return

            // Close any existing popup first
            closePopup()

            // Select the marker and open popup
            selectMarker(markerId)
            openPopup(marker.coordinates)
        } catch (err) {
            console.error('Marker click error:', err)
        }
    }, [markers, selectMarker, openPopup, closePopup])

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
        headerImage?: string
        editorData?: any
    }) => {
        try {
            const markerId = await createMarkerFromModal(data)
            console.log('新标记已创建:', markerId, data)
        } catch (err) {
            console.error('Save new marker error:', err)
        }
    }, [createMarkerFromModal])

    const handleUpdateMarker = useCallback((data: {
        markerId: string
        title?: string
        headerImage?: string
        editorData: any
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
        <div className="w-full h-screen relative">
            {/* 左侧边栏切换按钮 */}
            <button
                onClick={toggleLeftSidebar}
                className={cn(
                    'left-sidebar-toggle absolute top-4 left-4 z-50',
                    'w-12 h-12 bg-white rounded-lg shadow-xl border border-gray-200',
                    'flex items-center justify-center',
                    'hover:bg-blue-50 hover:border-blue-300 transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                    leftSidebar.isOpen && 'left-[336px] bg-blue-50 border-blue-300'
                )}
                aria-label="切换搜索面板"
                title="搜索地点"
            >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </button>

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

            {/* 城市快速跳转按钮 */}
            <div className="absolute bottom-4 right-4 z-50 flex flex-col space-y-2">
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
                            'flex items-center space-x-2'
                        )}
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

            {/* 左侧边栏 */}
            <LeftSidebar onFlyTo={handleFlyTo} />

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
                            />
                        </MapboxMarker>
                    )
                })}

                {/* Render popup */}
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