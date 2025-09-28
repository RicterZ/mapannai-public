'use client'

import { useEffect, useRef } from 'react'
import { Popup } from 'react-map-gl'
import { MarkerCoordinates } from '@/types/marker'
import { useMapStore } from '@/store/map-store'
import { cn } from '@/utils/cn'

interface MapPopupProps {
    coordinates: MarkerCoordinates
    selectedMarkerId: string | null
    onAddMarker: (name?: string) => void
    onEditMarker: (markerId: string) => void
    onDeleteMarker: (markerId: string) => void
    onClose: () => void
    placeName?: string // 新增：地点名称
    placeAddress?: string // 新增：地点地址
}

export const MapPopup = ({
    coordinates,
    selectedMarkerId,
    onAddMarker,
    onEditMarker,
    onDeleteMarker,
    onClose,
    placeName,
    placeAddress,
}: MapPopupProps) => {
    const popupRef = useRef<HTMLDivElement>(null)
    const { markers, editMode } = useMapStore()

    const selectedMarker = selectedMarkerId
        ? markers.find(m => m.id === selectedMarkerId)
        : null

    // Close popup when clicking outside (simplified since map handles most cases)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                // Only close if clicking outside both popup and markers
                if (!(event.target as HTMLElement).closest('.map-marker') &&
                    !(event.target as HTMLElement).closest('.mapboxgl-map')) {
                    onClose()
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    const handleAddClick = () => {
        onAddMarker(placeName)
    }

    const handleEditClick = () => {
        if (selectedMarkerId) {
            onEditMarker(selectedMarkerId)
        }
    }

    const handleDeleteClick = () => {
        if (selectedMarkerId) {
            onDeleteMarker(selectedMarkerId)
        }
    }

    return (
        <Popup
            longitude={coordinates.longitude}
            latitude={coordinates.latitude}
            anchor="top"
            closeButton={false}
            closeOnClick={false}
            closeOnMove={false}
            className="map-popup"
            maxWidth="300px"
        >
            <div
                ref={popupRef}
                className={cn(
                    'bg-white rounded-xl shadow-2xl',
                    'w-[240px] h-[140px] animate-scale-in overflow-hidden'
                )}
            >
                {selectedMarker ? (
                    editMode.isEnabled ? (
                        // 编辑模式：显示编辑/删除按钮
                        <div className="p-3 space-y-2">
                            <h3 className="text-sm font-medium text-gray-800 mb-3">
                                标记操作
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleEditClick}
                                    className={cn(
                                        'flex-1 px-3 py-2 text-sm font-medium rounded-md',
                                        'bg-blue-600 text-white hover:bg-blue-700',
                                        'transition-colors duration-200',
                                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                                    )}
                                >
                                    编辑
                                </button>
                                <button
                                    onClick={handleDeleteClick}
                                    className={cn(
                                        'flex-1 px-3 py-2 text-sm font-medium rounded-md',
                                        'bg-red-600 text-white hover:bg-red-700',
                                        'transition-colors duration-200',
                                        'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                                    )}
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                    ) : (
                        // 查看模式：显示标记头图和基本信息
                        <div className="max-w-[280px]">
                            {/* 头图显示 */}
                            {selectedMarker.content.headerImage && (
                                <div className="w-full h-32 bg-gray-100">
                                    <img
                                        src={selectedMarker.content.headerImage}
                                        alt={selectedMarker.content.title || '标记图片'}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none'
                                        }}
                                    />
                                </div>
                            )}

                            {/* 标记信息 */}
                            <div className="p-3">
                                <h3 className="text-sm font-semibold text-gray-800 mb-1">
                                    {selectedMarker.content.title || '未命名标记'}
                                </h3>
                            </div>
                        </div>
                    )
                ) : (
                    // 空白区域：重新设计的 popup
                    <div className="p-0">
                        {/* 头部区域 - 优化版 */}
                        <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-3 py-2.5 border-b border-gray-200">
                            <div className="min-w-0 space-y-1">
                                {placeName ? (
                                    <h3 className="text-sm font-semibold text-gray-900 truncate" title={placeName}>
                                        {placeName}
                                    </h3>
                                ) : (
                                    <div className="h-5 bg-gray-200 rounded animate-pulse mb-1 w-4/5"></div>
                                )}
                                
                                {placeAddress ? (
                                    <p className="text-xs text-gray-600 truncate leading-relaxed" title={placeAddress}>
                                        {placeAddress}
                                    </p>
                                ) : (
                                    <div className="h-[19.5px] bg-gray-200 rounded animate-pulse w-full mt-1"></div>
                                )}
                            </div>
                        </div>

                        {/* 内容区域 */}
                        <div className="p-2">
                            {editMode.isEnabled ? (
                                /* 编辑模式 - 优化按钮 */
                                <div className="space-y-2">
                                    <button
                                        onClick={handleAddClick}
                                        className={cn(
                                            'w-full px-3 py-1.5 text-sm font-medium rounded-lg',
                                            'bg-gradient-to-r from-blue-600 to-blue-700 text-white',
                                            'hover:from-blue-700 hover:to-blue-800',
                                            'transition-all duration-200 transform hover:scale-[1.02]',
                                            'focus:outline-none',
                                            'flex items-center justify-center gap-2 shadow-md'
                                        )}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        添加标记
                                    </button>
                                    
                                    <div className="pt-2 border-t border-gray-100">
                                        <p className="text-xs text-gray-400 font-mono text-center">
                                            {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                /* 非编辑模式 - 优化提示 */
                                <div className="text-center space-y-3">
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        点击编辑按钮，然后点击地图添加标记
                                    </p>
                                    
                                    <div className="pt-2 border-t border-gray-100">
                                        <p className="text-xs text-gray-400 font-mono">
                                            {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Close button - Google Maps 风格 */}
                <button
                    onClick={onClose}
                    className={cn(
                        'absolute -top-2 -right-2 w-6 h-6 rounded-full',
                        'bg-black/70 hover:bg-black/80 text-white',
                        'flex items-center justify-center',
                        'transition-colors duration-200',
                        'shadow-lg'
                    )}
                    aria-label="关闭弹窗"
                >
                    <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
        </Popup>
    )
} 