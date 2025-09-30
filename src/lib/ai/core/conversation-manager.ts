/**
 * 对话管理器
 * 负责管理对话历史和上下文
 */

import { AIMessage } from './ai-engine'
import { ToolCall, ToolResult } from './tool-executor'

export interface ConversationState {
  id: string
  messages: AIMessage[]
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
  createdAt: Date
  updatedAt: Date
}

export class ConversationManager {
  private conversations = new Map<string, ConversationState>()
  private systemPrompt: string

  constructor(systemPrompt: string) {
    this.systemPrompt = systemPrompt
  }

  /**
   * 创建新对话
   */
  createConversation(): string {
    const id = this.generateId()
    const conversation: ConversationState = {
      id,
      messages: [
        {
          role: 'system',
          content: this.systemPrompt
        }
      ],
      toolCalls: [],
      toolResults: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.conversations.set(id, conversation)
    return id
  }

  /**
   * 获取对话
   */
  getConversation(id: string): ConversationState | null {
    return this.conversations.get(id) || null
  }

  /**
   * 获取对话历史
   */
  getHistory(conversationId: string): AIMessage[] {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) return []
    
    // 返回除了系统消息之外的历史消息
    return conversation.messages.filter(msg => msg.role !== 'system')
  }

  /**
   * 添加消息
   */
  addMessage(conversationId: string, message: AIMessage): void {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) return

    conversation.messages.push(message)
    conversation.updatedAt = new Date()
  }

  /**
   * 添加用户消息
   */
  addUserMessage(conversationId: string, content: string): void {
    this.addMessage(conversationId, { role: 'user', content })
  }

  /**
   * 添加AI消息
   */
  addAssistantMessage(conversationId: string, content: string): void {
    this.addMessage(conversationId, { role: 'assistant', content })
  }

  /**
   * 添加工具调用记录
   */
  addToolCall(conversationId: string, toolCall: ToolCall): void {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) return

    conversation.toolCalls.push(toolCall)
    conversation.updatedAt = new Date()
  }

  /**
   * 添加工具结果
   */
  addToolResult(conversationId: string, result: ToolResult): void {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) return

    conversation.toolResults.push(result)
    
    // 将工具结果作为系统消息添加到对话中
    const resultMessage = result.success 
      ? `工具 ${result.id} 执行成功: ${JSON.stringify(result.result)}`
      : `工具 ${result.id} 执行失败: ${result.error}`

    conversation.messages.push({
      role: 'user',
      content: `[工具执行结果] ${resultMessage}`
    })
    
    conversation.updatedAt = new Date()
  }

  /**
   * 获取对话消息用于AI生成
   */
  getMessagesForGeneration(conversationId: string): AIMessage[] {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) return []

    return [...conversation.messages]
  }

  /**
   * 清除对话
   */
  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId)
  }

  /**
   * 清理过期对话（超过24小时）
   */
  cleanupExpiredConversations(): void {
    const now = new Date()
    const expireTime = 24 * 60 * 60 * 1000 // 24小时

    this.conversations.forEach((conversation, id) => {
      if (now.getTime() - conversation.updatedAt.getTime() > expireTime) {
        this.conversations.delete(id)
      }
    })
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalConversations: this.conversations.size,
      conversations: Array.from(this.conversations.values()).map(conv => ({
        id: conv.id,
        messageCount: conv.messages.length,
        toolCallCount: conv.toolCalls.length,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      }))
    }
  }

  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }
}