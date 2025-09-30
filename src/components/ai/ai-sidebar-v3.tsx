'use client'

import { AiChatV3 } from './ai-chat-v3'
import { cn } from '@/utils/cn'

interface AiSidebarV3Props {
  isOpen: boolean
  onToggle: () => void
}

export const AiSidebarV3 = ({ isOpen, onToggle }: AiSidebarV3Props) => {
  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* 侧边栏 */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">旅游规划助手</h2>
              <p className="text-xs text-gray-500">智能地图标记生成</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 聊天区域 */}
        <div className="h-[calc(100%-73px)]">
          <AiChatV3 />
        </div>
      </div>


    </>
  )
}