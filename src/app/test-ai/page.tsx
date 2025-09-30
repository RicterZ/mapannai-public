'use client'

import { AIChat } from '@/components/ai/ai-chat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ExecutionPlan {
  id: string
  title: string
  description: string
  steps: ExecutionStep[]
  createdAt: Date
}

interface ExecutionStep {
  id: string
  type: 'create_markers' | 'create_chain' | 'message'
  name: string
  description: string
  args: any
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export default function TestAIPage() {
  const handleExecutePlan = async (plan: ExecutionPlan) => {
    console.log('🚀 执行计划:', plan)
    
    // 模拟执行过程
    for (const step of plan.steps) {
      console.log(`执行步骤: ${step.description}`)
      
      // 模拟异步操作
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      if (step.type === 'create_markers') {
        console.log('创建地图标记:', step.args)
        // 这里会调用实际的地图标记创建逻辑
      } else if (step.type === 'create_chain') {
        console.log('创建行程链:', step.args)
        // 这里会调用实际的行程链创建逻辑
      }
    }
    
    console.log('✅ 计划执行完成')
  }

  return (
    <div className="container mx-auto p-4 h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* AI聊天面板 */}
        <div className="lg:col-span-2">
          <AIChat 
            onExecutePlan={handleExecutePlan}
            className="h-full"
          />
        </div>
        
        {/* 信息面板 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI架构</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">主要改进</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• 简化的架构设计</li>
                  <li>• 更好的错误处理</li>
                  <li>• 优化的流式处理</li>
                  <li>• 清晰的计划解析</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">支持功能</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">流式响应</Badge>
                  <Badge variant="secondary">计划生成</Badge>
                  <Badge variant="secondary">错误恢复</Badge>
                  <Badge variant="secondary">对话管理</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>测试建议</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>简单测试:</strong></p>
                <p className="text-muted-foreground">"你好"</p>
                
                <p><strong>计划生成:</strong></p>
                <p className="text-muted-foreground">"帮我规划东京一日游"</p>
                
                <p><strong>复杂需求:</strong></p>
                <p className="text-muted-foreground">"我想去大阪三天，喜欢美食和购物"</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}