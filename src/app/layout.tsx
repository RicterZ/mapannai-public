import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'マップ案内 - 交互式地图编辑器',
    description: '交互式地图标记编辑平台，支持富文本内容编辑和多人协作',
    keywords: ['地图', '编辑器', '标记', 'mapbox', '交互式', 'マップ案内'],
    authors: [{ name: 'マップ案内 Team' }],
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="zh-CN">
            <body className={inter.className}>
                {children}
            </body>
        </html>
    )
} 