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
}

export const AddMarkerModal = ({ coordinates, isOpen, onClose, onSave, placeName }: AddMarkerModalProps) => {
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">添加新地点</h2>
                    <button
                        onClick={handleCancel}
                        className="text-gray-400 hover:text-gray-600 text-xl"
                    >
                        ×
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* 坐标显示 */}
                    <div className="text-sm text-gray-500">
                        坐标: {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                    </div>

                    {/* 地点名称 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            地点名称 *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="请输入地点名称"
                        />
                    </div>

                    {/* 图标选择 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            图标类型
                        </label>
                        <IconSelector
                            selectedIcon={iconType}
                            onSelect={setIconType}
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        创建标记
                    </button>
                </div>
            </div>
        </div>
    )
} 