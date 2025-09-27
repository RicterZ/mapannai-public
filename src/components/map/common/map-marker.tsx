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
    const iconType = marker.content.iconType || 'location'
    const iconConfig = MARKER_ICONS[iconType]

    // 从配置中读取背景色类
    const markerColor = `${MARKER_ICONS[iconType].bgClass} ${MARKER_ICONS[iconType].hoverBgClass}`

    // 当缩放级别较小时，仅显示纯色小点
    const shouldRenderAsDot = typeof zoom === 'number' && zoom < 11

    return (
        <button
            className={cn(
                'map-marker relative flex items-center justify-center',
                shouldRenderAsDot ? 'w-2.5 h-2.5 border-0' : 'w-8 h-8 border-2',
                'rounded-full border-white',
                'transition-all duration-200 ease-in-out',
                shouldRenderAsDot ? 'hover:scale-100 shadow-none' : 'hover:scale-110 shadow-lg',
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
        </button>
    )
} 