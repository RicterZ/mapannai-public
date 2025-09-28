'use client'

import { useEffect, useRef, useState } from 'react'
import { MarkerCoordinates } from '@/types/marker'
import { cn } from '@/utils/cn'

interface GoogleMapPopupProps {
    coordinates: MarkerCoordinates
    isVisible: boolean
    onClose: () => void
    onAddMarker?: () => void
    placeId?: string
    placeName?: string
    clickPosition?: { x: number; y: number }
    isMarkerClick?: boolean
    mapInstance?: any // Google Maps实例
}

export const GoogleMapPopup = ({
    coordinates,
    isVisible,
    onClose,
    onAddMarker,
    placeId,
    placeName,
    clickPosition,
    isMarkerClick = false,
    mapInstance
}: GoogleMapPopupProps) => {
    const popupRef = useRef<HTMLDivElement>(null)
    const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null)
    const [arrowPosition, setArrowPosition] = useState(0.5) // 箭头位置，0-1之间
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [dynamicWidth, setDynamicWidth] = useState(200) // 动态宽度

    // 计算popup位置 - 完全重写
    useEffect(() => {
        if (!isVisible) return

        const calculatePosition = () => {
            // 如果没有地图实例，使用屏幕中心作为后备
            if (!mapInstance || !mapInstance.map) {
                setPopupPosition({ 
                    x: window.innerWidth / 2 - 100, // 100是popup最小宽度的一半
                    y: window.innerHeight / 2 - 45  // 45是popup高度的一半
                })
                setArrowPosition(0.5)
                return
            }

            // 根据title实际宽度动态计算popup宽度
            const baseWidth = 200
            const minWidth = 200
            const maxWidth = 320
            
            // 创建临时元素来测量文本实际宽度
            const measureTextWidth = (text: string, fontSize: string = '14px', fontFamily: string = 'system-ui') => {
                const canvas = document.createElement('canvas')
                const context = canvas.getContext('2d')
                if (!context) return text.length * 5 // 后备方案
                
                context.font = `${fontSize} ${fontFamily}`
                return context.measureText(text).width
            }
            
            // 计算标题实际宽度
            const titleWidth = placeName ? measureTextWidth(placeName, '14px', 'system-ui') : 0
            const padding = 24 // 左右padding (12px * 2)
            const buttonSpace = 32 // 关闭按钮占用的空间
            
            // 计算所需宽度：标题宽度 + padding + 按钮空间
            const requiredWidth = Math.max(baseWidth, titleWidth + padding + buttonSpace)
            const calculatedWidth = Math.min(maxWidth, requiredWidth)
            
            setDynamicWidth(calculatedWidth)
            const popupWidth = calculatedWidth
            const popupHeight = 90
            const margin = 20

            try {
                // 使用Google Maps API将经纬度转换为屏幕坐标
                const latLng = new (window as any).google.maps.LatLng(
                    coordinates.latitude, 
                    coordinates.longitude
                )
                
                // 获取地图容器的位置和大小
                const mapDiv = mapInstance.map.getDiv()
                const mapRect = mapDiv.getBoundingClientRect()
                
                // 使用Google Maps的getProjection()方法
                const projection = mapInstance.map.getProjection()
                if (!projection) {
                    return
                }
                
                // 将经纬度转换为世界坐标
                const worldCoordinate = projection.fromLatLngToPoint(latLng)
                
                // 获取地图的缩放级别和中心点
                const zoom = mapInstance.map.getZoom()
                const center = mapInstance.map.getCenter()
                const centerPoint = projection.fromLatLngToPoint(center)
                
                // 计算相对于地图中心的偏移
                const offsetX = (worldCoordinate.x - centerPoint.x) * Math.pow(2, zoom)
                const offsetY = (worldCoordinate.y - centerPoint.y) * Math.pow(2, zoom)
                
                // 计算屏幕坐标（地图中心 + 偏移）
                const screenX = mapRect.left + mapRect.width / 2 + offsetX
                const screenY = mapRect.top + mapRect.height / 2 + offsetY

                // 根据是否是marker点击使用不同的定位算法
                let popupX: number
                let popupY: number
                
                if (isMarkerClick) {
                    // Marker点击：使用特殊定位算法
                    popupX = screenX - popupWidth / 2 + 1 // 居中对齐，向右偏移1px
                    popupY = screenY + 20 // 在marker下方20px
                } else {
                    // 地图点击：使用标准定位算法
                    popupX = screenX - popupWidth / 2 + 1 // 居中对齐，向右偏移1px
                    popupY = screenY + 20 // 在点击位置下方20px
                }

                // 边界检查 - 确保popup不超出视口
                const minX = margin
                const maxX = window.innerWidth - popupWidth - margin
                const minY = margin
                const maxY = window.innerHeight - popupHeight - margin
                
                popupX = Math.max(minX, Math.min(popupX, maxX))
                popupY = Math.max(minY, Math.min(popupY, maxY))

                // 如果没有初始位置，直接设置（无动画）
                if (!popupPosition) {
                    setPopupPosition({ x: popupX, y: popupY })
                } else {
                    // 平滑过渡到新位置
                    const currentPosition = popupPosition
                    const distance = Math.sqrt(
                        Math.pow(popupX - currentPosition.x, 2) + 
                        Math.pow(popupY - currentPosition.y, 2)
                    )
                    
                    // 如果距离较大，使用平滑过渡
                    if (distance > 10) {
                        setIsTransitioning(true)
                        
                        // 使用requestAnimationFrame实现平滑过渡
                        const startTime = performance.now()
                        const duration = 200 // 200ms过渡时间
                        
                        const animate = (currentTime: number) => {
                            const elapsed = currentTime - startTime
                            const progress = Math.min(elapsed / duration, 1)
                            
                            // 使用easeOut缓动函数
                            const easeOut = 1 - Math.pow(1 - progress, 3)
                            
                            const newX = currentPosition.x + (popupX - currentPosition.x) * easeOut
                            const newY = currentPosition.y + (popupY - currentPosition.y) * easeOut
                            
                            setPopupPosition({ x: newX, y: newY })
                            
                            if (progress < 1) {
                                requestAnimationFrame(animate)
                            } else {
                                setIsTransitioning(false)
                            }
                        }
                        
                        requestAnimationFrame(animate)
                    } else {
                        // 距离较小，直接设置位置
                        setPopupPosition({ x: popupX, y: popupY })
                    }
                }
                
                // 计算箭头位置 - 指向屏幕坐标位置
                const arrowX = (screenX - popupX) / popupWidth
                setArrowPosition(Math.max(0.1, Math.min(0.9, arrowX)))
                
            } catch (error) {
                // 降级到使用点击位置
                if (clickPosition) {
                    const popupX = clickPosition.x - popupWidth / 2 + 1
                    const popupY = clickPosition.y + 20 // 统一使用20px距离
                    setPopupPosition({ x: popupX, y: popupY })
                    setArrowPosition(0.5)
                }
            }
        }

        // 立即计算位置
        calculatePosition()
        
        // 监听窗口大小变化和地图缩放
        const handleResize = () => {
            calculatePosition()
        }
        
        // 监听地图缩放事件
        const handleMapZoom = () => {
            calculatePosition()
        }
        
        window.addEventListener('resize', handleResize)
        
        // 监听地图容器的大小变化（包括缩放）
        const mapContainer = document.querySelector('.map-container')
        if (mapContainer) {
            const resizeObserver = new ResizeObserver(handleMapZoom)
            resizeObserver.observe(mapContainer)
            
            return () => {
                window.removeEventListener('resize', handleResize)
                resizeObserver.disconnect()
            }
        }
        
        return () => window.removeEventListener('resize', handleResize)
    }, [isVisible, clickPosition])

    // 点击外部关闭 - 完全禁用，让地图点击处理函数完全控制popup的显示/隐藏
    useEffect(() => {
        if (!isVisible) return

        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                // 检查是否点击在地图区域，如果是则不关闭，让地图点击处理函数决定
                const target = event.target as HTMLElement
                // 检查是否点击在地图容器或地图相关的元素上
                if (target.closest('.map-container') || 
                    target.closest('[data-map-container]') ||
                    target.closest('.google-map') ||
                    target.closest('canvas') || // Google Maps使用canvas渲染
                    target.closest('.gm-style') || // Google Maps样式类
                    target.closest('[role="button"]') || // Google Maps控件
                    target.closest('.gmnoprint')) { // Google Maps控件
                    return // 不关闭，让地图点击处理函数决定
                }
                // 对于其他区域（如侧边栏、模态框等），仍然关闭popup
                onClose()
            }
        }

        // 延迟添加监听器，避免立即触发
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside)
        }, 200) // 增加延迟，确保地图点击事件先处理

        return () => {
            clearTimeout(timer)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isVisible, onClose])

    if (!isVisible || !popupPosition) return null

    return (
        <div
            ref={popupRef}
            className={cn(
                'fixed z-50 bg-white rounded-xl shadow-2xl',
                'animate-slide-up-fade-in',
                'border border-gray-200',
                isTransitioning ? 'transition-none' : 'transition-all duration-200 ease-out'
            )}
            style={{
                left: `${popupPosition.x}px`,
                top: `${popupPosition.y}px`,
                width: `${dynamicWidth}px`,
                transform: isTransitioning ? 'none' : 'translateZ(0)', // 启用硬件加速
            }}
        >
            {/* 箭头指向点击位置 */}
            <div
                className="absolute -top-2 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"
                style={{
                    left: `${arrowPosition * 100}%`,
                    transform: `translateX(-50%) rotate(45deg)`,
                }}
            />

            {/* 关闭按钮 - 右上角，部分超出边界 */}
            <button
                onClick={onClose}
                className={cn(
                    'absolute -top-2 -right-2 z-10',
                    'w-6 h-6 rounded-full',
                    'bg-black/70 hover:bg-black/80',
                    'flex items-center justify-center',
                    'transition-colors duration-200',
                    'shadow-lg'
                )}
                aria-label="关闭弹窗"
            >
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Popup内容 */}
            <div className="p-3">
                <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-800 mb-1">
                        {placeName || '坐标'}
                    </h3>
                    <p className="text-xs text-gray-500">
                        {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                    </p>
                </div>

                {/* 操作按钮 */}
                {onAddMarker && (
                    <div className="flex gap-2">
                        <button
                            onClick={onAddMarker}
                            className={cn(
                                'flex-1 px-3 py-2 text-sm font-medium rounded-lg',
                                'bg-blue-600 text-white hover:bg-blue-700',
                                'transition-colors duration-200',
                                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                                'flex items-center justify-center gap-2'
                            )}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            添加标记
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
