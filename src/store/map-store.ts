import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Marker, MarkerCoordinates, MarkerIconType, MapInteractionState, DetailedPlaceInfo } from '@/types/marker'
import { v4 as uuidv4 } from 'uuid'

interface MapStore {
    // State
    markers: Marker[]
    interactionState: MapInteractionState
    isLoading: boolean
    error: string | null

    // 新增弹窗状态
    addMarkerModal: {
        isOpen: boolean
        coordinates: MarkerCoordinates | null
        placeName: string | null
    }

    // 编辑弹窗状态
    editMarkerModal: {
        isOpen: boolean
        markerId: string | null
    }

    // 左侧边栏状态
    leftSidebar: {
        isOpen: boolean
    }

    // 编辑模式状态
    editMode: {
        isEnabled: boolean
    }


    // Actions
    addMarker: (coordinates: MarkerCoordinates, content?: string) => string
    createMarkerFromModal: (data: {
        coordinates: MarkerCoordinates
        name: string
        iconType: MarkerIconType
    }) => Promise<string>
    updateMarker: (markerId: string, updates: Partial<Marker>) => void
    updateMarkerFromModal: (data: {
        markerId: string
        title?: string
        headerImage?: string
        markdownContent: string
    }) => void
    deleteMarker: (markerId: string) => void
    selectMarker: (markerId: string | null) => void

    // Popup actions
    openPopup: (coordinates: MarkerCoordinates, placeName?: string, placeInfo?: DetailedPlaceInfo) => void
    closePopup: () => void
    updatePlaceInfo: (placeInfo: DetailedPlaceInfo) => void

    // 新增弹窗 actions
    openAddMarkerModal: (coordinates: MarkerCoordinates, placeName?: string) => void
    closeAddMarkerModal: () => void

    // 编辑弹窗 actions
    openEditMarkerModal: (markerId: string) => void
    closeEditMarkerModal: () => void

    // 左侧边栏 actions
    openLeftSidebar: () => void
    closeLeftSidebar: () => void
    toggleLeftSidebar: () => void

    // 编辑模式 actions
    setEditMode: (enabled: boolean) => void
    toggleEditMode: () => void


    // Sidebar actions
    openSidebar: () => void
    closeSidebar: () => void

    // Editor actions
    updateMarkerContent: (markerId: string, content: { title?: string; headerImage?: string; markdownContent: string; next?: string[] }) => void

    // Chain highlight actions
    setHighlightedChain: (chainIds: string[]) => void
    clearHighlightedChain: () => void

    // Dataset actions
    saveMarkerToDataset: (marker: Marker) => Promise<void>
    loadMarkersFromDataset: () => Promise<void>
    deleteMarkerFromDataset: (markerId: string) => Promise<void>
    clearError: () => void

    setLoading: (loading: boolean) => void
}

// 检查是否在服务器端API路由中运行
const isServerSideAPIRoute = (): boolean => {
    return typeof window === 'undefined'
}

// 保存标记到 Dataset
const saveMarkerToDataset = async (marker: Marker) => {
    // 如果在服务器端API路由中运行，跳过保存以避免循环调用
    if (isServerSideAPIRoute()) {
        console.log('跳过服务器端的Dataset保存，避免循环调用')
        return
    }

    const properties = {
        markdownContent: marker.content.markdownContent,
        headerImage: marker.content.headerImage || null,
        iconType: marker.content.iconType || 'location', // 添加iconType支持
        next: marker.content.next || [], // 添加next字段支持
        metadata: {
            id: marker.id,
            title: marker.content.title || '新标记',
            description: '用户创建的标记',
            createdAt: marker.content.createdAt.toISOString(),
            updatedAt: marker.content.updatedAt.toISOString(),
            isPublished: true,
        },
    }

    const response = await fetch(`/api/dataset?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            featureId: marker.id,
            coordinates: marker.coordinates,
            properties,
        }),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`保存失败: ${errorData.error || response.status}`)
    }

    return response.json()
}

export const useMapStore = create<MapStore>()(
    devtools(
        (set, get) => ({
            // Initial state
            markers: [],
            interactionState: {
                selectedMarkerId: null,
                displayedMarkerId: null,
                isPopupOpen: false,
                isSidebarOpen: false,
                pendingCoordinates: null,
                popupCoordinates: null,
                placeName: null,
                highlightedChainIds: [],
            },
            isLoading: false,
            error: null,

            // 新增弹窗初始状态
            addMarkerModal: {
                isOpen: false,
                coordinates: null,
                placeName: null,
            },

            // 编辑弹窗初始状态
            editMarkerModal: {
                isOpen: false,
                markerId: null,
            },

            // 左侧边栏初始状态
            leftSidebar: {
                isOpen: false,
            },

            // 编辑模式初始状态
            editMode: {
                isEnabled: false,
            },


            // Actions
            addMarker: (coordinates, content) => {
                const markerId = uuidv4()
                const now = new Date()

                const newMarker: Marker = {
                    id: markerId,
                    coordinates,
                    content: {
                        id: uuidv4(),
                        markdownContent: content || '',
                        next: [], // 默认为空数组
                        createdAt: now,
                        updatedAt: now,
                    },
                }

                set(state => ({
                    markers: [...state.markers, newMarker],
                    interactionState: {
                        ...state.interactionState,
                        selectedMarkerId: markerId,
                        isSidebarOpen: true,
                        isPopupOpen: false,
                        pendingCoordinates: null,
                    },
                }), false, 'addMarker')

                // 异步保存到 Dataset
                const marker = get().markers.find(m => m.id === markerId)
                if (marker) {
                    get().saveMarkerToDataset(marker).catch(error => {
                        console.error('保存到 Dataset 失败:', error)
                        set({ error: '保存标记失败，请稍后重试' })
                    })
                }

                return markerId
            },

            createMarkerFromModal: async (data) => {
                const markerId = uuidv4()
                const now = new Date()

                const newMarker: Marker = {
                    id: markerId,
                    coordinates: data.coordinates,
                    content: {
                        id: uuidv4(),
                        title: data.name,
                        iconType: data.iconType,
                        markdownContent: '',
                        next: [], // 默认为空数组
                        createdAt: now,
                        updatedAt: now,
                    },
                }

                // 添加到本地状态
                set(state => ({
                    markers: [...state.markers, newMarker],
                    addMarkerModal: {
                        isOpen: false,
                        coordinates: null,
                        placeName: null,
                    },
                    interactionState: {
                        ...state.interactionState,
                        selectedMarkerId: markerId,
                        isSidebarOpen: false, // 不自动打开sidebar
                        isPopupOpen: false,
                        pendingCoordinates: null,
                    },
                }), false, 'createMarkerFromModal')

                // 异步保存到 Dataset
                try {
                    await get().saveMarkerToDataset(newMarker)
                } catch (error) {
                    console.error('保存到 Dataset 失败:', error)
                    set({ error: '保存标记失败，请稍后重试' })
                }

                return markerId
            },

            updateMarker: (markerId, updates) => {
                set(state => ({
                    markers: state.markers.map(marker =>
                        marker.id === markerId
                            ? { ...marker, ...updates, content: { ...marker.content, updatedAt: new Date() } }
                            : marker
                    ),
                }), false, 'updateMarker')

                // 异步更新到 Dataset
                const updatedMarker = get().markers.find(m => m.id === markerId)
                if (updatedMarker) {
                    get().saveMarkerToDataset(updatedMarker).catch(error => {
                        console.error('更新到 Dataset 失败:', error)
                    })
                }
            },

            updateMarkerFromModal: (data) => {
                const now = new Date()

                set(state => ({
                    markers: state.markers.map(marker =>
                        marker.id === data.markerId
                            ? {
                                ...marker,
                                content: {
                                    ...marker.content,
                                    title: data.title,
                                    headerImage: data.headerImage,
                                    markdownContent: data.markdownContent,
                                    updatedAt: now,
                                },
                            }
                            : marker
                    ),
                    editMarkerModal: {
                        isOpen: false,
                        markerId: null,
                    },
                }), false, 'updateMarkerFromModal')

                // 异步保存到 Dataset
                const marker = get().markers.find(m => m.id === data.markerId)
                if (marker) {
                    get().saveMarkerToDataset(marker).catch(error => {
                        console.error('更新到 Dataset 失败:', error)
                        set({ error: '更新标记失败，请稍后重试' })
                    })
                }
            },

            deleteMarker: (markerId) => {
                set(state => ({
                    markers: state.markers.filter(marker => marker.id !== markerId),
                    interactionState: {
                        ...state.interactionState,
                        selectedMarkerId: state.interactionState.selectedMarkerId === markerId
                            ? null
                            : state.interactionState.selectedMarkerId,
                        isSidebarOpen: false,
                    },
                }), false, 'deleteMarker')

                // 异步从 Dataset 删除
                get().deleteMarkerFromDataset(markerId).catch((error: any) => {
                    console.error('从 Dataset 删除失败:', error)
                })
            },

            selectMarker: (markerId) => {
                set(state => ({
                    interactionState: {
                        ...state.interactionState,
                        // selectedMarkerId用于控制标记的高亮状态
                        selectedMarkerId: markerId,
                        // displayedMarkerId用于在边栏中显示内容，清除选中时保持之前的内容
                        displayedMarkerId: markerId !== null ? markerId : state.interactionState.displayedMarkerId,
                        // 只有在选中新标记时才打开边栏，清除选中时保持边栏状态
                        isSidebarOpen: markerId !== null ? true : state.interactionState.isSidebarOpen,
                    },
                }), false, 'selectMarker')
            },

            openPopup: (coordinates, placeName, placeInfo) => {
                set(state => ({
                    interactionState: {
                        ...state.interactionState,
                        isPopupOpen: true,
                        popupCoordinates: coordinates,
                        pendingCoordinates: coordinates,
                        placeName: placeName || null,
                        placeInfo: placeInfo || null,
                    },
                }), false, 'openPopup')
            },

            closePopup: () => {
                set(state => ({
                    interactionState: {
                        ...state.interactionState,
                        isPopupOpen: false,
                        popupCoordinates: null,
                        placeName: null,
                        placeInfo: null,
                    },
                }), false, 'closePopup')
            },

            updatePlaceInfo: (placeInfo) => {
                set(state => ({
                    interactionState: {
                        ...state.interactionState,
                        placeInfo: placeInfo,
                        placeName: placeInfo.name, // 保持向后兼容
                    },
                }), false, 'updatePlaceInfo')
            },

            // 新增弹窗 actions
            openAddMarkerModal: (coordinates, placeName) => {
                set({
                    addMarkerModal: {
                        isOpen: true,
                        coordinates,
                        placeName: placeName || null,
                    },
                    interactionState: {
                        ...get().interactionState,
                        isPopupOpen: false, // 关闭popup
                        popupCoordinates: null,
                        placeName: placeName || null,
                    },
                }, false, 'openAddMarkerModal')
            },

            closeAddMarkerModal: () => {
                set({
                    addMarkerModal: {
                        isOpen: false,
                        coordinates: null,
                        placeName: null,
                    },
                }, false, 'closeAddMarkerModal')
            },

            // 编辑弹窗 actions
            openEditMarkerModal: (markerId) => {
                set({
                    editMarkerModal: {
                        isOpen: true,
                        markerId,
                    },
                    interactionState: {
                        ...get().interactionState,
                        isPopupOpen: false, // 关闭popup
                        popupCoordinates: null,
                    },
                }, false, 'openEditMarkerModal')
            },

            closeEditMarkerModal: () => {
                set({
                    editMarkerModal: {
                        isOpen: false,
                        markerId: null,
                    },
                }, false, 'closeEditMarkerModal')
            },

            // 左侧边栏 actions
            openLeftSidebar: () => {
                set(state => ({
                    leftSidebar: {
                        isOpen: true,
                    },
                }), false, 'openLeftSidebar')
            },

            closeLeftSidebar: () => {
                set(state => ({
                    leftSidebar: {
                        isOpen: false,
                    },
                }), false, 'closeLeftSidebar')
            },

            toggleLeftSidebar: () => {
                set(state => ({
                    leftSidebar: {
                        isOpen: !state.leftSidebar.isOpen,
                    },
                }), false, 'toggleLeftSidebar')
            },

            // 编辑模式 actions
            setEditMode: (enabled) => {
                set(state => ({
                    editMode: {
                        ...state.editMode,
                        isEnabled: enabled,
                    },
                }), false, 'setEditMode')
            },

            toggleEditMode: () => {
                set(state => ({
                    editMode: {
                        ...state.editMode,
                        isEnabled: !state.editMode.isEnabled,
                    },
                }), false, 'toggleEditMode')
            },

            openSidebar: () => {
                set(state => ({
                    interactionState: {
                        ...state.interactionState,
                        isSidebarOpen: true,
                    },
                }), false, 'openSidebar')
            },

            closeSidebar: () => {
                set(state => ({
                    interactionState: {
                        ...state.interactionState,
                        isSidebarOpen: false,
                        selectedMarkerId: null,
                    },
                }), false, 'closeSidebar')
            },

            updateMarkerContent: (markerId, content) => {
                set(state => ({
                    markers: state.markers.map(marker =>
                        marker.id === markerId
                            ? {
                                ...marker,
                                content: {
                                    ...marker.content,
                                    title: content.title,
                                    headerImage: content.headerImage,
                                    markdownContent: content.markdownContent,
                                    next: content.next !== undefined ? content.next : marker.content.next || [],
                                    updatedAt: new Date(),
                                },
                            }
                            : marker
                    ),
                }), false, 'updateMarkerContent')

                // 异步保存到 Dataset
                const marker = get().markers.find(m => m.id === markerId)
                if (marker) {
                    get().saveMarkerToDataset(marker).catch(error => {
                        console.error('保存内容到 Dataset 失败:', error)
                    })
                }
            },

            // Dataset actions
            saveMarkerToDataset: async (marker) => {
                set({ isLoading: true })
                try {
                    await saveMarkerToDataset(marker)
                } catch (error) {
                    console.error('保存到 Dataset 失败:', error)
                    throw error
                } finally {
                    set({ isLoading: false })
                }
            },

            loadMarkersFromDataset: async () => {
                set({ isLoading: true, error: null })
                try {
                    const response = await fetch(`/api/dataset?t=${Date.now()}`)

                    if (!response.ok) {
                        // 根据状态码设置不同的错误信息
                        if (response.status === 404) {
                            throw new Error('数据源未找到')
                        } else if (response.status === 401) {
                            throw new Error('访问权限不足')
                        } else if (response.status >= 500) {
                            throw new Error('服务器错误')
                        } else {
                            throw new Error(`网络错误 (${response.status})`)
                        }
                    }

                    const result = await response.json()
                    if (result.success && result.data?.features && Array.isArray(result.data.features)) {
                        const loadedMarkers: Marker[] = result.data.features
                            .filter((feature: any) => {
                                // 安全检查：确保feature有必要的属性
                                const hasValidId = feature.id || feature.properties?.metadata?.id
                                return feature &&
                                    hasValidId &&
                                    feature.geometry &&
                                    feature.geometry.coordinates &&
                                    Array.isArray(feature.geometry.coordinates) &&
                                    feature.geometry.coordinates.length >= 2 &&
                                    feature.properties
                            })
                            .map((feature: any) => {
                                try {
                                    // 安全地访问嵌套属性
                                    const coordinates = feature.geometry.coordinates
                                    const properties = feature.properties
                                    const metadata = properties.metadata || {}


                                    // 优先使用feature.id，如果没有则使用metadata.id
                                    const markerId = feature.id || metadata.id || `marker-${Date.now()}-${Math.random()}`

                                    return {
                                        id: markerId,
                                        coordinates: {
                                            latitude: coordinates[1],
                                            longitude: coordinates[0],
                                        },
                                        content: {
                                            id: metadata.id || markerId,
                                            title: metadata.title || '未命名标记',
                                            headerImage: properties.headerImage,
                                            iconType: properties.iconType, // 添加iconType
                                            markdownContent: properties.markdownContent || '',
                                            next: properties.next || [], // 处理缺失的next字段，默认为空数组
                                            createdAt: metadata.createdAt ? new Date(metadata.createdAt) : new Date(),
                                            updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : new Date(),
                                        },
                                    }
                                } catch (error) {
                                    console.warn('跳过无效的feature:', feature, error)
                                    return null
                                }
                            })
                            .filter((marker: Marker | null): marker is Marker => marker !== null)

                        set({ markers: loadedMarkers, error: null })
                    } else {
                        console.warn('Dataset 返回数据格式不正确:', result)
                        // 不设置错误，让地图正常显示
                        set({ markers: [], error: null })
                    }
                } catch (error) {
                    console.error('从 Dataset 加载失败:', error)
                    const errorMessage = error instanceof Error ? error.message : '数据加载失败'
                    set({ error: errorMessage })
                    throw error // 抛出错误供调用者处理
                } finally {
                    set({ isLoading: false })
                }
            },

            deleteMarkerFromDataset: async (markerId: string) => {
                try {
                    const response = await fetch(`/api/dataset?featureId=${markerId}`, {
                        method: 'DELETE',
                    })

                    if (!response.ok) {
                        throw new Error(`删除失败: ${response.status}`)
                    }

                } catch (error: any) {
                    console.error('从 Dataset 删除失败:', error)
                    throw error
                }
            },

            clearError: () => {
                set({ error: null }, false, 'clearError')
            },

            // Chain highlight actions
            setHighlightedChain: (chainIds) => {
                set(state => ({
                    interactionState: {
                        ...state.interactionState,
                        highlightedChainIds: chainIds,
                    },
                }), false, 'setHighlightedChain')
            },

            clearHighlightedChain: () => {
                set(state => ({
                    interactionState: {
                        ...state.interactionState,
                        highlightedChainIds: [],
                    },
                }), false, 'clearHighlightedChain')
            },

            setLoading: (loading) => {
                set({ isLoading: loading }, false, 'setLoading')
            },
        }),
        {
            name: 'map-store',
        }
    )
) 