'use client'

import React, { useEffect } from 'react'
import { Bot } from 'lucide-react'
import { AIChat } from './ai-chat'
import { createMarkerV2Tool, createTravelChainTool } from '@/lib/ai/tools/marker-tools'
import { useMapStore } from '@/store/map-store'

interface ExecutionPlan {
  id: string
  title: string
  description: string
  steps: ExecutionStep[]
  createdAt: Date
}

interface ExecutionStep {
  id: string
  type: 'create_markers' | 'create_chain' | 'message'
  name: string
  description: string
  args: any
  status: 'pending' | 'running' | 'completed' | 'failed'
}

interface AiSidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function AiSidebar({ isOpen, onToggle }: AiSidebarProps) {
  // 按下 ESC 关闭侧边栏
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onToggle()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onToggle])
  const handleExecutePlan = async (plan: ExecutionPlan, callbacks: { onStepStart?: (stepId: string) => void; onStepComplete?: (stepId: string, success: boolean) => void }) => {
    const anyWindow = (typeof window !== 'undefined') ? (window as any) : null
    const debug = (...args: any[]) => {
      try {
        if (anyWindow && typeof anyWindow.__AI_DEBUG__ === 'function') {
          anyWindow.__AI_DEBUG__('AiSidebar', ...args)
        } else {
          console.debug('[AiSidebar]', ...args)
        }
      } catch {}
    }
    debug('execute_plan_entry', { planId: plan?.id, stepCount: plan?.steps?.length })
    
    // 按组（通常对应“当天”）收集刚创建的标记ID
    let currentGroupMarkerIds: string[] = []
    for (const step of plan.steps) {
      callbacks.onStepStart?.(step.id)
      console.log(`执行步骤: ${step.description}`)

      if (step.type === 'create_markers') {
        try {
          debug('step_create_markers_begin', { args: step.args })
          // 支持批量创建
          const places = Array.isArray(step.args?.places) ? step.args.places : (step.args?.name ? [{ name: step.args.name, iconType: step.args.iconType || 'location', content: step.args.content || '' }] : [])
          const result = await createMarkerV2Tool.execute({ places })
          // 归集返回的 marker id（仅加入本组，不跨组累计）
          if (Array.isArray(result?.results)) {
            for (const r of result.results) {
              if (r && r.id) {
                currentGroupMarkerIds.push(r.id)
                // 写入本地地图状态，实时展示
                try {
                  console.debug('[AiSidebar] addMarkerToStore(batch):', r.id, r.coordinates)
                  useMapStore.getState().addMarkerToStore(r)
                } catch (e) {
                  console.debug('addMarkerToStore failed, will ignore:', e)
                }
              }
            }
          } else if (result && result.id) {
            currentGroupMarkerIds.push(result.id)
            try {
              console.debug('[AiSidebar] addMarkerToStore(single):', result.id, result.coordinates)
              useMapStore.getState().addMarkerToStore(result)
            } catch (e) {
              console.debug('addMarkerToStore failed, will ignore:', e)
            }
          }
          debug('step_create_markers_success', { groupCreatedCount: currentGroupMarkerIds.length })
          callbacks.onStepComplete?.(step.id, true)
        } catch (err) {
          console.error('创建标记失败:', err)
          debug('step_create_markers_error', { error: err instanceof Error ? err.message : String(err) })
          callbacks.onStepComplete?.(step.id, false)
          // 不中断后续步骤，让链式继续
        }
      } else if (step.type === 'create_chain') {
        try {
          debug('step_create_chain_begin', { args: step.args })
          // 若未显式提供 markerIds，则使用“本组”刚创建的标记IDs
          const markerIds: string[] = Array.isArray(step.args?.markerIds) && step.args.markerIds.length > 0
            ? step.args.markerIds
            : currentGroupMarkerIds
          if (markerIds.length === 0) {
            console.warn('无可用的 markerIds，跳过创建行程链')
            continue
          }
          await createTravelChainTool.execute({
            markerIds,
            chainName: step.args?.chainName,
            description: step.args?.description
          })
          debug('step_create_chain_success', { markerIdsCount: markerIds.length })
          // 实时更新本地 next 关系，触发线路渲染
          try {
            for (let i = 0; i < markerIds.length - 1; i++) {
              const fromId = markerIds[i]
              const toId = markerIds[i + 1]
              const state = useMapStore.getState()
              const fromMarker = state.markers.find(m => m.id === fromId)
              const existingNext = Array.isArray(fromMarker?.content.next) ? fromMarker!.content.next : []
              const nextIds = existingNext.includes(toId) ? existingNext : [...existingNext, toId]
              state.setMarkerNext(fromId, nextIds)
            }
            // 通知连线组件刷新路径
            window.dispatchEvent(new CustomEvent('refreshConnectionLines'))
          } catch (e) {
            console.debug('realtime next update failed (ignored):', e)
          }
          callbacks.onStepComplete?.(step.id, true)
          // 每创建一条链后清空“本组”IDs，避免后续链串联到之前的地点
          if (!Array.isArray(step.args?.markerIds) || step.args.markerIds.length === 0) {
            currentGroupMarkerIds = []
          }
        } catch (err) {
          console.error('创建行程链失败:', err)
          debug('step_create_chain_error', { error: err instanceof Error ? err.message : String(err) })
          callbacks.onStepComplete?.(step.id, false)
        }
      } else {
        // 其它消息类步骤，当前不执行具体动作
        debug('step_message', { args: step.args })
        callbacks.onStepComplete?.(step.id, true)
      }
    }
    
    debug('execute_plan_done', { planId: plan?.id })
  }

  return (
    <div className={`fixed inset-0 z-50 flex pointer-events-none`}>
      {/* 侧边栏 */}
      <div className={`relative ml-auto h-full w-full max-w-full md:max-w-md lg:max-w-lg bg-white shadow-xl flex flex-col overflow-hidden transform transition-transform duration-300 pointer-events-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* 顶部栏：标题 + 关闭按钮 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-gray" />
            旅游助手
          </div>
          <button
            onClick={onToggle}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            aria-label="关闭AI侧边栏"
            title="关闭"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* 聊天区域 */}
        <div className="flex-1 min-h-0">
          <AIChat 
            onExecutePlan={handleExecutePlan}
            className="h-full border-0 shadow-none"
            showTimestamp={false}
          />
        </div>
      </div>
    </div>
  )
}