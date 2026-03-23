'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
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
    placeName?: string
    placeAddress?: string
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
    const { markers, activeView, tripDays, addMarkerToDay } = useMapStore()

    const selectedMarker = selectedMarkerId
        ? markers.find(m => m.id === selectedMarkerId)
        : null

    // "加入今天" 按钮逻辑（Day 模式）
    const currentDay = activeView.mode === 'day' && activeView.dayId
        ? tripDays.find(d => d.id === activeView.dayId)
        : null
    const isMarkerInCurrentDay = currentDay && selectedMarkerId
        ? currentDay.markerIds.includes(selectedMarkerId)
        : false

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                if (!(event.target as HTMLElement).closest('.map-marker') &&
                    !(event.target as HTMLElement).closest('.mapboxgl-map')) {
                    onClose()
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    const handleAddToDay = async () => {
        if (!selectedMarkerId || !activeView.tripId || !activeView.dayId) return
        try {
            await addMarkerToDay(activeView.tripId, activeView.dayId, selectedMarkerId)
            toast.success('已加入今天行程')
            onClose()
        } catch {
            toast.error('操作失败，请重试')
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
                    'w-[240px] animate-scale-in overflow-hidden'
                )}
            >
                {selectedMarker ? (
                    // 已有标记：显示标题、编辑/删除、加入今天
                    <div className="max-w-[280px]">
                        {selectedMarker.content.headerImage && (
                            <div className="w-full h-28 bg-gray-100">
                                <img
                                    src={selectedMarker.content.headerImage}
                                    alt={selectedMarker.content.title || '标记图片'}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                                />
                            </div>
                        )}
                        <div className="p-3 space-y-2">
                            <h3 className="text-sm font-semibold text-gray-800">
                                {selectedMarker.content.title || '未命名标记'}
                            </h3>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => onEditMarker(selectedMarkerId!)}
                                    className="flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors focus:outline-none"
                                >
                                    编辑
                                </button>
                                <button
                                    onClick={() => onDeleteMarker(selectedMarkerId!)}
                                    className="flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors focus:outline-none"
                                >
                                    删除
                                </button>
                            </div>
                            {currentDay && !isMarkerInCurrentDay && (
                                <button
                                    onClick={handleAddToDay}
                                    className="w-full px-2 py-1.5 text-xs font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors flex items-center justify-center gap-1"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    加入今天行程
                                </button>
                            )}
                            {currentDay && isMarkerInCurrentDay && (
                                <span className="block text-xs text-indigo-500 text-center">✓ 已在今天行程中</span>
                            )}
                        </div>
                    </div>
                ) : (
                    // 空白区域：显示地点信息 + 添加按钮
                    <div className="p-0">
                        <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-3 py-2.5 border-b border-gray-200">
                            <div className="min-w-0 space-y-1">
                                {placeName ? (
                                    <h3 className="text-sm font-semibold text-gray-900 truncate" title={placeName}>{placeName}</h3>
                                ) : (
                                    <div className="h-5 bg-gray-200 rounded animate-pulse mb-1 w-4/5"></div>
                                )}
                                {placeAddress ? (
                                    <p className="text-xs text-gray-600 truncate leading-relaxed" title={placeAddress}>{placeAddress}</p>
                                ) : (
                                    <div className="h-[19.5px] bg-gray-200 rounded animate-pulse w-full mt-1"></div>
                                )}
                            </div>
                        </div>
                        <div className="p-2 space-y-2">
                            <button
                                onClick={() => onAddMarker(placeName)}
                                className="w-full px-3 py-1.5 text-sm font-medium rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2 shadow-md focus:outline-none"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                添加标记
                            </button>
                            <p className="text-xs text-gray-400 font-mono text-center">
                                {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
                            </p>
                        </div>
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-black/80 text-white flex items-center justify-center transition-colors shadow-lg"
                    aria-label="关闭弹窗"
                >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
        </Popup>
    )
}
