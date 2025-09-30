/**
 * 执行计划器
 * 负责将AI意图转换为前端可执行的步骤
 */

export interface ExecutionStep {
  id: string
  type: 'create_marker' | 'update_marker' | 'create_chain' | 'search_place'
  params: Record<string, any>
  dependencies?: string[] // 依赖的步骤ID
  metadata?: {
    description?: string
    estimatedTime?: number
    priority?: number
  }
}

export interface ExecutionPlan {
  id: string
  title: string
  description: string
  steps: ExecutionStep[]
  metadata: {
    totalSteps: number
    estimatedDuration: number
    createdAt: Date
  }
}

export interface ExecutionResult {
  stepId: string
  success: boolean
  data?: any
  error?: string
  executedAt: Date
  duration: number
}

/**
 * 执行计划器类
 */
export class ExecutionPlanner {
  /**
   * 创建标记执行步骤
   */
  static createMarkerStep(
    id: string,
    name: string,
    iconType: string,
    content?: string,
    dependencies?: string[]
  ): ExecutionStep {
    return {
      id,
      type: 'create_marker',
      params: {
        name,
        iconType,
        content: content || ''
      },
      dependencies,
      metadata: {
        description: `创建标记: ${name}`,
        estimatedTime: 2000,
        priority: 1
      }
    }
  }

  /**
   * 更新标记执行步骤
   */
  static updateMarkerStep(
    id: string,
    markerId: string,
    title: string,
    content: string,
    dependencies?: string[]
  ): ExecutionStep {
    return {
      id,
      type: 'update_marker',
      params: {
        markerId,
        title,
        markdownContent: content
      },
      dependencies,
      metadata: {
        description: `更新标记内容: ${title}`,
        estimatedTime: 1000,
        priority: 2
      }
    }
  }

  /**
   * 创建行程链执行步骤
   */
  static createChainStep(
    id: string,
    markerIds: string[],
    chainName: string,
    description?: string,
    dependencies?: string[]
  ): ExecutionStep {
    return {
      id,
      type: 'create_chain',
      params: {
        markerIds,
        chainName,
        description: description || ''
      },
      dependencies,
      metadata: {
        description: `创建行程链: ${chainName}`,
        estimatedTime: 1500,
        priority: 3
      }
    }
  }

  /**
   * 从AI工具调用创建执行计划
   */
  static createPlanFromToolCalls(
    title: string,
    description: string,
    toolCalls: Array<{
      name: string
      args: Record<string, any>
    }>
  ): ExecutionPlan {
    const steps: ExecutionStep[] = []
    const markerStepIds: string[] = []

    toolCalls.forEach((call, index) => {
      const stepId = `step_${index + 1}`

      switch (call.name) {
        case 'create_marker_v2':
          if (call.args.places && Array.isArray(call.args.places)) {
            // 批量创建 - 支持分组标记
            call.args.places.forEach((place: any, placeIndex: number) => {
              const markerStepId = `${stepId}_marker_${placeIndex + 1}`
              
              // 创建标记步骤，保留额外的元数据
              const markerStep = ExecutionPlanner.createMarkerStep(
                markerStepId,
                place.name,
                place.iconType,
                place.content
              )
              
              // 添加分组信息到参数中
              if (place.day !== undefined) {
                markerStep.params.day = place.day
              }
              if (place.group !== undefined) {
                markerStep.params.group = place.group
              }
              
              steps.push(markerStep)
              markerStepIds.push(markerStepId)
            })
          } else {
            // 单个创建
            const markerStep = ExecutionPlanner.createMarkerStep(
              stepId,
              call.args.name,
              call.args.iconType,
              call.args.content
            )
            
            // 添加分组信息
            if (call.args.day !== undefined) {
              markerStep.params.day = call.args.day
            }
            if (call.args.group !== undefined) {
              markerStep.params.group = call.args.group
            }
            
            steps.push(markerStep)
            markerStepIds.push(stepId)
          }
          break

        case 'update_marker_content':
          steps.push(
            ExecutionPlanner.updateMarkerStep(
              stepId,
              call.args.markerId,
              call.args.title,
              call.args.markdownContent
            )
          )
          break

        case 'create_travel_chain':
          // 支持过滤条件的行程链创建
          let targetMarkerIds = call.args.markerIds || markerStepIds
          let dependencies = markerStepIds
          
          // 如果有过滤条件，只依赖匹配的标记
          if (call.args.markerFilter) {
            const filter = call.args.markerFilter
            const filteredStepIds = markerStepIds.filter(stepId => {
              const step = steps.find(s => s.id === stepId)
              if (!step) return false
              
              // 检查过滤条件
              if (filter.day !== undefined && step.params.day !== filter.day) {
                return false
              }
              if (filter.group !== undefined && step.params.group !== filter.group) {
                return false
              }
              return true
            })
            
            targetMarkerIds = filteredStepIds
            dependencies = filteredStepIds
          }
          
          const chainStep = ExecutionPlanner.createChainStep(
            stepId,
            targetMarkerIds,
            call.args.chainName,
            call.args.description,
            dependencies
          )
          
          // 添加过滤信息到参数中
          if (call.args.markerFilter) {
            chainStep.params.markerFilter = call.args.markerFilter
          }
          
          steps.push(chainStep)
          break
      }
    })

    const totalTime = steps.reduce((sum, step) => 
      sum + (step.metadata?.estimatedTime || 1000), 0
    )

    return {
      id: `plan_${Date.now()}`,
      title,
      description,
      steps,
      metadata: {
        totalSteps: steps.length,
        estimatedDuration: totalTime,
        createdAt: new Date()
      }
    }
  }

  /**
   * 验证执行计划
   */
  static validatePlan(plan: ExecutionPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const stepIds = new Set(plan.steps.map(step => step.id))

    // 检查依赖关系
    plan.steps.forEach(step => {
      if (step.dependencies) {
        step.dependencies.forEach(depId => {
          if (!stepIds.has(depId)) {
            errors.push(`步骤 ${step.id} 依赖不存在的步骤 ${depId}`)
          }
        })
      }
    })

    // 检查必需参数
    plan.steps.forEach(step => {
      switch (step.type) {
        case 'create_marker':
          if (!step.params.name || !step.params.iconType) {
            errors.push(`步骤 ${step.id} 缺少必需参数: name, iconType`)
          }
          break
        case 'update_marker':
          if (!step.params.markerId || !step.params.markdownContent) {
            errors.push(`步骤 ${step.id} 缺少必需参数: markerId, markdownContent`)
          }
          break
        case 'create_chain':
          if (!step.params.markerIds || !Array.isArray(step.params.markerIds)) {
            errors.push(`步骤 ${step.id} 缺少必需参数: markerIds`)
          }
          break
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }
}