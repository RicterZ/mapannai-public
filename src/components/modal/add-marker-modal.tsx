'use client'

import { useState } from 'react'
import { MarkerCoordinates, MarkerIconType } from '@/types/marker'
import { uploadFileToS3 } from '@/lib/s3-direct-upload'
import EditorJSWrapper from '@/components/editor/editor-js-wrapper'
import { IconSelector } from '@/components/ui/icon-selector'
import { OutputData } from '@editorjs/editorjs'

interface AddMarkerModalProps {
    coordinates: MarkerCoordinates
    isOpen: boolean
    onClose: () => void
    onSave: (data: {
        coordinates: MarkerCoordinates
        name: string
        iconType: MarkerIconType
        headerImage?: string
        editorData?: OutputData
    }) => void
}

export const AddMarkerModal = ({ coordinates, isOpen, onClose, onSave }: AddMarkerModalProps) => {
    const [name, setName] = useState('')
    const [iconType, setIconType] = useState<MarkerIconType>('location')
    const [headerImage, setHeaderImage] = useState('')
    const [editorData, setEditorData] = useState<OutputData | undefined>()
    const [showEditor, setShowEditor] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    if (!isOpen) return null

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        try {
            const result = await uploadFileToS3(file)
            if (result.success && result.url) {
                setHeaderImage(result.url)
            } else {
                alert('图片上传失败: ' + result.error)
            }
        } catch (error) {
            console.error('图片上传错误:', error)
            alert('图片上传失败')
        } finally {
            setIsUploading(false)
        }
    }

    const handleSave = async () => {
        if (!name.trim()) {
            alert('请输入地点名称')
            return
        }

        try {
            onSave({
                coordinates,
                name: name.trim(),
                iconType,
                headerImage: headerImage || undefined,
                editorData: editorData
            })

            // 重置表单
            setName('')
            setIconType('location')
            setHeaderImage('')
            setEditorData(undefined)
            setShowEditor(false)
        } catch (error) {
            console.error('保存失败:', error)
            alert('保存失败，请重试')
        }
    }

    const handleCancel = () => {
        setName('')
        setIconType('location')
        setHeaderImage('')
        setEditorData(undefined)
        setShowEditor(false)
        onClose()
    }

    const openEditor = () => {
        setShowEditor(true)
    }

    const handleEditorChange = (data: OutputData) => {
        console.log('编辑器数据变化:', data)
        setEditorData(data)
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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

                    {/* 首图上传 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            首图
                        </label>
                        <div className="flex items-center space-x-3">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                                id="header-image-upload"
                                disabled={isUploading}
                            />
                            <label
                                htmlFor="header-image-upload"
                                className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-200 disabled:opacity-50"
                            >
                                {isUploading ? '上传中...' : '选择图片'}
                            </label>
                            {headerImage && (
                                <span className="text-sm text-green-600">已选择图片</span>
                            )}
                        </div>
                        {headerImage && (
                            <img
                                src={headerImage}
                                alt="预览"
                                className="mt-2 max-w-full h-20 object-cover rounded-md"
                            />
                        )}
                    </div>

                    {/* 详细内容编辑按钮 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            详细内容
                        </label>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={openEditor}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                {editorData?.blocks?.length ? '编辑详细内容' : '添加详细内容'}
                            </button>
                            {editorData?.blocks?.length && (
                                <span className="text-sm text-green-600">
                                    已添加内容（{editorData.blocks.length} 个块）
                                </span>
                            )}
                        </div>
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
                        保存
                    </button>
                </div>
            </div>

            {/* 编辑器弹窗 */}
            {showEditor && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">编辑详细内容</h3>
                            <button
                                onClick={() => setShowEditor(false)}
                                className="text-gray-400 hover:text-gray-600 text-xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto custom-scrollbar" style={{ height: 'calc(90vh - 140px)' }}>
                            <EditorJSWrapper
                                data={editorData}
                                onChange={handleEditorChange}
                                placeholder="请输入详细内容..."
                            />
                        </div>
                        <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50">
                            <button
                                onClick={() => setShowEditor(false)}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                完成编辑
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
} 