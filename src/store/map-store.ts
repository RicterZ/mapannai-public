import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Marker, MarkerCoordinates, MarkerIconType, MapInteractionState, DetailedPlaceInfo } from '@/types/marker'
import { Trip, TripDay, ActiveView } from '@/types/trip'
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

    // ── Trip 系统 ──────────────────────────────────
    trips: Trip[]
    tripDays: TripDay[]
    activeView: ActiveView

    // Actions
    addMarker: (coordinates: MarkerCoordinates, content?: string) => string
    addMarkerToStore: (marker: Marker) => void
    createMarkerFromModal: (data: {
        coordinates: MarkerCoordinates
        name: string
        iconType: MarkerIconType
        address?: string
        onSynced?: (realMarkerId: string) => void
    }) => Promise<string>
    updateMarker: (markerId: string, updates: Partial<Marker>) => void
    updateMarkerFromModal: (data: {
        markerId: string
        title?: string
        headerImage?: string
        markdownContent: string
        iconType?: MarkerIconType
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

    // Chain building - update next relations in local state
    setMarkerNext: (markerId: string, nextIds: string[]) => void

    // 重试同步失败的标记
    retrySyncMarker: (markerId: string) => Promise<void>

    // ── Trip actions ───────────────────────────────
    loadTripsFromDataset: () => Promise<void>
    setActiveView: (mode: ActiveView['mode'], tripId?: string | null, dayId?: string | null) => void
    createTrip: (data: { name: string; description?: string; startDate: string; endDate: string }) => Promise<Trip>
    updateTrip: (tripId: string, data: Partial<Trip>) => Promise<void>
    deleteTrip: (tripId: string) => Promise<void>
    createTripDay: (tripId: string, data: { date: string; title?: string }) => Promise<TripDay>
    updateTripDay: (tripId: string, dayId: string, data: Partial<TripDay>) => Promise<void>
    deleteTripDay: (tripId: string, dayId: string) => Promise<void>
    addMarkerToDay: (tripId: string, dayId: string, markerId: string) => Promise<void>
    removeMarkerFromDay: (tripId: string, dayId: string, markerId: string) => Promise<void>
    reorderDayMarkers: (tripId: string, dayId: string, newOrder: string[]) => Promise<void>
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
        address: marker.content.address || null,
        iconType: marker.content.iconType || 'location',
        next: marker.content.next || [],
        tripDayEntries: marker.content.tripDayEntries || [],
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

            // ── Trip 初始状态 ──
            trips: [],
            tripDays: [],
            activeView: { mode: 'overview', tripId: null, dayId: null },

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

            addMarkerToStore: (marker) => {
                set(state => {
                    // 检查是否已存在相同ID的标记
                    const existingIndex = state.markers.findIndex(m => m.id === marker.id);
                    if (existingIndex !== -1) {
                        // 如果存在，跳过添加但返回现有标记信息
                        return state;
                    } else {
                        // 如果不存在，添加新标记
                        const next = { markers: [...state.markers, marker] } as any
                        return next;
                    }
                }, false, 'addMarkerToStore')
                
                // 返回标记信息（无论是新添加的还是已存在的）
                const currentState = get();
                const existingMarker = currentState.markers.find(m => m.id === marker.id);
                return existingMarker || marker;
            },

            createMarkerFromModal: async (data) => {
                try {
                    // 1. 立即创建临时标记（乐观更新）
                    const tempMarkerId = uuidv4()
                    const now = new Date()
                    const tempMarker: Marker = {
                        id: tempMarkerId,
                        coordinates: data.coordinates,
                        content: {
                            id: tempMarkerId,
                            title: data.name,
                            address: data.address,
                            iconType: data.iconType,
                            markdownContent: '',
                            next: [],
                            createdAt: now,
                            updatedAt: now,
                        },
                    }

                    // 2. 立即添加到本地状态，用户立即看到标记
                    set(state => ({
                        markers: [...state.markers, tempMarker],
                        addMarkerModal: {
                            isOpen: false,
                            coordinates: null,
                            placeName: null,
                        },
                        interactionState: {
                            ...state.interactionState,
                            selectedMarkerId: null,
                            isSidebarOpen: false,
                            isPopupOpen: false,
                            popupCoordinates: null,
                            pendingCoordinates: null,
                            placeName: null,
                        },
                    }), false, 'createMarkerFromModal-optimistic')

                    // 3. 异步调用API创建标记（不阻塞UI）
                    const syncMarker = async () => {
                        try {
                            const response = await fetch('/api/markers', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    coordinates: data.coordinates,
                                    title: data.name,
                                    iconType: data.iconType,
                                    address: data.address,
                                    content: '',
                                }),
                            })

                            if (!response.ok) {
                                const errorData = await response.json().catch(() => ({}))
                                throw new Error(`创建标记失败: ${errorData.error || response.status}`)
                            }

                            const result = await response.json()

                            // 4. 更新本地标记为服务器返回的最终标记（修复Date类型）
                            set(state => ({
                                markers: state.markers.map(marker =>
                                    marker.id === tempMarkerId
                                        ? {
                                            ...result,
                                            content: {
                                                ...result.content,
                                                title: data.name,
                                                address: data.address,
                                                tripDayEntries: result.content?.tripDayEntries || [],
                                                createdAt: result.content?.createdAt ? new Date(result.content.createdAt) : new Date(),
                                                updatedAt: result.content?.updatedAt ? new Date(result.content.updatedAt) : new Date(),
                                            }
                                        }
                                        : marker
                                ),
                            }), false, 'createMarkerFromModal-sync')

                            // 5. 通知调用者实际 ID（用于 day 归属等后续操作）
                            data.onSynced?.(result.id)

                            return result.id
                        } catch (error) {
                            console.error('同步标记到服务器失败:', error)
                            set(state => ({
                                markers: state.markers.map(marker =>
                                    marker.id === tempMarkerId
                                        ? {
                                            ...marker,
                                            content: {
                                                ...marker.content,
                                                isTemporary: true,
                                                syncError: error instanceof Error ? error.message : '同步失败'
                                            }
                                        }
                                        : marker
                                ),
                            }), false, 'createMarkerFromModal-error')
                            return tempMarkerId
                        }
                    }

                    // 异步执行同步，不阻塞UI
                    syncMarker().catch(() => {
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('syncMarkerFailed'))
                        }
                    })

                    return tempMarkerId
                } catch (error) {
                    console.error('创建标记失败:', error)
                    set({ 
                        error: error instanceof Error ? error.message : '创建标记失败，请稍后重试',
                        addMarkerModal: {
                            isOpen: false,
                            coordinates: null,
                            placeName: null,
                        }
                    })
                    throw error
                }
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
                                    iconType: data.iconType !== undefined ? data.iconType : marker.content.iconType,
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
                // 防止误删旅行/天数据
                if (markerId.startsWith('trip_') || markerId.startsWith('day_')) {
                    console.error('禁止通过 deleteMarker 删除旅行数据:', markerId)
                    return
                }
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
                        selectedMarkerId: markerId,
                        displayedMarkerId: markerId !== null ? markerId : state.interactionState.displayedMarkerId,
                        // 不再自动打开边栏，由调用方决定
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

            // 设置某个标记的 next 关系（用于行程链实时渲染）
            setMarkerNext: (markerId, nextIds) => {
                set(state => ({
                    markers: state.markers.map(marker =>
                        marker.id === markerId
                            ? {
                                ...marker,
                                content: {
                                    ...marker.content,
                                    next: Array.isArray(nextIds) ? nextIds : [],
                                    updatedAt: new Date(),
                                },
                            }
                            : marker
                    ),
                }), false, 'setMarkerNext')
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
                                    feature.properties &&
                                    feature.properties.featureType !== 'trip' &&
                                    feature.properties.featureType !== 'tripDay'
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
                                            address: properties.address || undefined,
                                            headerImage: properties.headerImage,
                                            iconType: properties.iconType,
                                            markdownContent: properties.markdownContent || '',
                                            next: properties.next || [],
                                            tripDayEntries: properties.tripDayEntries || [],
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

                // 同时加载旅行数据（不阻塞主流程）
                get().loadTripsFromDataset().catch(err => {
                    console.error('加载旅行数据失败:', err)
                })
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

            // 重试同步失败的标记
            retrySyncMarker: async (markerId) => {
                const state = get()
                const marker = state.markers.find(m => m.id === markerId)
                
                if (!marker || !marker.content.isTemporary) {
                    console.warn('标记不存在或不是临时标记:', markerId)
                    return
                }

                try {
                    // 清除错误状态，显示同步中
                    set(state => ({
                        markers: state.markers.map(m => 
                            m.id === markerId 
                                ? {
                                    ...m,
                                    content: {
                                        ...m.content,
                                        isTemporary: true,
                                        syncError: undefined
                                    }
                                }
                                : m
                        ),
                    }), false, 'retrySyncMarker-start')

                    // 重新调用API
                    const response = await fetch('/api/markers', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            coordinates: marker.coordinates,
                            title: marker.content.title,
                            iconType: marker.content.iconType,
                            content: marker.content.markdownContent,
                        }),
                    })

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}))
                        throw new Error(`创建标记失败: ${errorData.error || response.status}`)
                    }

                    const result = await response.json()

                    // 更新为最终标记
                    set(state => ({
                        markers: state.markers.map(m => 
                            m.id === markerId 
                                ? {
                                    ...result,
                                    content: {
                                        ...result.content,
                                        title: marker.content.title, // 保持用户输入的名称
                                    }
                                }
                                : m
                        ),
                    }), false, 'retrySyncMarker-success')

                } catch (error) {
                    console.error('重试同步失败:', error)
                    
                    // 更新错误状态
                    set(state => ({
                        markers: state.markers.map(m => 
                            m.id === markerId 
                                ? {
                                    ...m,
                                    content: {
                                        ...m.content,
                                        isTemporary: true,
                                        syncError: error instanceof Error ? error.message : '同步失败'
                                    }
                                }
                                : m
                        ),
                    }), false, 'retrySyncMarker-error')
                }
            },

            // ── Trip Actions ──────────────────────────────────────────────────

            loadTripsFromDataset: async () => {
                try {
                    const response = await fetch('/api/trips')
                    if (!response.ok) throw new Error('加载旅行失败')
                    const data = await response.json()
                    const trips = data.map((t: any) => ({ ...t, days: undefined }))
                    const tripDays = data.flatMap((t: any) => t.days || [])
                    set({ trips, tripDays }, false, 'loadTripsFromDataset')
                } catch (error) {
                    console.error('loadTripsFromDataset error:', error)
                }
            },

            setActiveView: (mode, tripId = null, dayId = null) => {
                set({ activeView: { mode, tripId, dayId } }, false, 'setActiveView')
            },

            createTrip: async (data) => {
                const response = await fetch('/api/trips', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })
                if (!response.ok) throw new Error('创建旅行失败')
                const result = await response.json()
                const trip: Trip = { ...result, days: undefined }
                const days: TripDay[] = result.days || []
                set(state => ({
                    trips: [...state.trips, trip],
                    tripDays: [...state.tripDays, ...days],
                }), false, 'createTrip')
                return trip
            },

            updateTrip: async (tripId, data) => {
                const response = await fetch(`/api/trips/${tripId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })
                if (!response.ok) throw new Error('更新旅行失败')
                const updated: Trip = await response.json()
                set(state => ({
                    trips: state.trips.map(t => t.id === tripId ? updated : t),
                }), false, 'updateTrip')
            },

            deleteTrip: async (tripId) => {
                const response = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' })
                if (!response.ok) throw new Error('删除旅行失败')

                // 收集该旅行所有天中涉及的 markerIds，用于清除 next 链接
                const state = get()
                const affectedDays = state.tripDays.filter(d => d.tripId === tripId)
                const affectedMarkerIds = new Set<string>()
                affectedDays.forEach(d => d.markerIds.forEach(id => affectedMarkerIds.add(id)))

                set(prevState => ({
                    trips: prevState.trips.filter(t => t.id !== tripId),
                    tripDays: prevState.tripDays.filter(d => d.tripId !== tripId),
                    activeView: prevState.activeView.tripId === tripId
                        ? { mode: 'overview', tripId: null, dayId: null }
                        : prevState.activeView,
                    // 清空受影响 marker 的 next 链接，使其变为孤立点
                    markers: prevState.markers.map(m =>
                        affectedMarkerIds.has(m.id) && (m.content.next?.length ?? 0) > 0
                            ? { ...m, content: { ...m.content, next: [] } }
                            : m
                    ),
                }), false, 'deleteTrip')

                // 异步将 next 清空同步到 Dataset
                const updated = get().markers.filter(m => affectedMarkerIds.has(m.id))
                updated.forEach(m => {
                    get().saveMarkerToDataset(m).catch(err =>
                        console.error('deleteTrip: 清除 next 链接失败', m.id, err)
                    )
                })
            },

            createTripDay: async (tripId, data) => {
                const response = await fetch(`/api/trips/${tripId}/days`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })
                if (!response.ok) throw new Error('新增天失败')
                const day: TripDay = await response.json()
                set(state => ({ tripDays: [...state.tripDays, day] }), false, 'createTripDay')
                return day
            },

            updateTripDay: async (tripId, dayId, data) => {
                const response = await fetch(`/api/trips/${tripId}/days/${dayId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })
                if (!response.ok) throw new Error('更新天失败')
                const updated: TripDay = await response.json()
                set(state => ({
                    tripDays: state.tripDays.map(d => d.id === dayId ? updated : d),
                }), false, 'updateTripDay')
            },

            deleteTripDay: async (tripId, dayId) => {
                const response = await fetch(`/api/trips/${tripId}/days/${dayId}`, { method: 'DELETE' })
                if (!response.ok) throw new Error('删除天失败')
                set(state => ({
                    tripDays: state.tripDays.filter(d => d.id !== dayId),
                    activeView: state.activeView.dayId === dayId
                        ? { mode: 'trip', tripId, dayId: null }
                        : state.activeView,
                }), false, 'deleteTripDay')
            },

            addMarkerToDay: async (tripId, dayId, markerId) => {
                // 1. 立即更新本地 state（optimistic）
                set(state => ({
                    tripDays: state.tripDays.map(d =>
                        d.id === dayId && !d.markerIds.includes(markerId)
                            ? { ...d, markerIds: [...d.markerIds, markerId] }
                            : d
                    ),
                    markers: state.markers.map(m =>
                        m.id === markerId
                            ? {
                                ...m,
                                content: {
                                    ...m.content,
                                    tripDayEntries: [
                                        ...(m.content.tripDayEntries || []).filter(
                                            e => !(e.tripId === tripId && e.dayId === dayId)
                                        ),
                                        { tripId, dayId },
                                    ],
                                },
                            }
                            : m
                    ),
                }), false, 'addMarkerToDay-optimistic')

                // 2. 异步持久化到服务端（失败时回滚）
                fetch(`/api/trips/${tripId}/days/${dayId}/markers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ markerId }),
                }).then(res => {
                    if (!res.ok) throw new Error('添加标记到天失败')
                }).catch(() => {
                    // 回滚
                    set(state => ({
                        tripDays: state.tripDays.map(d =>
                            d.id === dayId
                                ? { ...d, markerIds: d.markerIds.filter(id => id !== markerId) }
                                : d
                        ),
                        markers: state.markers.map(m =>
                            m.id === markerId
                                ? {
                                    ...m,
                                    content: {
                                        ...m.content,
                                        tripDayEntries: (m.content.tripDayEntries || []).filter(
                                            e => !(e.tripId === tripId && e.dayId === dayId)
                                        ),
                                    },
                                }
                                : m
                        ),
                    }), false, 'addMarkerToDay-rollback')
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('syncMarkerFailed'))
                    }
                })
            },

            removeMarkerFromDay: async (tripId, dayId, markerId) => {
                // 1. 立即更新本地 state（optimistic）
                // 同时修复 next 链接：找到当天中指向 markerId 的上游节点，
                // 将其 next 改为跳接到 markerId 的下游（保持链连续），并清空 markerId 自身的 next（day内部链接）
                set(state => {
                    const day = state.tripDays.find(d => d.id === dayId)
                    const dayMarkerIds = new Set(day?.markerIds || [])
                    const removedMarker = state.markers.find(m => m.id === markerId)
                    // markerId 在当天的下游（只保留属于当天的那个）
                    const downstream = (removedMarker?.content.next || []).find(nid => dayMarkerIds.has(nid)) || null

                    return {
                        tripDays: state.tripDays.map(d =>
                            d.id === dayId
                                ? { ...d, markerIds: d.markerIds.filter(id => id !== markerId) }
                                : d
                        ),
                        markers: state.markers.map(m => {
                            if (m.id === markerId) {
                                // 清除 markerId 自身在当天的 next 链接
                                return {
                                    ...m,
                                    content: {
                                        ...m.content,
                                        next: (m.content.next || []).filter(nid => !dayMarkerIds.has(nid)),
                                        tripDayEntries: (m.content.tripDayEntries || []).filter(
                                            e => !(e.tripId === tripId && e.dayId === dayId)
                                        ),
                                    },
                                }
                            }
                            // 上游节点：next 中包含 markerId，跳接到 downstream
                            if ((m.content.next || []).includes(markerId) && dayMarkerIds.has(m.id)) {
                                const newNext = (m.content.next || [])
                                    .filter(nid => nid !== markerId)
                                    .concat(downstream ? [downstream] : [])
                                return { ...m, content: { ...m.content, next: newNext } }
                            }
                            return m
                        }),
                    }
                }, false, 'removeMarkerFromDay-optimistic')

                // 2. 异步持久化到服务端（失败时回滚）
                fetch(`/api/trips/${tripId}/days/${dayId}/markers`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ markerId }),
                }).then(res => {
                    if (!res.ok) throw new Error('从天移除标记失败')
                    // 持久化受影响的 marker next 链接变更
                    const updatedMarkers = get().markers.filter(m =>
                        m.id === markerId || (m.content.next || []).includes(markerId)
                    )
                    updatedMarkers.forEach(m => {
                        get().saveMarkerToDataset(m).catch(err =>
                            console.error('removeMarkerFromDay: 保存 next 链接失败', m.id, err)
                        )
                    })
                }).catch(() => {
                    // 回滚
                    set(state => ({
                        tripDays: state.tripDays.map(d =>
                            d.id === dayId && !d.markerIds.includes(markerId)
                                ? { ...d, markerIds: [...d.markerIds, markerId] }
                                : d
                        ),
                        markers: state.markers.map(m =>
                            m.id === markerId
                                ? {
                                    ...m,
                                    content: {
                                        ...m.content,
                                        tripDayEntries: [
                                            ...(m.content.tripDayEntries || []).filter(
                                                e => !(e.tripId === tripId && e.dayId === dayId)
                                            ),
                                            { tripId, dayId },
                                        ],
                                    },
                                }
                                : m
                        ),
                    }), false, 'removeMarkerFromDay-rollback')
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('syncMarkerFailed'))
                    }
                })
            },

            reorderDayMarkers: async (tripId, dayId, newOrder) => {
                const response = await fetch(`/api/trips/${tripId}/days/${dayId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ markerIds: newOrder }),
                })
                if (!response.ok) throw new Error('重排顺序失败')
                set(state => ({
                    tripDays: state.tripDays.map(d =>
                        d.id === dayId ? { ...d, markerIds: newOrder } : d
                    ),
                }), false, 'reorderDayMarkers')
            },
        }),
        {
            name: 'map-store',
        }
    )
) 