'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    closestCenter,
    useSensor,
    useSensors,
    useDroppable,
    useDraggable,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    sortableKeyboardCoordinates,
    arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMapStore } from '@/store/map-store'
import { MARKER_ICONS, Marker } from '@/types/marker'
import { cn } from '@/utils/cn'
import { CreateTripModal } from '@/components/modal/create-trip-modal'

interface LeftSidebarProps {
    onFlyTo: (coordinates: { longitude: number; latitude: number }, zoom?: number) => void
    addMarkerEnabled: boolean
    onToggleAddMarker: () => void
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

// ── ChainItem: node inside a chain (edit mode) ───────────────────────────────

interface ChainItemProps {
    id: string          // dnd-kit id, format: chain-${chainIdx}::${markerId}
    marker: Marker
    index: number
    hasArrowAfter: boolean
    onRemove: () => void
    onFlyTo?: () => void
}

function ChainItem({ id, marker, index, hasArrowAfter, onRemove, onFlyTo }: ChainItemProps) {
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
            <div className="border border-gray-200 rounded-xl bg-white overflow-hidden flex items-center gap-2">
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
                <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">{index + 1}</span>
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0', getMarkerColor(marker.content.iconType || 'location'))}>
                    <span className="text-xs text-white">{icon.emoji}</span>
                </div>
                <div className="flex-1 min-w-0 py-2.5">
                    <button
                        className="w-full text-left"
                        onClick={onFlyTo}
                        title="跳转到此位置"
                    >
                    <div className="text-sm font-medium text-gray-800 truncate">{marker.content.title || '未命名标记'}</div>
                    {marker.content.address && (
                        <div className="text-xs text-gray-400 truncate mt-0.5">{marker.content.address}</div>
                    )}
                    </button>
                </div>
                <button
                    onClick={onRemove}
                    className="px-3 py-2.5 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 border-l border-gray-100"
                    title="从该路线移除"
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

// ── PaletteItem: draggable node in palette (edit mode) ───────────────────────

interface PaletteItemProps {
    marker: Marker
    onFlyTo?: () => void
    onRemove?: () => void
}

function PaletteItem({ marker, onFlyTo, onRemove }: PaletteItemProps) {
    const paletteId = `palette::${marker.id}`
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: paletteId })

    const icon = MARKER_ICONS[marker.content.iconType || 'location'] || MARKER_ICONS.location

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'border border-gray-200 rounded-xl bg-white overflow-hidden flex items-center gap-2',
                isDragging && 'opacity-40 border-blue-300'
            )}
        >
            <div
                className="p-2.5 flex items-center gap-2 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
                {...attributes}
                {...listeners}
            >
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0', getMarkerColor(marker.content.iconType || 'location'))}>
                    <span className="text-xs text-white">{icon.emoji}</span>
                </div>
                <button
                    className="flex-1 min-w-0 text-left"
                    onClick={onFlyTo}
                    title="跳转到此位置"
                >
                    <div className="text-sm font-medium text-gray-800 truncate">{marker.content.title || '未命名标记'}</div>
                </button>
            </div>
            <button
                onClick={onRemove}
                className="px-2.5 py-2.5 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 border-l border-gray-100"
                title="从当天移除"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    )
}

// ── ChainDropContainer: droppable wrapper for a chain ─────────────────────────

function ChainDropContainer({ chainIdx, children, isEmpty }: {
    chainIdx: number
    children: React.ReactNode
    isEmpty: boolean
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `chain-drop-${chainIdx}` })
    return (
        <div
            ref={setNodeRef}
            className={cn(
                'flex flex-col gap-0 min-h-[48px] rounded-lg transition-colors',
                isOver && 'bg-blue-50 ring-2 ring-blue-200 ring-inset',
                isEmpty && 'border border-dashed border-blue-200'
            )}
        >
            {isEmpty && (
                <div className="flex items-center justify-center h-12 text-xs text-blue-300 select-none">
                    拖入节点到此路线
                </div>
            )}
            {children}
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

export const LeftSidebar = ({ onFlyTo, addMarkerEnabled, onToggleAddMarker }: LeftSidebarProps) => {
    const {
        markers, trips, tripDays, activeView, interactionState,
        leftSidebar, closeLeftSidebar,
        selectMarker, openSidebar,
        setActiveView, deleteTrip, updateTrip,
        removeMarkerFromDay,
        updateDayChains,
    } = useMapStore()

    const [showCreateTrip, setShowCreateTrip] = useState(false)
    const [confirmDeleteTripId, setConfirmDeleteTripId] = useState<string | null>(null)
    const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Edit mode: number of pending (empty) chain slots user has clicked "create"
    const [pendingEmptyChains, setPendingEmptyChains] = useState(0)

    const startConfirmDelete = (tripId: string) => {
        setConfirmDeleteTripId(tripId)
        if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current)
        confirmDeleteTimerRef.current = setTimeout(() => setConfirmDeleteTripId(null), 3000)
    }

    const cancelConfirmDelete = () => {
        if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current)
        setConfirmDeleteTripId(null)
    }
    const [activeDragId, setActiveDragId] = useState<string | null>(null)

    const [editingTripName, setEditingTripName] = useState(false)
    const [tripNameDraft, setTripNameDraft] = useState('')
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)

    // 视图切换动画：向左滑出，从右滑入
    const [slideState, setSlideState] = useState<'idle' | 'exit' | 'enter'>('idle')
    const [blockClicks, setBlockClicks] = useState(false)  // 防幽灵 click
    const [displayMode, setDisplayMode] = useState(activeView.mode)
    const [displayTripId, setDisplayTripId] = useState(activeView.tripId)
    const [displayDayId, setDisplayDayId] = useState(activeView.dayId)
    const prevModeRef = useRef(activeView.mode)
    const prevTripRef = useRef(activeView.tripId)
    const prevDayRef = useRef(activeView.dayId)

    useEffect(() => {
        const modeChanged = prevModeRef.current !== activeView.mode
        const tripChanged = prevTripRef.current !== activeView.tripId
        const dayChanged = prevDayRef.current !== activeView.dayId
        if (!modeChanged && !tripChanged && !dayChanged) return

        prevModeRef.current = activeView.mode
        prevTripRef.current = activeView.tripId
        prevDayRef.current = activeView.dayId

        // 1. 当前内容滑出（250ms）
        setSlideState('exit')
        setBlockClicks(true)
        cancelConfirmDelete()

        // 2. 内容切换 + 新内容从对面出发位置就位（不可见，立即切换）
        const t = setTimeout(() => {
            setDisplayMode(activeView.mode)
            setDisplayTripId(activeView.tripId)
            setDisplayDayId(activeView.dayId)
            setSlideState('enter')
            // 3. 下一帧触发 transition 滑入到 idle(0)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setSlideState('idle'))
            })
            // 4. 超过 iOS 幽灵 click 300ms 窗口后解除屏蔽
            setTimeout(() => setBlockClicks(false), 400)
        }, 250)

        return () => { clearTimeout(t) }
    }, [activeView.mode, activeView.tripId, activeView.dayId])

    // 从 URL hash 恢复 activeView（trips/tripDays 加载完后执行一次）
    const hashRestoredRef = useRef(false)
    useEffect(() => {
        if (hashRestoredRef.current) return
        if (trips.length === 0) return  // 数据还没加载完
        hashRestoredRef.current = true

        const hash = window.location.hash.slice(1)  // 去掉 #
        if (!hash) return

        const parts = hash.split('/')
        if (parts[0] === 'trip' && parts[1]) {
            const trip = trips.find(t => t.id === parts[1])
            if (trip) setActiveView('trip', parts[1], null)
        } else if (parts[0] === 'day' && parts[1] && parts[2]) {
            const trip = trips.find(t => t.id === parts[1])
            const day = tripDays.find(d => d.id === parts[2])
            if (trip && day) setActiveView('day', parts[1], parts[2])
        }
    }, [trips, tripDays, setActiveView])

    const TRIP_EMOJIS = ['✈️', '🚞', '🚢', '🚗', '🏍️', '🏕️', '🏖️', '🗻', '🏯', '🎒', '🇨🇳', '🇯🇵', '🇰🇷', '🇸🇬', '🇹🇭', '🇺🇸', '🇫🇷', '🇬🇧', '🇮🇹', '🇩🇪', '🍜', '🍣', '🍲', '🍛', '🍖']

    useEffect(() => {
        if (!showEmojiPicker) return
        const handler = (e: MouseEvent) => {
            // 如果点击的是 picker 内部，不关闭
            const target = e.target as HTMLElement
            if (target.closest('[data-emoji-picker]')) return
            setShowEmojiPicker(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showEmojiPicker])

    // ── Derived data ────────────────────────────────────────────────────────

    const currentTrip = useMemo(() =>
        trips.find(t => t.id === displayTripId) ?? null,
        [trips, displayTripId]
    )

    const currentTripDays = useMemo(() =>
        tripDays
            .filter(d => d.tripId === displayTripId)
            .sort((a, b) => a.date.localeCompare(b.date)),
        [tripDays, displayTripId]
    )

    const currentDay = useMemo(() =>
        tripDays.find(d => d.id === displayDayId) ?? null,
        [tripDays, displayDayId]
    )

    const currentDayMarkers = useMemo(() => {
        if (!currentDay) return []
        return currentDay.markerIds
            .map(id => markers.find(m => m.id === id))
            .filter(Boolean) as typeof markers
    }, [currentDay, markers])

    // Split currentDayMarkers into chain groups + isolated nodes
    // 单节点链视为孤立节点（不构成连线）
    const { chainedGroups, isolatedMarkers } = useMemo(() => {
        if (!currentDay) return { chainedGroups: [], isolatedMarkers: [] }
        const chains = currentDay.chains ?? []
        const markerMap = new Map(currentDayMarkers.map(m => [m.id, m]))

        const validGroups = chains
            .map(chain => chain.map(id => markerMap.get(id)).filter(Boolean) as Marker[])
            .filter(g => g.length >= 2)  // 单节点链降级为孤立节点

        const inValidChainSet = new Set(validGroups.flat().map(m => m.id))
        const isolatedMarkers = currentDayMarkers.filter(m => !inValidChainSet.has(m.id))
        return { chainedGroups: validGroups, isolatedMarkers }
    }, [currentDay, currentDayMarkers])

    // Edit mode chain groups: include single-node chains (not yet valid but in-progress)
    // chainedGroupsEdit has all chains (including single-node), for rendering in edit mode
    const chainedGroupsEdit = useMemo(() => {
        if (!currentDay) return []
        const chains = currentDay.chains ?? []
        const markerMap = new Map(currentDayMarkers.map(m => [m.id, m]))
        return chains
            .map(chain => chain.map(id => markerMap.get(id)).filter(Boolean) as Marker[])
    }, [currentDay, currentDayMarkers])

    // 自动清理 DB 里的单节点链（避免脏数据残留）
    // Only runs when the day changes, not on every currentDay mutation
    const prevCleanupDayRef = useRef<string | null>(null)
    useEffect(() => {
        if (!currentDay || !activeView.tripId || !activeView.dayId) return
        if (prevCleanupDayRef.current === activeView.dayId) return
        prevCleanupDayRef.current = activeView.dayId
        // Reset pending empty chains when switching days
        setPendingEmptyChains(0)
        // Clean empty chains from previous day state (may have been left over)
        const chains = currentDay.chains ?? []
        const hasEmpty = chains.some(c => c.length === 0)
        if (!hasEmpty) return
        const cleaned = chains.filter(c => c.length >= 1)
        updateDayChains(activeView.tripId, activeView.dayId, cleaned)
    }, [activeView.dayId, activeView.tripId, currentDay, updateDayChains])

    // Unassigned markers: those not appearing in any TripDay's markerIds
    const unassignedMarkers = useMemo(() => {
        const assignedIds = new Set(tripDays.flatMap(d => d.markerIds))
        return markers.filter(m => !assignedIds.has(m.id))
    }, [markers, tripDays])

    // ── Drag and drop ─────────────────────────────────────────────────────────

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveDragId(event.active.id as string)
    }, [])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        setActiveDragId(null)

        if (!over || active.id === over.id) return
        if (!currentDay || !activeView.tripId || !activeView.dayId) return

        const dragId = active.id as string
        const overId = over.id as string

        // ── 编辑模式新版：链 + 调色板 ─────────────────────────────────────────
        if (addMarkerEnabled) {
            // Parse IDs
            const parseId = (id: string) => {
                if (id.startsWith('chain-drop-')) return { type: 'chain-drop' as const, chainIdx: parseInt(id.slice(11)) }
                if (id.startsWith('chain-') && id.includes('::')) {
                    const sepIdx = id.indexOf('::')
                    const chainIdx = parseInt(id.slice(6, sepIdx))
                    const markerId = id.slice(sepIdx + 2)
                    return { type: 'chain-item' as const, chainIdx, markerId }
                }
                if (id.startsWith('palette::')) return { type: 'palette' as const, markerId: id.slice(9) }
                return { type: 'unknown' as const }
            }

            const drag = parseId(dragId)
            const drop = parseId(overId)

            const chains = currentDay.chains ?? []
            let newChains: string[][] = chains.map(c => [...c])

            if (drag.type === 'chain-item' && drop.type === 'chain-item' && drag.chainIdx === drop.chainIdx) {
                // Case A: reorder within same chain
                const chain = newChains[drag.chainIdx]
                const fromIdx = chain.indexOf(drag.markerId)
                const toIdx = chain.indexOf(drop.markerId)
                if (fromIdx === -1 || toIdx === -1) return
                newChains[drag.chainIdx] = arrayMove(chain, fromIdx, toIdx)
            } else if (drag.type === 'chain-item' && drop.type === 'chain-item' && drag.chainIdx !== drop.chainIdx) {
                // Case B: move chain node to a different chain
                newChains[drag.chainIdx] = newChains[drag.chainIdx].filter(id => id !== drag.markerId)
                const targetChain = newChains[drop.chainIdx]
                const insertAt = targetChain.indexOf(drop.markerId)
                const safeInsert = insertAt === -1 ? targetChain.length : insertAt
                newChains[drop.chainIdx] = [
                    ...targetChain.slice(0, safeInsert),
                    drag.markerId,
                    ...targetChain.slice(safeInsert),
                ]
                newChains = newChains.filter(c => c.length >= 1)
            } else if (drag.type === 'palette' && drop.type === 'chain-drop') {
                // Case C: palette node → chain drop zone (append to end)
                const chainIdx = drop.chainIdx
                if (chainIdx < newChains.length) {
                    if (!newChains[chainIdx].includes(drag.markerId)) {
                        newChains[chainIdx] = [...newChains[chainIdx], drag.markerId]
                    }
                } else {
                    // Pending chain slot: create new chain with this marker
                    newChains = [...newChains, [drag.markerId]]
                    setPendingEmptyChains(prev => Math.max(0, prev - 1))
                }
            } else if (drag.type === 'palette' && drop.type === 'chain-item') {
                // Case D: palette node → onto a chain item (insert before that item)
                const chainIdx = drop.chainIdx
                if (!newChains[chainIdx].includes(drag.markerId)) {
                    const targetChain = newChains[chainIdx]
                    const insertAt = targetChain.indexOf(drop.markerId)
                    const safeInsert = insertAt === -1 ? targetChain.length : insertAt
                    newChains[chainIdx] = [
                        ...targetChain.slice(0, safeInsert),
                        drag.markerId,
                        ...targetChain.slice(safeInsert),
                    ]
                }
            }
            // Palette → palette: ignore (no sorting in palette)
            // Chain item → palette: not supported (use × button)
            else {
                return
            }

            updateDayChains(activeView.tripId, activeView.dayId, newChains)
            return
        }

        const chains = currentDay.chains ?? []
        const isolatedIds = new Set(isolatedMarkers.map(m => m.id))

        // Find which chain contains dragId (-1 = isolated)
        const dragChainIdx = chains.findIndex(c => c.includes(dragId))
        const isDragIsolated = isolatedIds.has(dragId)

        // Resolve over container: overId may be a marker id or a chain/isolated container id
        // Determine if overId is a chain container marker id, or a droppable container
        // Container ids: 'chain-0', 'chain-1', ..., 'isolated'
        let overChainIdx = chains.findIndex(c => c.includes(overId))
        const isOverIsolated = isolatedIds.has(overId) || overId === 'isolated'
        // overId could be "chain-N" (dropped on the container itself)
        if (overChainIdx === -1 && overId.startsWith('chain-')) {
            overChainIdx = parseInt(overId.slice(6), 10)
        }

        // Build new chains (clone)
        let newChains: string[][] = chains.map(c => [...c])

        if (dragChainIdx !== -1 && overChainIdx !== -1 && dragChainIdx === overChainIdx) {
            // Case 1: reorder within same chain
            const chain = newChains[dragChainIdx]
            const fromIdx = chain.indexOf(dragId)
            const toIdx = chain.indexOf(overId)
            if (fromIdx === -1 || toIdx === -1) return
            newChains[dragChainIdx] = arrayMove(chain, fromIdx, toIdx)
        } else if (isDragIsolated && overChainIdx !== -1) {
            // Case 2: isolated → chain
            // Insert dragId at the position of overId in target chain
            const targetChain = newChains[overChainIdx]
            const insertAt = overId.startsWith('chain-') ? targetChain.length : targetChain.indexOf(overId)
            const safeInsert = insertAt === -1 ? targetChain.length : insertAt
            newChains[overChainIdx] = [
                ...targetChain.slice(0, safeInsert),
                dragId,
                ...targetChain.slice(safeInsert),
            ]
        } else if (dragChainIdx !== -1 && isOverIsolated) {
            // Case 3: chain → isolated (remove from chain)
            newChains[dragChainIdx] = newChains[dragChainIdx].filter(id => id !== dragId)
            // Only remove empty chains (single-node chains are allowed)
            newChains = newChains.filter(c => c.length >= 1)
        } else if (dragChainIdx !== -1 && overChainIdx !== -1 && dragChainIdx !== overChainIdx) {
            // Case 4: move from one chain to another
            newChains[dragChainIdx] = newChains[dragChainIdx].filter(id => id !== dragId)
            const targetChain = newChains[overChainIdx]
            const insertAt = targetChain.indexOf(overId)
            const safeInsert = insertAt === -1 ? targetChain.length : insertAt
            newChains[overChainIdx] = [
                ...targetChain.slice(0, safeInsert),
                dragId,
                ...targetChain.slice(safeInsert),
            ]
            // Only remove empty chains from source (single-node chains are allowed)
            newChains = newChains.filter(c => c.length >= 1)
        } else if (isDragIsolated && isOverIsolated && overId !== 'isolated') {
            // Case 5: isolated → isolated (merge into new chain)
            newChains = [...newChains, [dragId, overId]]
        } else {
            return
        }

        updateDayChains(activeView.tripId, activeView.dayId, newChains)
    }, [currentDay, activeView, isolatedMarkers, addMarkerEnabled, updateDayChains])

    // ── Handlers ────────────────────────────────────────────────────────────

    const handleMarkerClick = (markerId: string) => {
        const marker = markers.find(m => m.id === markerId)
        if (!marker) return
        onFlyTo(marker.coordinates, 15)
        if (window.innerWidth < 1024) closeLeftSidebar()
    }

    const handleDeleteTrip = async (tripId: string) => {
        try {
            await deleteTrip(tripId)
            toast.success('旅行已删除')
            cancelConfirmDelete()
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

    // 从某条链中移除指定节点（保留单节点链，只清理空链）
    const handleRemoveFromChain = useCallback((markerId: string, chainIdx: number) => {
        if (!currentDay || !activeView.tripId || !activeView.dayId) return
        const newChains = (currentDay.chains ?? [])
            .map((c, i) => i === chainIdx ? c.filter(id => id !== markerId) : c)
            .filter(c => c.length >= 1)
        updateDayChains(activeView.tripId, activeView.dayId, newChains)
    }, [currentDay, activeView, updateDayChains])

    // 移动端关闭时不渲染；桌面端始终保持渲染

    // Active drag marker info
    // activeDragId may be: markerId (plain), palette::markerId, chain-N::markerId
    const activeDragMarkerId = useMemo(() => {
        if (!activeDragId) return null
        if (activeDragId.startsWith('palette::')) return activeDragId.slice(9)
        if (activeDragId.includes('::')) return activeDragId.split('::')[1]
        return activeDragId
    }, [activeDragId])
    const activeDragMarker = activeDragMarkerId ? currentDayMarkers.find(m => m.id === activeDragMarkerId) : null
    const activeDragIndex = activeDragMarkerId ? currentDayMarkers.findIndex(m => m.id === activeDragMarkerId) : -1

    // Reset pending empty chains when editing mode is turned off or day changes
    useEffect(() => {
        if (!addMarkerEnabled) {
            setPendingEmptyChains(0)
        }
    }, [addMarkerEnabled])

    // ── Render helpers ───────────────────────────────────────────────────────

    const renderHeader = () => (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-blue-50 flex-shrink-0 min-h-[68px]">
            <div className="flex items-center gap-2">
                {/* Back button */}
                {displayMode === 'trip' && (
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
                {displayMode === 'day' && (
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

                <div className="relative">
                    <div
                        className={cn(
                            'w-11 h-11 rounded-xl flex items-center justify-center text-2xl',
                            displayMode === 'trip'
                                ? 'bg-blue-100 cursor-pointer hover:bg-blue-200 transition-colors'
                                : 'bg-blue-100',
                        )}
                        onClick={() => displayMode === 'trip' && setShowEmojiPicker(v => !v)}
                        title={displayMode === 'trip' ? '更换图标' : undefined}
                    >
                        {displayMode === 'overview' ? '🗺️' : displayMode === 'trip' ? (currentTrip?.emoji ?? '✈️') : '📅'}
                    </div>
                    {showEmojiPicker && displayMode === 'trip' && currentTrip && (
                        <div data-emoji-picker className="absolute left-0 top-9 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-2 grid grid-cols-5 gap-1 w-44">
                            {TRIP_EMOJIS.map(e => (
                                <button
                                    key={e}
                                    onClick={() => {
                                        updateTrip(currentTrip.id, { emoji: e })
                                        setShowEmojiPicker(false)
                                    }}
                                    className={cn(
                                        'text-lg w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-50 transition-colors',
                                        (currentTrip.emoji ?? '✈️') === e && 'bg-blue-100'
                                    )}
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    {displayMode === 'trip' && currentTrip && editingTripName ? (
                        <input
                            autoFocus
                            className="text-sm font-semibold text-gray-900 bg-white border border-blue-300 rounded px-1.5 py-0.5 w-40 focus:outline-none"
                            value={tripNameDraft}
                            onChange={e => setTripNameDraft(e.target.value)}
                            onBlur={() => {
                                const name = tripNameDraft.trim()
                                if (name && name !== currentTrip.name) {
                                    updateTrip(currentTrip.id, { name })
                                }
                                setEditingTripName(false)
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                if (e.key === 'Escape') { setEditingTripName(false) }
                            }}
                        />
                    ) : (
                        <h2
                            className={cn(
                                'leading-tight',
                                displayMode === 'overview'
                                    ? 'text-xl font-normal text-gray-900 tracking-wide'
                                    : 'text-sm font-semibold text-gray-900',
                                displayMode === 'trip' && 'cursor-pointer hover:text-blue-600 transition-colors'
                            )}
                            style={displayMode === 'overview' ? { fontFamily: 'var(--font-dm-serif)' } : undefined}
                            onClick={() => {
                                if (displayMode === 'trip' && currentTrip) {
                                    setTripNameDraft(currentTrip.name)
                                    setEditingTripName(true)
                                }
                            }}
                            title={displayMode === 'trip' ? '点击修改名称' : undefined}
                        >
                            {displayMode === 'overview' && 'MapAnNai'}
                            {displayMode === 'overview' && (
                                <span className="block text-xs font-normal text-gray-400 tracking-widest mt-0.5" style={{ fontFamily: 'var(--font-inter, sans-serif)' }}>マップ案内</span>
                            )}
                            {displayMode === 'trip' && (currentTrip ? `${currentTrip.name} · ${currentTrip.startDate.slice(0, 4)}` : '旅行')}
                            {displayMode === 'day' && (currentDay?.title || (() => {
                                const idx = currentTripDays.findIndex(d => d.id === displayDayId)
                                return `第${idx + 1}天`
                            })())}
                        </h2>
                    )}
                    {displayMode === 'trip' && currentTrip && (
                        <p className="text-xs text-gray-500">
                            {currentTrip.startDate.slice(5).replace('-', '/')} ~ {currentTrip.endDate.slice(5).replace('-', '/')}
                            {' · '}{currentTripDays.length}天
                        </p>
                    )}
                    {displayMode === 'day' && currentDay && (
                        <p className="text-xs text-gray-500">{formatDate(currentDay.date)}</p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={closeLeftSidebar}
                    className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors"
                    aria-label="关闭"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
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
                    (() => {
                        const sorted = trips.slice().sort((a, b) => b.startDate.localeCompare(a.startDate))
                        // Group by year
                        const byYear = new Map<string, typeof sorted>()
                        sorted.forEach(trip => {
                            const year = trip.startDate.slice(0, 4)
                            if (!byYear.has(year)) byYear.set(year, [])
                            byYear.get(year)!.push(trip)
                        })
                        return Array.from(byYear.entries()).map(([year, yearTrips]) => (
                            <div key={year}>
                                {/* Year divider */}
                                <div className="flex items-center gap-2 px-1 py-1">
                                    <div className="flex-1 border-t border-gray-200" />
                                    <span className="text-[10px] text-gray-400 flex-shrink-0">{year}</span>
                                    <div className="flex-1 border-t border-gray-200" />
                                </div>
                                {yearTrips.map(trip => {
                                    const days = tripDays.filter(d => d.tripId === trip.id)
                                    const totalMarkers = Array.from(new Set(days.flatMap(d => d.markerIds))).length
                                    return (
                                        <div key={trip.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden mb-2">
                                            <button
                                                onClick={() => setActiveView('trip', trip.id, null)}
                                                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-blue-50 transition-colors text-left"
                                            >
                                                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">{trip.emoji ?? '✈️'}</div>
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
                                        </div>
                                    )
                                })}
                            </div>
                        ))
                    })()
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
    const renderTripView = () => {
        const lastDay = currentTripDays[currentTripDays.length - 1]

        const handleAddDay = async () => {
            if (!activeView.tripId || !currentTrip) return
            // 末尾日期 +1 天
            const lastDate = lastDay?.date ?? currentTrip.endDate
            const next = new Date(lastDate)
            next.setDate(next.getDate() + 1)
            const nextDate = next.toISOString().slice(0, 10)
            await useMapStore.getState().createTripDay(activeView.tripId, { date: nextDate })
            // 同步更新 endDate
            await updateTrip(activeView.tripId, { endDate: nextDate })
        }

        const handleRemoveDay = async () => {
            if (!activeView.tripId || !lastDay) return
            if (currentTripDays.length <= 1) return // 至少保留一天
            await useMapStore.getState().deleteTripDay(activeView.tripId, lastDay.id)
            // 同步更新 endDate
            const newLast = currentTripDays[currentTripDays.length - 2]
            if (newLast) await updateTrip(activeView.tripId, { endDate: newLast.date })
        }

        return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-3">
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
                            <React.Fragment key={day.id}>
                            <button
                                onClick={() => setActiveView('day', activeView.tripId, day.id)}
                                className="w-full flex items-center gap-3 px-3 py-3 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                            >
                                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
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
                            {idx < currentTripDays.length - 1 && (
                                <div className="flex justify-center py-0.5">
                                    <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            )}
                            </React.Fragment>
                        )
                    })
                )}

                {/* 增减天数 + 删除旅行 */}
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={handleRemoveDay}
                        disabled={currentTripDays.length <= 1}
                        className="flex-1 flex items-center justify-center py-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                    </button>
                    <button
                        onClick={handleAddDay}
                        className="flex-1 flex items-center justify-center py-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                    {confirmDeleteTripId !== null && confirmDeleteTripId === displayTripId ? (
                        <div className="flex-1 flex items-center gap-1">
                            <button onClick={() => handleDeleteTrip(activeView.tripId!)} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-xs font-medium">确认</button>
                            <button onClick={() => cancelConfirmDelete()} className="flex-1 py-2 bg-gray-100 rounded-xl text-xs text-gray-600">取消</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => startConfirmDelete(activeView.tripId!)}
                            className="flex-1 flex items-center justify-center py-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="删除旅行"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
        )
    }

    // ── Day view ──────────────────────────────────────────────────────────────
    const renderDayView = () => {
        if (currentDayMarkers.length === 0) {
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

        // ── 编辑模式开：上方管理链，下方当天节点 ──────────────────────────────
        if (addMarkerEnabled) {
            // All chain item ids for SortableContext (per chain)
            const getChainItemIds = (chainIdx: number) =>
                (currentDay?.chains?.[chainIdx] ?? []).map(id => `chain-${chainIdx}::${id}`)

            const totalChains = chainedGroupsEdit.length + pendingEmptyChains

            return (
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="p-3 flex flex-col gap-3">
                            {/* ── 上半区：路线卡片 ── */}
                            {Array.from({ length: totalChains }).map((_, slotIdx) => {
                                const isPending = slotIdx >= chainedGroupsEdit.length
                                const chainGroup = isPending ? [] : chainedGroupsEdit[slotIdx]
                                const chainIdx = slotIdx
                                const chainItemIds = getChainItemIds(chainIdx)

                                return (
                                    <div key={`chain-slot-${slotIdx}`} className="rounded-xl border border-blue-100 bg-blue-50/30 p-2">
                                        <div className="flex items-center gap-1.5 px-1 pb-1.5">
                                            <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                            <span className="text-[10px] text-blue-400 font-medium">路线 {slotIdx + 1}</span>
                                        </div>
                                        <SortableContext
                                            id={`chain-sort-${chainIdx}`}
                                            items={isPending ? [] : chainItemIds}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <ChainDropContainer chainIdx={chainIdx} isEmpty={chainGroup.length === 0}>
                                                {chainGroup.map((marker, idx) => (
                                                    <ChainItem
                                                        key={`chain-${chainIdx}::${marker.id}`}
                                                        id={`chain-${chainIdx}::${marker.id}`}
                                                        marker={marker}
                                                        index={idx}
                                                        hasArrowAfter={idx < chainGroup.length - 1}
                                                        onRemove={() => handleRemoveFromChain(marker.id, chainIdx)}
                                                        onFlyTo={() => handleMarkerClick(marker.id)}
                                                    />
                                                ))}
                                            </ChainDropContainer>
                                        </SortableContext>
                                    </div>
                                )
                            })}

                            {/* ＋ 创建行程链按钮 */}
                            <button
                                onClick={() => setPendingEmptyChains(prev => prev + 1)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-blue-200 rounded-xl text-blue-400 hover:border-blue-400 hover:bg-blue-50 transition-colors text-xs"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                创建行程链
                            </button>

                            {/* ── 分割线 ── */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 border-t border-gray-200" />
                                <span className="text-[10px] text-gray-400 flex-shrink-0">当天节点</span>
                                <div className="flex-1 border-t border-gray-200" />
                            </div>

                            {/* ── 下半区：当天节点（按类型排序，一行两个）── */}
                            <div className="grid grid-cols-2 gap-2">
                                {currentDayMarkers
                                    .slice()
                                    .sort((a, b) => (a.content.iconType || 'location').localeCompare(b.content.iconType || 'location'))
                                    .map(marker => (
                                        <PaletteItem key={marker.id} marker={marker} onFlyTo={() => handleMarkerClick(marker.id)} onRemove={() => handleRemoveMarkerFromDay(marker.id)} />
                                    ))}
                            </div>
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
            )
        }

        // ── 编辑模式关：显示路线分组 + 孤立节点（只读，可点击跳转）────────────
        return (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-3 flex flex-col gap-3">
                    {/* 路线分组 */}
                    {chainedGroups.map((group, chainIdx) => (
                        <div key={`chain-${chainIdx}`} className="rounded-xl border border-blue-100 bg-blue-50/30 p-2">
                            <div className="flex items-center gap-1.5 px-1 pb-1.5">
                                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                <span className="text-[10px] text-blue-400 font-medium">路线 {chainIdx + 1}</span>
                            </div>
                            <div className="flex flex-col">
                                {group.map((marker, idx) => {
                                    const icon = MARKER_ICONS[marker.content.iconType || 'location'] || MARKER_ICONS.location
                                    return (
                                        <div key={marker.id}>
                                            <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                                                <button
                                                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left"
                                                    onClick={() => handleMarkerClick(marker.id)}
                                                >
                                                    <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">{idx + 1}</span>
                                                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0', getMarkerColor(marker.content.iconType || 'location'))}>
                                                        <span className="text-xs text-white">{icon.emoji}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-gray-800 truncate">{marker.content.title || '未命名标记'}</div>
                                                        {marker.content.address && (
                                                            <div className="text-xs text-gray-400 truncate mt-0.5">{marker.content.address}</div>
                                                        )}
                                                    </div>
                                                </button>
                                            </div>
                                            {idx < group.length - 1 && (
                                                <div className="flex justify-center py-0.5">
                                                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}

                    {/* 孤立节点 */}
                    {isolatedMarkers.length > 0 && (
                        <div>
                            {chainedGroups.length > 0 && (
                                <div className="flex items-center gap-2 px-1 pb-1.5">
                                    <div className="flex-1 border-t border-gray-200" />
                                    <span className="text-[10px] text-gray-400 flex-shrink-0">未安排</span>
                                    <div className="flex-1 border-t border-gray-200" />
                                </div>
                            )}
                            <div className="flex flex-col gap-2">
                                {isolatedMarkers.map((marker, idx) => {
                                    const icon = MARKER_ICONS[marker.content.iconType || 'location'] || MARKER_ICONS.location
                                    return (
                                        <div key={marker.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                                            <button
                                                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left"
                                                onClick={() => handleMarkerClick(marker.id)}
                                            >
                                                <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">{idx + 1}</span>
                                                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0', getMarkerColor(marker.content.iconType || 'location'))}>
                                                    <span className="text-xs text-white">{icon.emoji}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-800 truncate">{marker.content.title || '未命名标记'}</div>
                                                    {marker.content.address && (
                                                        <div className="text-xs text-gray-400 truncate mt-0.5">{marker.content.address}</div>
                                                    )}
                                                </div>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <>
            <div className={cn(
                    'fixed inset-0 bg-black bg-opacity-25 z-40 lg:hidden',
                    leftSidebar.isOpen ? 'block' : 'hidden',
                    // 右侧详情开着时屏蔽左侧遮罩的点击，防止关闭详情的 ghost click 穿透
                    interactionState.isSidebarOpen && 'pointer-events-none'
                )} onClick={closeLeftSidebar} />

            <div
                className={cn(
                    'left-sidebar fixed left-0 top-0 bottom-0 z-[60]',
                    'w-full bg-white shadow-2xl',
                    'flex flex-col',
                    'lg:w-[360px]',
                    // 桌面端：始终显示，无需动画
                    // 移动端：关闭时滑出（transition），打开时滑入（animation）
                    'lg:translate-x-0',
                    !leftSidebar.isOpen ? 'max-lg:-translate-x-full max-lg:transition-transform max-lg:duration-300' : 'max-lg:animate-slide-in-left',
                )}
                style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                {renderHeader()}

                {/* 内容区域：向左滑出，从右滑入 */}
                <div
                    className={cn(
                        'flex-1 flex flex-col overflow-hidden',
                        'transition-transform duration-300',
                        slideState === 'exit' && '-translate-x-full pointer-events-none',
                        slideState === 'enter' && 'translate-x-full pointer-events-none',
                        blockClicks && 'pointer-events-none',
                    )}
                >
                    {displayMode === 'overview' && renderOverview()}
                    {displayMode === 'trip' && renderTripView()}
                    {displayMode === 'day' && renderDayView()}
                </div>

                {/* 底部：添加标记开关 */}
                <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
                    <span className="text-xs text-gray-500">编辑模式</span>
                    <div
                        className={cn(
                            'relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0',
                            addMarkerEnabled ? 'bg-blue-500' : 'bg-gray-300'
                        )}
                        onClick={() => onToggleAddMarker()}
                    >
                        <div className={cn(
                            'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                            addMarkerEnabled ? 'translate-x-6' : 'translate-x-1'
                        )} />
                    </div>
                </div>
            </div>

            <CreateTripModal isOpen={showCreateTrip} onClose={() => setShowCreateTrip(false)} />
        </>
    )
}
