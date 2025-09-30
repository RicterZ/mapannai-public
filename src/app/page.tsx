'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useMapStore } from '@/store/map-store'
import { cn } from '@/utils/cn'

// 动态导入地图组件，避免SSR问题
const InteractiveMap = dynamic(() => import('@/components/map/abstract-map').then(mod => ({ default: mod.AbstractMap })), {
    ssr: false,
    loading: () => (
        <div className="w-full h-screen flex items-center justify-center bg-gray-100">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">加载地图中...</p>
            </div>
        </div>
    )
})

const Sidebar = dynamic(() => import('@/components/sidebar/sidebar').then(mod => ({ default: mod.Sidebar })), {
    ssr: false
})

const AiSidebar = dynamic(() => import('@/components/ai/ai-sidebar').then(mod => ({ default: mod.AiSidebar })), {
    ssr: false
})

export default function HomePage() {
    const [mapLoaded, setMapLoaded] = useState(false) // This state is not currently used
    const { interactionState, openAiSidebar, closeAiSidebar } = useMapStore()

    return (
        <main className="relative w-full h-screen full-height overflow-hidden">
            {/* Full-screen map */}
            <InteractiveMap />

            {/* Floating sidebar */}
            <Sidebar />

            {/* AI Sidebar */}
            {interactionState.isAiSidebarOpen && (
                <AiSidebar onClose={closeAiSidebar} />
            )}

            {/* AI Assistant Button - 左上角，与现有按钮风格一致 */}
            <div className="absolute left-4 top-20 z-50">
                <button
                    onClick={interactionState.isAiSidebarOpen ? closeAiSidebar : openAiSidebar}
                    className={cn(
                        'w-12 h-12 rounded-full shadow-lg border border-gray-200 bg-white',
                        'flex items-center justify-center',
                        'hover:bg-blue-50 hover:border-blue-300 transition-all duration-200',
                        'focus:outline-none',
                        interactionState.isAiSidebarOpen && 'bg-red-50 border-red-300 hover:bg-red-100'
                    )}
                    aria-label={interactionState.isAiSidebarOpen ? '关闭AI助手' : '打开AI助手'}
                    title={interactionState.isAiSidebarOpen ? '关闭AI助手' : '打开AI助手'}
                >
                    {interactionState.isAiSidebarOpen ? (
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    )}
                </button>
            </div>
        </main>
    )
} 