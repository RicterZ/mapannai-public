import { NextRequest, NextResponse } from 'next/server'
import { AiService } from '@/lib/ai/ai-service'

const aiService = new AiService()

export async function POST(request: NextRequest) {
  try {
    console.log('AI聊天API被调用')
    const { message } = await request.json()
    console.log('接收到的消息:', message)

    if (!message) {
      console.log('消息为空，返回400错误')
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      )
    }

    console.log('开始处理AI服务...')
    // 使用本地AI服务，返回流式响应
    const stream = await aiService.processMessage(message)
    console.log('AI服务返回流:', stream)
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('AI聊天API错误:', error)
    return NextResponse.json(
      { error: 'AI服务暂时不可用' },
      { status: 500 }
    )
  }
}
