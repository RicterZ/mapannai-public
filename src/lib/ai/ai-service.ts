/**
 * AI服务 V4 - 简化重构版本
 * 专注于稳定性和可维护性
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  type: 'text' | 'plan' | 'plan_chunk' | 'error' | 'done' | 'thinking' | 'thinking_end'
  content: string
  plan?: ExecutionPlan
  conversationId: string
}

export interface ExecutionPlan {
  id: string
  title: string
  description: string
  steps: ExecutionStep[]
  createdAt: Date
}

export interface ExecutionStep {
  id: string
  type: 'create_markers' | 'create_chain' | 'message'
  name: string
  description: string
  args: any
  status: 'pending' | 'running' | 'completed' | 'failed'
}

/**
 * 对话管理器
 */
class ConversationManager {
  private conversations = new Map<string, AIMessage[]>()
  private systemPrompt: string

  constructor(systemPrompt: string) {
    this.systemPrompt = systemPrompt
  }

  createConversation(): string {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.conversations.set(id, [])
    return id
  }

  addMessage(conversationId: string, message: AIMessage): void {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, [])
    }
    this.conversations.get(conversationId)!.push(message)
  }

  getMessages(conversationId: string): AIMessage[] {
    return [
      { role: 'system', content: this.systemPrompt },
      ...(this.conversations.get(conversationId) || [])
    ]
  }

  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId)
  }
}

/**
 * AI引擎 - 简化版本
 */
class AIEngine {
  private baseUrl: string
  private model: string
  private timeoutMs: number

  constructor(baseUrl: string, model: string, timeoutMs: number) {
    this.baseUrl = baseUrl
    this.model = model
    this.timeoutMs = timeoutMs
  }

  async *generateStream(messages: AIMessage[]): AsyncGenerator<string> {
    try {
      console.log('🤖 调用AI模型:', this.model)
      
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      })

      if (!response.ok) {
        throw new Error(`AI服务错误: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            
            try {
              const data = JSON.parse(line)
              if (data.message?.content) {
                yield data.message.content
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      console.error('❌ AI引擎错误:', error)
      throw error
    }
  }
}

/**
 * 计划解析器
 */
class PlanParser {
  static extractPlan(text: string): ExecutionPlan | null {
    try {
      // 查找 <plan> 标签
      const planMatch = text.match(/<plan>([\s\S]*?)<\/plan>/i)
      if (!planMatch) return null

      const planContent = planMatch[1].trim()
      const planData = JSON.parse(planContent)

      if (!planData.toolCalls || !Array.isArray(planData.toolCalls)) {
        return null
      }

      // 转换为执行步骤
      const steps: ExecutionStep[] = planData.toolCalls.map((tool: any, index: number) => ({
        id: `step_${index + 1}`,
        type: tool.name === 'create_marker_v2' ? 'create_markers' : 
              tool.name === 'create_travel_chain' ? 'create_chain' : 'message',
        name: tool.name,
        description: this.getStepDescription(tool),
        args: tool.args,
        status: 'pending' as const
      }))

      return {
        id: `plan_${Date.now()}`,
        title: planData.title || '旅游计划',
        description: planData.description || '用户定制的旅游计划',
        steps,
        createdAt: new Date()
      }
    } catch (error) {
      console.error('计划解析失败:', error)
      return null
    }
  }

  private static getStepDescription(tool: any): string {
    switch (tool.name) {
      case 'create_marker_v2':
        const placeCount = tool.args?.places?.length || 0
        return `创建 ${placeCount} 个地点标记`
      case 'create_travel_chain':
        return `创建行程链: ${tool.args?.chainName || '未命名'}`
      default:
        return tool.name
    }
  }

  static filterThinking(text: string): string {
    // 移除 <think> 标签内容
    return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  }
}

/**
 * AI服务主类 - V4版本
 */
export class AIService {
  private aiEngine: AIEngine
  private conversationManager: ConversationManager
  private systemPrompt: string

  constructor() {
    const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
    const model = process.env.OLLAMA_MODEL || 'deepseek-r1:8b'
    const timeoutSec = Number(process.env.AI_REQUEST_TIMEOUT_SEC || '180')
    const timeoutMs = Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec * 1000 : 180000
    
    this.systemPrompt = this.buildSystemPrompt()
    this.aiEngine = new AIEngine(baseUrl, model, timeoutMs)
    this.conversationManager = new ConversationManager(this.systemPrompt)
  }

  private buildSystemPrompt(): string {
    return `你是旅游规划助手，精通日本相关旅游信息，专门负责分析用户需求并生成地图标记创建计划。

## 核心任务
1. 深度分析用户的旅游需求
2. 基于你的知识推荐合适的地点
3. 生成结构化的执行计划，供前端实时执行
4. 基于用户的需求，生成合理的标记链；如果是多日行程，需按“天（Day 1 / Day 2 / …）”输出多条行程链，每条链只包含当天的地点

## 输出格式
<think>
[深度思考用户需求，分析旅游偏好、时间安排、预算考虑等，列出推荐地点和理由]
</think>

<plan>
{
  "title": "计划标题",
  "description": "计划描述",
  "toolCalls": [
    {
      "name": "create_marker_v2",
      "args": {
        "places": [
          {"name": "地点A", "iconType": "landmark", "content": "亮点/时间/备注"},
          {"name": "地点B", "iconType": "food", "content": "亮点/时间/备注"}
        ]
      }
    },
    {
      "name": "create_travel_chain",
      "args": {
        "chainName": "Day 1",
        "description": "第1天路线描述，含交通/时长/用餐等"
      }
    },
    {
      "name": "create_marker_v2",
      "args": {
        "places": [
          {"name": "地点C", "iconType": "culture", "content": "亮点/时间/备注"},
          {"name": "地点D", "iconType": "shopping", "content": "亮点/时间/备注"}
        ]
      }
    },
    {
      "name": "create_travel_chain",
      "args": {
        "chainName": "Day 2",
        "description": "第2天路线描述，含交通/时长/用餐等"
      }
    }
  ]
}
</plan>

## 图标类型
- landmark: 地标建筑
- culture: 博物馆、文化遗迹
- natural: 自然景观
- food: 餐厅、美食
- shopping: 购物场所
- activity: 娱乐活动
- hotel: 住宿
- park: 公园

重要：只生成计划，不执行具体操作。`
  }

  /**
   * 创建新对话
   */
  createConversation(): string {
    return this.conversationManager.createConversation()
  }

  /**
   * 流式处理消息
   */
  async *processMessageStream(
    message: string,
    conversationId: string
  ): AsyncGenerator<AIResponse> {
    try {
      console.log('🤖 处理消息:', message)

      // 获取对话消息
      const messages = this.conversationManager.getMessages(conversationId)
      messages.push({ role: 'user', content: message })

      let fullResponse = ''
      let buffer = ''
      let isInThinkTag = false
      let isInPlanTag = false
      let planContent = ''

      // 流式生成（带缓冲与完整标签解析）
      // 在关闭某个标签（</think> 或 </plan>）后，等缓冲累计到一定长度再继续解析，避免把未完整的下一个标签前缀当作文本清空
      const MIN_BUFFER_AFTER_CLOSE = 15
      let recentlyClosedTag = false
      for await (const chunk of this.aiEngine.generateStream(messages)) {
        fullResponse += chunk
        buffer += chunk

        parseLoop: while (true) {
          // 思考段内，直到遇到 </think>
          if (isInThinkTag) {
            const endIdx = buffer.indexOf('</think>')
            if (endIdx === -1) {
              if (buffer) {
                yield { type: 'thinking', content: buffer, conversationId }
                buffer = ''
              }
              break parseLoop
            } else {
              const beforeEnd = buffer.slice(0, endIdx)
              if (beforeEnd) {
                yield { type: 'thinking', content: beforeEnd, conversationId }
              }
              buffer = buffer.slice(endIdx + '</think>'.length)
              isInThinkTag = false
              yield { type: 'thinking_end', content: '', conversationId }
              // 标记刚刚关闭过标签，等后续缓冲更充足再解析
              recentlyClosedTag = true
              continue
            }
          }

          // 计划段内，直到遇到 </plan>
          if (isInPlanTag) {
            const endIdx = buffer.indexOf('</plan>')
            if (endIdx === -1) {
              if (buffer) {
                // 增量产出 plan 草案片段
                planContent += buffer
                yield { type: 'plan_chunk', content: buffer, conversationId }
                buffer = ''
              }
              break parseLoop
            } else {
              planContent += buffer.slice(0, endIdx)
              buffer = buffer.slice(endIdx + '</plan>'.length)
              isInPlanTag = false

              const plan = PlanParser.extractPlan(`<plan>${planContent}</plan>`)
              if (plan) {
                yield { type: 'plan', content: '已生成执行计划', plan, conversationId }
              }
              planContent = ''
              // 标记刚刚关闭过标签，等后续缓冲更充足再解析
              recentlyClosedTag = true
              continue
            }
          }

          // 如果刚关闭过标签，而当前缓冲长度不足阈值，则等待更多数据，避免把例如 "<plan" 冲掉
          if (!isInThinkTag && !isInPlanTag && recentlyClosedTag) {
            if (buffer.length < MIN_BUFFER_AFTER_CLOSE) {
              break parseLoop
            } else {
              recentlyClosedTag = false
            }
          }

          // 查找下一个标签的开头
          const thinkStart = buffer.indexOf('<think>')
          const planStart = buffer.indexOf('<plan>')
          const candidates = [thinkStart, planStart].filter(i => i !== -1)

          if (candidates.length === 0) {
            // 保护：如果缓冲以未闭合的标签前缀开头（例如 "<plan" 但没有 ">"），不要当作文本输出
            const trimmed = buffer.trimStart()
            const startsWithPlanPrefix = trimmed.startsWith('<plan')
            const startsWithThinkPrefix = trimmed.startsWith('<think')
            if ((startsWithPlanPrefix || startsWithThinkPrefix) && trimmed.indexOf('>') === -1) {
              break parseLoop
            }
            if (buffer) {
              // 无标签时，作为普通文本输出并清空
              yield { type: 'text', content: buffer, conversationId }
              buffer = ''
            }
            break parseLoop
          }

          console.log('buffer', buffer)
          const nextIdx = Math.min(...candidates)
          if (nextIdx > 0) {
            const plain = buffer.slice(0, nextIdx)
            if (plain) {
              yield { type: 'text', content: plain, conversationId }
            }
            buffer = buffer.slice(nextIdx)
          }

          // 现在 buffer 必然以某个标签起始
          if (buffer.startsWith('<think>')) {
            buffer = buffer.slice('<think>'.length)
            isInThinkTag = true
            continue
          }
          if (buffer.startsWith('<plan>')) {
            buffer = buffer.slice('<plan>'.length)
            isInPlanTag = true
            planContent = ''
            continue
          }

          // 标签文本不完整，等待下一轮数据
          break parseLoop
        }
      }

      // 流结束时的收尾处理
      if (isInThinkTag) {
        if (buffer) {
          yield { type: 'thinking', content: buffer, conversationId }
        }
        yield { type: 'thinking_end', content: '', conversationId }
        buffer = ''
        isInThinkTag = false
      }
      if (isInPlanTag) {
        // 兜底：若计划未正常闭合，输出剩余草案，并尝试解析
        if (planContent || buffer) {
          if (buffer) {
            planContent += buffer
            yield { type: 'plan_chunk', content: buffer, conversationId }
            buffer = ''
          }
          const plan = PlanParser.extractPlan(`<plan>${planContent}</plan>`)
          if (plan) {
            yield { type: 'plan', content: '已生成执行计划', plan, conversationId }
          }
        }
        isInPlanTag = false
        planContent = ''
      }
      if (!isInPlanTag && buffer) {
        // 非标签上下文中的残留文本
        yield { type: 'text', content: buffer, conversationId }
        buffer = ''
      }

      // 保存对话历史
      this.conversationManager.addMessage(conversationId, { role: 'user', content: message })
      this.conversationManager.addMessage(conversationId, { role: 'assistant', content: fullResponse })

      // 发送完成信号
      yield {
        type: 'done',
        content: '',
        conversationId
      }

    } catch (error) {
      console.error('❌ 处理失败:', error)
      yield {
        type: 'error',
        content: `处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
        conversationId
      }
    }
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
      model: process.env.OLLAMA_MODEL || 'deepseek-r1:8b',
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434'
    }
  }
}