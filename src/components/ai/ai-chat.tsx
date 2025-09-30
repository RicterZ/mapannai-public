'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/utils/cn'

interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  thinking?: string
  timestamp: Date
  isStreaming?: boolean
}

interface AiChatProps {
  onClose?: () => void
}

export const AiChat = ({ onClose }: AiChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: '你好！我是你的地图助手，可以帮助你创建标记、规划行程等。有什么我可以帮助你的吗？',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 发送消息
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      console.log('发送消息到AI API:', userMessage.content);
      // 调用AI流式API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content })
      })

      console.log('AI API响应状态:', response.status);
      console.log('AI API响应头:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API错误:', response.status, errorText);
        throw new Error(`AI服务暂时不可用: ${response.status} - ${errorText}`)
      }

      console.log('AI API响应体:', response.body);

      // 创建AI消息占位符
      const aiMessageId = (Date.now() + 1).toString()
      const aiMessage: Message = {
        id: aiMessageId,
        type: 'ai',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      }

      setMessages(prev => [...prev, aiMessage])

      // 处理流式响应
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentContent = ''
      let thinkingContent = ''
      let isInThinking = false
      let fullResponse = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line)
                if (data.response) {
                  const content = data.response
                  fullResponse += content
                  
                  // 检查是否在思考阶段
                  if (content.includes('<think>')) {
                    isInThinking = true
                    thinkingContent += content
                  } else if (content.includes('</think>')) {
                    // 思考结束
                    thinkingContent += content
                    isInThinking = false
                  } else if (isInThinking) {
                    // 仍在思考中
                    thinkingContent += content
                  } else {
                    // 正常输出内容
                    currentContent += content
                  }
                  
                  // 更新AI消息，包含思考内容和正式输出
                  setMessages(prev => prev.map(msg => 
                    msg.id === aiMessageId 
                      ? { 
                          ...msg, 
                          content: currentContent,
                          thinking: thinkingContent
                        }
                      : msg
                  ))
                }
              } catch (e) {
                // 忽略JSON解析错误
              }
            }
          }
        }
      }

      // 流式响应完成后，检查是否有工具调用
      if (fullResponse.includes('<execute>')) {
        await handleToolCalls(fullResponse, aiMessageId)
      }

      // 完成流式输出
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, isStreaming: false }
          : msg
      ))

    } catch (error) {
      console.error('AI聊天错误:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '抱歉，服务暂时不可用，请稍后再试。',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // 处理输入框变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    
    // 自动调整高度
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }

  // 处理工具调用
  const handleToolCalls = async (fullResponse: string, aiMessageId: string) => {
    try {
      // 提取execute块
      const executeRegex = /<execute>([\s\S]*?)<\/execute>/g
      const executeBlocks: string[] = []
      let match
      
      while ((match = executeRegex.exec(fullResponse)) !== null) {
        executeBlocks.push(match[1].trim())
      }
      
      for (const block of executeBlocks) {
        const toolCalls = parseToolCalls(block)
        
        for (const toolCall of toolCalls) {
          
          try {
            const result = await executeToolCall(toolCall)
            
            // 添加工具执行结果到消息
            const resultMessage = `\n\n[工具执行结果]\n${JSON.stringify(result, null, 2)}\n\n`
            setMessages(prev => prev.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, content: msg.content + resultMessage }
                : msg
            ))
          } catch (error) {
            console.error('工具调用失败:', error)
            const errorMessage = `\n\n[工具调用失败]\n${error instanceof Error ? error.message : '未知错误'}\n\n`
            setMessages(prev => prev.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, content: msg.content + errorMessage }
                : msg
            ))
          }
        }
      }
    } catch (error) {
      console.error('处理工具调用时出错:', error)
    }
  }

  // 解析工具调用
  const parseToolCalls = (executeBlock: string): Array<{tool: string, arguments: any}> => {
    try {
      const toolCalls: Array<{tool: string, arguments: any}> = []
      
      // 尝试解析JSON格式的工具调用
      const jsonMatch = executeBlock.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const toolCall = JSON.parse(jsonMatch[0])
        if (toolCall.tool && toolCall.arguments) {
          toolCalls.push(toolCall)
        }
      }

      return toolCalls
    } catch (error) {
      console.error('解析工具调用失败:', error)
      return []
    }
  }

  // 执行工具调用
  const executeToolCall = async (toolCall: {tool: string, arguments: any}): Promise<any> => {
    const { tool, arguments: args } = toolCall
    
    switch (tool) {
      case 'create_marker_v2':
        // 支持两种格式：places 和 markers
        const batchData = args.places || args.markers
        if (batchData && Array.isArray(batchData)) {
          const results = []
          for (const item of batchData) {
            try {
              // 处理不同的参数格式
              const placeData = {
                name: item.name || item.title,
                iconType: item.iconType,
                content: item.content || item.description || ''
              }
              const result = await fetch('/api/markers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  coordinates: { latitude: 0, longitude: 0 }, // 临时坐标，会被搜索替换
                  title: placeData.name,
                  iconType: placeData.iconType,
                  content: placeData.content
                })
              })
              const marker = await result.json()
              results.push(marker)
            } catch (error) {
              const itemName = item.name || item.title || '未知地点'
              console.error(`创建标记失败 ${itemName}:`, error)
              results.push({ error: error instanceof Error ? error.message : '创建失败', place: itemName })
            }
          }
          return { type: 'batch', results }
        } else {
          // 单个地点创建
          const response = await fetch('/api/markers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              coordinates: { latitude: 0, longitude: 0 },
              title: args.name,
              iconType: args.iconType,
              content: args.content || ''
            })
          })
          return await response.json()
        }

      case 'update_marker_content':
        const updateResponse = await fetch(`/api/markers/${args.markerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: args.title,
            markdownContent: args.markdownContent
          })
        })
        return await updateResponse.json()

      case 'create_travel_chain':
        const chainResponse = await fetch('/api/chains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            markerIds: args.markerIds,
            name: args.chainName,
            description: args.description
          })
        })
        return await chainResponse.json()

      default:
        throw new Error(`未知工具: ${tool}`)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI助手</h2>
            <p className="text-sm text-gray-500">地图规划专家</p>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="关闭AI助手"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex',
              message.type === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-xs lg:max-w-md px-4 py-2 rounded-lg',
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              {/* 思考内容 */}
              {message.thinking && (
                <div className="mb-3 p-3 bg-gray-50 border-l-4 border-gray-300 rounded-r-lg">
                  <div className="text-xs text-gray-500 mb-2 font-medium flex items-center">
                    <span className="mr-1">💭</span>
                    AI思考过程
                  </div>
                  <div className="text-sm text-gray-600 font-mono whitespace-pre-wrap">
                    {message.thinking.replace(/<think>|<\/think>/g, '').trim()}
                  </div>
                </div>
              )}
              
              {/* 正式输出内容 */}
              {message.content && (
                <div className="whitespace-pre-wrap text-black">
                  {message.content}
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1"></span>
                  )}
                </div>
              )}
              
              <div className={cn(
                'text-xs mt-1',
                message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
              )}>
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm">AI正在思考...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="输入你的问题..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              inputValue.trim() && !isLoading
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            )}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
