import { OutputData } from '@editorjs/editorjs'

export interface MarkerCoordinates {
    latitude: number
    longitude: number
}

// 图标类型定义
export type MarkerIconType =
    | 'activity'      // 🎯 活动
    | 'location'      // 📍 位置
    | 'hotel'         // 🏨 酒店
    | 'shopping'      // 🛍️ 购物

// 图标配置
export const MARKER_ICONS: Record<MarkerIconType, { name: string; emoji: string; description: string }> = {
    activity: { name: '活动', emoji: '🎯', description: '活动和娱乐场所' },
    location: { name: '位置', emoji: '📍', description: '一般地点标记' },
    hotel: { name: '酒店', emoji: '🏨', description: '住宿和酒店' },
    shopping: { name: '购物', emoji: '🛍️', description: '购物中心和商店' },
}

export interface MarkerContent {
    id: string
    title?: string // 地点名称
    headerImage?: string // 首图URL
    iconType?: MarkerIconType // 图标类型
    editorData: OutputData
    createdAt: Date
    updatedAt: Date
}

export interface Marker {
    id: string
    coordinates: MarkerCoordinates
    content: MarkerContent
}

export interface MarkerPopupActions {
    onEdit: (marker: Marker) => void
    onDelete: (markerId: string) => void
    onAdd: (coordinates: MarkerCoordinates) => void
}

export interface MapInteractionState {
    selectedMarkerId: string | null
    displayedMarkerId: string | null // 用于在边栏中显示内容的标记ID
    isPopupOpen: boolean
    isSidebarOpen: boolean
    pendingCoordinates: MarkerCoordinates | null
    popupCoordinates: MarkerCoordinates | null
}

export type MarkerAction =
    | { type: 'SELECT_MARKER'; markerId: string }
    | { type: 'DESELECT_MARKER' }
    | { type: 'OPEN_POPUP'; coordinates: MarkerCoordinates }
    | { type: 'CLOSE_POPUP' }
    | { type: 'OPEN_SIDEBAR' }
    | { type: 'CLOSE_SIDEBAR' }
    | { type: 'SET_PENDING_COORDINATES'; coordinates: MarkerCoordinates | null } 