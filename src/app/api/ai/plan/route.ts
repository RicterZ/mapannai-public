import { NextRequest, NextResponse } from 'next/server'
import { AIServiceV3 } from '@/lib/ai/ai-service-v3'

const aiService = new AIServiceV3()

export async function POST(request: NextRequest) {
  try {
    const { message, conversationId } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      )
    }

    // 处理消息并生成计划
    const response = await aiService.processMessage(message, conversationId)

    return NextResponse.json(response)
  } catch (error) {
    console.error('AI计划生成失败:', error)
    return NextResponse.json(
      { error: '计划生成失败' },
      { status: 500 }
    )
  }
}

// 流式响应版本
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const message = searchParams.get('message')
  const conversationId = searchParams.get('conversationId')

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
        for await (const chunk of aiService.processMessageStream(message, conversationId || '')) {
          const data = `data: ${JSON.stringify(chunk)}\n\n`
          controller.enqueue(encoder.encode(data))
        }
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        console.error('流式处理失败:', error)
        const errorData = `data: ${JSON.stringify({
          type: 'error',
          content: '处理失败',
          conversationId: conversationId || ''
        })}\n\n`
        controller.enqueue(encoder.encode(errorData))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}