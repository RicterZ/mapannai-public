/**
 * 工具执行器
 * 负责解析和执行AI工具调用
 */

export interface ToolCall {
  id: string
  tool: string
  arguments: Record<string, any>
}

export interface ToolResult {
  id: string
  success: boolean
  result?: any
  error?: string
}

export interface Tool {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (args: Record<string, any>) => Promise<any>
}

export class ToolExecutor {
  private tools = new Map<string, Tool>()

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * 获取所有工具定义
   */
  getToolDefinitions(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 解析文本中的工具调用
   */
  parseToolCalls(text: string): ToolCall[] {
    const toolCalls: ToolCall[] = []
    
    // 提取 <execute> 块
    const executeRegex = /<execute>([\s\S]*?)<\/execute>/g
    let match

    while ((match = executeRegex.exec(text)) !== null) {
      const executeContent = match[1].trim()
      
      // 解析JSON工具调用
      try {
        const jsonMatch = executeContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const toolCallData = JSON.parse(jsonMatch[0])
          
          if (toolCallData.tool && toolCallData.arguments) {
            toolCalls.push({
              id: this.generateId(),
              tool: toolCallData.tool,
              arguments: toolCallData.arguments
            })
          }
        }
      } catch (error) {
        console.warn('解析工具调用失败:', error)
      }
    }

    return toolCalls
  }

  /**
   * 执行工具调用
   */
  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.tool)
    
    if (!tool) {
      return {
        id: toolCall.id,
        success: false,
        error: `未知工具: ${toolCall.tool}`
      }
    }

    try {
      const result = await tool.execute(toolCall.arguments)
      return {
        id: toolCall.id,
        success: true,
        result
      }
    } catch (error) {
      return {
        id: toolCall.id,
        success: false,
        error: error instanceof Error ? error.message : '工具执行失败'
      }
    }
  }

  /**
   * 批量执行工具调用
   */
  async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    
    // 顺序执行工具调用，确保依赖关系
    for (const toolCall of toolCalls) {
      const result = await this.executeToolCall(toolCall)
      results.push(result)
    }

    return results
  }

  private generateId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}