/**
 * AI服务 V3 - 混合架构版本
 * AI智能在后端，地图操作在前端
 */

import { AIEngine, AIMessage, AIStreamChunk } from './core/ai-engine'
import { ConversationManager } from './core/conversation-manager'
import { ExecutionPlanner, ExecutionPlan } from './core/execution-planner'

// 系统提示词 - 专注于生成执行计划
const SYSTEM_PROMPT = `你是旅游规划助手，专门负责分析用户需求并生成地图标记创建计划。

## 核心任务
1. 深度分析用户的旅游需求
2. 基于你的知识推荐合适的地点
3. 生成结构化的执行计划，供前端实时执行

## 输出格式
<think>
[深度思考用户需求，分析旅游偏好、时间安排、预算考虑等，列出推荐地点和理由]
</think>

<plan>
[生成JSON格式的执行计划，包含具体的工具调用序列]
</plan>

## 规划原则
1. **地点准确性**: 使用日语官方名称，包含城市信息避免歧义
2. **类型多样性**: 平衡景点、美食、购物、文化等不同类型
3. **地理合理性**: 考虑地点间的距离和交通便利性
4. **时间安排**: 根据用户时间合理安排游览顺序
5. **个性化**: 根据用户偏好调整推荐内容

## 图标类型规范
- landmark: 地标建筑、纪念碑、塔楼
- culture: 博物馆、艺术馆、历史遗迹
- natural: 自然景观、公园、海滩
- food: 餐厅、美食街、市场
- shopping: 商场、购物中心
- activity: 娱乐场所、运动场馆
- hotel: 酒店、住宿
- park: 公园、绿地

## 执行计划格式

### 单日游示例
{
  "title": "东京一日游",
  "description": "经典景点一日游",
  "toolCalls": [
    {
      "name": "create_marker_v2",
      "args": {
        "places": [
          {"name": "東京タワー", "iconType": "landmark", "content": "..."},
          {"name": "浅草寺", "iconType": "culture", "content": "..."},
          {"name": "新宿御苑", "iconType": "park", "content": "..."}
        ]
      }
    },
    {
      "name": "create_travel_chain",
      "args": {
        "chainName": "东京一日游路线",
        "description": "完整的一日游览路线"
      }
    }
  ]
}

### 多日游示例
{
  "title": "东京三日深度游",
  "description": "分天游览不同主题的景点",
  "toolCalls": [
    {
      "name": "create_marker_v2",
      "args": {
        "places": [
          {"name": "東京タワー", "iconType": "landmark", "content": "...", "day": 1},
          {"name": "浅草寺", "iconType": "culture", "content": "...", "day": 1},
          {"name": "新宿御苑", "iconType": "park", "content": "...", "day": 1},
          {"name": "築地市場", "iconType": "food", "content": "...", "day": 2},
          {"name": "銀座", "iconType": "shopping", "content": "...", "day": 2},
          {"name": "上野公園", "iconType": "park", "content": "...", "day": 2}
        ]
      }
    },
    {
      "name": "create_travel_chain",
      "args": {
        "chainName": "第一天：传统与现代",
        "description": "东京塔、浅草寺、新宿御苑的经典路线",
        "markerFilter": {"day": 1}
      }
    },
    {
      "name": "create_travel_chain", 
      "args": {
        "chainName": "第二天：美食与购物",
        "description": "築地市場、銀座的美食购物之旅",
        "markerFilter": {"day": 2}
      }
    }
  ]
}

## 重要说明
- create_travel_chain 会自动使用前面创建的所有标记来构建行程链
- 标记创建和行程链创建有依赖关系，系统会自动处理
- 每个地点的content应该包含详细的介绍信息，帮助用户了解景点特色

重要：只生成计划，不执行具体操作。前端会根据计划实时执行并更新地图。`

export interface AIResponse {
  type: 'plan' | 'message' | 'error'
  content: string
  plan?: ExecutionPlan
  conversationId: string
}

/**
 * AI服务 V3 类
 */
export class AIServiceV3 {
  private aiEngine: AIEngine
  private conversationManager: ConversationManager

  constructor() {
    this.aiEngine = new AIEngine({
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'deepseek-r1:8b'
    })
    this.conversationManager = new ConversationManager(SYSTEM_PROMPT)
  }

  /**
   * 创建新对话
   */
  createConversation(): string {
    return this.conversationManager.createConversation()
  }

  /**
   * 处理用户消息，生成执行计划
   */
  async processMessage(
    message: string,
    conversationId: string
  ): Promise<AIResponse> {
    try {
      console.log('🤖 AI处理消息:', message)

      // 获取对话历史  
      const history = this.conversationManager.getHistory(conversationId) || [] || []
      
      // 构建消息列表
      const messages: AIMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: message }
      ]

      // 调用AI模型
      const response = await this.aiEngine.generate(messages)
      
      // 解析响应
      const aiResponse = await this.parseAIResponse(response, conversationId)
      
      // 保存对话历史
      this.conversationManager.addMessage(conversationId, { role: 'user', content: message })
      this.conversationManager.addMessage(conversationId, { role: 'assistant', content: aiResponse.content })

      return aiResponse
    } catch (error) {
      console.error('❌ AI处理失败:', error)
      return {
        type: 'error',
        content: `处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
        conversationId
      }
    }
  }

  /**
   * 流式处理消息 - 过滤AI思考过程
   */
  async *processMessageStream(
    message: string,
    conversationId: string
  ): AsyncGenerator<AIResponse, void, unknown> {
    try {
      console.log('🤖 AI流式处理消息:', message)

      // 获取对话历史
      const history = this.conversationManager.getHistory(conversationId)
      
      // 构建消息列表
      const messages: AIMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: message }
      ]

      let fullResponse = ''
      let isInThinkTag = false
      let isInPlanTag = false
      let planContent = ''
      
      // 流式调用AI模型
      for await (const chunk of this.aiEngine.generateStream(messages)) {
        fullResponse += chunk.content
        
        // 检查是否进入/退出 <think> 标签
        if (chunk.content.includes('<think>')) {
          isInThinkTag = true
          continue // 跳过 <think> 标签内容
        }
        if (chunk.content.includes('</think>')) {
          isInThinkTag = false
          continue
        }
        
        // 检查是否进入 <plan> 标签
        if (chunk.content.includes('<plan>')) {
          isInPlanTag = true
          continue
        }
        if (chunk.content.includes('</plan>')) {
          isInPlanTag = false
          // 解析并发送计划
          const plan = this.parsePlanContent(planContent)
          if (plan) {
            yield {
              type: 'plan',
              content: '已生成执行计划',
              plan,
              conversationId
            }
          }
          continue
        }
        
        // 如果在 <think> 标签内，跳过输出
        if (isInThinkTag) {
          continue
        }
        
        // 如果在 <plan> 标签内，收集计划内容
        if (isInPlanTag) {
          planContent += chunk.content
          continue
        }
        
        // 输出正常内容
        yield {
          type: 'message',
          content: chunk.content,
          conversationId
        }
      }

      // 保存对话历史
      this.conversationManager.addMessage(conversationId, { role: 'user', content: message })
      this.conversationManager.addMessage(conversationId, { role: 'assistant', content: fullResponse })

    } catch (error) {
      console.error('❌ AI流式处理失败:', error)
      yield {
        type: 'error',
        content: `处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
        conversationId
      }
    }
  }

  /**
   * 解析AI响应
   */
  private async parseAIResponse(response: string, conversationId: string): Promise<AIResponse> {
    // 提取执行计划
    const plan = this.extractPlanFromResponse(response)
    
    if (plan) {
      return {
        type: 'plan',
        content: response,
        plan,
        conversationId
      }
    }

    return {
      type: 'message',
      content: response,
      conversationId
    }
  }

  /**
   * 从响应中提取执行计划
   */
  private extractPlanFromResponse(response: string): ExecutionPlan | null {
    try {
      // 查找 <plan> 标签中的内容
      const planMatch = response.match(/<plan>([\s\S]*?)<\/plan>/i)
      if (!planMatch) {
        return null
      }

      const planContent = planMatch[1].trim()
      return this.parsePlanContent(planContent)
    } catch (error) {
      console.error('解析执行计划失败:', error)
      return null
    }
  }

  /**
   * 解析计划内容
   */
  private parsePlanContent(planContent: string): ExecutionPlan | null {
    try {
      console.log('📋 解析计划内容:', planContent)
      
      // 尝试解析JSON
      const planData = JSON.parse(planContent)
      
      if (!planData.toolCalls || !Array.isArray(planData.toolCalls)) {
        console.warn('计划格式不正确，缺少toolCalls')
        return null
      }

      // 使用ExecutionPlanner创建计划
      const plan = ExecutionPlanner.createPlanFromToolCalls(
        planData.title || '旅游计划',
        planData.description || '用户定制的旅游计划',
        planData.toolCalls
      )

      // 验证计划
      const validation = ExecutionPlanner.validatePlan(plan)
      if (!validation.valid) {
        console.error('计划验证失败:', validation.errors)
        return null
      }

      console.log('✅ 成功生成执行计划:', plan.title, `(${plan.steps.length}步骤)`)
      return plan
    } catch (error) {
      console.error('解析计划内容失败:', error)
      return null
    }
  }

  /**
   * 获取对话历史
   */
  getConversationHistory(conversationId: string): AIMessage[] {
    return this.conversationManager.getHistory(conversationId)
  }

  /**
   * 清理对话
   */
  clearConversation(conversationId: string): void {
    this.conversationManager.clearConversation(conversationId)
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      conversations: this.conversationManager.getStats(),
      engine: this.aiEngine.getStats()
    }
  }
}