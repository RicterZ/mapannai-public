'use client'

import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    closestCenter,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
    useDroppable,
} from '@dnd-kit/core'
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMapStore } from '@/store/map-store'
import { MARKER_ICONS, Marker } from '@/types/marker'
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

// ── SortableItem ─────────────────────────────────────────────────────────────

interface SortableItemProps {
    id: string
    marker: Marker
    index: number
    hasArrowAfter: boolean
    onMarkerClick: (markerId: string) => void
    onRemove: (markerId: string) => void
    isDragging?: boolean
}

function SortableItem({
    id,
    marker,
    index,
    hasArrowAfter,
    onMarkerClick,
    onRemove,
    isDragging = false,
}: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging,
    } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    const icon = MARKER_ICONS[marker.content.iconType || 'location'] || MARKER_ICONS.location

    return (
        <div ref={setNodeRef} style={style} className={cn(isSortableDragging && 'opacity-40')}>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl bg-white overflow-hidden">
                {/* Drag handle */}
                <button
                    {...attributes}
                    {...listeners}
                    className="pl-2 py-2.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
                    aria-label="拖拽排序"
                >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6-8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                    </svg>
                </button>

                <div className="flex items-center gap-2 py-2.5 flex-1 min-w-0">
                    <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">{index + 1}</span>
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0', getMarkerColor(marker.content.iconType || 'location'))}>
                        <span className="text-xs text-white">{icon.emoji}</span>
                    </div>
                    <button
                        className="flex-1 text-left text-sm font-medium text-gray-800 truncate"
                        onClick={() => onMarkerClick(marker.id)}
                    >
                        {marker.content.title || '未命名标记'}
                    </button>
                </div>
                <button
                    onClick={() => onRemove(marker.id)}
                    className="px-3 py-2.5 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 border-l border-gray-100"
                    title="从当天移除"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {hasArrowAfter && (
                <div className="flex justify-center py-0.5">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            )}
        </div>
    )
}

// Ghost item rendered in DragOverlay
function DragGhostItem({ marker, index }: { marker: Marker; index: number }) {
    const icon = MARKER_ICONS[marker.content.iconType || 'location'] || MARKER_ICONS.location
    return (
        <div className="flex items-center gap-2 border border-blue-300 rounded-xl bg-white shadow-lg overflow-hidden opacity-90">
            <div className="pl-2 py-2.5 text-gray-300 flex-shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6-8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                </svg>
            </div>
            <div className="flex items-center gap-2 py-2.5 flex-1 min-w-0 pr-3">
                <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">{index + 1}</span>
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0', getMarkerColor(marker.content.iconType || 'location'))}>
                    <span className="text-xs text-white">{icon.emoji}</span>
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                    {marker.content.title || '未命名标记'}
                </span>
            </div>
        </div>
    )
}

// Droppable container for isolated items
function IsolatedDropZone({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id: 'isolated' })
    return (
        <div
            ref={setNodeRef}
            className={cn(
                'min-h-[40px] rounded-xl transition-colors',
                isOver && 'bg-amber-50 ring-2 ring-amber-300 ring-dashed',
                isEmpty && isOver && 'p-2'
            )}
        >
            {children}
            {isEmpty && isOver && (
                <div className="text-xs text-amber-500 text-center py-1">拖放至此变为孤立地点</div>
            )}
        </div>
    )
}

// ── Data types ────────────────────────────────────────────────────────────────

interface OrderedItem {
    marker: Marker
    hasArrowAfter: boolean
}

interface ChainGroup {
    id: string       // e.g. "chain-0", "chain-1"
    items: OrderedItem[]
}

// ── Main component ────────────────────────────────────────────────────────────

export const LeftSidebar = ({ onFlyTo }: LeftSidebarProps) => {
    const {
        markers, trips, tripDays, activeView,
        leftSidebar, closeLeftSidebar,
        selectMarker, openSidebar,
        setActiveView, deleteTrip,
        removeMarkerFromDay,
        updateMarkerContent,
        setHighlightedChain,
        clearHighlightedChain,
    } = useMapStore()

    const [showCreateTrip, setShowCreateTrip] = useState(false)
    const [confirmDeleteTripId, setConfirmDeleteTripId] = useState<string | null>(null)
    const [activeDragId, setActiveDragId] = useState<string | null>(null)
    const [activeOverContainer, setActiveOverContainer] = useState<string | null>(null)

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

    // Build chain groups + isolated items from the current day's markers
    const { chainGroups, isolatedItems } = useMemo(() => {
        if (!currentDay || currentDayMarkers.length === 0) {
            return { chainGroups: [] as ChainGroup[], isolatedItems: [] as OrderedItem[] }
        }

        const dayIdSet = new Set(currentDay.markerIds)

        // Build in-day next map and in-degree map
        const dayNextMap = new Map<string, string[]>()
        const inDegree = new Map<string, number>()
        for (const m of currentDayMarkers) inDegree.set(m.id, 0)
        for (const m of currentDayMarkers) {
            const dayNext = (m.content.next || []).filter(id => dayIdSet.has(id))
            dayNextMap.set(m.id, dayNext)
            for (const nid of dayNext) inDegree.set(nid, (inDegree.get(nid) || 0) + 1)
        }

        const visited = new Set<string>()
        const chains: ChainGroup[] = []

        // Walk chains starting from nodes with in-degree 0 and out-degree > 0
        const starters = currentDayMarkers.filter(
            m => inDegree.get(m.id) === 0 && (dayNextMap.get(m.id) || []).length > 0
        )
        for (let gi = 0; gi < starters.length; gi++) {
            const starter = starters[gi]
            const chainItems: OrderedItem[] = []
            let cur: Marker | undefined = starter
            while (cur && !visited.has(cur.id)) {
                visited.add(cur.id)
                const nextId: string | undefined = (dayNextMap.get(cur.id) || []).find(id => !visited.has(id))
                const nextMarker: Marker | undefined = nextId ? currentDayMarkers.find(m => m.id === nextId) : undefined
                chainItems.push({ marker: cur, hasArrowAfter: !!nextMarker })
                cur = nextMarker
            }
            if (chainItems.length > 0) {
                chains.push({ id: `chain-${gi}`, items: chainItems })
            }
        }

        // Isolated: not visited, in-degree 0, out-degree 0
        const isolated: OrderedItem[] = []
        for (const m of currentDayMarkers) {
            if (!visited.has(m.id)) {
                isolated.push({ marker: m, hasArrowAfter: false })
            }
        }

        return { chainGroups: chains, isolatedItems: isolated }
    }, [currentDay, currentDayMarkers])

    // Flat ordered list for display indices
    const allItems = useMemo(() => {
        const result: OrderedItem[] = []
        for (const group of chainGroups) result.push(...group.items)
        result.push(...isolatedItems)
        return result
    }, [chainGroups, isolatedItems])

    // Unassigned markers: those with no tripDayEntries
    const unassignedMarkers = useMemo(() =>
        markers.filter(m => !m.content.tripDayEntries?.length),
        [markers]
    )

    // ── next-link helpers ─────────────────────────────────────────────────────

    // Update a marker's next array and persist to Dataset
    const updateNext = useCallback((markerId: string, newNext: string[]) => {
        const marker = markers.find(m => m.id === markerId)
        if (!marker) return
        updateMarkerContent(markerId, {
            title: marker.content.title,
            headerImage: marker.content.headerImage,
            markdownContent: marker.content.markdownContent,
            next: newNext,
        })
    }, [markers, updateMarkerContent])

    // Find who points to targetId in the current day (unused but kept for future use)
    // const findPrev = useCallback((targetId: string): string | null => { ... })

    // ── Drag and drop ─────────────────────────────────────────────────────────

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveDragId(event.active.id as string)
    }, [])

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const overId = event.over?.id as string | undefined
        if (!overId) {
            setActiveOverContainer(null)
            return
        }
        // Determine which container we're over
        if (overId === 'isolated') {
            setActiveOverContainer('isolated')
            return
        }
        // Check if over a chain container
        for (const group of chainGroups) {
            if (overId === group.id || group.items.some(i => i.marker.id === overId)) {
                setActiveOverContainer(group.id)
                return
            }
        }
        // Check if over an isolated item
        if (isolatedItems.some(i => i.marker.id === overId)) {
            setActiveOverContainer('isolated')
            return
        }
        setActiveOverContainer(null)
    }, [chainGroups, isolatedItems])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        setActiveDragId(null)
        setActiveOverContainer(null)

        if (!over || active.id === over.id) return

        const dragId = active.id as string
        const overId = over.id as string

        // Find source container
        let sourceContainer: string | null = null
        let sourceChainGroup: ChainGroup | null = null
        for (const group of chainGroups) {
            if (group.items.some(i => i.marker.id === dragId)) {
                sourceContainer = group.id
                sourceChainGroup = group
                break
            }
        }
        if (!sourceContainer && isolatedItems.some(i => i.marker.id === dragId)) {
            sourceContainer = 'isolated'
        }

        // Find target container
        let targetContainer: string | null = null
        let targetChainGroup: ChainGroup | null = null
        if (overId === 'isolated') {
            targetContainer = 'isolated'
        } else {
            for (const group of chainGroups) {
                if (overId === group.id || group.items.some(i => i.marker.id === overId)) {
                    targetContainer = group.id
                    targetChainGroup = group
                    break
                }
            }
            if (!targetContainer && isolatedItems.some(i => i.marker.id === overId)) {
                targetContainer = 'isolated'
            }
        }

        if (!sourceContainer || !targetContainer) return

        // ── Case 1: Chain-internal reorder ──────────────────────────────────
        if (sourceContainer === targetContainer && sourceContainer.startsWith('chain-') && sourceChainGroup) {
            const chainIds = sourceChainGroup.items.map(i => i.marker.id)
            const fromIdx = chainIds.indexOf(dragId)
            const toIdx = overId === sourceChainGroup.id ? 0 : chainIds.indexOf(overId)
            if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return

            // Build new order
            const newOrder = [...chainIds]
            newOrder.splice(fromIdx, 1)
            newOrder.splice(toIdx, 0, dragId)

            // Rebuild next links: each node points to next in newOrder
            for (let i = 0; i < newOrder.length; i++) {
                const id = newOrder[i]
                const marker = currentDayMarkers.find(m => m.id === id)
                if (!marker) continue
                // Keep non-day next links, rebuild day-internal next
                const externalNext = (marker.content.next || []).filter(nid => !currentDay?.markerIds.includes(nid))
                const newNext = i < newOrder.length - 1
                    ? [...externalNext, newOrder[i + 1]]
                    : externalNext
                updateNext(id, newNext)
            }
        }

        // ── Case 2: Isolated → Chain ─────────────────────────────────────────
        else if (sourceContainer === 'isolated' && targetContainer.startsWith('chain-') && targetChainGroup) {
            const chainIds = targetChainGroup.items.map(i => i.marker.id)
            let insertIdx = overId === targetChainGroup.id ? chainIds.length : chainIds.indexOf(overId)
            if (insertIdx === -1) insertIdx = chainIds.length

            // New chain order after insertion
            const newOrder = [...chainIds]
            newOrder.splice(insertIdx, 0, dragId)

            // Rebuild next links for the whole chain
            for (let i = 0; i < newOrder.length; i++) {
                const id = newOrder[i]
                const marker = currentDayMarkers.find(m => m.id === id)
                if (!marker) continue
                const externalNext = (marker.content.next || []).filter(nid => !currentDay?.markerIds.includes(nid))
                const newNext = i < newOrder.length - 1
                    ? [...externalNext, newOrder[i + 1]]
                    : externalNext
                updateNext(id, newNext)
            }
        }

        // ── Case 3: Chain → Isolated ─────────────────────────────────────────
        else if (sourceContainer.startsWith('chain-') && targetContainer === 'isolated' && sourceChainGroup) {
            const chainIds = sourceChainGroup.items.map(i => i.marker.id)
            const removeIdx = chainIds.indexOf(dragId)
            if (removeIdx === -1) return

            // Rebuild remaining chain without dragId
            const newOrder = chainIds.filter(id => id !== dragId)

            for (let i = 0; i < newOrder.length; i++) {
                const id = newOrder[i]
                const marker = currentDayMarkers.find(m => m.id === id)
                if (!marker) continue
                const externalNext = (marker.content.next || []).filter(nid => !currentDay?.markerIds.includes(nid))
                const newNext = i < newOrder.length - 1
                    ? [...externalNext, newOrder[i + 1]]
                    : externalNext
                updateNext(id, newNext)
            }

            // Clear the dragged node's day-internal next links
            const dragMarker = currentDayMarkers.find(m => m.id === dragId)
            if (dragMarker) {
                const externalNext = (dragMarker.content.next || []).filter(nid => !currentDay?.markerIds.includes(nid))
                updateNext(dragId, externalNext)
            }
        }

        // ── Case 4: Isolated → Isolated (reorder within isolated) ────────────
        else if (sourceContainer === 'isolated' && targetContainer === 'isolated') {
            // No chain links to update — just visual order, nothing to persist
        }

        // ── Case 5: Chain → different Chain ─────────────────────────────────
        else if (sourceContainer.startsWith('chain-') && targetContainer.startsWith('chain-') && sourceChainGroup && targetChainGroup && sourceChainGroup.id !== targetChainGroup.id) {
            // Remove from source chain
            const srcIds = sourceChainGroup.items.map(i => i.marker.id).filter(id => id !== dragId)
            for (let i = 0; i < srcIds.length; i++) {
                const id = srcIds[i]
                const marker = currentDayMarkers.find(m => m.id === id)
                if (!marker) continue
                const externalNext = (marker.content.next || []).filter(nid => !currentDay?.markerIds.includes(nid))
                const newNext = i < srcIds.length - 1 ? [...externalNext, srcIds[i + 1]] : externalNext
                updateNext(id, newNext)
            }
            // Clear source node's day links
            const dragMarker = currentDayMarkers.find(m => m.id === dragId)
            if (dragMarker) {
                const externalNext = (dragMarker.content.next || []).filter(nid => !currentDay?.markerIds.includes(nid))
                updateNext(dragId, externalNext)
            }

            // Insert into target chain
            const tgtIds = targetChainGroup.items.map(i => i.marker.id)
            let insertIdx = overId === targetChainGroup.id ? tgtIds.length : tgtIds.indexOf(overId)
            if (insertIdx === -1) insertIdx = tgtIds.length
            const newTgtOrder = [...tgtIds]
            newTgtOrder.splice(insertIdx, 0, dragId)
            for (let i = 0; i < newTgtOrder.length; i++) {
                const id = newTgtOrder[i]
                const marker = currentDayMarkers.find(m => m.id === id)
                if (!marker) continue
                const externalNext = (marker.content.next || []).filter(nid => !currentDay?.markerIds.includes(nid))
                const newNext = i < newTgtOrder.length - 1 ? [...externalNext, newTgtOrder[i + 1]] : externalNext
                updateNext(id, newNext)
            }
        }
    }, [chainGroups, isolatedItems, currentDayMarkers, currentDay, updateNext])

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

    // Active drag marker info
    const activeDragMarker = activeDragId ? currentDayMarkers.find(m => m.id === activeDragId) : null
    const activeDragIndex = activeDragId ? allItems.findIndex(i => i.marker.id === activeDragId) : -1

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

                {/* Unassigned markers — grouped by icon type */}
                {unassignedMarkers.length > 0 && (
                    <>
                        <div className="flex items-center gap-2 px-1 py-1">
                            <div className="flex-1 border-t border-gray-200" />
                            <span className="text-[10px] text-gray-400 flex-shrink-0">独立标记</span>
                            <div className="flex-1 border-t border-gray-200" />
                        </div>
                        {(() => {
                            // Group by iconType, preserve order of first appearance
                            const groups = new Map<string, Marker[]>()
                            unassignedMarkers.forEach(m => {
                                const type = m.content.iconType || 'location'
                                if (!groups.has(type)) groups.set(type, [])
                                groups.get(type)!.push(m)
                            })
                            return Array.from(groups.entries()).map(([type, groupMarkers]) => {
                                const iconConfig = MARKER_ICONS[type as keyof typeof MARKER_ICONS] || MARKER_ICONS.location
                                return (
                                    <div key={type}>
                                        {/* Group header */}
                                        <div className="flex items-center gap-1.5 px-1 py-1.5">
                                            <span className="text-sm">{iconConfig.emoji}</span>
                                            <span className="text-xs font-medium text-gray-500">{iconConfig.name}</span>
                                            <span className="text-[10px] text-gray-400">({groupMarkers.length})</span>
                                        </div>
                                        {/* Cards */}
                                        <div className="space-y-1.5">
                                            {groupMarkers.map(m => (
                                                <div key={m.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                                                    {m.content.headerImage && (
                                                        <div className="w-full h-24 bg-gray-100">
                                                            <img
                                                                src={m.content.headerImage}
                                                                alt={m.content.title || ''}
                                                                className="w-full h-full object-cover"
                                                                onError={e => { e.currentTarget.style.display = 'none' }}
                                                            />
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleMarkerClick(m.id)}
                                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left"
                                                    >
                                                        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0', getMarkerColor(m.content.iconType || 'location'))}>
                                                            {iconConfig.emoji}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm text-gray-900 truncate">{m.content.title || '未命名标记'}</div>
                                                            {m.content.address && (
                                                                <div className="text-xs text-gray-400 truncate mt-0.5">{m.content.address}</div>
                                                            )}
                                                        </div>
                                                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })
                        })()}
                    </>
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
    const renderDayView = () => {
        const hasAnyItems = chainGroups.length > 0 || isolatedItems.length > 0

        if (!hasAnyItems) {
            return (
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-3">
                        <div className="text-center py-8 text-gray-400">
                            <div className="text-3xl mb-2">📍</div>
                            <p className="text-sm">当天暂无地点</p>
                            <p className="text-xs mt-1">点击地图标记上的「加入今天」来添加</p>
                        </div>
                    </div>
                </div>
            )
        }

        // Accumulate display index across all items
        let displayIdx = 0

        return (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-3">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="flex flex-col gap-3">
                            {/* Chain containers */}
                            {chainGroups.map((group) => {
                                const chainItemIds = group.items.map(i => i.marker.id)
                                const isOverThisChain = activeOverContainer === group.id
                                return (
                                    <div
                                        key={group.id}
                                        className={cn(
                                            'rounded-xl border-2 p-2 transition-colors',
                                            isOverThisChain
                                                ? 'border-blue-400 bg-blue-50'
                                                : 'border-gray-200 bg-gray-50'
                                        )}
                                        onMouseEnter={() => setHighlightedChain(chainItemIds)}
                                        onMouseLeave={() => clearHighlightedChain()}
                                    >
                                        <div className="text-[10px] text-gray-400 font-medium mb-1.5 px-1">行程链</div>
                                        <SortableContext
                                            items={chainItemIds}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {group.items.map((item) => {
                                                const idx = displayIdx++
                                                return (
                                                    <SortableItem
                                                        key={item.marker.id}
                                                        id={item.marker.id}
                                                        marker={item.marker}
                                                        index={idx}
                                                        hasArrowAfter={item.hasArrowAfter}
                                                        onMarkerClick={handleMarkerClick}
                                                        onRemove={handleRemoveMarkerFromDay}
                                                    />
                                                )
                                            })}
                                        </SortableContext>
                                    </div>
                                )
                            })}

                            {/* Isolated items */}
                            {isolatedItems.length > 0 && (
                                <div>
                                    {chainGroups.length > 0 && (
                                        <div className="flex items-center gap-2 mb-2 px-1">
                                            <div className="flex-1 border-t border-dashed border-gray-200" />
                                            <span className="text-[10px] text-gray-300 flex-shrink-0">孤立地点</span>
                                            <div className="flex-1 border-t border-dashed border-gray-200" />
                                        </div>
                                    )}
                                    <SortableContext
                                        items={isolatedItems.map(i => i.marker.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <IsolatedDropZone isEmpty={isolatedItems.length === 0}>
                                            <div className="flex flex-col gap-2">
                                                {isolatedItems.map((item) => {
                                                    const idx = displayIdx++
                                                    return (
                                                        <SortableItem
                                                            key={item.marker.id}
                                                            id={item.marker.id}
                                                            marker={item.marker}
                                                            index={idx}
                                                            hasArrowAfter={false}
                                                            onMarkerClick={handleMarkerClick}
                                                            onRemove={handleRemoveMarkerFromDay}
                                                        />
                                                    )
                                                })}
                                            </div>
                                        </IsolatedDropZone>
                                    </SortableContext>
                                </div>
                            )}

                            {/* Drop zone for isolated (when no isolated items yet) */}
                            {isolatedItems.length === 0 && (
                                <IsolatedDropZone isEmpty={true}>
                                    <div />
                                </IsolatedDropZone>
                            )}
                        </div>

                        <DragOverlay>
                            {activeDragMarker && activeDragIndex >= 0 && (
                                <DragGhostItem
                                    marker={activeDragMarker}
                                    index={activeDragIndex}
                                />
                            )}
                        </DragOverlay>
                    </DndContext>
                </div>
            </div>
        )
    }

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
