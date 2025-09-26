'use client'

import { useEffect, useRef } from 'react'
import { Popup } from 'react-map-gl'
import { MarkerCoordinates } from '@/types/marker'
import { useMapStore } from '@/store/map-store'
import { cn } from '@/utils/cn'

interface MapPopupProps {
    coordinates: MarkerCoordinates
    selectedMarkerId: string | null
    onAddMarker: () => void
    onEditMarker: (markerId: string) => void
    onDeleteMarker: (markerId: string) => void
    onClose: () => void
}

export const MapPopup = ({
    coordinates,
    selectedMarkerId,
    onAddMarker,
    onEditMarker,
    onDeleteMarker,
    onClose,
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
        onAddMarker()
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
                    'bg-white rounded-2xl',
                    'min-w-[200px] animate-scale-in overflow-hidden'
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
                    // 空白区域：根据编辑模式显示添加按钮或提示
                    editMode.isEnabled ? (
                        <div className="p-3 space-y-2">
                            <h3 className="text-sm font-medium text-gray-800 mb-3">
                                添加新标记
                            </h3>
                            <button
                                onClick={handleAddClick}
                                className={cn(
                                    'w-full px-3 py-2 text-sm font-medium rounded-md',
                                    'bg-green-600 text-white hover:bg-green-700',
                                    'transition-colors duration-200',
                                    'focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
                                    'flex items-center justify-center gap-2'
                                )}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                添加图标
                            </button>
                        </div>
                    ) : (
                        <div className="p-3 space-y-2">
                            <div className="text-center">
                                <div className="w-8 h-8 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <p className="text-xs text-gray-500">
                                    当前为查看模式
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    开启编辑模式以添加标记
                                </p>
                            </div>
                        </div>
                    )
                )}

                {/* Close button */}
                <button
                    onClick={onClose}
                    className={cn(
                        'absolute -top-2 -right-2 w-5 h-5 rounded-full',
                        'bg-gray-600 text-white hover:bg-gray-700',
                        'flex items-center justify-center text-xs leading-none p-0',
                        'transition-colors duration-200',
                    )}
                    aria-label="关闭弹窗"
                >
                    <svg
                        className="w-3.5 h-3.5"
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