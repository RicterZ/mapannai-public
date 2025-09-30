import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      )
    }

    // 调用AI中间件服务
    const aiMiddlewareUrl = process.env.AI_MIDDLEWARE_URL || 'http://localhost:3001'
    
    const response = await fetch(`${aiMiddlewareUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message })
    })

    if (!response.ok) {
      throw new Error(`AI中间件响应错误: ${response.status}`)
    }

    const data = await response.json()
    
    return NextResponse.json({
      response: data.response || '抱歉，我暂时无法处理您的请求。'
    })

  } catch (error) {
    console.error('AI聊天API错误:', error)
    return NextResponse.json(
      { error: 'AI服务暂时不可用' },
      { status: 500 }
    )
  }
}
