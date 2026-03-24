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

        let pending = false
        const update = () => {
            if (pending) return
            pending = true
            requestAnimationFrame(() => {
                pending = false
                const vv = window.visualViewport
                if (!vv) return
                // Layout Viewport 和 Visual Viewport 的差值就是键盘+工具栏高度
                // 用 translateY 把容器往上推，抵消白条
                const offset = window.innerHeight - vv.height - vv.offsetTop
                el.style.transform = `translateY(-${Math.max(0, offset)}px)`
            })
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
        <main id="app-root" className="fixed inset-0 overflow-hidden">
            {/* Full-screen map */}
            <InteractiveMap />

            {/* Floating sidebar */}
            <Sidebar />

        </main>
    )
} 