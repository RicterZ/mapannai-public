'use client'

import { useMemo, useCallback, useRef, useEffect } from 'react'
import { useMapStore } from '@/store/map-store'
import { Marker } from '@/types/marker'
import { MARKER_ICONS } from '@/types/marker'
import { cn } from '@/utils/cn'

interface MarkerChainProps {
    currentMarker: Marker
    onMarkerClick: (markerId: string) => void
    onAddMarker: (targetMarkerId: string) => void
}

export const MarkerChain = ({ currentMarker, onMarkerClick, onAddMarker }: MarkerChainProps) => {
    const { markers, setHighlightedChain, clearHighlightedChain, updateMarkerContent } = useMapStore()
    
    
  // 横向拖拽：按下容器并拖动进行横向滚动
  const handleChainMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    // 仅在非交互元素上按下时才进入拖拽，避免遮挡右上角 X 等按钮
    const target = e.target as HTMLElement
    if (target && target.closest('button')) {
      return
    }
    const startX = e.pageX
    const startScrollLeft = el.scrollLeft
    e.preventDefault()
    el.classList.add('cursor-grabbing', 'select-none')

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.pageX - startX
      el.scrollLeft = startScrollLeft - dx
    }
    const onMouseUp = () => {
      el.classList.remove('cursor-grabbing', 'select-none')
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  // 将垂直滚轮映射为横向滚动
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
  }, [])

    const handleMouseEnter = useCallback((chainIds: string[]) => {
        setHighlightedChain(chainIds)
    }, [setHighlightedChain])
    
    const handleMouseLeave = useCallback(() => {
        clearHighlightedChain()
    }, [clearHighlightedChain])
    

    // 计算标记链：多行显示多个标记链
    const markerChains = useMemo(() => {
        const chains: Marker[][] = []
        const maxDepth = 3
        
        
        // BFS构建标记链
        const buildChains = () => {
            const nextIds = currentMarker.content.next || []
            
            nextIds.forEach(nextId => {
                const nextMarker = markers.find(m => m.id === nextId)
                if (!nextMarker) return
                
                // 为每个链创建独立的visited集合
                const visited = new Set<string>()
                const queue: { marker: Marker; chain: Marker[]; depth: number }[] = []
                
                // 初始化队列
                queue.push({ marker: nextMarker, chain: [nextMarker], depth: 0 })
                visited.add(nextMarker.id)
                
                while (queue.length > 0) {
                    const { marker, chain, depth } = queue.shift()!
                    
                    // 保存当前链
                    if (chain.length > 0) {
                        chains.push([...chain])
                    }
                    
                    // 获取下一个标记
                    const nextIds = marker.content.next || []
                    
                    // 如果没有下一个标记，链结束
                    if (nextIds.length === 0) {
                        continue
                    }
                    
                    // 继续扩展链
                    nextIds.forEach(nextId => {
                        if (!visited.has(nextId)) {
                            const nextMarker = markers.find(m => m.id === nextId)
                            if (nextMarker) {
                                visited.add(nextId)
                                queue.push({
                                    marker: nextMarker,
                                    chain: [...chain, nextMarker],
                                    depth: depth + 1
                                })
                            }
                        }
                    })
                }
            })
        }
        
        buildChains()
        
        // 去重：去掉子链
        const deduplicatedChains = chains.filter((chain, index) => {
            const chainIds = chain.map(m => m.id)
            
            // 检查当前链是否是其他链的子链
            const isSubChain = chains.some((otherChain, otherIndex) => {
                if (index === otherIndex) return false
                const otherChainIds = otherChain.map(m => m.id)
                
                // 检查当前链是否是otherChain的子链
                if (chainIds.length >= otherChainIds.length) return false
                
                // 检查当前链是否在otherChain中连续出现
                for (let i = 0; i <= otherChainIds.length - chainIds.length; i++) {
                    const isMatch = chainIds.every((id, j) => id === otherChainIds[i + j])
                    if (isMatch) return true
                }
                return false
            })
            
            return !isSubChain
        })
        
        return deduplicatedChains
    }, [currentMarker.id, markers])

    // 删除标记链中的节点
    const handleRemoveFromChain = useCallback((markerId: string, chainIndex: number) => {
        const chain = markerChains[chainIndex]
        if (!chain) return

        // 找到要删除的标记在链中的位置
        const markerIndex = chain.findIndex(m => m.id === markerId)
        if (markerIndex === -1) return

        // 如果删除的是链中的第一个标记，需要从当前标记的next中移除
        if (markerIndex === 0) {
            const nextMarkerId = chain[0].id
            const currentNext = currentMarker.content.next || []
            const updatedNext = currentNext.filter(id => id !== nextMarkerId)
            
            
            updateMarkerContent(currentMarker.id, {
                title: currentMarker.content.title,
                headerImage: currentMarker.content.headerImage,
                markdownContent: currentMarker.content.markdownContent,
                next: updatedNext
            })
            
            // 触发路径重新计算
            const refreshEvent = new CustomEvent('refreshConnectionLines')
            window.dispatchEvent(refreshEvent)
        } else {
            // 如果删除的是链中间的标记，需要从前面一个标记的next中移除
            const prevMarker = chain[markerIndex - 1]
            const currentNext = prevMarker.content.next || []
            const updatedNext = currentNext.filter(id => id !== markerId)
            
            
            updateMarkerContent(prevMarker.id, {
                title: prevMarker.content.title,
                headerImage: prevMarker.content.headerImage,
                markdownContent: prevMarker.content.markdownContent,
                next: updatedNext
            })
            
            // 触发路径重新计算
            const refreshEvent = new CustomEvent('refreshConnectionLines')
            window.dispatchEvent(refreshEvent)
        }
    }, [markerChains, currentMarker, updateMarkerContent])

    // 即使没有标记链，也显示添加按钮
    // if (markerChain.length === 0) {
    //     return null
    // }

    return (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200" data-marker-chain>
            <div className="flex items-center mb-2">
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">标记链</span>
                </div>
            </div>
            
            {markerChains.length > 0 ? (
                <div className="space-y-3 min-w-0" style={{ overflow: 'visible' }}>
                    {/* 显示所有标记链 */}
                    {markerChains.map((chain, chainIndex) => {
                        // 获取当前链的所有标记ID（不包含当前标记，只包含链中的标记）
                        const chainIds = chain.map(m => m.id)
                        
                        return (
                            <div 
                                key={chainIndex} 
                                className="flex items-center space-x-2 overflow-x-auto overflow-y-visible cursor-grab hide-scrollbar w-full max-w-full min-w-0 whitespace-nowrap pr-2"
                                onMouseEnter={() => handleMouseEnter(chainIds)}
                                onMouseLeave={handleMouseLeave}
                                style={{ overflowY: 'visible', pointerEvents: 'auto' }}
                                onMouseDown={handleChainMouseDown}
                                onWheel={handleWheel}
                            >
                            {/* 当前标记指示（最左侧高亮） */}
                            <div className="flex items-center space-x-2 flex-shrink-0 mr-1">
                                <div className="inline-flex items-center h-8 rounded-full px-2.5 border border-blue-300 bg-blue-50 text-blue-700 flex-shrink-0">
                                    {(() => {
                                        const iconType = currentMarker.content.iconType || 'location'
                                        const icon = MARKER_ICONS[iconType]
                                        return (
                                            <span className="mr-1" aria-hidden>
                                                {icon.emoji}
                                            </span>
                                        )
                                    })()}
                                    <span className="text-xs font-medium">当前</span>
                                </div>
                                <div className="text-gray-300">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>

                            {chain.map((marker, index) => {
                                const iconType = marker.content.iconType || 'location'
                                const iconConfig = MARKER_ICONS[iconType]
                                
                                return (
                                    <div key={marker.id} className="flex items-center space-x-2 flex-shrink-0">
                                        {/* 箭头 */}
                                        {index > 0 && (
                                            <div className="text-gray-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        )}
                                        
                                        {/* 标记信息容器 */}
                                        <div className="relative group inline-flex items-center h-9 align-middle" style={{ overflow: 'visible' }}>
                                            <button
                                                onClick={() => {
                                                    onMarkerClick(marker.id)
                                                    // 触发flyTo跳转，保持当前zoom
                                                    const event = new CustomEvent('jumpToCenter', {
                                                        detail: {
                                                            coordinates: marker.coordinates,
                                                            zoom: null // 保持当前zoom
                                                        }
                                                    })
                                                    window.dispatchEvent(event)
                                                    
                                                    // 延迟清除高亮状态，确保选中状态先设置完成
                                                    setTimeout(() => {
                                                        clearHighlightedChain()
                                                    }, 100)
                                                }}
                                                className={cn(
                                                    'inline-flex flex-none items-center space-x-2 px-3 py-0 rounded-l-lg whitespace-nowrap',
                                                    'bg-white border border-gray-200',
                                                    'hover:bg-blue-50 hover:border-blue-300 transition-colors duration-200',
                                                    'focus:outline-none h-9 leading-none'
                                                )}
                                                style={{ borderRightWidth: 1 }}
                                            >
                                                {/* 图标 */}
                                                <div className={cn(
                                                    'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                                                    iconConfig.bgClass
                                                )}>
                                                    <span className="text-white filter drop-shadow-sm">
                                                        {iconConfig.emoji}
                                                    </span>
                                                </div>
                                                
                                                {/* 标题 */}
                                                <span className="text-sm font-medium text-gray-900 truncate max-w-32">
                                                    {marker.content.title || '未命名标记'}
                                                </span>
                                            </button>
                                            
                                            {/* 右侧删除按钮（并列块） */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleRemoveFromChain(marker.id, chainIndex)
                                                }}
                                                className={cn(
                                                    'inline-flex flex-none items-center justify-center px-2 py-0 rounded-r-lg whitespace-nowrap',
                                                    'bg-white border border-gray-200',
                                                    'hover:bg-red-50 hover:border-red-300 text-red-600 hover:text-red-700',
                                                    'transition-colors duration-200 focus:outline-none h-9 leading-none'
                                                )}
                                                title="从链中删除此标记"
                                            >
                                                <svg className="w-4 h-4 block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                            
                            {/* 每个链的添加按钮 */}
                            <div className="flex items-center space-x-2 flex-shrink-0">
                                {/* 箭头 */}
                                {chain.length > 0 && (
                                    <div className="text-gray-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                )}
                                
                                {/* 添加按钮 */}
                                <button
                                    onClick={() => {
                                        // 从当前链的最后一个标记开始添加
                                        const targetMarkerId = chain.length > 0 
                                            ? chain[chain.length - 1].id 
                                            : currentMarker.id
                                        onAddMarker(targetMarkerId)
                                    }}
                                    className={cn(
                                        'inline-flex flex-none items-center h-9 space-x-2 px-3 py-0 rounded-lg',
                                        'bg-blue-50 border-2 border-dashed border-blue-300 hover:border-blue-400',
                                        'hover:bg-blue-100 transition-all duration-200',
                                        'focus:outline-none',
                                        'shadow-sm hover:shadow-md'
                                    )}
                                >
                                    {/* 加号图标 */}
                                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </div>
                                    
                                    {/* 添加文本 */}
                                    <span className="text-sm font-medium text-blue-700">
                                        添加
                                    </span>
                                </button>
                            </div>
                        </div>
                        )
                    })}
                </div>
            ) : (
                /* 没有标记链时，只显示添加按钮 */
                <div className="flex items-center">
                    <button
                        onClick={() => onAddMarker(currentMarker.id)}
                        className={cn(
                            'inline-flex flex-none items-center h-9 space-x-2 px-3 py-0 rounded-lg',
                            'bg-blue-50 border-2 border-dashed border-blue-300 hover:border-blue-400',
                            'hover:bg-blue-100 transition-all duration-200',
                            'focus:outline-none',
                            'shadow-sm hover:shadow-md'
                        )}
                    >
                        {/* 加号图标 */}
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                        
                        {/* 添加文本 */}
                        <span className="text-sm font-medium text-blue-700">
                            添加
                        </span>
                    </button>
                </div>
            )}
            
            {/* 全宽添加按钮 - 只在有标记链时显示 */}
            {markerChains.length > 0 && (
                <div className="mt-3">
                    <button
                        onClick={() => onAddMarker(currentMarker.id)}
                        className={cn(
                            'w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg',
                            'bg-gray-50 border-2 border-dashed border-gray-300 hover:border-gray-400',
                            'hover:bg-gray-100 transition-all duration-200',
                            'focus:outline-none',
                            'shadow-sm hover:shadow-md'
                        )}
                    >
                        {/* 加号图标 */}
                        <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                        
                        {/* 添加文本 */}
                        <span className="text-sm font-medium text-gray-700">
                            从当前标记开始新的标记链
                        </span>
                    </button>
                </div>
            )}
            
            <div className="mt-2 text-xs text-gray-500">
                {markerChains.length > 0 ? '点击标记可跳转到相应位置' : '点击添加按钮选择地图上的标记'}
            </div>
        </div>
    )
}
