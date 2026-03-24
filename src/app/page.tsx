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
        const el = document.getElementById('app-root')
        if (!el) return

        const update = () => {
            const vv = window.visualViewport
            if (vv) {
                el.style.height = `${vv.height}px`
            }
        }
        update()
        window.visualViewport?.addEventListener('resize', update)
        window.visualViewport?.addEventListener('scroll', update)
        return () => {
            window.visualViewport?.removeEventListener('resize', update)
            window.visualViewport?.removeEventListener('scroll', update)
        }
    }, [])

    return (
        <main id="app-root" className="fixed overflow-hidden" style={{ top: 0, left: 0, width: '100%', height: '100dvh' }}>
            {/* Full-screen map */}
            <InteractiveMap />

            {/* Floating sidebar */}
            <Sidebar />

        </main>
    )
} 