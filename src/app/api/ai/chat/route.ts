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

    // 使用本地AI服务
    const response = await aiService.processMessage(message)
    
    return NextResponse.json({
      response: response || '抱歉，我暂时无法处理您的请求。'
    })

  } catch (error) {
    console.error('AI聊天API错误:', error)
    return NextResponse.json(
      { error: 'AI服务暂时不可用' },
      { status: 500 }
    )
  }
}
