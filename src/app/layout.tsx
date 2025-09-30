import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'マップ案内 Plus - 交互式地图 AI 编辑器',
    description: '交互式地图标记编辑平台，支持富文本内容编辑和多人协作，支持AI聊天和生成计划',
    keywords: ['地图', '编辑器', '标记', 'mapbox', '交互式', 'マップ案内', 'AI', '聊天', '旅游计划'],
    authors: [{ name: 'マップ案内 Team, Ricter Z' }],
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
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