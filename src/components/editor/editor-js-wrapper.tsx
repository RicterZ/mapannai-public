'use client'

import { useEffect, useRef, memo, useCallback, useState } from 'react'
import EditorJS, { OutputData } from '@editorjs/editorjs'
// @ts-ignore
import Header from '@editorjs/header'
// @ts-ignore
import List from '@editorjs/list'
// @ts-ignore
import Paragraph from '@editorjs/paragraph'
// @ts-ignore
import Quote from '@editorjs/quote'
// @ts-ignore
import Delimiter from '@editorjs/delimiter'
// @ts-ignore
import ImageTool from '@editorjs/image'
import { uploadFileToS3 } from '@/lib/s3-direct-upload'

interface EditorProps {
    data?: OutputData
    onChange?: (data: OutputData) => void
    onReady?: (editor: { save: () => Promise<OutputData> }) => void
    readOnly?: boolean
    placeholder?: string
}

const EditorJSWrapper = ({ data, onChange, onReady, readOnly = false, placeholder = '开始编写内容...' }: EditorProps) => {
    const editorInstance = useRef<EditorJS | null>(null)
    const editorContainerRef = useRef<HTMLDivElement | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isUploading, setIsUploading] = useState(false)

    // 自定义图片上传处理
    const customImageUpload = useCallback(async (file: File) => {
        try {
            setIsUploading(true)
            setUploadProgress(0)
            
            // 模拟进度更新
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) return prev
                    return prev + Math.random() * 20
                })
            }, 200)
            
            const result = await uploadFileToS3(file)
            
            clearInterval(progressInterval)
            setUploadProgress(100)
            
            if (result.success && result.url) {
                // 延迟一下让用户看到100%进度
                setTimeout(() => {
                    setIsUploading(false)
                    setUploadProgress(0)
                }, 500)
                
                return {
                    success: 1,
                    file: {
                        url: result.url
                    }
                }
            } else {
                throw new Error(result.error || '上传失败')
            }
        } catch (error) {
            console.error('Image upload failed:', error)
            setIsUploading(false)
            setUploadProgress(0)
            return {
                success: 0,
                error: '图片上传失败'
            }
        }
    }, [])

    // 自定义图片工具配置
    const customImageTool = useCallback(() => {
        return {
            // @ts-ignore
            class: ImageTool,
            config: {
                uploader: {
                    uploadByFile: customImageUpload,
                    uploadByUrl: async (url: string) => {
                        // URL上传的处理
                        try {
                            const response = await fetch(`/api/upload-image-by-url?t=${Date.now()}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url })
                            })
                            const result = await response.json()
                            
                            if (result.success) {
                                return {
                                    success: 1,
                                    file: {
                                        url: result.file.url
                                    }
                                }
                            } else {
                                throw new Error(result.message || 'URL上传失败')
                            }
                        } catch (error) {
                            console.error('URL upload failed:', error)
                            return {
                                success: 0,
                                error: 'URL上传失败'
                            }
                        }
                    }
                },
                captionPlaceholder: '添加图片说明',
                field: 'image',
                types: 'image/*',
                additionalRequestData: {},
                additionalRequestHeaders: {}
            }
        }
    }, [customImageUpload])

    // 初始化编辑器
    useEffect(() => {
        if (!editorContainerRef.current || editorInstance.current) return

        const initEditor = async () => {
            try {
                // @ts-ignore
                const editor = new EditorJS({
                    holder: editorContainerRef.current!,
                    tools: {
                        // @ts-ignore
                        header: {
                            // @ts-ignore
                            class: Header,
                            config: {
                                placeholder: '输入标题',
                                levels: [1, 2, 3, 4],
                                defaultLevel: 2
                            }
                        },
                        // @ts-ignore
                        paragraph: {
                            // @ts-ignore
                            class: Paragraph,
                            config: {
                                placeholder: '输入段落内容...'
                            }
                        },
                        // @ts-ignore
                        list: {
                            // @ts-ignore
                            class: List,
                            config: {
                                defaultStyle: 'unordered'
                            }
                        },
                        // @ts-ignore
                        quote: {
                            // @ts-ignore
                            class: Quote,
                            config: {
                                quotePlaceholder: '输入引用...',
                                captionPlaceholder: '引用来源'
                            }
                        },
                        // @ts-ignore
                        delimiter: Delimiter,
                        // @ts-ignore
                        image: customImageTool()
                    },
                    data: data || { blocks: [] },
                    readOnly,
                    autofocus: !readOnly,
                    onChange: async () => {
                        if (!editorInstance.current || !onChange) return

                        try {
                            const outputData = await editorInstance.current.save()
                            onChange(outputData)
                        } catch (error) {
                            console.error('Error getting editor content:', error)
                        }
                    },
                    onReady: () => {
                        setIsReady(true)
                        if (onReady) {
                            onReady({
                                save: async () => {
                                    if (!editorInstance.current) return { blocks: [], version: '2.28.2', time: Date.now() }
                                    return await editorInstance.current.save()
                                }
                            })
                        }
                    },
                    placeholder,
                    defaultBlock: 'paragraph'
                })

                editorInstance.current = editor
            } catch (error) {
                console.error('Editor initialization failed:', error)
            }
        }

        initEditor()

        return () => {
            if (editorInstance.current && editorInstance.current.destroy) {
                editorInstance.current.destroy()
                editorInstance.current = null
            }
        }
    }, [readOnly]) // 只监听 readOnly 变化，避免 data 变更触发重建

    // 添加自定义样式
    useEffect(() => {
        if (!isReady) return

        const style = document.createElement('style')
        style.textContent = `
            .codex-editor__redactor {
                padding-bottom: 50px !important;
                overflow-y: auto !important;
                max-height: 100% !important;
            }
            .ce-block__content,
            .ce-toolbar__content {
                max-width: 100% !important;
            }
            .codex-editor {
                min-height: 300px !important;
                max-height: 100% !important;
                overflow-y: auto !important;
            }
            .ce-block {
                margin: 0.5em 0 !important;
            }
            .ce-toolbar__actions {
                right: -10px !important;
            }
            /* 自定义滚动条样式 */
            .codex-editor::-webkit-scrollbar {
                width: 6px;
            }
            .codex-editor::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 3px;
            }
            .codex-editor::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 3px;
            }
            .codex-editor::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }
            /* 图片上传loading样式 */
            .image-tool__image-preloader {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 20px !important;
                background: #f8f9fa !important;
                border: 2px dashed #dee2e6 !important;
                border-radius: 8px !important;
                position: relative !important;
            }
            .image-tool__image-preloader::before {
                content: "" !important;
                width: 24px !important;
                height: 24px !important;
                border: 2px solid #e3e3e3 !important;
                border-top: 2px solid #3b82f6 !important;
                border-radius: 50% !important;
                animation: spin 1s linear infinite !important;
                margin-bottom: 8px !important;
            }
            .image-tool__image-preloader::after {
                content: "上传中..." !important;
                font-size: 14px !important;
                color: #6c757d !important;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `
        document.head.appendChild(style)

        return () => {
            document.head.removeChild(style)
        }
    }, [isReady])

    return (
        <div className="w-full min-h-[300px] border border-gray-200 rounded-lg overflow-hidden relative">
            {/* 上传进度条 */}
            {isUploading && (
                <div className="absolute top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
                    <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">上传图片中...</span>
                            <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}
            
            <div
                ref={editorContainerRef}
                className={`p-4 min-h-[300px] max-h-full overflow-y-auto ${isUploading ? 'pt-16' : ''}`}
            />
        </div>
    )
}

export default memo(EditorJSWrapper) 