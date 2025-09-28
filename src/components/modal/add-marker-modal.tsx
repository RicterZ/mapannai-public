'use client'

import { useState, useEffect } from 'react'
import { MarkerCoordinates, MarkerIconType } from '@/types/marker'
import { IconSelector } from '@/components/ui/icon-selector'

interface AddMarkerModalProps {
    coordinates: MarkerCoordinates
    isOpen: boolean
    onClose: () => void
    onSave: (data: {
        coordinates: MarkerCoordinates
        name: string
        iconType: MarkerIconType
    }) => void
    placeName?: string  // 添加地点名称参数
    placeAddress?: string  // 添加地址参数
}

export const AddMarkerModal = ({ coordinates, isOpen, onClose, onSave, placeName, placeAddress }: AddMarkerModalProps) => {
    const [name, setName] = useState('')
    const [iconType, setIconType] = useState<MarkerIconType>('location')

    // 当模态框打开且有地点名称时，自动填写
    useEffect(() => {
        if (isOpen && placeName) {
            setName(placeName)
        }
    }, [isOpen, placeName])

    if (!isOpen) return null

    const handleSave = async () => {
        if (!name.trim()) {
            alert('请输入地点名称')
            return
        }

        try {
            onSave({
                coordinates,
                name: name.trim(),
                iconType
            })

            // 重置表单
            setName('')
            setIconType('location')
        } catch (error) {
            console.error('保存失败:', error)
            alert('保存失败，请重试')
        }
    }

    const handleCancel = () => {
        setName('')
        setIconType('location')
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-scale-in">
                {/* 头部区域 */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">添加新地点</h2>
                            </div>
                        </div>
                        <button
                            onClick={handleCancel}
                            className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* 内容区域 */}
                <div className="p-4 space-y-4">
                    {/* 位置信息 */}
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                        {placeAddress ? (
                            <div className="space-y-1">
                                <p className="text-xs text-gray-600 leading-relaxed">{placeAddress}</p>
                                <p className="text-xs text-gray-400 font-mono">
                                    {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <p className="text-xs text-gray-400 font-mono">
                                    {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 地点名称 */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-gray-800">
                            地点名称
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm h-10"
                            placeholder="请输入地点名称"
                        />
                    </div>

                    {/* 图标选择 */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-800">
                            选择图标
                        </label>
                        <IconSelector
                            selectedIcon={iconType}
                            onSelect={setIconType}
                        />
                    </div>
                </div>

                {/* 底部按钮 */}
                <div className="flex gap-3 p-4 bg-gray-50 border-t border-gray-200">
                    <button
                        onClick={handleCancel}
                        className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors duration-200 font-medium focus:outline-none"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-md focus:outline-none"
                    >
                        创建标记
                    </button>
                </div>
            </div>
        </div>
    )
} 