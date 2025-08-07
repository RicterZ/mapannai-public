'use client'

import { Marker } from '@/types/marker'
import { MARKER_ICONS } from '@/types/marker'
import { cn } from '@/utils/cn'

interface MapMarkerProps {
    marker: Marker
    isSelected: boolean
    onClick: () => void
}

export const MapMarker = ({ marker, isSelected, onClick }: MapMarkerProps) => {
    const iconType = marker.content.iconType || 'location'
    const iconConfig = MARKER_ICONS[iconType]

    // 根据图标类型设置颜色
    const getMarkerColor = (iconType: string) => {
        switch (iconType) {
            case 'hotel':
                return 'bg-green-500 hover:bg-green-600'
            case 'activity':
                return 'bg-orange-500 hover:bg-orange-600'
            case 'shopping':
                return 'bg-purple-500 hover:bg-purple-600'
            case 'location':
            default:
                return 'bg-red-500 hover:bg-red-600'
        }
    }

    const markerColor = getMarkerColor(iconType)

    return (
        <button
            className={cn(
                'map-marker relative flex items-center justify-center',
                'w-8 h-8 rounded-full border-2 border-white',
                'transition-all duration-200 ease-in-out',
                'hover:scale-110 cursor-pointer shadow-lg',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                isSelected
                    ? 'bg-blue-600 scale-110 z-10'
                    : markerColor
            )}
            onClick={(e) => {
                e.stopPropagation()
                onClick()
            }}
            aria-label={`${iconConfig.name}: ${marker.content.title || '未命名标记'} at ${marker.coordinates.latitude}, ${marker.coordinates.longitude}`}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onClick()
                }
            }}
        >
            {/* 图标显示 - 使用emoji */}
            <div className="w-4 h-4 flex items-center justify-center">
                <span className="text-white text-xs filter drop-shadow-sm">
                    {iconConfig.emoji}
                </span>
            </div>

            {/* Selection indicator */}
            {isSelected && (
                <div className="absolute -inset-1 bg-blue-400 rounded-full animate-pulse opacity-30" />
            )}
        </button>
    )
} 