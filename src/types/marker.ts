
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
    | 'food'          // 🍚 美食
    | 'landmark'      // 🌆 地标建筑
    | 'park'          // 🎡 游乐场
    | 'natural'       // 🗻 自然景观
    | 'culture'       // ⛩️ 人文景观

// 图标配置
export const MARKER_ICONS: Record<MarkerIconType, { name: string; emoji: string; description: string; bgClass: string; hoverBgClass: string }> = {
    activity: { name: '活动', emoji: '🎯', description: '活动和娱乐场所', bgClass: 'bg-orange-500/75', hoverBgClass: 'hover:bg-orange-500' },
    location: { name: '位置', emoji: '📍', description: '一般地点标记', bgClass: 'bg-pink-500/75', hoverBgClass: 'hover:bg-pink-500' },
    hotel: { name: '酒店', emoji: '🏨', description: '住宿和酒店', bgClass: 'bg-green-500/75', hoverBgClass: 'hover:bg-green-500' },
    shopping: { name: '购物', emoji: '🛍️', description: '购物中心和商店', bgClass: 'bg-purple-500/75', hoverBgClass: 'hover:bg-purple-500' },
    food: { name: '美食', emoji: '🍜', description: '美食和小吃', bgClass: 'bg-zinc-500/75', hoverBgClass: 'hover:bg-zinc-500' },
    landmark: { name: '地标', emoji: '🌆', description: '地标性建筑和知名地点', bgClass: 'bg-purple-500/75', hoverBgClass: 'hover:bg-purple-500' },
    park: { name: '游乐场', emoji: '🎡', description: '公园和游乐场', bgClass: 'bg-slate-500/75', hoverBgClass: 'hover:bg-slate-500' },
    natural: { name: '自然景观', emoji: '🗻', description: '自然景观', bgClass: 'bg-fuchsia-500/75', hoverBgClass: 'hover:bg-fuchsia-500' },
    culture: { name: '人文景观', emoji: '⛩️', description: '人文景观', bgClass: 'bg-gray-500/75', hoverBgClass: 'hover:bg-gray-500' },
}

export interface MarkerContent {
    id: string
    title?: string // 地点名称
    headerImage?: string // 首图URL
    iconType?: MarkerIconType // 图标类型
    markdownContent: string // Markdown内容
    next: string[] // 下一个标记的ID列表，默认为空数组
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
