'use client'

import { useMemo, useEffect, useState, useCallback } from 'react'
import { Source, Layer } from 'react-map-gl'
import { Marker } from '@/types/marker'
import { useMapStore } from '@/store/map-store'
import { googleDirectionsService, GoogleDirectionsRequest } from '@/lib/api/google-directions-service'
import { config } from '@/lib/config'

// 检查连线是否在完整的标记链中
// 算法说明：
// 1. 检查连线的终点是否在高亮链中
// 2. 检查连线的起点标记的next数组中是否包含终点标记的ID
// 3. 这确保了只高亮真正属于完整标记链的连线
// 例如：如果有链 1-2-3-4 和 1-2-5-6，hover第一条链时：
// - 会高亮 1-2, 2-3, 3-4 这些连线
// - 不会高亮 2-5 这条连线，因为虽然2在第一条链中，但2-5不属于第一条链
const isLineInHighlightedChain = (line: ConnectionLine, highlightedChainIds: string[], markers: Marker[]): boolean => {
    // 检查连线的终点是否在高亮链中
    if (highlightedChainIds.includes(line.to.id)) {
        // 检查这条连线是否在完整的标记链中
        // 即：from -> to 的连线确实存在于标记的next关系中
        const fromMarker = markers.find(m => m.id === line.from.id)
        if (fromMarker && fromMarker.content.next && fromMarker.content.next.includes(line.to.id)) {
            return true
        }
    }
    return false
}

interface ConnectionLinesProps {
    markers: Marker[]
    zoom?: number
}

interface ConnectionLine {
    id: string
    from: Marker
    to: Marker
}

export const ConnectionLines = ({ markers, zoom = 11 }: ConnectionLinesProps) => {
    const { interactionState } = useMapStore()
    const { highlightedChainIds } = interactionState
    
    // 路径缓存状态
    const [routeCache, setRouteCache] = useState<Map<string, Array<{ lat: number; lng: number }>>>(() => {
        // 从 localStorage 加载缓存
        try {
            const cached = localStorage.getItem('mapbox-route-cache')
            if (cached) {
                const parsed = JSON.parse(cached)
                return new Map(parsed)
            }
        } catch (error) {
            console.warn('Failed to load route cache from localStorage:', error)
        }
        return new Map()
    })
    const [isLoadingRoutes, setIsLoadingRoutes] = useState(false)
    
    // 保存缓存到 localStorage
    const saveCacheToStorage = (cache: Map<string, Array<{ lat: number; lng: number }>>) => {
        try {
            const serialized = JSON.stringify(Array.from(cache.entries()))
            localStorage.setItem('mapbox-route-cache', serialized)
        } catch (error) {
            console.warn('Failed to save route cache to localStorage:', error)
        }
    }
    
    
    // 移除CSS transition动画效果，确保连接线显示/隐藏而不是渐变
    
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

    // 计算需要高亮的连线ID
    const highlightedLineIds = useMemo(() => {
        if (highlightedChainIds.length === 0) {
            return []
        }

        const highlightedIds = new Set<string>()
        
        // 遍历所有连接线，检查是否应该高亮
        connectionLines.forEach(line => {
            // 检查这条连线是否在完整的标记链中
            const shouldHighlight = isLineInHighlightedChain(line, highlightedChainIds, markers)
            if (shouldHighlight) {
                highlightedIds.add(line.id)
            }
        })
        
        return Array.from(highlightedIds)
    }, [connectionLines, highlightedChainIds, markers])

    // 计算步行+公共交通路径
    const calculateWalkingRoutes = useCallback(async () => {
        if (connectionLines.length === 0) return

        console.log('开始计算路径...', { connectionLinesCount: connectionLines.length })
        setIsLoadingRoutes(true)
        
        try {
            const routePromises = connectionLines.map(async (line) => {
                const cacheKey = `${line.from.id}-${line.to.id}`
                
                // 检查缓存
                if (routeCache.has(cacheKey)) {
                    return { line, path: routeCache.get(cacheKey)! }
                }

                try {
                    const request: GoogleDirectionsRequest = {
                        origin: { lat: line.from.coordinates.latitude, lng: line.from.coordinates.longitude },
                        destination: { lat: line.to.coordinates.latitude, lng: line.to.coordinates.longitude }
                    }

                    const response = await googleDirectionsService.getWalkingRoute(request)
                    
                    // 补全路径：确保路径两端精确连接到标记
                    const completePath = [
                        // 起始点：标记位置
                        { lat: line.from.coordinates.latitude, lng: line.from.coordinates.longitude },
                        // Google 返回的路径点
                        ...response.path,
                        // 结束点：标记位置
                        { lat: line.to.coordinates.latitude, lng: line.to.coordinates.longitude }
                    ]
                    
                    // 缓存结果
                    setRouteCache(prev => {
                        const newCache = new Map(prev.set(cacheKey, completePath))
                        saveCacheToStorage(newCache)
                        return newCache
                    })
                    
                    return { line, path: completePath }
                } catch (error) {
                    console.warn('计算步行路径失败，使用直线路径:', error)
                    const fallbackPath = [
                        { lat: line.from.coordinates.latitude, lng: line.from.coordinates.longitude },
                        { lat: line.to.coordinates.latitude, lng: line.to.coordinates.longitude }
                    ]
                    return { line, path: fallbackPath }
                }
            })

            await Promise.all(routePromises)
        } catch (error) {
            console.error('路径计算错误:', error)
        } finally {
            setIsLoadingRoutes(false)
        }
    }, [connectionLines, routeCache, setRouteCache, saveCacheToStorage])

    // 当连接线变化时，计算路径
    useEffect(() => {
        if (connectionLines.length > 0) {
            calculateWalkingRoutes()
        }
    }, [connectionLines, calculateWalkingRoutes])

    // 监听标记链更新事件，强制重新计算路径
    useEffect(() => {
        const handleRefreshConnectionLines = () => {
            console.log('标记链更新事件触发，重新计算路径...', { connectionLinesCount: connectionLines.length })
            if (connectionLines.length > 0) {
                calculateWalkingRoutes()
            }
        }

        window.addEventListener('refreshConnectionLines', handleRefreshConnectionLines)
        return () => {
            window.removeEventListener('refreshConnectionLines', handleRefreshConnectionLines)
        }
    }, [calculateWalkingRoutes, connectionLines.length])


    // 生成普通连接线的 GeoJSON
    const connectionGeoJSON = useMemo(() => {
        if (connectionLines.length === 0) {
            return {
                type: 'FeatureCollection' as const,
                features: []
            }
        }

        const features = connectionLines.map(line => {
            const cacheKey = `${line.from.id}-${line.to.id}`
            const cachedPath = routeCache.get(cacheKey)
            
            // 使用缓存的路径或直线路径
            const coordinates = cachedPath 
                ? cachedPath.map(point => [point.lng, point.lat])
                : [
                    [line.from.coordinates.longitude, line.from.coordinates.latitude],
                    [line.to.coordinates.longitude, line.to.coordinates.latitude]
                ]

            return {
                type: 'Feature' as const,
                geometry: {
                    type: 'LineString' as const,
                    coordinates
                },
                properties: {
                    id: line.id,
                    fromId: line.from.id,
                    toId: line.to.id,
                    isDragPreview: false,
                    isWalkingRoute: !!cachedPath
                }
            }
        })

        return {
            type: 'FeatureCollection' as const,
            features
        }
    }, [connectionLines, routeCache])

    // 如果没有连接线，不渲染任何内容
    if (connectionLines.length === 0) {
        return null
    }

    // 当缩放级别小于阈值时，隐藏连接线
    if (zoom < config.app.zoomThreshold) {
        return null
    }

    return (
        <>
            {/* 加载状态指示器 */}
            {isLoadingRoutes && (
                <div className="absolute top-4 right-4 bg-white bg-opacity-90 px-3 py-2 rounded-lg shadow-lg text-sm text-gray-600 z-10">
                    <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span>计算公共交通路径中...</span>
                    </div>
                </div>
            )}
            
            <Source id="connection-lines" type="geojson" data={connectionGeoJSON}>
            {/* 普通连接线 */}
            <Layer
                id="connection-lines-layer"
                type="line"
                paint={{
                    'line-color': 'rgba(0, 0, 0, 0.4)', // 黑色半透明，降低不透明度
                    'line-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 3,
                        15, 4,
                        20, 5
                    ], // 根据缩放级别动态调整线宽
                    'line-opacity': [
                        'case',
                        ['>', ['length', ['literal', highlightedLineIds]], 0],
                        0.3, // 当有高亮时，普通线变暗
                        0.6  // 无高亮时，正常显示
                    ], // 根据高亮状态调整透明度，不根据缩放级别渐变
                }}
                layout={{
                    'line-join': 'round',
                    'line-cap': 'round'
                }}
            />
            
            {/* 高亮连接线 */}
            <Layer
                id="highlighted-connection-lines-layer"
                type="line"
                paint={{
                    'line-color': 'rgba(59, 130, 246, 0.9)', // 蓝色高亮
                    'line-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 4,
                        15, 6,
                        20, 8
                    ], // 根据缩放级别动态调整线宽
                    'line-opacity': 1, // 高亮时完全不透明
                }}
                layout={{
                    'line-join': 'round',
                    'line-cap': 'round'
                }}
                filter={highlightedLineIds.length > 0 ? [
                    'in',
                    ['get', 'id'],
                    ['literal', highlightedLineIds]
                ] : ['literal', false]}
            />
        </Source>
        </>
    )
}
