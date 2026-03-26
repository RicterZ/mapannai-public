'use client'

import { useMapStore } from '@/store/map-store'
import { cn } from '@/utils/cn'

// Format ISO date as "3月1日（周五）"
function formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00')
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`
}

// Get ordinal day number within a trip
function getDayNumber(tripId: string, dayId: string, tripDays: ReturnType<typeof useMapStore.getState>['tripDays']): number {
    const days = tripDays
        .filter(d => d.tripId === tripId)
        .sort((a, b) => a.date.localeCompare(b.date))
    const idx = days.findIndex(d => d.id === dayId)
    return idx + 1
}

export const ViewModeBanner = () => {
    const { activeView, trips, tripDays, setActiveView } = useMapStore()

    if (activeView.mode === 'overview') return null

    const trip = trips.find(t => t.id === activeView.tripId)
    const day = tripDays.find(d => d.id === activeView.dayId)
    const totalDays = tripDays.filter(d => d.tripId === activeView.tripId).length
    const dayNum = activeView.dayId && activeView.tripId
        ? getDayNumber(activeView.tripId, activeView.dayId, tripDays)
        : null

    return (
        <div
            className={cn(
                'fixed left-1/2 -translate-x-1/2 -translate-y-1/2 z-40',
                'bg-white/95 backdrop-blur border border-gray-200 shadow-lg rounded-full',
                'flex items-center gap-1 px-3 py-1.5 text-sm max-w-[90vw]',
                'animate-scale-in'
            )}
            style={{ top: 'calc(env(safe-area-inset-top) + env(safe-area-inset-top) + 36px)' }}
        >
            {/* Breadcrumb */}
            <button
                onClick={() => setActiveView('overview', null, null)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-xs px-1 flex-shrink-0"
                title="返回全览"
            >
                全览
            </button>

            <span className="text-gray-300 flex-shrink-0">›</span>

            {/* Trip name */}
            <button
                onClick={() => setActiveView('trip', activeView.tripId, null)}
                className={cn(
                    'font-medium transition-colors truncate max-w-[120px]',
                    activeView.mode === 'trip' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-500'
                )}
                title={trip?.name}
            >
                {trip?.name ?? '旅行'}
            </button>

            {/* Day breadcrumb (only in day mode) */}
            {activeView.mode === 'day' && day && (
                <>
                    <span className="text-gray-300 flex-shrink-0">›</span>
                    <span className="font-medium text-blue-600 truncate max-w-[140px]" title={day.date}>
                        {day.title || `第${dayNum}天`}
                        <span className="ml-1 text-xs text-gray-400 font-normal hidden sm:inline">
                            · {formatDate(day.date)}
                        </span>
                    </span>
                </>
            )}

            {/* Progress (trip mode: Day X/Y) */}
            {activeView.mode === 'trip' && totalDays > 0 && (
                <span className="text-xs text-gray-400 ml-1 flex-shrink-0">{totalDays}天</span>
            )}

            {/* Exit button */}
            <button
                onClick={() => setActiveView('overview', null, null)}
                className="ml-1 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors flex-shrink-0"
                title="退出旅行模式"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    )
}
