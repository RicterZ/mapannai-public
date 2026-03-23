'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useMapStore } from '@/store/map-store'
import { cn } from '@/utils/cn'

interface CreateTripModalProps {
    isOpen: boolean
    onClose: () => void
    onCreated?: (tripId: string) => void
}

export const CreateTripModal = ({ isOpen, onClose, onCreated }: CreateTripModalProps) => {
    const { createTrip, setActiveView } = useMapStore()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!isOpen) return null

    const handleSave = async () => {
        if (!name.trim()) { toast.error('请输入旅行名称'); return }
        if (!startDate) { toast.error('请选择开始日期'); return }
        if (!endDate) { toast.error('请选择结束日期'); return }
        if (startDate > endDate) { toast.error('开始日期不能晚于结束日期'); return }

        setIsSubmitting(true)
        try {
            const trip = await createTrip({ name: name.trim(), description: description.trim() || undefined, startDate, endDate })
            toast.success(`旅行「${trip.name}」已创建`)
            setActiveView('trip', trip.id, null)
            onCreated?.(trip.id)
            handleClose()
        } catch {
            toast.error('创建旅行失败，请重试')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        setName(''); setDescription(''); setStartDate(''); setEndDate('')
        onClose()
    }

    // Calculate number of days
    const dayCount = startDate && endDate && startDate <= endDate
        ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
        : null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full animate-scale-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-base">✈️</div>
                            <h2 className="text-base font-semibold text-gray-900">新建旅行</h2>
                        </div>
                        <button onClick={handleClose} className="w-8 h-8 rounded-full hover:bg-white/80 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">旅行名称 *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="例如：东京2024春"
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">备注（选填）</label>
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="一句话描述这次旅行"
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">开始日期 *</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">结束日期 *</label>
                            <input
                                type="date"
                                value={endDate}
                                min={startDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
                            />
                        </div>
                    </div>
                    {dayCount !== null && (
                        <p className="text-xs text-blue-600 text-center">
                            共 {dayCount} 天，将自动生成每日行程
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 p-4 pt-0">
                    <button onClick={handleClose} className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors focus:outline-none">取消</button>
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>创建中...</>
                        ) : '创建旅行'}
                    </button>
                </div>
            </div>
        </div>
    )
}
