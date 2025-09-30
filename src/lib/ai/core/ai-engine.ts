/**
 * AI引擎核心类
 * 负责与AI模型的交互和响应处理
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIStreamChunk {
  type: 'text' | 'thinking' | 'tool_call' | 'error' | 'done'
  content: string
  metadata?: any
}

export interface AIEngineConfig {
  baseUrl: string
  model: string
  timeout?: number
}

export class AIEngine {
  private config: AIEngineConfig

  constructor(config: AIEngineConfig) {
    this.config = {
      timeout: 60000,
      ...config
    }
  }

  /**
   * 流式生成AI响应
   */
  async *generateStream(messages: AIMessage[]): AsyncGenerator<AIStreamChunk> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: true
        }),
        signal: AbortSignal.timeout(this.config.timeout!)
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
                yield {
                  type: 'text',
                  content: data.message.content
                }
              }
            } catch {
              // 忽略JSON解析错误
            }
          }
        }

        yield { type: 'done', content: '' }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 非流式生成AI响应
   */
  async generate(messages: AIMessage[]): Promise<string> {
    const chunks: string[] = []
    
    for await (const chunk of this.generateStream(messages)) {
      if (chunk.type === 'text') {
        chunks.push(chunk.content)
      } else if (chunk.type === 'error') {
        throw new Error(chunk.content)
      }
    }

    return chunks.join('')
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout
    }
  }
}