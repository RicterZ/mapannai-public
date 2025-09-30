import { NextRequest, NextResponse } from 'next/server'
import { AIServiceV3 } from '@/lib/ai/ai-service-v3'

// 创建AI服务实例
const aiService = new AIServiceV3()

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
          for await (const chunk of aiService.processMessageStream(message, conversationId)) {
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

// 流式响应版本 - 支持EventSource
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const message = searchParams.get('message')
  const conversationId = searchParams.get('conversationId')

  console.log('🔄 GET请求 - 消息:', message, '对话ID:', conversationId)

  if (!message) {
    return NextResponse.json(
      { error: '消息内容不能为空' },
      { status: 400 }
    )
  }

  // 创建流式响应
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log('🚀 开始流式处理...')
        for await (const chunk of aiService.processMessageStream(message, conversationId || '')) {
          console.log('📤 发送chunk:', chunk)
          // 将chunk转换为SSE格式
          const data = JSON.stringify(chunk)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }
        
        // 发送结束信号
        console.log('🏁 发送完成信号')
        controller.enqueue(encoder.encode('data: {"type":"done","content":""}\n\n'))
      } catch (error) {
        console.error('AI流式处理错误:', error)
        const errorChunk = JSON.stringify({
          type: 'error',
          content: error instanceof Error ? error.message : '处理消息时发生错误'
        })
        controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`))
      } finally {
        console.log('✅ 流式响应完成，关闭控制器')
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
}