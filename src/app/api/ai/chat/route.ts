import { NextRequest, NextResponse } from 'next/server'
import { AIServiceV2 } from '@/lib/ai/ai-service-v2'

// 创建AI服务实例
const aiService = new AIServiceV2()

export async function POST(request: NextRequest) {
  try {
    const { message, conversationId, clearHistory } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      )
    }

    // 如果需要清除历史，先清除对话
    if (clearHistory && conversationId) {
      aiService.clearConversation(conversationId)
    }

    // 创建流式响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of aiService.processMessage(message, conversationId)) {
            // 将chunk转换为SSE格式
            const data = JSON.stringify(chunk)
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
          
          // 发送结束信号
          controller.enqueue(encoder.encode('data: {"type":"done","content":""}\n\n'))
        } catch (error) {
          console.error('AI流式处理错误:', error)
          const errorChunk = JSON.stringify({
            type: 'error',
            content: error instanceof Error ? error.message : '处理消息时发生错误'
          })
          controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`))
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('AI聊天API错误:', error)
    return NextResponse.json(
      { 
        error: 'AI服务暂时不可用',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// 获取工具定义
export async function GET() {
  try {
    const tools = aiService.getToolDefinitions()
    return NextResponse.json({ tools })
  } catch (error) {
    console.error('获取工具定义错误:', error)
    return NextResponse.json(
      { error: '获取工具定义失败' },
      { status: 500 }
    )
  }
}