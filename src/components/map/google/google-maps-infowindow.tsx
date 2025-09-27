'use client'

import { useEffect, useRef } from 'react'
import { MarkerCoordinates } from '@/types/marker'
import { useMapStore } from '@/store/map-store'
import { cn } from '@/utils/cn'

interface GoogleMapsInfoWindowProps {
    mapInstance: any
    coordinates: MarkerCoordinates
    selectedMarkerId: string | null
    placeName?: string  // 添加地点名称
    onAddMarker: (placeName?: string) => void  // 修改为可传递地点名称
    onEditMarker: (markerId: string) => void
    onDeleteMarker: (markerId: string) => void
    onClose: () => void
}

export const GoogleMapsInfoWindow = ({
    mapInstance,
    coordinates,
    selectedMarkerId,
    placeName,
    onAddMarker,
    onEditMarker,
    onDeleteMarker,
    onClose,
}: GoogleMapsInfoWindowProps) => {
    const infoWindowRef = useRef<any>(null)
    const markerRef = useRef<any>(null)
    const { markers, editMode } = useMapStore()

    const selectedMarker = selectedMarkerId
        ? markers.find(m => m.id === selectedMarkerId)
        : null

    useEffect(() => {
        if (!mapInstance || !window.google) return

        // 获取实际的 Google Maps 实例
        const googleMap = mapInstance.map
        if (!googleMap) return

        // 创建标记
        const marker = new window.google.maps.Marker({
            position: {
                lat: coordinates.latitude,
                lng: coordinates.longitude
            },
            map: googleMap,
            animation: window.google.maps.Animation.DROP
        })

        markerRef.current = marker

        // 创建信息窗口内容
        const createInfoWindowContent = () => {
            if (selectedMarker) {
                if (editMode.isEnabled) {
                    // 编辑模式：显示编辑/删除按钮
                    return `
                        <div style="padding: 12px; min-width: 200px; max-width: 300px;">
                            <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">标记操作</h3>
                            <div style="display: flex; gap: 8px;">
                                <button onclick="window.editMarker('${selectedMarkerId}')" 
                                        style="flex: 1; padding: 8px 12px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: background-color 0.2s;">
                                    编辑
                                </button>
                                <button onclick="window.deleteMarker('${selectedMarkerId}')" 
                                        style="flex: 1; padding: 8px 12px; background: #dc2626; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: background-color 0.2s;">
                                    删除
                                </button>
                            </div>
                        </div>
                    `
                } else {
                    // 查看模式：显示标记头图和基本信息
                    const headerImage = selectedMarker.content.headerImage ? 
                        `<div style="width: 100%; height: 128px; background: #f3f4f6; margin: -12px -12px 12px -12px; border-radius: 12px 12px 0 0; overflow: hidden;">
                            <img src="${selectedMarker.content.headerImage}" 
                                 alt="${selectedMarker.content.title || '标记图片'}" 
                                 style="width: 100%; height: 100%; object-fit: cover;" 
                                 onerror="this.style.display='none'">
                        </div>` : ''

                    return `
                        <div style="padding: 12px; min-width: 200px; max-width: 280px;">
                            ${headerImage}
                            <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #374151;">
                                ${selectedMarker.content.title || '未命名标记'}
                            </h3>
                        </div>
                    `
                }
            } else {
                if (editMode.isEnabled) {
                    // 空白区域 + 编辑模式：显示添加按钮和地点名称
                    const placeNameDisplay = placeName ? 
                        `<div style="margin-bottom: 12px; padding: 8px; background: #f3f4f6; border-radius: 6px; border-left: 3px solid #3b82f6;">
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">地点名称</div>
                            <div style="font-size: 14px; font-weight: 500; color: #374151;">${placeName}</div>
                        </div>` : ''
                    
                    return `
                        <div style="padding: 12px; min-width: 200px; max-width: 300px;">
                            <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">添加新标记</h3>
                            ${placeNameDisplay}
                            <button onclick="window.addMarker()" 
                                    style="width: 100%; padding: 8px 12px; background: #16a34a; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: background-color 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                                </svg>
                                添加图标
                            </button>
                        </div>
                    `
                } else {
                    // 空白区域 + 查看模式：显示坐标信息
                    return `
                        <div style="padding: 12px; min-width: 200px; max-width: 300px;">
                            <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">点击位置</h3>
                            <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">
                                坐标: ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                                开启编辑模式后可以在此位置添加标记
                            </p>
                        </div>
                    `
                }
            }
        }

        // 创建信息窗口
        const infoWindow = new window.google.maps.InfoWindow({
            content: createInfoWindowContent(),
            maxWidth: 300,
            pixelOffset: new window.google.maps.Size(0, -10)
        })

        infoWindowRef.current = infoWindow

        // 设置全局函数供 HTML 内容调用
        ;(window as any).addMarker = () => onAddMarker(placeName)
        ;(window as any).editMarker = onEditMarker
        ;(window as any).deleteMarker = onDeleteMarker

        // 打开信息窗口
        infoWindow.open(googleMap, marker)

        // 监听信息窗口关闭事件
        const closeListener = infoWindow.addListener('closeclick', () => {
            onClose()
        })

        return () => {
            // 清理
            if (marker) {
                marker.setMap(null)
            }
            if (infoWindow) {
                infoWindow.close()
            }
            if (closeListener) {
                window.google.maps.event.removeListener(closeListener)
            }
        }
    }, [mapInstance, coordinates, selectedMarkerId, editMode.isEnabled, onAddMarker, onEditMarker, onDeleteMarker, onClose])

    // 当内容变化时更新信息窗口
    useEffect(() => {
        if (infoWindowRef.current && mapInstance && mapInstance.map) {
            const createInfoWindowContent = () => {
                if (selectedMarker) {
                    if (editMode.isEnabled) {
                        return `
                            <div style="padding: 12px; min-width: 200px; max-width: 300px;">
                                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">标记操作</h3>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="window.editMarker('${selectedMarkerId}')" 
                                            style="flex: 1; padding: 8px 12px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">
                                        编辑
                                    </button>
                                    <button onclick="window.deleteMarker('${selectedMarkerId}')" 
                                            style="flex: 1; padding: 8px 12px; background: #dc2626; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">
                                        删除
                                    </button>
                                </div>
                            </div>
                        `
                    } else {
                        const headerImage = selectedMarker.content.headerImage ? 
                            `<div style="width: 100%; height: 128px; background: #f3f4f6; margin: -12px -12px 12px -12px; border-radius: 12px 12px 0 0; overflow: hidden;">
                                <img src="${selectedMarker.content.headerImage}" 
                                     alt="${selectedMarker.content.title || '标记图片'}" 
                                     style="width: 100%; height: 100%; object-fit: cover;" 
                                     onerror="this.style.display='none'">
                            </div>` : ''

                        return `
                            <div style="padding: 12px; min-width: 200px; max-width: 280px;">
                                ${headerImage}
                                <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #374151;">
                                    ${selectedMarker.content.title || '未命名标记'}
                                </h3>
                            </div>
                        `
                    }
                } else {
                    if (editMode.isEnabled) {
                        // 空白区域 + 编辑模式：显示添加按钮和地点名称
                        const placeNameDisplay = placeName ? 
                            `<div style="margin-bottom: 12px; padding: 8px; background: #f3f4f6; border-radius: 6px; border-left: 3px solid #3b82f6;">
                                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">地点名称</div>
                                <div style="font-size: 14px; font-weight: 500; color: #374151;">${placeName}</div>
                            </div>` : ''
                        
                        return `
                            <div style="padding: 12px; min-width: 200px; max-width: 300px;">
                                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">添加新标记</h3>
                                ${placeNameDisplay}
                                <button onclick="window.addMarker()" 
                                        style="width: 100%; padding: 8px 12px; background: #16a34a; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                                    </svg>
                                    添加图标
                                </button>
                            </div>
                        `
                    } else {
                        return `
                            <div style="padding: 12px; min-width: 200px; max-width: 300px;">
                                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">点击位置</h3>
                                <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">
                                    坐标: ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}
                                </p>
                                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                                    开启编辑模式后可以在此位置添加标记
                                </p>
                            </div>
                        `
                    }
                }
            }

            infoWindowRef.current.setContent(createInfoWindowContent())
        }
    }, [selectedMarkerId, editMode.isEnabled, selectedMarker, coordinates])

    return null // 这个组件不渲染任何内容，只是管理 Google Maps InfoWindow
}
