'use client'

import { useMemo, useEffect, useState } from 'react'
import { Source, Layer } from 'react-map-gl'
import { Marker } from '@/types/marker'
import { useMapStore } from '@/store/map-store'

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


    // 生成普通连接线的 GeoJSON
    const connectionGeoJSON = useMemo(() => {
        if (connectionLines.length === 0) {
            return {
                type: 'FeatureCollection' as const,
                features: []
            }
        }

        const features = connectionLines.map(line => ({
            type: 'Feature' as const,
            geometry: {
                type: 'LineString' as const,
                coordinates: [
                    [line.from.coordinates.longitude, line.from.coordinates.latitude],
                    [line.to.coordinates.longitude, line.to.coordinates.latitude]
                ]
            },
            properties: {
                id: line.id,
                fromId: line.from.id,
                toId: line.to.id,
                isDragPreview: false
            }
        }))

        return {
            type: 'FeatureCollection' as const,
            features
        }
    }, [connectionLines])

    // 如果没有连接线，不渲染任何内容
    if (connectionLines.length === 0) {
        return null
    }

    // 当缩放级别小于13时，隐藏连接线
    if (zoom < 13) {
        return null
    }

    return (
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
                        ['>', ['length', ['literal', highlightedChainIds]], 0],
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
                filter={highlightedChainIds.length > 0 ? [
                    'all',
                    [
                        'in',
                        ['get', 'fromId'],
                        ['literal', highlightedChainIds]
                    ],
                    [
                        'in',
                        ['get', 'toId'],
                        ['literal', highlightedChainIds]
                    ]
                ] : ['literal', false]}
            />
        </Source>
    )
}
