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
      console.log('🔗 调用Ollama API:', `${this.config.baseUrl}/api/chat`)
      console.log('🤖 使用模型:', this.config.model)
      console.log('📝 发送消息数量:', messages.length)
      console.log('📄 消息预览:', messages.map(m => `${m.role}: ${m.content.substring(0, 100)}...`))
      
      const requestBody = {
        model: this.config.model,
        messages,
        stream: true
      }
      
      console.log('📦 请求体:', JSON.stringify(requestBody, null, 2))
      
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout!)
      })

      console.log('📡 Ollama响应状态:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Ollama API错误:', response.status, errorText)
        throw new Error(`AI服务错误: ${response.status} - ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        console.error('❌ 无法获取响应流reader')
        throw new Error('无法获取响应流')
      }

      console.log('✅ 开始读取Ollama流式响应...')
      const decoder = new TextDecoder()
      let buffer = ''
      let chunkCount = 0

      try {
        while (true) {
          const { done, value } = await reader.read()
          chunkCount++
          
          console.log(`📦 Ollama chunk ${chunkCount}, done: ${done}, 长度: ${value?.length || 0}`)
          
          if (done) {
            console.log('✅ Ollama流式响应完成')
            break
          }

          buffer += decoder.decode(value, { stream: true })
          console.log('📝 当前buffer:', buffer)
          
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          console.log(`📄 分割成 ${lines.length} 行，剩余buffer: ${buffer}`)

          for (const line of lines) {
            if (!line.trim()) continue

            try {
              const data = JSON.parse(line)
              console.log('✅ Ollama解析成功:', data)
              
              if (data.message?.content) {
                console.log('💬 Ollama响应内容:', JSON.stringify(data.message.content))
                yield {
                  type: 'text',
                  content: data.message.content
                }
              }
              
              if (data.done) {
                console.log('🏁 Ollama标记完成')
              }
            } catch (parseError) {
              console.warn('⚠️ Ollama解析行失败:', parseError, '原始行:', line)
              // 忽略JSON解析错误
            }
          }
        }

        console.log('🏁 发送完成信号')
        yield { type: 'done', content: '' }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      console.error('❌ AI引擎错误:', error)
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