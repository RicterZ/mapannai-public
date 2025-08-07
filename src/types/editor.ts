import { OutputData, ToolConstructable, ToolSettings } from '@editorjs/editorjs'

export interface EditorConfig {
    placeholder?: string
    data?: OutputData
    readOnly?: boolean
    onChange?: (data: OutputData) => void
    onSave?: (data: OutputData) => Promise<void>
}

export interface EditorTools {
    [toolName: string]: ToolConstructable | ToolSettings
}

export interface SavedEditorData {
    markerId: string
    data: OutputData
    timestamp: Date
} 