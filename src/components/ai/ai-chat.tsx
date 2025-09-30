'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Send, 
  Bot, 
  User, 
  AlertCircle, 
  CheckCircle,
  Clock,
  MapPin,
  Route
} from 'lucide-react'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'plan'
  content: string
  timestamp: Date
  plan?: ExecutionPlan
}

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

interface PlanExecutionCallbacks {
  onStepStart?: (stepId: string) => void
  onStepComplete?: (stepId: string, success: boolean) => void
}

interface AIChatProps {
  onExecutePlan?: (plan: ExecutionPlan, callbacks: PlanExecutionCallbacks) => Promise<void>
  className?: string
  showTimestamp?: boolean
}

export function AIChat({ onExecutePlan, className, showTimestamp = true }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId] = useState(() => `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [executingPlan, setExecutingPlan] = useState<string | null>(null)
  const [thinkingText, setThinkingText] = useState('')
  const [planDraftText, setPlanDraftText] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    console.log('[AIChat] mounted', { hasOnExecutePlan: !!onExecutePlan, conversationId })
  }, [])

  const inputRef = useRef<HTMLInputElement>(null)

  // 自动滚动到底部
  const scrollToBottom = () => {
    if (scrollRef.current) {
      // 直接将滚动容器滚动到底部，避免 smooth 在高频更新时被打断
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }

  useEffect(() => {
    // 在消息/思考/计划草案变化时，保持滚动到底部
    scrollToBottom()
  }, [messages, thinkingText, planDraftText])

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      console.log('🚀 发送消息到AI服务...')
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let currentAssistantMessage: Message | null = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            
            const data = line.slice(6).trim()
            if (!data) continue

            try {
              const chunk = JSON.parse(data)

              switch (chunk.type) {
                case 'thinking':
                  setThinkingText(prev => prev + chunk.content)
                  break
                case 'thinking_end':
                  setThinkingText('')
                  break
                case 'plan_chunk':
                  setPlanDraftText(prev => prev + chunk.content)
                  break
                case 'text':
                  if (!currentAssistantMessage) {
                    currentAssistantMessage = {
                      id: `msg_${Date.now()}_assistant`,
                      type: 'assistant',
                      content: chunk.content,
                      timestamp: new Date()
                    }
                    setMessages(prev => [...prev, currentAssistantMessage!])
                  } else {
                    currentAssistantMessage.content += chunk.content
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === currentAssistantMessage!.id 
                          ? { ...msg, content: currentAssistantMessage!.content }
                          : msg
                      )
                    )
                  }
                  break

                case 'plan':
                  // 收到最终计划，清空草案显示
                  setPlanDraftText('')
                  console.log('[AIChat] plan_received', {
                    planId: chunk?.plan?.id,
                    stepCount: chunk?.plan?.steps?.length,
                    hasOnExecutePlan: !!onExecutePlan
                  })
                  const planMessage: Message = {
                    id: `msg_${Date.now()}_plan`,
                    type: 'plan',
                    content: chunk.content,
                    timestamp: new Date(),
                    plan: chunk.plan
                  }
                  setMessages(prev => [...prev, planMessage])
                  break

                case 'error':
                  const errorMessage: Message = {
                    id: `msg_${Date.now()}_error`,
                    type: 'system',
                    content: `❌ ${chunk.content}`,
                    timestamp: new Date()
                  }
                  setMessages(prev => [...prev, errorMessage])
                  break

                case 'done':
                  console.log('✅ 流式响应完成')
                  break
              }
            } catch (parseError) {
              console.warn('解析chunk失败:', parseError, '原始数据:', data)
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

    } catch (error) {
      console.error('❌ 发送消息失败:', error)
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        type: 'system',
        content: `❌ 发送失败: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // 执行计划
  const handleExecutePlan = async (plan: ExecutionPlan) => {
    if (!onExecutePlan || executingPlan) return

    setExecutingPlan(plan.id)
    try {
      console.log('[AIChat] execute_plan_start', { planId: plan.id, steps: plan.steps.map(s => ({ id: s.id, type: s.type })) })
      await onExecutePlan(plan, {
        onStepStart: (stepId: string) => {
          setMessages(prev => prev.map(msg => {
            if (msg.plan?.id !== plan.id) return msg
            return {
              ...msg,
              plan: {
                ...msg.plan,
                steps: msg.plan.steps.map(step => step.id === stepId ? { ...step, status: 'running' as const } : step)
              }
            }
          }))
        },
        onStepComplete: (stepId: string, success: boolean) => {
          setMessages(prev => prev.map(msg => {
            if (msg.plan?.id !== plan.id) return msg
            return {
              ...msg,
              plan: {
                ...msg.plan,
                steps: msg.plan.steps.map(step => step.id === stepId ? { ...step, status: (success ? 'completed' : 'failed') as ExecutionStep['status'] } : step)
              }
            }
          }))
        }
      })
      console.log('[AIChat] execute_plan_success', { planId: plan.id })
      
      // 更新计划状态为已完成
      setMessages(prev => 
        prev.map(msg => 
          msg.plan?.id === plan.id 
            ? { 
                ...msg, 
                plan: { 
                  ...msg.plan, 
                  steps: msg.plan.steps.map(step => ({ ...step, status: 'completed' as const }))
                }
              }
            : msg
        )
      )
    } catch (error) {
      console.error('执行计划失败:', error)
      console.log('[AIChat] execute_plan_error', { planId: plan.id, error: error instanceof Error ? error.message : String(error) })
      // 更新计划状态为失败
      setMessages(prev => 
        prev.map(msg => 
          msg.plan?.id === plan.id 
            ? { 
                ...msg, 
                plan: { 
                  ...msg.plan, 
                  steps: msg.plan.steps.map(step => ({ ...step, status: 'failed' as const }))
                }
              }
            : msg
        )
      )
    } finally {
      setExecutingPlan(null)
    }
  }



  // 获取步骤图标
  const getStepIcon = (step: ExecutionStep) => {
    switch (step.type) {
      case 'create_markers':
        return <MapPin className="h-4 w-4" />
      case 'create_chain':
        return <Route className="h-4 w-4" />
      default:
        return <Bot className="h-4 w-4" />
    }
  }

  // 获取状态图标
  const getStatusIcon = (status: ExecutionStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <Card className={`flex flex-col h-full ${className}`}>
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <ScrollArea ref={scrollRef} className="flex-1 min-h-0 p-4 custom-scrollbar">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>你好！我可以帮你规划旅游行程。</p>
                <p className="text-sm mt-2">试试问我："帮我规划东京三日游"</p>
              </div>
            )}

            {messages.map((message) => {
              if (message.type === 'assistant' && (!message.content || message.content.trim().length === 0)) {
                return null
              }
              return (
              <div key={message.id} className="space-y-2">
                <div className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.type !== 'user' && (
                    <div className="flex-shrink-0">
                      {message.type === 'system' ? (
                        <AlertCircle className="h-6 w-6 text-orange-500" />
                      ) : (
                        <Bot className="h-6 w-6 text-blue-500" />
                      )}
                    </div>
                  )}
                  
                    <div className={`max-w-[80%] ${message.type === 'user' ? 'order-first' : ''}`}>
                    <div className={`rounded-lg px-3 py-2 ${
                      message.type === 'user' 
                        ? 'bg-primary text-primary-foreground ml-auto' 
                        : message.type === 'system'
                        ? 'bg-orange-50 text-orange-800 border border-orange-200'
                        : 'bg-muted'
                    }`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    
                    {showTimestamp && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    )}
                  </div>

                  {message.type === 'user' && (
                    <div className="flex-shrink-0">
                      <User className="h-6 w-6 text-green-500" />
                    </div>
                  )}
                </div>

                {/* 执行计划卡片 */}
                {message.plan && (
                  <Card className="ml-9 border-blue-200 bg-blue-50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                            {message.plan.description}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleExecutePlan(message.plan!)}
                          disabled={executingPlan === message.plan.id}
                          size="sm"
                        >
                          {executingPlan === message.plan.id ? '执行中...' : '执行计划'}
                        </Button>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {message.plan.steps.map((step, index) => (
                          <div key={step.id} className="flex items-center gap-3 p-2 rounded bg-white">
                            <Badge variant="outline" className="flex items-center gap-1">
                              {getStepIcon(step)}
                              {index + 1}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-medium text-sm whitespace-pre-wrap">{step.description}</p>
                            </div>
                            {getStatusIcon(step.status)}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              )
            })}

            {(isLoading || planDraftText) && (
              <div className="flex gap-3">
                <Bot className="h-6 w-6 text-blue-500 animate-pulse" />
                <div className="bg-muted rounded-lg px-3 py-2">
                {thinkingText || planDraftText ? (
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground max-w-[60ch]">
                    {thinkingText}
                    {planDraftText}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                )}
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        <Separator />
        
        <div className="p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入你的旅游需求..."
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={isLoading || !inputValue.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}