'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'

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

export default function HomePage() {
    useEffect(() => {
        const setVh = () => {
            const h = window.visualViewport?.height ?? window.innerHeight
            document.documentElement.style.setProperty('--vh', `${h}px`)
        }
        setVh()
        window.visualViewport?.addEventListener('resize', setVh)
        window.addEventListener('resize', setVh)
        return () => {
            window.visualViewport?.removeEventListener('resize', setVh)
            window.removeEventListener('resize', setVh)
        }
    }, [])

    return (
        <main className="relative w-full overflow-hidden" style={{ height: 'var(--vh, 100dvh)' }}>
            {/* Full-screen map */}
            <InteractiveMap />

            {/* Floating sidebar */}
            <Sidebar />

        </main>
    )
} 