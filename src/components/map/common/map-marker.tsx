'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Marker } from '@/types/marker'
import { MARKER_ICONS } from '@/types/marker'
import { cn } from '@/utils/cn'

interface MapMarkerProps {
    marker: Marker
    isSelected: boolean
    onClick: () => void
    zoom?: number
}

export const MapMarker = ({ 
    marker, 
    isSelected, 
    onClick, 
    zoom
}: MapMarkerProps) => {
    const [isHovered, setIsHovered] = useState(false)
    const iconType = marker.content.iconType || 'location'
    const iconConfig = MARKER_ICONS[iconType]

    // 从配置中读取背景色类
    const markerColor = `${MARKER_ICONS[iconType].bgClass} ${MARKER_ICONS[iconType].hoverBgClass}`

    // 当缩放级别较小时，仅显示纯色小点
    const shouldRenderAsDot = typeof zoom === 'number' && zoom < 13

    return (
        <div
            className={cn(
                'map-marker relative flex items-center justify-center',
                'w-[28px] h-[28px] border-2',
                'rounded-full border-white',
                'transition-all duration-300 ease-out',
                'origin-center', // 确保变换以中心为原点
                // 根据缩放级别调整大小
                shouldRenderAsDot ? 'scale-[0.36]' : 'scale-100', // 0.36 = 10/28，保持中心缩放
                // 增强的hover效果：放大 + 增加不透明度
                shouldRenderAsDot 
                    ? 'hover:scale-[0.36] shadow-none' 
                    : 'hover:scale-125 hover:opacity-100 shadow-lg hover:shadow-xl',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                isSelected
                    ? shouldRenderAsDot 
                        ? 'bg-blue-600 scale-[0.36] z-10' // 圆点状态时，选中圆圈也缩小
                        : 'bg-blue-600 scale-110 z-10' // 正常状态时，选中圆圈放大
                    : markerColor
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(e) => {
                e.preventDefault()
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
            {!shouldRenderAsDot && (
                <div className="w-4 h-4 flex items-center justify-center">
                    <span className="text-white text-xs filter drop-shadow-sm">
                        {iconConfig.emoji}
                    </span>
                </div>
            )}

            {/* Selection indicator */}
            {isSelected && !shouldRenderAsDot && (
                <div className="absolute -inset-1 bg-blue-400 rounded-full animate-pulse opacity-30" />
            )}

            {/* Hover effect indicator */}
            {isHovered && !shouldRenderAsDot && !isSelected && (
                <div className="absolute -inset-2 bg-white rounded-full opacity-20 animate-pulse" />
            )}
        </div>
    )
} 