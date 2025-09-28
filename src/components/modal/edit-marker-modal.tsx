'use client'

import { useState, useEffect } from 'react'
import { Marker } from '@/types/marker'
import { uploadFileToS3 } from '@/lib/s3-direct-upload'
import MDEditor from '@uiw/react-md-editor'
import { commands } from '@uiw/react-md-editor'

interface EditMarkerModalProps {
    marker: Marker | null
    isOpen: boolean
    onClose: () => void
    onSave: (data: {
        markerId: string
        title?: string
        headerImage?: string
        markdownContent: string
    }) => void
}

export const EditMarkerModal = ({ marker, isOpen, onClose, onSave }: EditMarkerModalProps) => {
    const [title, setTitle] = useState('')
    const [headerImage, setHeaderImage] = useState('')
    const [markdownContent, setMarkdownContent] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [isMarkdownUploading, setIsMarkdownUploading] = useState(false)
    const [markdownUploadProgress, setMarkdownUploadProgress] = useState(0)
    const [isDesktop, setIsDesktop] = useState(false)

    // 检测屏幕尺寸
    useEffect(() => {
        const checkScreenSize = () => {
            setIsDesktop(window.innerWidth >= 1024)
        }
        
        checkScreenSize()
        window.addEventListener('resize', checkScreenSize)
        
        return () => window.removeEventListener('resize', checkScreenSize)
    }, [])

    // 当marker变化时更新表单数据
    useEffect(() => {
        if (marker && isOpen) {
            setTitle(marker.content.title || '')
            setHeaderImage(marker.content.headerImage || '')
            
            // 设置Markdown内容
            const initialMarkdown = marker.content.markdownContent || ''
            setMarkdownContent(initialMarkdown)
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
            const saveData = {
                markerId: marker.id,
                title: title.trim() || undefined,
                headerImage: headerImage || undefined,
                markdownContent: markdownContent
            }

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
            setMarkdownContent(marker.content.markdownContent || '')
        }
        onClose()
    }


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center lg:p-4">
            {/* 背景遮罩 */}
            <div className="absolute inset-0" onClick={handleCancel} />
            
            {/* 内容区域 - PC端居中显示，移动端全屏 */}
            <div className="relative w-full h-full lg:w-[800px] lg:h-[600px] lg:max-w-4xl bg-white flex flex-col animate-slide-in-bottom lg:animate-fade-in lg:rounded-xl lg:shadow-2xl">
                {/* 顶部标题栏 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-50 flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">编辑标记</h2>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            保存
                        </button>
                        <button
                            onClick={handleCancel}
                            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* 主要内容区域 */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* 基本信息区域 - 上下布局 */}
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <div className="max-w-4xl mx-auto space-y-4">
                            {/* 标题输入框 */}
                            <div>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                                    placeholder="标记标题"
                                />
                            </div>
                            
                            {/* 首图上传 - 全宽显示，限制高度 */}
                            <div className="w-full">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    id="edit-header-image"
                                    disabled={isUploading}
                                />
                                {!headerImage ? (
                                    <label
                                        htmlFor="edit-header-image"
                                        className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                                    >
                                        {isUploading ? (
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        ) : (
                                            <div className="text-center">
                                                <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                </svg>
                                                <p className="text-sm text-gray-500">点击上传首图</p>
                                            </div>
                                        )}
                                    </label>
                                ) : (
                                    <div className="relative group w-full h-32">
                                        <img
                                            src={headerImage}
                                            alt="Header"
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                                            <label
                                                htmlFor="edit-header-image"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                                            >
                                                <div className="p-2 bg-white rounded-full shadow-lg">
                                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </div>
                                            </label>
                                        </div>
                                        <button
                                            onClick={() => setHeaderImage('')}
                                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors duration-200"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 编辑器区域 */}
                    <div className="flex-1 overflow-hidden relative">
                        {/* Markdown编辑器上传进度条 */}
                        {isMarkdownUploading && (
                            <div className="absolute top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
                                <div className="p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">上传图片中...</span>
                                        <span className="text-sm text-gray-500">{Math.min(Math.round(markdownUploadProgress), 100)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${Math.min(markdownUploadProgress, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="h-full">
                            <div className={`markdown-editor-container h-full ${isMarkdownUploading ? 'pt-16' : ''}`}>
                                <style jsx>{`
                                    .markdown-editor-container {
                                        height: 100% !important;
                                    }
                                    .markdown-editor-container :global(.w-md-editor) {
                                        height: 100% !important;
                                    }
                                    .markdown-editor-container :global(.w-md-editor-text-container) {
                                        padding-top: ${isMarkdownUploading ? '16px' : '0'} !important;
                                    }
                                    .markdown-editor-container :global(.w-md-editor-toolbar) {
                                        padding: ${isDesktop ? '8px' : '12px'} 8px;
                                    }
                                    .markdown-editor-container :global(.w-md-editor-toolbar button) {
                                        width: ${isDesktop ? '28px' : '36px'} !important;
                                        height: ${isDesktop ? '28px' : '36px'} !important;
                                        font-size: ${isDesktop ? '14px' : '16px'} !important;
                                        position: relative;
                                    }
                                    .markdown-editor-container :global(.w-md-editor-toolbar button svg) {
                                        width: ${isDesktop ? '14px' : '18px'} !important;
                                        height: ${isDesktop ? '14px' : '18px'} !important;
                                    }
                                    .markdown-editor-container :global(.w-md-editor-toolbar button:disabled) {
                                        opacity: 0.6;
                                        cursor: not-allowed;
                                    }
                                `}</style>
                                <MDEditor
                                    value={markdownContent}
                                    onChange={(val) => setMarkdownContent(val || '')}
                                    data-color-mode="light"
                                    height={isDesktop ? 350 : '100%'}
                                    visibleDragbar={false}
                                    preview="edit"
                                    hideToolbar={false}
                                    textareaProps={{
                                        placeholder: '添加标记的详细描述...',
                                        style: {
                                            fontSize: 14,
                                            lineHeight: 1.5,
                                        }
                                    }}
                                commands={[
                                    // 自定义图片上传功能
                                    {
                                        ...commands.image,
                                        execute: (state, api) => {
                                            if (isMarkdownUploading) return // 如果正在上传，不执行
                                            
                                            // 创建文件输入元素
                                            const input = document.createElement('input')
                                            input.type = 'file'
                                            input.accept = 'image/*'
                                            input.onchange = async (e) => {
                                                const file = (e.target as HTMLInputElement).files?.[0]
                                                if (file) {
                                                    try {
                                                        setIsMarkdownUploading(true)
                                                        setMarkdownUploadProgress(0)
                                                        
                                                        // 模拟进度更新
                                                        const progressInterval = setInterval(() => {
                                                            setMarkdownUploadProgress(prev => {
                                                                if (prev >= 90) return prev
                                                                const increment = Math.random() * 20
                                                                return Math.min(prev + increment, 90)
                                                            })
                                                        }, 200)
                                                        
                                                        const result = await uploadFileToS3(file)
                                                        
                                                        clearInterval(progressInterval)
                                                        setMarkdownUploadProgress(100)
                                                        
                                                        if (result.success && result.url) {
                                                            // 延迟一下让用户看到100%进度
                                                            setTimeout(() => {
                                                                setIsMarkdownUploading(false)
                                                                setMarkdownUploadProgress(0)
                                                            }, 500)
                                                            
                                                            // 插入markdown图片语法
                                                            const imageMarkdown = `![${file.name}](${result.url})`
                                                            const newValue = markdownContent + imageMarkdown
                                                            setMarkdownContent(newValue)
                                                        } else {
                                                            throw new Error(result.error || '上传失败')
                                                        }
                                                    } catch (error) {
                                                        console.error('图片上传失败:', error)
                                                        alert('图片上传失败，请重试')
                                                        setIsMarkdownUploading(false)
                                                        setMarkdownUploadProgress(0)
                                                    }
                                                }
                                            }
                                            input.click()
                                        }
                                    }
                                ]}
                                />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
} 