'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

// 动态导入地图组件，避免SSR问题
const InteractiveMap = dynamic(() => import('@/components/map/interactive-map').then(mod => ({ default: mod.InteractiveMap })), {
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

export default function HomePage() {
    const [mapLoaded, setMapLoaded] = useState(false) // This state is not currently used

    return (
        <main className="relative w-full h-screen overflow-hidden">
            {/* Full-screen map */}
            <InteractiveMap />

            {/* Floating sidebar */}
            <Sidebar />

            {/* App title overlay - 移动到右上角 */}
            <div className="absolute top-4 right-20 z-20 pointer-events-none">
                <h1 className="text-white text-lg font-semibold bg-black bg-opacity-50 px-3 py-2 rounded-md backdrop-blur-sm">
                    マップ案内
                </h1>
            </div>
        </main>
    )
} 