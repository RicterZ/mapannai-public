'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useMapStore } from '@/store/map-store'
import { Marker, MARKER_ICONS } from '@/types/marker'
import { cn } from '@/utils/cn'

interface LeftSidebarProps {
    onFlyTo: (coordinates: { longitude: number; latitude: number }, zoom?: number) => void
}

export const LeftSidebar = ({ onFlyTo }: LeftSidebarProps) => {
    const sidebarRef = useRef<HTMLDivElement>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

    const {
        markers,
        leftSidebar,
        editMode,
        closeLeftSidebar,
        selectMarker,
        openPopup,
        openSidebar,
        toggleEditMode,
    } = useMapStore()

    // 搜索已保存的标记
    const filteredMarkers = useMemo(() => {
        if (!searchQuery.trim()) {
            return markers
        }

        const query = searchQuery.toLowerCase()
        return markers.filter(marker => {
            const title = marker.content.title?.toLowerCase() || ''
            const iconType = marker.content.iconType || 'location'
            const iconName = MARKER_ICONS[iconType].name.toLowerCase()

            return title.includes(query) || iconName.includes(query)
        })
    }, [markers, searchQuery])

    // 分组：按 iconType 分组（无该类型则不显示）
    const groupedMarkers = useMemo(() => {
        const groups: Record<string, Marker[]> = {}
        for (const marker of filteredMarkers) {
            const type = marker.content.iconType || 'location'
            if (!groups[type]) groups[type] = []
            groups[type].push(marker)
        }
        return groups
    }, [filteredMarkers])

    // 当前应显示的分组顺序（仅包含非空分组）
    const visibleGroupTypes = useMemo(() => {
        return Object.keys(MARKER_ICONS).filter((type) => groupedMarkers[type] && groupedMarkers[type].length > 0)
    }, [groupedMarkers])

    // 初始化/同步展开状态：新出现的分组默认展开；消失的分组从状态中移除
    useEffect(() => {
        setExpandedGroups(prev => {
            const next: Record<string, boolean> = { ...prev }
            for (const type of visibleGroupTypes) {
                if (next[type] === undefined) next[type] = true
            }
            for (const key of Object.keys(next)) {
                if (!visibleGroupTypes.includes(key)) delete next[key]
            }
            return next
        })
    }, [visibleGroupTypes])

    // 颜色：与地图标记一致
    const getMarkerColor = (iconType: string) => {
        switch (iconType) {
            case 'hotel':
                return 'bg-green-500/50 hover:bg-green-500/50'
            case 'activity':
                return 'bg-orange-500/50 hover:bg-orange-500/50'
            case 'shopping':
                return 'bg-purple-500/50 hover:bg-purple-500/75'
            case 'location':
                return 'bg-pink-500/50 hover:bg-pink-500/75'
            case 'park':
                return 'bg-slate-500/50 hover:bg-slate-500/75'
            case 'culture':
                return 'bg-gray-500/50 hover:bg-gray-500/75'
            case 'food':
                return 'bg-zinc-500/50 hover:bg-zinc-500/75'
            case 'landmark':
                return 'bg-purple-500/50 hover:bg-purple-500/75'
            case 'natural':
                return 'bg-fuchsia-500/50 hover:bg-fuchsia-500/75'
            default:
                return 'bg-sky-500/50 hover:bg-sky-500/75'
        }
    }


    // 处理标记点击
    const handleMarkerClick = (markerId: string) => {
        const marker = markers.find(m => m.id === markerId)
        if (!marker) return

        // 飞到标记位置并放大到 15 级
        onFlyTo(marker.coordinates, 15)

        // 选择标记并打开详情
        selectMarker(markerId)

        // 打开右侧详情栏
        openSidebar()

        // 在移动端自动关闭标记列表侧边栏
        if (window.innerWidth < 1024) { // lg断点
            closeLeftSidebar()
        }
    }

    if (!leftSidebar.isOpen) {
        return null
    }

    return (
        <>
            {/* 移动端背景遮罩 */}
            <div
                className="fixed inset-0 bg-black bg-opacity-25 z-40 lg:hidden"
            />

            {/* 左侧边栏 */}
            <div
                ref={sidebarRef}
                className={cn(
                    'fixed left-0 top-0 bottom-0 z-50',
                    'w-full bg-white shadow-2xl',
                    'transform transition-transform duration-300 ease-in-out',
                    'animate-slide-in-left',
                    'flex flex-col',
                    'lg:w-80 lg:max-w-[20rem]'
                )}
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                {/* 标题栏 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-blue-50">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">标记</h2>
                    </div>

                    <button
                        onClick={closeLeftSidebar}
                        className={cn(
                            'p-2 rounded-md text-gray-400 hover:text-gray-600',
                            'hover:bg-gray-100 transition-colors duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                        )}
                        aria-label="关闭左侧边栏"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>


                {/* 编辑模式开关 */}
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className={cn(
                                "w-4 h-4 rounded-full flex items-center justify-center",
                                editMode.isEnabled ? "bg-green-100" : "bg-gray-100"
                            )}>
                                {editMode.isEnabled ? (
                                    <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                    </svg>
                                ) : (
                                    <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                    </svg>
                                )}
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                                编辑模式
                            </span>
                        </div>

                        <button
                            onClick={toggleEditMode}
                            className={cn(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                                editMode.isEnabled ? "bg-blue-600" : "bg-gray-200"
                            )}
                            role="switch"
                            aria-checked={editMode.isEnabled}
                        >
                            <span
                                className={cn(
                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                    editMode.isEnabled ? "translate-x-6" : "translate-x-1"
                                )}
                            />
                        </button>
                    </div>

                    <div className="mt-2">
                        <p className="text-xs text-gray-500">
                            {editMode.isEnabled
                                ? "可以添加、编辑和删除标记"
                                : "只能查看标记内容，无法编辑"}
                        </p>
                    </div>
                </div>



                {/* 内容区域 */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    
                    {/* 标记列表 */}
                    <div className="flex-1 overflow-hidden flex flex-col">


                    {/* 标记搜索框 */}
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索已保存的标记..."
                                className={cn(
                                    'w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl',
                                    'text-sm placeholder-gray-500 bg-white shadow-sm',
                                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                                    'focus:shadow-md transition-all duration-200',
                                    'hover:border-gray-300'
                                )}
                            />
                            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
                                >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        {searchQuery && (
                            <div className="mt-2 text-xs text-gray-600">
                                找到 {filteredMarkers.length} 个标记
                            </div>
                        )}
                    </div>

                        {filteredMarkers.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center p-8">
                                <div className="text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                                        <div className="text-2xl">
                                            {searchQuery.trim() ? '🔍' : '📍'}
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                                        {searchQuery.trim() ? '未找到匹配的标记' : '暂无已保存的标记'}
                                    </h3>
                                    <p className="text-sm text-gray-500 max-w-xs">
                                        {searchQuery.trim()
                                            ? `尝试使用不同的关键词搜索，或检查拼写是否正确`
                                            : '点击地图上的任意位置来添加你的第一个标记'}
                                    </p>
                                    {searchQuery.trim() && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="mt-3 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                        >
                                            清除搜索
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <div className="p-2 space-y-3">
                                    {visibleGroupTypes.map((type) => {
                                        const group = groupedMarkers[type]
                                        const iconConfig = MARKER_ICONS[type as keyof typeof MARKER_ICONS]
                                        const isExpanded = expandedGroups[type]
                                        return (
                                            <div key={type} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                                {/* 分组头 */}
                                                <button
                                                    onClick={() => setExpandedGroups(prev => ({ ...prev, [type]: !prev[type] }))}
                                                    className={cn(
                                                        'w-full flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200',
                                                        'hover:bg-gray-100 transition-colors duration-200'
                                                    )}
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <div className={cn(
                                                            'w-6 h-6 rounded-full flex items-center justify-center',
                                                            'border-2 border-white shadow-sm',
                                                            getMarkerColor(type)
                                                        )}>
                                                            <span className="text-white text-xs filter drop-shadow-sm">
                                                                {iconConfig.emoji}
                                                            </span>
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-800">{iconConfig.name}</span>
                                                        <span className="text-xs text-gray-500">{group.length}</span>
                                                    </div>
                                                    <svg
                                                        className={cn('w-4 h-4 text-gray-400 transition-transform duration-200', isExpanded ? 'rotate-180' : '')}
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>

                                                {/* 分组内容 */}
                                                <div className={cn(
                                                    'overflow-hidden transition-all duration-300 ease-in-out',
                                                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                                                )}>
                                                    <div className="p-2 space-y-2">
                                                        {group.map((marker) => {
                                                            const markerColor = getMarkerColor(type)
                                                            return (
                                                                <button
                                                                    key={marker.id}
                                                                    onClick={() => handleMarkerClick(marker.id)}
                                                                    className={cn(
                                                                        'w-full p-3 bg-white rounded-lg border border-gray-200',
                                                                        'hover:border-blue-300 hover:shadow-md',
                                                                        'transition-all duration-200',
                                                                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                                                                        'text-left'
                                                                    )}
                                                                >
                                                                    <div className="flex items-start">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center justify-between">
                                                                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                                                                    {marker.content.title || '未命名标记'}
                                                                                </h4>
                                                                                <span className="text-xs text-gray-500">{MARKER_ICONS[type as keyof typeof MARKER_ICONS].name}</span>
                                                                            </div>
                                                                            <p className="text-xs text-gray-500 mt-1">
                                                                                {marker.coordinates.latitude.toFixed(6)}, {marker.coordinates.longitude.toFixed(6)}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    {marker.content.headerImage && (
                                                                        <div className="mt-2">
                                                                            <img
                                                                                src={marker.content.headerImage}
                                                                                alt={marker.content.title || '标记图片'}
                                                                                className="w-full h-24 object-cover rounded-md"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
} 