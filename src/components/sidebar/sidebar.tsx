'use client'

import { useRef, useCallback } from 'react'
import { useMapStore } from '@/store/map-store'
import { cn } from '@/utils/cn'
import { marked } from 'marked'

interface SidebarProps {
    onClose?: () => void
}

export const Sidebar = ({ onClose }: SidebarProps) => {
    const sidebarRef = useRef<HTMLDivElement>(null)

    const {
        markers,
        interactionState,
        closeSidebar,
        editMarkerModal,
        openEditMarkerModal,
        deleteMarker,
    } = useMapStore()

    // 自定义关闭函数，在移动端关闭时跳转到正中间
    const handleClose = useCallback(() => {
        const { selectedMarkerId } = interactionState
        
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
                console.log('Dispatched jumpToCenter event:', marker.coordinates)
            }
        }
    }, [closeSidebar, interactionState.selectedMarkerId, markers])

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
                onClick={onClose || closeSidebar}
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
                        <div className="flex items-center gap-2 mr-2">
                            <button
                                onClick={() => openEditMarkerModal(selectedMarker.id)}
                                className={cn(
                                    'px-3 py-1.5 text-xs font-medium rounded-md',
                                    'bg-blue-600 text-white hover:bg-blue-700',
                                    'transition-colors duration-200',
                                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                                )}
                            >
                                编辑
                            </button>
                            <button
                                onClick={() => deleteMarker(selectedMarker.id)}
                                className={cn(
                                    'px-3 py-1.5 text-xs font-medium rounded-md',
                                    'bg-red-600 text-white hover:bg-red-700',
                                    'transition-colors duration-200',
                                    'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                                )}
                            >
                                删除
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

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    {selectedMarker ? (
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
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