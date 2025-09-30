import { NextResponse } from 'next/server'

// 简单的内存统计（生产环境建议使用Redis等外部存储）
let stats = {
  totalConversations: 0,
  activeConversations: 0,
  totalMessages: 0,
  totalToolCalls: 0,
  successfulToolCalls: 0,
  failedToolCalls: 0,
  averageResponseTime: 0,
  lastResetTime: new Date().toISOString()
}

export async function GET() {
  try {
    // 计算成功率
    const successRate = stats.totalToolCalls > 0 
      ? (stats.successfulToolCalls / stats.totalToolCalls * 100).toFixed(2)
      : '0'

    return NextResponse.json({
      ...stats,
      successRate: `${successRate}%`,
      uptime: Date.now() - new Date(stats.lastResetTime).getTime()
    })
  } catch (error) {
    console.error('获取AI统计信息错误:', error)
    return NextResponse.json(
      { error: '获取统计信息失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { action, data } = await request.json()

    switch (action) {
      case 'conversation_created':
        stats.totalConversations++
        stats.activeConversations++
        break
        
      case 'conversation_ended':
        stats.activeConversations = Math.max(0, stats.activeConversations - 1)
        break
        
      case 'message_sent':
        stats.totalMessages++
        break
        
      case 'tool_call_success':
        stats.totalToolCalls++
        stats.successfulToolCalls++
        break
        
      case 'tool_call_failed':
        stats.totalToolCalls++
        stats.failedToolCalls++
        break
        
      case 'response_time':
        // 简单的移动平均
        stats.averageResponseTime = (stats.averageResponseTime + (data?.responseTime || 0)) / 2
        break
        
      case 'reset':
        stats = {
          totalConversations: 0,
          activeConversations: 0,
          totalMessages: 0,
          totalToolCalls: 0,
          successfulToolCalls: 0,
          failedToolCalls: 0,
          averageResponseTime: 0,
          lastResetTime: new Date().toISOString()
        }
        break
        
      default:
        return NextResponse.json(
          { error: '未知操作' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, stats })
  } catch (error) {
    console.error('更新AI统计信息错误:', error)
    return NextResponse.json(
      { error: '更新统计信息失败' },
      { status: 500 }
    )
  }
}