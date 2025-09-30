'use client'

import { useState, useRef, useEffect } from 'react'
import { ExecutionPanel } from './execution-panel'
import { ExecutionPlan, ExecutionResult } from '@/lib/ai/core/execution-planner'
import { cn } from '@/utils/cn'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'plan' | 'system'
  content: string
  timestamp: Date
  plan?: ExecutionPlan
  executionResults?: ExecutionResult[]
}

interface AiChatV3Props {
  className?: string
}

export const AiChatV3 = ({ className }: AiChatV3Props) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'system',
      content: '👋 你好！我是你的旅游规划助手。告诉我你想去哪里旅游，我会为你创建详细的地图标记和行程规划。',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId] = useState(() => `conv_${Date.now()}`)
  const [currentPlan, setCurrentPlan] = useState<ExecutionPlan | null>(null)
  const [showExecutionPanel, setShowExecutionPanel] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      console.log('🚀 发起AI请求...')
      
      let assistantMessageId = `msg_${Date.now()}_assistant`
      let assistantContent = ''
      
      // 先添加空的助手消息
      const assistantMessage: Message = {
        id: assistantMessageId,
        type: 'assistant',
        content: '',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

      // 使用EventSource进行流式处理
      const eventSource = new EventSource('/api/ai/chat?' + new URLSearchParams({
        message: userMessage.content,
        conversationId: conversationId
      }))

      console.log('📡 EventSource创建成功')

      eventSource.onopen = () => {
        console.log('✅ EventSource连接已打开')
      }

      eventSource.onmessage = (event) => {
        console.log('📦 收到SSE消息:', event.data)
        
        try {
          const parsed = JSON.parse(event.data)
          console.log('✅ 解析成功:', parsed)
          
          if (parsed.type === 'message') {
            console.log('💬 收到消息chunk:', parsed.content)
            // 累积消息内容
            assistantContent += parsed.content
            
            // 更新助手消息
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: assistantContent }
                : msg
            ))
          } else if (parsed.type === 'plan' && parsed.plan) {
            console.log('📋 收到执行计划:', parsed.plan.title)
            // 添加执行计划消息
            const planMessage: Message = {
              id: `msg_${Date.now()}_plan`,
              type: 'plan',
              content: `已生成执行计划：${parsed.plan.title}`,
              timestamp: new Date(),
              plan: parsed.plan
            }
            setMessages(prev => [...prev, planMessage])
            
            // 设置当前计划并显示执行面板
            setCurrentPlan(parsed.plan)
            setShowExecutionPanel(true)
          } else if (parsed.type === 'error') {
            console.log('❌ 收到错误:', parsed.content)
            // 处理错误
            const errorMessage: Message = {
              id: `msg_${Date.now()}_error`,
              type: 'system',
              content: `❌ ${parsed.content}`,
              timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
            eventSource.close()
            setIsLoading(false)
          } else if (parsed.type === 'done') {
            console.log('🏁 收到完成信号')
            eventSource.close()
            setIsLoading(false)
          } else {
            console.log('❓ 未知消息类型:', parsed.type)
          }
        } catch (parseError) {
          console.error('❌ 解析SSE数据失败:', parseError, '原始数据:', event.data)
        }
      }

      eventSource.onerror = (error) => {
        console.error('❌ EventSource错误:', error)
        eventSource.close()
        setIsLoading(false)
        
        const errorMessage: Message = {
          id: `msg_${Date.now()}_error`,
          type: 'system',
          content: '❌ 连接AI服务失败，请重试',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }

      // 设置超时
      setTimeout(() => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          console.log('⏰ EventSource超时，关闭连接')
          eventSource.close()
          setIsLoading(false)
        }
      }, 60000) // 60秒超时

    } catch (error) {
      console.error('AI请求失败:', error)
      
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        type: 'system',
        content: `❌ 请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleExecutionComplete = (results: ExecutionResult[]) => {
    console.log('执行完成:', results)
    
    // 添加执行结果消息
    const successCount = results.filter(r => r.success).length
    const totalCount = results.length
    
    const resultMessage: Message = {
      id: `msg_${Date.now()}_result`,
      type: 'system',
      content: `✅ 执行完成！成功创建 ${successCount}/${totalCount} 个操作。请查看地图上的新标记。`,
      timestamp: new Date(),
      executionResults: results
    }

    setMessages(prev => [...prev, resultMessage])
    setShowExecutionPanel(false)
    setCurrentPlan(null)
  }

  const handleExecutionCancel = () => {
    setShowExecutionPanel(false)
    setCurrentPlan(null)
    
    const cancelMessage: Message = {
      id: `msg_${Date.now()}_cancel`,
      type: 'system',
      content: '执行已取消。',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, cancelMessage])
  }

  const handleExecutePlan = (plan: ExecutionPlan) => {
    setCurrentPlan(plan)
    setShowExecutionPanel(true)
  }

  return (
    <div className={cn("flex flex-col h-full bg-white", className)}>
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.type === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-4 py-2",
                message.type === 'user' && "bg-blue-600 text-white",
                message.type === 'assistant' && "bg-gray-100 text-gray-900",
                message.type === 'system' && "bg-green-50 text-green-800 border border-green-200",
                message.type === 'plan' && "bg-purple-50 text-purple-800 border border-purple-200"
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* 计划执行按钮 */}
              {message.type === 'plan' && message.plan && (
                <div className="mt-3 pt-3 border-t border-purple-200">
                  <div className="text-sm text-purple-600 mb-2">
                    📋 {message.plan.steps.length} 个步骤 • 预计 {Math.round(message.plan.metadata.estimatedDuration / 1000)}秒
                  </div>
                  <button
                    onClick={() => handleExecutePlan(message.plan!)}
                    className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 transition-colors"
                  >
                    开始执行计划
                  </button>
                </div>
              )}

              {/* 执行结果展示 */}
              {message.executionResults && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <div className="text-sm space-y-1">
                    {message.executionResults.map((result, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className={result.success ? "text-green-600" : "text-red-600"}>
                          {result.success ? "✅" : "❌"}
                        </span>
                        <span className="text-xs text-gray-600">
                          步骤 {index + 1} • {result.duration}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs opacity-70 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {/* 加载指示器 */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-gray-600">AI正在思考...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 执行面板 */}
      {showExecutionPanel && currentPlan && (
        <div className="border-t border-gray-200 p-4">
          <ExecutionPanel
            plan={currentPlan}
            onComplete={handleExecutionComplete}
            onCancel={handleExecutionCancel}
          />
        </div>
      )}

      {/* 输入区域 */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="告诉我你想去哪里旅游..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            发送
          </button>
        </form>
        
        {/* 快捷建议 */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "东京3日游",
            "大阪美食之旅", 
            "京都文化体验",
            "北海道自然风光"
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setInput(suggestion)}
              className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors"
              disabled={isLoading}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}