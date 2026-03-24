/**
 * zoom-threshold.ts
 *
 * 动态读写 zoomThreshold 的工具模块。
 *
 * 默认值来自 config，可通过 localStorage 覆盖。
 * 在浏览器 Console (F12) 中调用以下函数动态调整：
 *
 *   window.__setZoomThreshold(9)   // 设置新阈值
 *   window.__getZoomThreshold()    // 查看当前阈值
 *   window.__resetZoomThreshold()  // 恢复默认值
 */

import { config } from '@/lib/config'

const LS_KEY = 'mapannai_zoom_threshold'

/** 读取当前生效的 zoomThreshold（localStorage 优先，fallback 到 config） */
export function getZoomThreshold(): number {
    if (typeof window === 'undefined') return config.app.zoomThreshold
    const stored = localStorage.getItem(LS_KEY)
    if (stored !== null) {
        const parsed = Number(stored)
        if (!isNaN(parsed)) return parsed
    }
    return config.app.zoomThreshold
}

/** 将新阈值写入 localStorage 并触发自定义事件通知组件刷新 */
export function setZoomThreshold(value: number): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(LS_KEY, String(value))
    window.dispatchEvent(new CustomEvent('zoomThresholdChange', { detail: value }))
    console.info(`[MapAnNai] zoomThreshold 已更新为 ${value}（已保存到 localStorage）`)
}

/** 清除 localStorage 中的覆盖值，恢复 config 默认值 */
export function resetZoomThreshold(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(LS_KEY)
    window.dispatchEvent(new CustomEvent('zoomThresholdChange', { detail: config.app.zoomThreshold }))
    console.info(`[MapAnNai] zoomThreshold 已重置为默认值 ${config.app.zoomThreshold}`)
}

/** 挂载 backdoor 函数到 window，供 F12 Console 调用 */
export function installZoomThresholdBackdoor(): void {
    if (typeof window === 'undefined') return
    ;(window as unknown as Record<string, unknown>).__setZoomThreshold = (value: number) => setZoomThreshold(value)
    ;(window as unknown as Record<string, unknown>).__getZoomThreshold = () => {
        const current = getZoomThreshold()
        console.info(`[MapAnNai] 当前 zoomThreshold = ${current}（默认值 = ${config.app.zoomThreshold}）`)
        return current
    }
    ;(window as unknown as Record<string, unknown>).__resetZoomThreshold = () => resetZoomThreshold()
}
