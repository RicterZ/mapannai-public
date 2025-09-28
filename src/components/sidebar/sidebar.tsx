'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useMapStore } from '@/store/map-store'
import { cn } from '@/utils/cn'
import { marked } from 'marked'
import { MarkerChain } from './marker-chain'

interface SidebarProps {
    onClose?: () => void
}

export const Sidebar = ({ onClose }: SidebarProps) => {
    const sidebarRef = useRef<HTMLDivElement>(null)
    const [isAddingToChain, setIsAddingToChain] = useState(false)
    const [targetMarkerId, setTargetMarkerId] = useState<string | null>(null)

    const {
        markers,
        interactionState,
        closeSidebar,
        editMarkerModal,
        openEditMarkerModal,
        deleteMarker,
        selectMarker,
        updateMarkerContent,
    } = useMapStore()

    // 自定义关闭函数，在移动端关闭时跳转到正中间
    const handleClose = useCallback(() => {
        const { selectedMarkerId } = interactionState
        
        // 关闭添加模式
        setIsAddingToChain(false)
        setTargetMarkerId(null)
        
        closeSidebar()
        
        // 在移动端关闭标记详情时，跳转到正中间（修复之前的偏移）
        if (window.innerWidth < 1024 && selectedMarkerId) {
            const marker = markers.find(m => m.id === selectedMarkerId)
            if (marker) {
                // 立即执行跳转
                const event = new CustomEvent('jumpToCenter', {
                    detail: {
                        coordinates: marker.coordinates,
                        zoom: 15
                    }
                })
                window.dispatchEvent(event)
            }
        }
    }, [closeSidebar, interactionState.selectedMarkerId, markers])

    // 处理标记链中的标记点击
    const handleMarkerClick = useCallback((markerId: string) => {
        selectMarker(markerId)
    }, [selectMarker])

    // 处理添加标记到链中
    const handleAddToChain = useCallback((sourceMarkerId: string) => {
        setIsAddingToChain(true)
        setTargetMarkerId(sourceMarkerId)
        
        // 显示提示信息
        const event = new CustomEvent('showMessage', {
            detail: {
                type: 'info',
                message: '点击地图上的标记添加到链中',
                duration: 5000
            }
        })
        window.dispatchEvent(event)
    }, [])

    // 处理标记选择（当处于添加模式时）
    const handleMarkerSelection = useCallback((markerId: string) => {
        if (isAddingToChain) {
            if (targetMarkerId) {
                
                // 获取源标记
                const sourceMarker = markers.find(m => m.id === targetMarkerId)
                if (sourceMarker) {
                    // 更新 next 字段
                    const currentNext = sourceMarker.content.next || []
                    if (!currentNext.includes(markerId)) {
                        const updatedNext = [...currentNext, markerId]
                        
                        // 更新标记内容
                        updateMarkerContent(targetMarkerId, {
                            title: sourceMarker.content.title,
                            headerImage: sourceMarker.content.headerImage,
                            markdownContent: sourceMarker.content.markdownContent,
                            next: updatedNext
                        })
                        
                        // 触发路径重新计算
                        const refreshEvent = new CustomEvent('refreshConnectionLines')
                        window.dispatchEvent(refreshEvent)
                        
                        // 显示成功消息
                        const event = new CustomEvent('showMessage', {
                            detail: {
                                type: 'success',
                                message: '成功添加到标记链',
                                duration: 3000
                            }
                        })
                        window.dispatchEvent(event)
                    } else {
                    }
                }
            } else {
                // 如果没有目标标记，说明是直接添加模式，不需要添加到链中
                return // 直接返回，不执行后续逻辑
            }
            
            // 重置状态
            setIsAddingToChain(false)
            setTargetMarkerId(null)
        } else {
            // 正常选择标记
            selectMarker(markerId)
        }
    }, [isAddingToChain, targetMarkerId, markers, updateMarkerContent, selectMarker])

    // 监听添加标记事件
    useEffect(() => {
        const handleAddMarkerToChain = (event: CustomEvent) => {
            if (isAddingToChain) {
                handleMarkerSelection(event.detail.markerId)
            }
        }

        const handleCheckAddingMode = (event: CustomEvent) => {
            if (event.detail && event.detail.callback) {
                event.detail.callback(isAddingToChain)
            }
        }

        const handleResetAddMode = () => {
            setIsAddingToChain(false)
            setTargetMarkerId(null)
        }

        window.addEventListener('addMarkerToChain', handleAddMarkerToChain as EventListener)
        window.addEventListener('checkAddingMode', handleCheckAddingMode as EventListener)
        window.addEventListener('resetAddMode', handleResetAddMode as EventListener)

        return () => {
            window.removeEventListener('addMarkerToChain', handleAddMarkerToChain as EventListener)
            window.removeEventListener('checkAddingMode', handleCheckAddingMode as EventListener)
            window.removeEventListener('resetAddMode', handleResetAddMode as EventListener)
        }
    }, [isAddingToChain, targetMarkerId, handleMarkerSelection])

    const { isSidebarOpen, selectedMarkerId, displayedMarkerId } = interactionState

    const selectedMarker = displayedMarkerId
        ? markers.find(m => m.id === displayedMarkerId)
        : null

    // 移除“点击外部关闭”监听，避免误触导致关闭

    // 渲染Markdown内容的只读版本
    const renderReadOnlyContent = (markdownContent: string) => {
        if (!markdownContent || markdownContent.trim() === '') {
            return (
                <div className="text-gray-500 text-center py-8">
                    <div className="text-4xl mb-2">📝</div>
                    <p>暂无详细内容</p>
                    <p className="text-sm mt-1">通过编辑按钮添加内容</p>
                </div>
            )
        }

        return (
            <div className="prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: marked(markdownContent) }} />
            </div>
        )
    }

    if (!isSidebarOpen) {
        return null
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-25 z-40 lg:hidden"
                onClick={() => {
                    // 关闭添加模式
                    setIsAddingToChain(false)
                    setTargetMarkerId(null)
                    // 调用关闭函数
                    if (onClose) {
                        onClose()
                    } else {
                        closeSidebar()
                    }
                }}
            />

            {/* Sidebar */}
            <div
                ref={sidebarRef}
                className={cn(
                    'fixed z-50',
                    'w-full max-w-md lg:max-w-lg xl:max-w-xl',
                    'bg-white shadow-2xl',
                    'transform transition-transform duration-300 ease-in-out',
                    'animate-slide-in-bottom lg:animate-slide-in-right',
                    'flex flex-col',
                    // iPad特定样式
                    'sidebar-ipad-portrait sidebar-ipad-landscape',
                    // 移动端：全屏显示
                    'right-0 bottom-0 h-full',
                    // PC端：正常右侧显示
                    'lg:right-0 lg:top-0 lg:bottom-0 lg:h-auto'
                )}
                style={{ 
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)'
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-gray-900">
                            {selectedMarker?.content.title || '标记详情'}
                        </h2>
                        {selectedMarker && (
                            <p className="text-sm text-gray-500 mt-1">
                                位置: {selectedMarker.coordinates.latitude.toFixed(6)}, {selectedMarker.coordinates.longitude.toFixed(6)}
                            </p>
                        )}
                    </div>

                    {selectedMarker && (
                        <div className="flex items-center gap-1 mr-2">
                            {/* 编辑按钮 */}
                            <button
                                onClick={() => openEditMarkerModal(selectedMarker.id)}
                                className={cn(
                                    'p-2 rounded-lg text-gray-500 hover:text-blue-600',
                                    'hover:bg-blue-50 transition-all duration-200',
                                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                                    'min-h-[40px] min-w-[40px] flex items-center justify-center'
                                )}
                                title="编辑标记"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                            
                            {/* 删除按钮 */}
                            <button
                                onClick={() => {
                                    // 单次确认机制
                                    const confirmed = confirm('🗑️ 确定要删除这个标记吗？删除后无法恢复。')
                                    if (confirmed) {
                                        deleteMarker(selectedMarker.id)
                                    }
                                }}
                                className={cn(
                                    'p-2 rounded-lg text-gray-500 hover:text-red-600',
                                    'hover:bg-red-50 transition-all duration-200',
                                    'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
                                    'min-h-[40px] min-w-[40px] flex items-center justify-center'
                                )}
                                title="删除标记"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handleClose}
                        className={cn(
                            'ml-4 p-2 rounded-md text-gray-400 hover:text-gray-600',
                            'hover:bg-gray-100 transition-colors duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                        )}
                        aria-label="关闭侧边栏"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 添加模式指示器 */}
                {isAddingToChain && (
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-blue-700">添加模式</span>
                            <span className="text-xs text-blue-600">点击地图上的标记添加到链中</span>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    {selectedMarker ? (
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible custom-scrollbar">
                            {/* 标记链 */}
                            <MarkerChain 
                                currentMarker={selectedMarker} 
                                onMarkerClick={handleMarkerClick}
                                onAddMarker={handleAddToChain}
                            />

                            {/* 首图显示 */}
                            {selectedMarker.content.headerImage && (
                                <div className="w-full">
                                    <img
                                        src={selectedMarker.content.headerImage}
                                        alt={selectedMarker.content.title || '标记首图'}
                                        className="w-full h-48 object-cover"
                                    />
                                </div>
                            )}

                            {/* 只读内容显示 */}
                            <div className="p-4">
                                {renderReadOnlyContent(selectedMarker.content.markdownContent)}
                            </div>
                        </div>
                    ) : (
                        // 无选中标记时的提示
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="text-center text-gray-500">
                                <div className="text-6xl mb-4">🗺️</div>
                                <h3 className="text-lg font-medium mb-2">选择一个标记</h3>
                                <p className="text-sm">点击地图上的标记查看详细内容</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
} 