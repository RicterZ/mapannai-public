'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Marker } from '@/types/marker'
import { useMapStore } from '@/store/map-store'
import { GoogleMapInstance } from '@/lib/map-providers/google-provider'
import { config } from '@/lib/config'

interface GoogleConnectionLinesProps {
    mapInstance: GoogleMapInstance | null
    markers: Marker[]
}

interface ConnectionLine {
    id: string
    from: Marker
    to: Marker
}

export const GoogleConnectionLines = ({ mapInstance, markers }: GoogleConnectionLinesProps) => {
    const { interactionState } = useMapStore()
    const { highlightedChainIds } = interactionState
    const connectionLinesRef = useRef<Map<string, any>>(new Map())
    
    // 计算所有连接线
    const connectionLines = useMemo(() => {
        const lines: ConnectionLine[] = []
        
        markers.forEach(marker => {
            // 检查当前标记是否有 next 字段且不为空
            if (marker.content.next && marker.content.next.length > 0) {
                marker.content.next.forEach(nextMarkerId => {
                    // 查找目标标记
                    const targetMarker = markers.find(m => m.id === nextMarkerId)
                    if (targetMarker) {
                        lines.push({
                            id: `${marker.id}-${nextMarkerId}`,
                            from: marker,
                            to: targetMarker
                        })
                    }
                })
            }
        })
        
        return lines
    }, [markers])

    // 渲染连接线
    useEffect(() => {
        if (!mapInstance?.map || connectionLines.length === 0) {
            return
        }

        // 获取当前缩放级别
        const currentZoom = mapInstance.map.getZoom()
        
        // 当缩放级别小于阈值时，隐藏连接线
        if (currentZoom < config.app.zoomThreshold) {
            // 清除现有的连接线
            connectionLinesRef.current.forEach((polyline, lineId) => {
                try {
                    polyline.setMap(null)
                } catch (error) {
                    console.warn('移除连接线时出错:', error)
                }
            })
            connectionLinesRef.current.clear()
            return
        }

        // 清除现有的连接线
        connectionLinesRef.current.forEach((polyline, lineId) => {
            try {
                polyline.setMap(null)
            } catch (error) {
                console.warn('移除连接线时出错:', error)
            }
        })
        connectionLinesRef.current.clear()

        // 添加新的连接线
        connectionLines.forEach(line => {
            const isHighlighted = highlightedChainIds.includes(line.from.id) || 
                                highlightedChainIds.includes(line.to.id)

            try {

                // 使用 Polyline 而不是 Data Layer
                const polyline = new (window as any).google.maps.Polyline({
                    path: [
                        { lat: line.from.coordinates.latitude, lng: line.from.coordinates.longitude },
                        { lat: line.to.coordinates.latitude, lng: line.to.coordinates.longitude }
                    ],
                    geodesic: true,
                    strokeColor: isHighlighted ? '#3b82f6' : 'rgba(0, 0, 0, 0.4)',
                    strokeWeight: isHighlighted ? 6 : 4,
                    strokeOpacity: isHighlighted ? 1 : 0.6,
                    zIndex: 1, // 设置较低的 z-index，确保连接线在标记下方
                    map: mapInstance.map
                })

                // 简化动画 - 直接设置样式，无复杂动画逻辑
                if (isHighlighted) {
                    polyline.setOptions({
                        strokeWeight: 6,
                        strokeOpacity: 1
                    })
                } else {
                    polyline.setOptions({
                        strokeWeight: 4,
                        strokeOpacity: 0.6
                    })
                }

                // 记录连接线以便后续清理
                connectionLinesRef.current.set(line.id, polyline)
            } catch (error) {
                console.warn('添加连接线时出错:', error)
            }
        })

    }, [mapInstance, connectionLines, highlightedChainIds])

    // 监听缩放级别变化 - 立即显示/隐藏连接线，无渐变效果
    useEffect(() => {
        if (!mapInstance?.map) return

        const handleZoomChange = () => {
            const currentZoom = mapInstance.map.getZoom()
            
            if (currentZoom < config.app.zoomThreshold) {
                // 立即隐藏所有连接线
                connectionLinesRef.current.forEach((polyline) => {
                    try {
                        polyline.setMap(null)
                    } catch (error) {
                        console.warn('隐藏连接线时出错:', error)
                    }
                })
                connectionLinesRef.current.clear()
            } else {
                // 立即显示连接线
                if (connectionLines.length > 0) {
                    // 先清除现有连接线
                    connectionLinesRef.current.forEach((polyline) => {
                        try {
                            polyline.setMap(null)
                        } catch (error) {
                            console.warn('清除连接线时出错:', error)
                        }
                    })
                    connectionLinesRef.current.clear()
                    
                    // 立即添加新连接线
                    connectionLines.forEach(line => {
                        const isHighlighted = highlightedChainIds.includes(line.from.id) || 
                                            highlightedChainIds.includes(line.to.id)

                        try {
                            const polyline = new (window as any).google.maps.Polyline({
                                path: [
                                    { lat: line.from.coordinates.latitude, lng: line.from.coordinates.longitude },
                                    { lat: line.to.coordinates.latitude, lng: line.to.coordinates.longitude }
                                ],
                                geodesic: true,
                                strokeColor: isHighlighted ? '#3b82f6' : 'rgba(0, 0, 0, 0.4)',
                                strokeWeight: isHighlighted ? 6 : 4,
                                strokeOpacity: isHighlighted ? 1 : 0.6,
                                zIndex: 1,
                                map: mapInstance.map
                            })

                            connectionLinesRef.current.set(line.id, polyline)
                        } catch (error) {
                            console.warn('添加连接线时出错:', error)
                        }
                    })
                }
            }
        }

        // 添加缩放监听器
        const zoomListener = (window as any).google.maps.event.addListener(mapInstance.map, 'zoom_changed', handleZoomChange)
        
        return () => {
            if (zoomListener) {
                (window as any).google.maps.event.removeListener(zoomListener)
            }
        }
    }, [mapInstance, connectionLines, highlightedChainIds])

    // 当组件卸载时清理连接线
    useEffect(() => {
        return () => {
            if (mapInstance?.map) {
                try {
                    
                    // 清理所有连接线
                    connectionLinesRef.current.forEach((polyline) => {
                        polyline.setMap(null)
                    })
                    connectionLinesRef.current.clear()
                } catch (error) {
                    console.warn('清理连接线时出错:', error)
                }
            }
        }
    }, [mapInstance])

    return null // 这个组件不渲染任何可见元素
}
