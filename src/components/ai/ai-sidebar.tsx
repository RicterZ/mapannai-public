'use client'

import React from 'react'
import { AIChat } from './ai-chat'

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
    
    // 模拟执行过程
    for (const step of plan.steps) {
      console.log(`执行步骤: ${step.description}`)
      
      // 模拟异步操作
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      if (step.type === 'create_markers') {
        debug('step_create_markers', { args: step.args })
        // TODO: 调用实际的地图标记创建逻辑
        // 这里需要集成到地图组件中
      } else if (step.type === 'create_chain') {
        debug('step_create_chain', { args: step.args })
        // TODO: 调用实际的行程链创建逻辑
      }
    }
    
    debug('execute_plan_done', { planId: plan?.id })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onToggle}
      />
      
      {/* 侧边栏 */}
      <div className="relative ml-auto h-full w-full max-w-md bg-white shadow-xl flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center p-4 border-b">
          <h2 className="text-lg font-semibold">AI旅游助手</h2>
        </div>
        
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