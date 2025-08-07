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
    const [coordinateInput, setCoordinateInput] = useState('')
    const [coordinateError, setCoordinateError] = useState('')
    const [isCoordinateExpanded, setIsCoordinateExpanded] = useState(false)

    const {
        markers,
        leftSidebar,
        editMode,
        closeLeftSidebar,
        selectMarker,
        openPopup,
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

    // 处理坐标跳转
    const handleCoordinateJump = () => {
        const input = coordinateInput.trim()
        if (!input) {
            setCoordinateError('请输入坐标')
            return
        }

        // 解析坐标格式：支持多种格式
        // 1. "lat, lng" 格式
        // 2. "lat lng" 格式
        // 3. "纬度, 经度" 格式
        const patterns = [
            /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/, // lat, lng
            /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/, // lat lng
        ]

        let latitude: number | null = null
        let longitude: number | null = null

        for (const pattern of patterns) {
            const match = input.match(pattern)
            if (match) {
                latitude = parseFloat(match[1])
                longitude = parseFloat(match[2])
                break
            }
        }

        if (latitude === null || longitude === null) {
            setCoordinateError('坐标格式错误，请使用"纬度, 经度"格式')
            return
        }

        // 验证坐标范围
        if (latitude < -90 || latitude > 90) {
            setCoordinateError('纬度必须在-90到90之间')
            return
        }

        if (longitude < -180 || longitude > 180) {
            setCoordinateError('经度必须在-180到180之间')
            return
        }

        // 清除错误并跳转
        setCoordinateError('')
        onFlyTo({ latitude, longitude }, 14) // 使用14级缩放
        setCoordinateInput('') // 清空输入框
    }

    // 处理回车键
    const handleCoordinateKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCoordinateJump()
        }
    }

    // 处理标记点击
    const handleMarkerClick = (markerId: string) => {
        const marker = markers.find(m => m.id === markerId)
        if (!marker) return

        // 飞到标记位置（保持当前zoom级别）
        onFlyTo(marker.coordinates)

        // 选择标记并打开详情
        selectMarker(markerId)

        // 稍微延迟后打开popup，确保地图已经移动到位
        setTimeout(() => {
            openPopup(marker.coordinates)
        }, 500)
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
                    'w-80 bg-white shadow-2xl',
                    'transform transition-transform duration-300 ease-in-out',
                    'animate-slide-in-left',
                    'flex flex-col'
                )}
            >
                {/* 标题栏 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-50">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">标记搜索</h2>
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

                {/* 搜索区域 */}
                <div className="p-4 border-b border-gray-200 space-y-3">
                    {/* 坐标跳转区域 */}
                    <div className="space-y-2">
                        {/* 坐标跳转标题栏 */}
                        <button
                            onClick={() => setIsCoordinateExpanded(!isCoordinateExpanded)}
                            className={cn(
                                'w-full flex items-center justify-between p-2 rounded-md',
                                'hover:bg-gray-50 transition-colors duration-200',
                                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                            )}
                        >
                            <div className="flex items-center space-x-2">
                                <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                </div>
                                <span className="text-sm font-medium text-gray-700">坐标跳转</span>
                            </div>
                            <svg
                                className={cn(
                                    'w-4 h-4 text-gray-400 transition-transform duration-200',
                                    isCoordinateExpanded ? 'rotate-180' : ''
                                )}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {/* 坐标跳转内容 */}
                        {isCoordinateExpanded && (
                            <div className="space-y-3 animate-slide-down">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={coordinateInput}
                                        onChange={(e) => {
                                            setCoordinateInput(e.target.value)
                                            if (coordinateError) setCoordinateError('')
                                        }}
                                        onKeyDown={handleCoordinateKeyDown}
                                        placeholder="输入坐标，如: 35.452, 139.638"
                                        className={cn(
                                            'w-full pl-10 pr-12 py-2 border rounded-md text-sm',
                                            coordinateError
                                                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                                                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
                                            'focus:outline-none focus:ring-2 transition-colors duration-200'
                                        )}
                                    />
                                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                    </div>
                                    <button
                                        onClick={handleCoordinateJump}
                                        className={cn(
                                            'absolute right-2 top-1/2 transform -translate-y-1/2',
                                            'px-2 py-1 text-xs font-medium rounded',
                                            'bg-blue-600 text-white hover:bg-blue-700',
                                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                                            'transition-colors duration-200'
                                        )}
                                    >
                                        跳转
                                    </button>
                                </div>

                                {/* 错误提示 */}
                                {coordinateError && (
                                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md">
                                        {coordinateError}
                                    </div>
                                )}

                                {/* 使用说明 */}
                                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded-md">
                                    <p className="font-medium mb-1">坐标格式说明：</p>
                                    <ul className="space-y-1 text-xs">
                                        <li>• 纬度, 经度 (如: 35.452, 139.638)</li>
                                        <li>• 纬度 经度 (如: 35.452 139.638)</li>
                                        <li>• 纬度范围: -90 到 90</li>
                                        <li>• 经度范围: -180 到 180</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 标记搜索框 */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="搜索已保存的标记..."
                            className={cn(
                                'w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md',
                                'text-sm placeholder-gray-500',
                                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                                'transition-colors duration-200'
                            )}
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* 内容区域 */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* 标记列表 */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        <div className="p-3 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-sm font-medium text-gray-700">
                                {searchQuery.trim() ? '搜索结果' : '已保存的标记'} ({filteredMarkers.length})
                            </h3>
                        </div>

                        {filteredMarkers.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center p-8">
                                <div className="text-center text-gray-500">
                                    <div className="text-4xl mb-2">
                                        {searchQuery.trim() ? '🔍' : '📍'}
                                    </div>
                                    <p className="text-sm">
                                        {searchQuery.trim()
                                            ? `未找到包含"${searchQuery}"的标记`
                                            : '暂无已保存的标记'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <div className="p-2 space-y-2">
                                    {filteredMarkers.map((marker) => {
                                        const iconType = marker.content.iconType || 'location'
                                        const iconConfig = MARKER_ICONS[iconType]

                                        const getMarkerColor = (iconType: string) => {
                                            switch (iconType) {
                                                case 'hotel': return 'bg-green-500 hover:bg-green-600'
                                                case 'activity': return 'bg-orange-500 hover:bg-orange-600'
                                                case 'shopping': return 'bg-purple-500 hover:bg-purple-600'
                                                case 'location':
                                                default: return 'bg-red-500 hover:bg-red-600'
                                            }
                                        }
                                        const markerColor = getMarkerColor(iconType)

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
                                                <div className="flex items-start space-x-3">
                                                    {/* 标记图标 */}
                                                    <div className={cn(
                                                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                                                        'border-2 border-white shadow-sm',
                                                        markerColor
                                                    )}>
                                                        <span className="text-white text-xs filter drop-shadow-sm">
                                                            {iconConfig.emoji}
                                                        </span>
                                                    </div>

                                                    {/* 标记信息 */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-sm font-medium text-gray-900 truncate">
                                                                {marker.content.title || '未命名标记'}
                                                            </h4>
                                                            <span className="text-xs text-gray-500">
                                                                {iconConfig.name}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {marker.coordinates.latitude.toFixed(6)}, {marker.coordinates.longitude.toFixed(6)}
                                                        </p>
                                                        {marker.content.headerImage && (
                                                            <div className="mt-2">
                                                                <img
                                                                    src={marker.content.headerImage}
                                                                    alt={marker.content.title || '标记图片'}
                                                                    className="w-full h-16 object-cover rounded-md"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
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