'use client'

import React, { useEffect } from 'react'
import { AIChat } from './ai-chat'
import { createMarkerV2Tool, createTravelChainTool } from '@/lib/ai/tools/marker-tools'

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
  const handleExecutePlan = async (plan: ExecutionPlan) => {
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
              if (r && r.id) currentGroupMarkerIds.push(r.id)
            }
          } else if (result && result.id) {
            currentGroupMarkerIds.push(result.id)
          }
          debug('step_create_markers_success', { groupCreatedCount: currentGroupMarkerIds.length })
        } catch (err) {
          console.error('创建标记失败:', err)
          debug('step_create_markers_error', { error: err instanceof Error ? err.message : String(err) })
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
          // 每创建一条链后清空“本组”IDs，避免后续链串联到之前的地点
          if (!Array.isArray(step.args?.markerIds) || step.args.markerIds.length === 0) {
            currentGroupMarkerIds = []
          }
        } catch (err) {
          console.error('创建行程链失败:', err)
          debug('step_create_chain_error', { error: err instanceof Error ? err.message : String(err) })
        }
      } else {
        // 其它消息类步骤，当前不执行具体动作
        debug('step_message', { args: step.args })
      }
    }
    
    debug('execute_plan_done', { planId: plan?.id })
  }

  return (
    <div className={`fixed inset-0 z-50 flex pointer-events-none`}>
      {/* 侧边栏 */}
      <div className={`relative ml-auto h-full w-full max-w-full md:max-w-md lg:max-w-lg bg-white shadow-xl flex flex-col overflow-hidden transform transition-transform duration-300 pointer-events-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* 聊天区域 */}
        <div className="flex-1 min-h-0">
          <AIChat 
            onExecutePlan={handleExecutePlan}
            className="h-full border-0 shadow-none"
          />
        </div>
      </div>
    </div>
  )
}