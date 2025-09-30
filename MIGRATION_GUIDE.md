# AI架构迁移指南

## 概述

本次重构将原有的AI服务架构进行了全面升级，采用模块化设计，提高了可维护性、可扩展性和性能。

## 主要变更

### 1. 架构重构

#### 旧架构问题
- 代码重复：`ai-service.ts` 和 `ai-middleware.ts` 有大量重复逻辑
- 职责混乱：单个文件承担多种职责
- 工具调用复杂：前后端都在处理工具调用，容易出错
- 状态管理混乱：工具执行状态管理复杂

#### 新架构优势
- **模块化设计**：核心功能拆分为独立模块
- **单一职责**：每个模块只负责特定功能
- **类型安全**：完整的TypeScript类型定义
- **错误处理**：统一的错误处理机制
- **性能优化**：真正的流式处理和内存管理

### 2. 文件结构变更

```
旧结构:
src/lib/ai/
├── ai-service.ts          # 混合了多种职责
├── ai-middleware.ts       # 重复逻辑
├── api-client.ts          # API客户端
└── types.ts               # 类型定义

新结构:
src/lib/ai/
├── core/                  # 核心模块
│   ├── ai-engine.ts      # AI引擎
│   ├── tool-executor.ts  # 工具执行器
│   └── conversation-manager.ts # 对话管理器
├── tools/                 # 工具实现
│   └── marker-tools.ts   # 地图标记工具
├── ai-service-v2.ts      # 主服务类
└── README.md             # 文档
```

## 迁移步骤

### 步骤1: 更新导入

```typescript
// 旧版本
import { AiService } from '@/lib/ai/ai-service'
import { AiChat } from '@/components/ai/ai-chat'

// 新版本
import { AIServiceV2 } from '@/lib/ai/ai-service-v2'
import { AiChatV2 } from '@/components/ai/ai-chat-v2'
```

### 步骤2: 更新组件使用

```typescript
// 在你的页面组件中
import { AiSidebar } from '@/components/ai/ai-sidebar'

export default function MapPage() {
  const [isAiOpen, setIsAiOpen] = useState(false)

  return (
    <div>
      {/* 你的地图组件 */}
      <AiSidebar 
        isOpen={isAiOpen} 
        onToggle={() => setIsAiOpen(!isAiOpen)} 
      />
    </div>
  )
}
```

### 步骤3: 环境变量检查

确保以下环境变量正确设置：

```bash
# .env.local
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:8b
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 步骤4: 删除旧文件（可选）

在确认新架构工作正常后，可以删除以下旧文件：
- `src/lib/ai/ai-service.ts`
- `src/lib/ai/ai-middleware.ts`
- `src/components/ai/ai-chat.tsx`（如果不再使用）

## 新功能

### 1. 统计监控

新架构包含性能监控功能：

```typescript
// 获取统计信息
const response = await fetch('/api/ai/stats')
const stats = await response.json()

console.log('AI服务统计:', stats)
```

### 2. 对话管理

```typescript
const aiService = new AIServiceV2()

// 创建新对话
const conversationId = aiService.createConversation()

// 处理消息
for await (const chunk of aiService.processMessage('你好', conversationId)) {
  console.log(chunk)
}

// 清除对话
aiService.clearConversation(conversationId)
```

### 3. 自定义工具

```typescript
import { Tool } from '@/lib/ai/core/tool-executor'

const customTool: Tool = {
  name: 'custom_tool',
  description: '自定义工具',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: '输入参数' }
    },
    required: ['input']
  },
  execute: async (args) => {
    // 工具实现
    return { result: 'success' }
  }
}

// 注册工具
aiService.registerTool(customTool)
```

## 测试

### 1. 基本功能测试

```bash
# 启动开发服务器
npm run dev

# 测试AI聊天功能
# 1. 打开浏览器访问应用
# 2. 点击AI助手按钮
# 3. 发送测试消息
# 4. 验证工具调用是否正常工作
```

### 2. API测试

```bash
# 测试AI聊天API
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "帮我规划东京旅游"}'

# 测试统计API
curl http://localhost:3000/api/ai/stats
```

## 故障排除

### 常见问题

1. **Ollama连接失败**
   ```
   错误: AI服务错误: 500
   解决: 检查OLLAMA_URL环境变量，确认Ollama服务正在运行
   ```

2. **工具调用失败**
   ```
   错误: 工具 create_marker_v2 执行失败
   解决: 检查API路由是否正常，查看控制台错误日志
   ```

3. **流式响应中断**
   ```
   错误: 响应流意外中断
   解决: 检查网络连接，确认客户端正确处理SSE
   ```

### 调试模式

启用详细日志：

```bash
# 设置调试环境变量
DEBUG=ai:* npm run dev
```

### 性能监控

访问 `/api/ai/stats` 查看性能统计：

```json
{
  "totalConversations": 10,
  "activeConversations": 2,
  "totalMessages": 50,
  "totalToolCalls": 15,
  "successfulToolCalls": 14,
  "failedToolCalls": 1,
  "successRate": "93.33%",
  "averageResponseTime": 1200,
  "uptime": 3600000
}
```

## 回滚计划

如果新架构出现问题，可以快速回滚：

1. **保留旧文件**：在迁移期间不要删除旧文件
2. **Git分支**：在新分支上进行迁移
3. **环境变量**：确保环境变量兼容
4. **数据备份**：备份重要的对话数据

```bash
# 回滚到旧版本
git checkout main
npm install
npm run dev
```

## 后续计划

1. **性能优化**：基于统计数据进一步优化
2. **功能扩展**：添加更多工具和功能
3. **测试覆盖**：增加单元测试和集成测试
4. **文档完善**：补充API文档和使用示例

## 支持

如果在迁移过程中遇到问题，请：

1. 查看控制台错误日志
2. 检查环境变量配置
3. 参考本文档的故障排除部分
4. 查看 `/api/ai/stats` 的统计信息

迁移完成后，你将获得一个更稳定、更高性能、更易维护的AI服务架构。