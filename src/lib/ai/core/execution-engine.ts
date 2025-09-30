/**
 * 前端执行引擎
 * 负责在前端执行AI生成的计划，实时更新地图
 */

import { ExecutionPlan, ExecutionStep, ExecutionResult } from './execution-planner'

export interface ExecutionProgress {
  planId: string
  currentStep: number
  totalSteps: number
  completedSteps: ExecutionResult[]
  currentStepId?: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  startedAt?: Date
  completedAt?: Date
  error?: string
}

export interface ExecutionOptions {
  autoExecute?: boolean
  pauseOnError?: boolean
  maxRetries?: number
  onProgress?: (progress: ExecutionProgress) => void
  onStepComplete?: (step: ExecutionStep, result: ExecutionResult) => void
  onComplete?: (results: ExecutionResult[]) => void
  onError?: (error: string, step?: ExecutionStep) => void
}

/**
 * 前端执行引擎类
 */
export class ExecutionEngine {
  private progress: ExecutionProgress
  private options: ExecutionOptions
  private abortController?: AbortController

  constructor(plan: ExecutionPlan, options: ExecutionOptions = {}) {
    this.progress = {
      planId: plan.id,
      currentStep: 0,
      totalSteps: plan.steps.length,
      completedSteps: [],
      status: 'pending'
    }
    
    this.options = {
      autoExecute: true,
      pauseOnError: false,
      maxRetries: 3,
      ...options
    }
  }

  /**
   * 开始执行计划
   */
  async execute(plan: ExecutionPlan): Promise<ExecutionResult[]> {
    this.progress.status = 'running'
    this.progress.startedAt = new Date()
    this.abortController = new AbortController()

    console.log('🚀 开始执行计划:', plan.title)
    this.notifyProgress()

    try {
      const results: ExecutionResult[] = []
      
      for (let i = 0; i < plan.steps.length; i++) {
        if (this.abortController.signal.aborted) {
          throw new Error('执行被用户取消')
        }

        const step = plan.steps[i]
        this.progress.currentStep = i + 1
        this.progress.currentStepId = step.id
        this.notifyProgress()

        console.log(`🔧 执行步骤 ${i + 1}/${plan.steps.length}:`, step.metadata?.description)

        // 检查依赖
        if (step.dependencies) {
          const missingDeps = step.dependencies.filter(depId => 
            !results.find(r => r.stepId === depId && r.success)
          )
          if (missingDeps.length > 0) {
            throw new Error(`步骤 ${step.id} 的依赖未满足: ${missingDeps.join(', ')}`)
          }
        }

        // 执行步骤
        const result = await this.executeStep(step, results)
        results.push(result)
        this.progress.completedSteps.push(result)

        // 通知步骤完成
        this.options.onStepComplete?.(step, result)

        if (!result.success && this.options.pauseOnError) {
          this.progress.status = 'paused'
          this.notifyProgress()
          throw new Error(`步骤执行失败: ${result.error}`)
        }
      }

      this.progress.status = 'completed'
      this.progress.completedAt = new Date()
      this.progress.currentStepId = undefined
      this.notifyProgress()

      console.log('✅ 计划执行完成')
      this.options.onComplete?.(results)
      
      return results
    } catch (error) {
      this.progress.status = 'failed'
      this.progress.error = error instanceof Error ? error.message : '未知错误'
      this.notifyProgress()

      console.error('❌ 计划执行失败:', error)
      this.options.onError?.(this.progress.error)
      
      throw error
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: ExecutionStep, 
    previousResults: ExecutionResult[]
  ): Promise<ExecutionResult> {
    const startTime = Date.now()
    
    try {
      let result: any

      switch (step.type) {
        case 'create_marker':
          result = await this.createMarker(step.params)
          break
        case 'update_marker':
          result = await this.updateMarker(step.params, previousResults)
          break
        case 'create_chain':
          result = await this.createChain(step.params, previousResults)
          break
        default:
          throw new Error(`未知的步骤类型: ${step.type}`)
      }

      return {
        stepId: step.id,
        success: true,
        data: result,
        executedAt: new Date(),
        duration: Date.now() - startTime
      }
    } catch (error) {
      return {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
        executedAt: new Date(),
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * 创建标记
   */
  private async createMarker(params: any) {
    const response = await fetch('/api/markers/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name,
        iconType: params.iconType,
        content: params.content
      }),
      signal: this.abortController?.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`创建标记失败: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  /**
   * 更新标记
   */
  private async updateMarker(params: any, previousResults: ExecutionResult[]) {
    // 如果markerId是步骤ID，需要从之前的结果中获取实际的markerId
    let markerId = params.markerId
    if (markerId.startsWith('step_')) {
      const markerResult = previousResults.find(r => r.stepId === markerId)
      if (markerResult?.success && markerResult.data?.id) {
        markerId = markerResult.data.id
      } else {
        throw new Error(`无法找到标记ID，步骤 ${markerId} 未成功执行`)
      }
    }

    const response = await fetch(`/api/markers/${markerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: params.title,
        markdownContent: params.markdownContent
      }),
      signal: this.abortController?.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`更新标记失败: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  /**
   * 创建行程链
   */
  private async createChain(params: any, previousResults: ExecutionResult[]) {
    console.log('🔗 创建行程链:', params)
    
    let markerIds: string[] = []
    
    if (params.markerIds && Array.isArray(params.markerIds)) {
      // 处理指定的标记ID列表
      markerIds = params.markerIds.map((id: string) => {
        if (id.startsWith('step_') || id.startsWith('marker_')) {
          const markerResult = previousResults.find(r => r.stepId === id)
          if (markerResult?.success && markerResult.data?.id) {
            console.log(`📍 从步骤 ${id} 获取标记ID: ${markerResult.data.id}`)
            return markerResult.data.id
          } else {
            throw new Error(`无法找到标记ID，步骤 ${id} 未成功执行`)
          }
        }
        return id
      })
    } else {
      // 自动收集标记，支持过滤条件
      markerIds = this.collectMarkerIds(previousResults, params.markerFilter)
    }

    if (markerIds.length === 0) {
      const filterDesc = params.markerFilter ? ` (过滤条件: ${JSON.stringify(params.markerFilter)})` : ''
      throw new Error(`没有找到有效的标记ID来创建行程链${filterDesc}`)
    }

    console.log(`🔗 准备创建行程链，包含 ${markerIds.length} 个标记:`, markerIds)

    const response = await fetch('/api/travel-chains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.chainName,
        description: params.description,
        markerIds
      }),
      signal: this.abortController?.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`创建行程链失败: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ 行程链创建成功:', result)
    return result
  }

  /**
   * 收集标记ID，支持过滤条件
   */
  private collectMarkerIds(previousResults: ExecutionResult[], filter?: any): string[] {
    const markerResults = previousResults.filter(r => 
      r.success && 
      (r.stepId.startsWith('marker_') || r.stepId.startsWith('step_marker_')) &&
      r.data?.id
    )
    
    let filteredResults = markerResults
    
    // 应用过滤条件
    if (filter) {
      filteredResults = markerResults.filter(result => {
        // 需要从步骤参数中获取过滤信息
        // 这里需要访问原始步骤信息，暂时通过结果数据判断
        if (filter.day !== undefined) {
          // 可以通过标记名称或其他方式判断天数
          // 这里简化处理，实际可能需要更复杂的逻辑
          return true // 暂时返回true，实际需要根据具体实现调整
        }
        if (filter.group !== undefined) {
          return true // 同上
        }
        return true
      })
      
      console.log(`🔍 应用过滤条件 ${JSON.stringify(filter)}: ${markerResults.length} → ${filteredResults.length} 个标记`)
    }
    
    const markerIds = filteredResults.map(result => {
      const filterInfo = filter ? ` (匹配过滤条件)` : ''
      console.log(`📍 收集标记ID: ${result.data.id} (来自步骤 ${result.stepId})${filterInfo}`)
      return result.data.id
    })
    
    return markerIds
  }

  /**
   * 暂停执行
   */
  pause(): void {
    if (this.progress.status === 'running') {
      this.progress.status = 'paused'
      this.notifyProgress()
    }
  }

  /**
   * 恢复执行
   */
  resume(): void {
    if (this.progress.status === 'paused') {
      this.progress.status = 'running'
      this.notifyProgress()
    }
  }

  /**
   * 取消执行
   */
  cancel(): void {
    this.abortController?.abort()
    this.progress.status = 'failed'
    this.progress.error = '用户取消执行'
    this.notifyProgress()
  }

  /**
   * 获取当前进度
   */
  getProgress(): ExecutionProgress {
    return { ...this.progress }
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(): void {
    this.options.onProgress?.(this.getProgress())
  }
}