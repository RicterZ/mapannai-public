'use client'

import { useState, useEffect } from 'react'
import { Marker } from '@/types/marker'
import { uploadFileToS3 } from '@/lib/s3-direct-upload'
import EditorJSWrapper from '@/components/editor/editor-js-wrapper'
import { OutputData } from '@editorjs/editorjs'

interface EditMarkerModalProps {
    marker: Marker | null
    isOpen: boolean
    onClose: () => void
    onSave: (data: {
        markerId: string
        title?: string
        headerImage?: string
        editorData: OutputData
    }) => void
}

export const EditMarkerModal = ({ marker, isOpen, onClose, onSave }: EditMarkerModalProps) => {
    const [title, setTitle] = useState('')
    const [headerImage, setHeaderImage] = useState('')
    const [editorData, setEditorData] = useState<OutputData>({ blocks: [], version: '2.28.2', time: Date.now() })
    const [isUploading, setIsUploading] = useState(false)
    const [isEditorReady, setIsEditorReady] = useState(false)

    // 当marker变化时更新表单数据
    useEffect(() => {
        if (marker && isOpen) {
            console.log('EditMarkerModal: 初始化数据', marker)
            setTitle(marker.content.title || '')
            setHeaderImage(marker.content.headerImage || '')

            // 设置编辑器数据
            const initialEditorData = marker.content.editorData || { blocks: [], version: '2.28.2', time: Date.now() }
            console.log('EditMarkerModal: 设置编辑器数据', initialEditorData)
            setEditorData(initialEditorData)

            // 延迟2秒后设置编辑器为就绪状态，确保Editor.js能够正常加载
            setIsEditorReady(false)
            const timer = setTimeout(() => {
                console.log('EditMarkerModal: 编辑器延迟加载完成')
                setIsEditorReady(true)
            }, 2000)

            return () => clearTimeout(timer)
        }
    }, [marker, isOpen])

    if (!isOpen || !marker) return null

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
        if (!marker) return

        try {
            console.log('开始保存编辑标记:', marker.id)
            console.log('当前editorData状态:', editorData)

            const saveData = {
                markerId: marker.id,
                title: title.trim() || undefined,
                headerImage: headerImage || undefined,
                editorData: editorData
            }

            console.log('最终保存数据:', saveData)
            console.log('编辑器数据blocks:', editorData?.blocks?.length || 0)

            onSave(saveData)
            onClose()
        } catch (error) {
            console.error('保存失败:', error)
            alert('保存失败，请重试')
        }
    }

    const handleCancel = () => {
        // 恢复原始数据
        if (marker) {
            setTitle(marker.content.title || '')
            setHeaderImage(marker.content.headerImage || '')
            setEditorData(marker.content.editorData || { blocks: [], version: '2.28.2', time: Date.now() })
        }
        onClose()
    }

    const handleEditorChange = (data: OutputData) => {
        console.log('编辑器数据变化:', data)
        setEditorData(data)
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">编辑标记</h2>
                    <button
                        onClick={handleCancel}
                        className="text-gray-400 hover:text-gray-600 text-xl"
                    >
                        ×
                    </button>
                </div>

                <div className="flex flex-col h-[calc(90vh-140px)]">
                    {/* 基本信息区域 */}
                    <div className="p-4 border-b space-y-4 flex-shrink-0">
                        {/* 标题 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                标题
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="请输入标题"
                            />
                        </div>

                        {/* 首图 */}
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
                                    id="edit-header-image"
                                    disabled={isUploading}
                                />
                                <label
                                    htmlFor="edit-header-image"
                                    className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-200"
                                >
                                    {isUploading ? '上传中...' : '更换图片'}
                                </label>
                                {headerImage && (
                                    <button
                                        onClick={() => setHeaderImage('')}
                                        className="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                                    >
                                        删除图片
                                    </button>
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
                    </div>

                    {/* 编辑器区域 */}
                    <div className="flex-1 p-4 overflow-hidden">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            详细内容
                        </label>
                        <div className="h-full overflow-y-auto border border-gray-200 rounded-lg custom-scrollbar">
                            {!isEditorReady ? (
                                // 加载状态显示
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                        <p className="text-sm text-gray-500">编辑器加载中...</p>
                                    </div>
                                </div>
                            ) : (
                                // 编辑器组件
                                <EditorJSWrapper
                                    data={editorData}
                                    onChange={handleEditorChange}
                                    placeholder="请输入详细内容..."
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* 底部按钮 */}
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
                        保存更改
                    </button>
                </div>
            </div>
        </div>
    )
} 