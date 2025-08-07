'use client'

import { useEffect, useRef } from 'react'
import { useMapStore } from '@/store/map-store'
import { cn } from '@/utils/cn'

export const Sidebar = () => {
    const sidebarRef = useRef<HTMLDivElement>(null)

    const {
        markers,
        interactionState,
        closeSidebar,
    } = useMapStore()

    const { isSidebarOpen, selectedMarkerId, displayedMarkerId } = interactionState

    const selectedMarker = displayedMarkerId
        ? markers.find(m => m.id === displayedMarkerId)
        : null

    // Close sidebar when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                // Check if click is not on map elements that should keep sidebar open
                const target = event.target as HTMLElement
                if (!target.closest('.map-marker') && !target.closest('.map-popup')) {
                    // Don't close if clicking on map area while viewing
                    if (!target.closest('.mapboxgl-canvas-container')) {
                        closeSidebar()
                    }
                }
            }
        }

        if (isSidebarOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isSidebarOpen, closeSidebar])

    // 渲染Editor.js内容的只读版本
    const renderReadOnlyContent = (editorData: any) => {
        if (!editorData || !editorData.blocks || editorData.blocks.length === 0) {
            return (
                <div className="text-gray-500 text-center py-8">
                    <div className="text-4xl mb-2">📝</div>
                    <p>暂无详细内容</p>
                    <p className="text-sm mt-1">通过编辑按钮添加内容</p>
                </div>
            )
        }

        return (
            <div className="space-y-4">
                {editorData.blocks.map((block: any, index: number) => {
                    switch (block.type) {
                        case 'header':
                            const level = block.data.level || 2
                            const HeaderTag = `h${level}` as keyof JSX.IntrinsicElements
                            return (
                                <HeaderTag
                                    key={index}
                                    className={cn(
                                        'font-bold text-gray-900',
                                        level === 1 && 'text-2xl',
                                        level === 2 && 'text-xl',
                                        level === 3 && 'text-lg',
                                        level >= 4 && 'text-base'
                                    )}
                                >
                                    {block.data.text || ''}
                                </HeaderTag>
                            )

                        case 'paragraph':
                            return (
                                <p key={index} className="text-gray-700 leading-relaxed">
                                    {block.data.text || ''}
                                </p>
                            )

                        case 'list':
                            const ListTag = block.data.style === 'ordered' ? 'ol' : 'ul'
                            return (
                                <ListTag
                                    key={index}
                                    className={cn(
                                        'text-gray-700 space-y-1',
                                        block.data.style === 'ordered' ? 'list-decimal list-inside' : 'list-disc list-inside'
                                    )}
                                >
                                    {(block.data.items || []).map((item: string, itemIndex: number) => (
                                        <li key={itemIndex}>{item}</li>
                                    ))}
                                </ListTag>
                            )

                        case 'quote':
                            return (
                                <blockquote key={index} className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r">
                                    <p className="text-gray-700 italic">{block.data.text || ''}</p>
                                    {block.data.caption && (
                                        <cite className="text-sm text-gray-500 mt-2 block">— {block.data.caption}</cite>
                                    )}
                                </blockquote>
                            )

                        case 'image':
                            return (
                                <div key={index} className="text-center">
                                    <img
                                        src={block.data.file?.url || block.data.url}
                                        alt={block.data.caption || '图片'}
                                        className="max-w-full h-auto rounded-lg shadow-sm mx-auto"
                                    />
                                    {block.data.caption && (
                                        <p className="text-sm text-gray-500 mt-2">{block.data.caption}</p>
                                    )}
                                </div>
                            )

                        case 'delimiter':
                            return (
                                <div key={index} className="text-center py-4">
                                    <div className="inline-flex items-center space-x-2 text-gray-400">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                    </div>
                                </div>
                            )

                        default:
                            return (
                                <div key={index} className="text-gray-500 italic">
                                    [未支持的内容类型: {block.type}]
                                </div>
                            )
                    }
                })}
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
                onClick={closeSidebar}
            />

            {/* Sidebar */}
            <div
                ref={sidebarRef}
                className={cn(
                    'fixed right-0 top-0 bottom-0 z-50',
                    'w-full max-w-md lg:max-w-lg xl:max-w-xl',
                    'bg-white shadow-2xl',
                    'transform transition-transform duration-300 ease-in-out',
                    'animate-slide-in-right',
                    'flex flex-col'
                )}
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

                    <button
                        onClick={closeSidebar}
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
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* 首图显示 */}
                            {selectedMarker.content.headerImage && (
                                <div className="flex-shrink-0">
                                    <img
                                        src={selectedMarker.content.headerImage}
                                        alt={selectedMarker.content.title || '标记首图'}
                                        className="w-full h-48 object-cover"
                                    />
                                </div>
                            )}

                            {/* 只读内容显示 */}
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
                                <div className="prose prose-sm max-w-none">
                                    {renderReadOnlyContent(selectedMarker.content.editorData)}
                                </div>
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