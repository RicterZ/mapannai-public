'use client'

import { useRef, useCallback } from 'react'
import { cn } from '@/utils/cn'
import { AiChat } from './ai-chat'

interface AiSidebarProps {
  onClose?: () => void
}

export const AiSidebar = ({ onClose }: AiSidebarProps) => {
  const sidebarRef = useRef<HTMLDivElement>(null)

  // 自定义关闭函数
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose()
    }
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-25 z-40 lg:hidden"
        onClick={handleClose}
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={cn(
          'fixed z-50',
          'w-full max-w-md lg:max-w-lg xl:max-w-xl',
          'bg-white shadow-2xl',
          'transform transition-transform duration-300 ease-in-out',
          'animate-slide-in-bottom lg:animate-slide-in-right',
          'flex flex-col',
          // 移动端：全屏显示
          'right-0 bottom-0 h-full',
          // PC端：正常右侧显示
          'lg:right-0 lg:top-0 lg:bottom-0 lg:h-auto'
        )}
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        <AiChat onClose={handleClose} />
      </div>
    </>
  )
}
