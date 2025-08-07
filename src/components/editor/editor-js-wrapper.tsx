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

    // 自定义图片上传处理
    const customImageUpload = useCallback(async (file: File) => {
        try {
            const result = await uploadFileToS3(file)
            if (result.success && result.url) {
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
            return {
                success: 0,
                error: '图片上传失败'
            }
        }
    }, [])

    // 初始化编辑器
    useEffect(() => {
        if (!editorContainerRef.current || editorInstance.current) return

        const initEditor = async () => {
            try {
                console.log('EditorJSWrapper: 初始化编辑器，数据:', data)

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
                        image: {
                            // @ts-ignore
                            class: ImageTool,
                            config: {
                                uploader: {
                                    uploadByFile: customImageUpload
                                },
                                captionPlaceholder: '添加图片说明'
                            }
                        }
                    },
                    data: data || { blocks: [] },
                    readOnly,
                    autofocus: !readOnly,
                    onChange: async () => {
                        if (!editorInstance.current || !onChange) return

                        try {
                            const outputData = await editorInstance.current.save()
                            console.log('EditorJS onChange - 获取编辑器数据:', outputData)
                            onChange(outputData)
                        } catch (error) {
                            console.error('Error getting editor content:', error)
                        }
                    },
                    onReady: () => {
                        console.log('Editor.js is ready to work!')
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
        `
        document.head.appendChild(style)

        return () => {
            document.head.removeChild(style)
        }
    }, [isReady])

    return (
        <div className="w-full min-h-[300px] border border-gray-200 rounded-lg overflow-hidden">
            <div
                ref={editorContainerRef}
                className="p-4 min-h-[300px] max-h-full overflow-y-auto"
            />
        </div>
    )
}

export default memo(EditorJSWrapper) 