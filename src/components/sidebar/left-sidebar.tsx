'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useMapStore } from '@/store/map-store'
import { MARKER_ICONS } from '@/types/marker'
import { Trip, TripDay } from '@/types/trip'
import { cn } from '@/utils/cn'
import { CreateTripModal } from '@/components/modal/create-trip-modal'

interface LeftSidebarProps {
    onFlyTo: (coordinates: { longitude: number; latitude: number }, zoom?: number) => void
}

// Format ISO date as "3月1日（周五）"
function formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00')
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`
}

function getMarkerColor(iconType: string): string {
    const map: Record<string, string> = {
        hotel: 'bg-green-500/50', activity: 'bg-orange-500/50',
        shopping: 'bg-purple-500/50', location: 'bg-pink-500/50',
        park: 'bg-slate-500/50', culture: 'bg-gray-500/50',
        food: 'bg-zinc-500/50', landmark: 'bg-purple-500/50',
        natural: 'bg-fuchsia-500/50',
        transit: 'bg-blue-500/50',
    }
    return map[iconType] || 'bg-sky-500/50'
}

export const LeftSidebar = ({ onFlyTo }: LeftSidebarProps) => {
    const {
        markers, trips, tripDays, activeView,
        leftSidebar, closeLeftSidebar,
        selectMarker, openSidebar,
        setActiveView, deleteTrip,
        removeMarkerFromDay,
    } = useMapStore()

    const [showCreateTrip, setShowCreateTrip] = useState(false)
    const [confirmDeleteTripId, setConfirmDeleteTripId] = useState<string | null>(null)

    // ── Derived data ────────────────────────────────────────────────────────

    const currentTrip = useMemo(() =>
        trips.find(t => t.id === activeView.tripId) ?? null,
        [trips, activeView.tripId]
    )

    const currentTripDays = useMemo(() =>
        tripDays
            .filter(d => d.tripId === activeView.tripId)
            .sort((a, b) => a.date.localeCompare(b.date)),
        [tripDays, activeView.tripId]
    )

    const currentDay = useMemo(() =>
        tripDays.find(d => d.id === activeView.dayId) ?? null,
        [tripDays, activeView.dayId]
    )

    const currentDayMarkers = useMemo(() => {
        if (!currentDay) return []
        return currentDay.markerIds
            .map(id => markers.find(m => m.id === id))
            .filter(Boolean) as typeof markers
    }, [currentDay, markers])

    // Unassigned markers: those with no tripDayEntries
    const unassignedMarkers = useMemo(() =>
        markers.filter(m => !m.content.tripDayEntries?.length),
        [markers]
    )

    // ── Handlers ────────────────────────────────────────────────────────────

    const handleMarkerClick = (markerId: string) => {
        const marker = markers.find(m => m.id === markerId)
        if (!marker) return
        onFlyTo(marker.coordinates, 15)
        selectMarker(markerId)
        openSidebar()
        if (window.innerWidth < 1024) closeLeftSidebar()
    }

    const handleDeleteTrip = async (tripId: string) => {
        try {
            await deleteTrip(tripId)
            toast.success('旅行已删除')
            setConfirmDeleteTripId(null)
        } catch {
            toast.error('删除失败，请重试')
        }
    }

    const handleRemoveMarkerFromDay = async (markerId: string) => {
        if (!activeView.tripId || !activeView.dayId) return
        try {
            await removeMarkerFromDay(activeView.tripId, activeView.dayId, markerId)
            toast.success('已从当天移除')
        } catch {
            toast.error('操作失败')
        }
    }

    if (!leftSidebar.isOpen) return null

    // ── Render helpers ───────────────────────────────────────────────────────

    const renderHeader = () => (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-blue-50 flex-shrink-0">
            <div className="flex items-center gap-2">
                {/* Back button */}
                {activeView.mode === 'trip' && (
                    <button
                        onClick={() => setActiveView('overview', null, null)}
                        className="mr-1 p-1 rounded-lg text-gray-500 hover:bg-white/80 hover:text-blue-600 transition-colors"
                        title="返回全览"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}
                {activeView.mode === 'day' && (
                    <button
                        onClick={() => setActiveView('trip', activeView.tripId, null)}
                        className="mr-1 p-1 rounded-lg text-gray-500 hover:bg-white/80 hover:text-blue-600 transition-colors"
                        title="返回旅行"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}

                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                    {activeView.mode === 'overview' ? '🗺' : activeView.mode === 'trip' ? '✈️' : '📅'}
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-gray-900 leading-tight">
                        {activeView.mode === 'overview' && '全览'}
                        {activeView.mode === 'trip' && (currentTrip?.name ?? '旅行')}
                        {activeView.mode === 'day' && (currentDay?.title || (() => {
                            const idx = currentTripDays.findIndex(d => d.id === activeView.dayId)
                            return `第${idx + 1}天`
                        })())}
                    </h2>
                    {activeView.mode === 'trip' && currentTrip && (
                        <p className="text-xs text-gray-500">
                            {currentTrip.startDate.slice(5).replace('-', '/')} ~ {currentTrip.endDate.slice(5).replace('-', '/')}
                            {' · '}{currentTripDays.length}天
                        </p>
                    )}
                    {activeView.mode === 'day' && currentDay && (
                        <p className="text-xs text-gray-500">{formatDate(currentDay.date)}</p>
                    )}
                </div>
            </div>

            <button
                onClick={closeLeftSidebar}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors"
                aria-label="关闭"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    )

    // ── Overview view ─────────────────────────────────────────────────────────
    const renderOverview = () => (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-3 space-y-2">
                {/* Create trip button */}
                <button
                    onClick={() => setShowCreateTrip(true)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm font-medium"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    新建旅行
                </button>

                {/* Trip list */}
                {trips.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <div className="text-3xl mb-2">✈️</div>
                        <p className="text-sm">还没有旅行记录</p>
                        <p className="text-xs mt-1">点击上方创建你的第一次旅行</p>
                    </div>
                ) : (
                    trips
                        .slice()
                        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                        .map(trip => {
                            const days = tripDays.filter(d => d.tripId === trip.id)
                            const totalMarkers = Array.from(new Set(days.flatMap(d => d.markerIds))).length
                            return (
                                <div key={trip.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                                    <button
                                        onClick={() => setActiveView('trip', trip.id, null)}
                                        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-blue-50 transition-colors text-left"
                                    >
                                        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">✈️</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm text-gray-900 truncate">{trip.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {trip.startDate.slice(5).replace('-', '/')} ~ {trip.endDate.slice(5).replace('-', '/')}
                                                {' · '}{days.length}天 · {totalMarkers}个地点
                                            </div>
                                        </div>
                                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>

                                    {/* Delete confirm */}
                                    {confirmDeleteTripId === trip.id ? (
                                        <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 bg-red-50">
                                            <span className="text-xs text-red-600 flex-1">确认删除此旅行？</span>
                                            <button onClick={() => handleDeleteTrip(trip.id)} className="px-2 py-1 bg-red-500 text-white rounded text-xs">删除</button>
                                            <button onClick={() => setConfirmDeleteTripId(null)} className="px-2 py-1 bg-gray-200 rounded text-xs">取消</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmDeleteTripId(trip.id)}
                                            className="w-full px-3 py-1.5 border-t border-gray-100 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-left"
                                        >
                                            删除旅行
                                        </button>
                                    )}
                                </div>
                            )
                        })
                )}

                {/* Unassigned markers */}
                {unassignedMarkers.length > 0 && (
                    <div className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
                        <div className="px-3 py-2 border-b border-gray-200">
                            <span className="text-xs font-medium text-gray-500">📍 未分配标记 ({unassignedMarkers.length})</span>
                        </div>
                        <div className="p-2 space-y-1">
                            {unassignedMarkers.slice(0, 5).map(m => (
                                <button key={m.id} onClick={() => handleMarkerClick(m.id)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white text-sm text-gray-700 truncate transition-colors">
                                    {MARKER_ICONS[m.content.iconType || 'location']?.emoji} {m.content.title || '未命名标记'}
                                </button>
                            ))}
                            {unassignedMarkers.length > 5 && (
                                <p className="text-xs text-gray-400 text-center py-1">还有 {unassignedMarkers.length - 5} 个…</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )

    // ── Trip view ─────────────────────────────────────────────────────────────
    const renderTripView = () => (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-3 space-y-2">
                {currentTripDays.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <div className="text-3xl mb-2">📅</div>
                        <p className="text-sm">暂无行程天</p>
                    </div>
                ) : (
                    currentTripDays.map((day, idx) => {
                        const dayMarkers = day.markerIds
                            .map(id => markers.find(m => m.id === id))
                            .filter(Boolean) as typeof markers
                        return (
                            <button
                                key={day.id}
                                onClick={() => setActiveView('day', activeView.tripId, day.id)}
                                className="w-full flex items-center gap-3 px-3 py-3 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                            >
                                <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600 flex-shrink-0">
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-900">
                                        {day.title || `第${idx + 1}天`}
                                        <span className="ml-1.5 text-xs text-gray-400 font-normal">{formatDate(day.date)}</span>
                                    </div>
                                    {dayMarkers.length > 0 ? (
                                        <div className="text-xs text-gray-500 truncate mt-0.5">
                                            {dayMarkers.map(m => m.content.title || '未命名').join(' · ')}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-400 mt-0.5">暂无地点</div>
                                    )}
                                </div>
                                <div className="text-xs text-gray-400 flex-shrink-0">{dayMarkers.length}个</div>
                                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )

    // ── Day view ──────────────────────────────────────────────────────────────
    const renderDayView = () => (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-3 space-y-2">
                {currentDayMarkers.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <div className="text-3xl mb-2">📍</div>
                        <p className="text-sm">当天暂无地点</p>
                        <p className="text-xs mt-1">点击地图标记上的「加入今天」来添加</p>
                    </div>
                ) : (
                    currentDayMarkers.map((marker, idx) => {
                        const icon = MARKER_ICONS[marker.content.iconType || 'location'] || MARKER_ICONS.location
                        return (
                            <div key={marker.id} className="flex items-center gap-2 border border-gray-200 rounded-xl bg-white overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-2.5 flex-1 min-w-0">
                                    <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">{idx + 1}</span>
                                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0', getMarkerColor(marker.content.iconType || 'location'))}>
                                        <span className="text-xs text-white">{icon.emoji}</span>
                                    </div>
                                    <button
                                        className="flex-1 text-left text-sm font-medium text-gray-800 truncate"
                                        onClick={() => handleMarkerClick(marker.id)}
                                    >
                                        {marker.content.title || '未命名标记'}
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleRemoveMarkerFromDay(marker.id)}
                                    className="px-3 py-2.5 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 border-l border-gray-100"
                                    title="从当天移除"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-25 z-40 lg:hidden" onClick={closeLeftSidebar} />

            <div
                className={cn(
                    'fixed left-0 top-0 bottom-0 z-50',
                    'w-full bg-white shadow-2xl',
                    'transform transition-transform duration-300 ease-in-out',
                    'animate-slide-in-left flex flex-col',
                    'lg:w-72 lg:max-w-[18rem]'
                )}
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                {renderHeader()}

                {activeView.mode === 'overview' && renderOverview()}
                {activeView.mode === 'trip' && renderTripView()}
                {activeView.mode === 'day' && renderDayView()}
            </div>

            <CreateTripModal isOpen={showCreateTrip} onClose={() => setShowCreateTrip(false)} />
        </>
    )
}
