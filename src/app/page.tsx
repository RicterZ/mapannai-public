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

const AiSidebarV3 = dynamic(() => import('@/components/ai/ai-sidebar-v3').then(mod => ({ default: mod.AiSidebarV3 })), {
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

            {/* AI Sidebar V3 - 混合架构 */}
            <AiSidebarV3 
                isOpen={interactionState.isAiSidebarOpen} 
                onToggle={() => interactionState.isAiSidebarOpen ? closeAiSidebar() : openAiSidebar()} 
            />

        </main>
    )
} 