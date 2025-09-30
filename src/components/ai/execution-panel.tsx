'use client'

import { useState, useEffect } from 'react'
import { ExecutionEngine, ExecutionProgress, ExecutionOptions } from '@/lib/ai/core/execution-engine'
import { ExecutionPlan, ExecutionStep, ExecutionResult } from '@/lib/ai/core/execution-planner'
import { cn } from '@/utils/cn'

interface ExecutionPanelProps {
  plan: ExecutionPlan
  onComplete?: (results: ExecutionResult[]) => void
  onCancel?: () => void
}

export const ExecutionPanel = ({ plan, onComplete, onCancel }: ExecutionPanelProps) => {
  const [progress, setProgress] = useState<ExecutionProgress | null>(null)
  const [engine, setEngine] = useState<ExecutionEngine | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  useEffect(() => {
    // 创建执行引擎
    const options: ExecutionOptions = {
      autoExecute: false,
      pauseOnError: false,
      maxRetries: 3,
      onProgress: (progress) => {
        setProgress(progress)
      },
      onStepComplete: (step, result) => {
        console.log('步骤完成:', step.metadata?.description, result.success ? '✅' : '❌')
      },
      onComplete: (results) => {
        setIsExecuting(false)
        onComplete?.(results)
      },
      onError: (error) => {
        setIsExecuting(false)
        console.error('执行失败:', error)
      }
    }

    const executionEngine = new ExecutionEngine(plan, options)
    setEngine(executionEngine)
    setProgress(executionEngine.getProgress())
  }, [plan, onComplete])

  const handleStart = async () => {
    if (!engine) return
    
    setIsExecuting(true)
    try {
      await engine.execute(plan)
    } catch (error) {
      console.error('执行失败:', error)
      setIsExecuting(false)
    }
  }

  const handlePause = () => {
    engine?.pause()
  }

  const handleResume = () => {
    engine?.resume()
  }

  const handleCancel = () => {
    engine?.cancel()
    setIsExecuting(false)
    onCancel?.()
  }

  if (!progress) {
    return <div className="p-4">加载中...</div>
  }

  const progressPercentage = (progress.completedSteps.length / progress.totalSteps) * 100

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      {/* 计划标题 */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{plan.title}</h3>
        <p className="text-sm text-gray-600">{plan.description}</p>
      </div>

      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>进度</span>
          <span>{progress.completedSteps.length}/{progress.totalSteps}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* 状态显示 */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <div className={cn(
            "w-3 h-3 rounded-full",
            progress.status === 'running' && "bg-green-500 animate-pulse",
            progress.status === 'paused' && "bg-yellow-500",
            progress.status === 'completed' && "bg-blue-500",
            progress.status === 'failed' && "bg-red-500",
            progress.status === 'pending' && "bg-gray-400"
          )} />
          <span className="text-sm font-medium">
            {progress.status === 'running' && '执行中...'}
            {progress.status === 'paused' && '已暂停'}
            {progress.status === 'completed' && '已完成'}
            {progress.status === 'failed' && '执行失败'}
            {progress.status === 'pending' && '等待开始'}
          </span>
        </div>
        
        {progress.currentStepId && (
          <div className="mt-2 text-sm text-gray-600">
            当前步骤: {plan.steps.find(s => s.id === progress.currentStepId)?.metadata?.description}
          </div>
        )}
      </div>

      {/* 步骤列表 */}
      <div className="mb-4 max-h-40 overflow-y-auto">
        <h4 className="text-sm font-medium text-gray-700 mb-2">执行步骤</h4>
        <div className="space-y-2">
          {plan.steps.map((step, index) => {
            const result = progress.completedSteps.find(r => r.stepId === step.id)
            const isCurrent = progress.currentStepId === step.id
            
            return (
              <div 
                key={step.id}
                className={cn(
                  "flex items-center space-x-2 p-2 rounded text-sm",
                  isCurrent && "bg-blue-50 border border-blue-200",
                  result?.success && "bg-green-50",
                  result && !result.success && "bg-red-50"
                )}
              >
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  result?.success && "bg-green-500",
                  result && !result.success && "bg-red-500",
                  isCurrent && "bg-blue-500 animate-pulse",
                  !result && !isCurrent && "bg-gray-300"
                )} />
                <span className="flex-1">{step.metadata?.description}</span>
                {result && (
                  <span className="text-xs text-gray-500">
                    {result.duration}ms
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex space-x-2">
        {progress.status === 'pending' && (
          <button
            onClick={handleStart}
            disabled={isExecuting}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            开始执行
          </button>
        )}
        
        {progress.status === 'running' && (
          <button
            onClick={handlePause}
            className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700"
          >
            暂停
          </button>
        )}
        
        {progress.status === 'paused' && (
          <button
            onClick={handleResume}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            继续
          </button>
        )}
        
        {(progress.status === 'running' || progress.status === 'paused') && (
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            取消
          </button>
        )}
        
        {progress.status === 'completed' && (
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            关闭
          </button>
        )}
        
        {progress.status === 'failed' && (
          <div className="flex space-x-2 w-full">
            <button
              onClick={handleStart}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              重试
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* 错误信息 */}
      {progress.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{progress.error}</p>
        </div>
      )}
    </div>
  )
}