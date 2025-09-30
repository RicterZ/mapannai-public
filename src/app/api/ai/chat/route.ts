import { NextRequest, NextResponse } from 'next/server'
import { AiService } from '@/lib/ai/ai-service'

const aiService = new AiService()

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      )
    }

    // 使用本地AI服务，返回流式响应
    const stream = await aiService.processMessage(message)
    
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
