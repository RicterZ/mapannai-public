# AI架构 V4 - 重新设计文档

## 概述

基于对现有AI部分的分析，我们重新设计了一个更简洁、可靠、易维护的AI架构。新架构专注于稳定性和用户体验。

## 问题分析

### 原有架构问题
1. **配置缺失**: 缺少环境变量配置文件
2. **架构复杂**: 多层抽象导致调试困难
3. **错误处理**: 缺乏完善的错误处理和重试机制
4. **流式处理**: 逻辑复杂，容易出错
5. **依赖问题**: 过度依赖外部库

## 新架构设计

### 核心原则
- **简洁性**: 减少不必要的抽象层
- **可靠性**: 完善的错误处理和恢复机制
- **可维护性**: 清晰的代码结构和文档
- **性能**: 优化的流式处理和响应速度

### 架构组件

#### 1. AI服务层 (`AIServiceV4`)
```typescript
// 主要职责：
- 对话管理
- 流式处理
- 计划解析
- 错误处理
```

**特点**:
- 简化的类结构
- 内置对话管理
- 优化的流式处理逻辑
- 智能的思考内容过滤

#### 2. AI引擎 (`AIEngine`)
```typescript
// 主要职责：
- 与Ollama API通信
- 流式响应处理
- 连接管理
```

**改进**:
- 简化的API调用
- 更好的错误处理
- 详细的日志记录

#### 3. 计划解析器 (`PlanParser`)
```typescript
// 主要职责：
- 解析AI生成的执行计划
- 验证计划格式
- 转换为执行步骤
```

**特点**:
- 静态方法设计
- 健壮的JSON解析
- 思考内容过滤

#### 4. 对话管理器 (`ConversationManager`)
```typescript
// 主要职责：
- 管理多个对话会话
- 消息历史存储
- 系统提示词管理
```

**改进**:
- 内存高效的存储
- 简单的API接口

### UI组件重构

#### 1. AIChatV4组件
- 现代化的聊天界面
- 实时流式显示
- 执行计划可视化
- 完善的错误提示

#### 2. AiSidebarV4组件
- 响应式侧边栏设计
- 集成聊天功能
- 计划执行集成

#### 3. 简化UI组件库
- 移除外部依赖
- 自定义实现核心组件
- 保持一致的设计风格

## 配置文件

### 环境变量 (`.env.local`)
```bash
# AI服务配置
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:8b

# 应用配置
NEXT_PUBLIC_APP_NAME=MapAnnai Interactive Map
NEXT_PUBLIC_APP_VERSION=2.0.0
```

## API接口

### `/api/ai/chat`
- **POST**: 流式聊天接口
- **GET**: EventSource兼容接口

**请求格式**:
```json
{
  "message": "用户消息",
  "conversationId": "对话ID",
  "clearHistory": false
}
```

**响应格式**:
```json
{
  "type": "text|plan|error|done",
  "content": "响应内容",
  "plan": "执行计划对象(可选)",
  "conversationId": "对话ID"
}
```

## 执行计划格式

### 计划结构
```json
{
  "id": "plan_1234567890",
  "title": "东京三日游",
  "description": "经典景点深度游",
  "steps": [
    {
      "id": "step_1",
      "type": "create_markers",
      "name": "create_marker_v2",
      "description": "创建 5 个地点标记",
      "args": {
        "places": [...]
      },
      "status": "pending"
    }
  ],
  "createdAt": "2025-09-30T09:00:00.000Z"
}
```

### 支持的步骤类型
- `create_markers`: 创建地图标记
- `create_chain`: 创建行程链
- `message`: 文本消息

## 使用方法

### 1. 基本聊天
```typescript
const aiService = new AIServiceV4()
const conversationId = aiService.createConversation()

for await (const response of aiService.processMessageStream(message, conversationId)) {
  console.log(response)
}
```

### 2. 计划执行
```typescript
const handleExecutePlan = async (plan: ExecutionPlan) => {
  for (const step of plan.steps) {
    if (step.type === 'create_markers') {
      // 创建地图标记
      await createMapMarkers(step.args.places)
    }
  }
}
```

## 测试

### 测试页面
访问 `/test-ai` 页面进行功能测试

### 测试用例
1. **基本对话**: "你好"
2. **简单计划**: "帮我规划东京一日游"
3. **复杂需求**: "我想去大阪三天，喜欢美食和购物"

## 部署要求

### 依赖服务
- Ollama服务运行在 `localhost:11434`
- 已安装 `deepseek-r1:8b` 模型

### 环境检查
```bash
# 检查Ollama服务
curl http://localhost:11434/api/tags

# 检查模型
curl http://localhost:11434/api/show -d '{"name":"deepseek-r1:8b"}'
```

## 性能优化

### 1. 流式处理优化
- 智能内容过滤
- 减少不必要的渲染
- 优化网络传输

### 2. 内存管理
- 对话历史限制
- 及时清理无用数据
- 高效的数据结构

### 3. 错误恢复
- 自动重试机制
- 优雅降级
- 详细错误日志

## 未来扩展

### 1. 多模型支持
- 支持不同AI模型
- 模型切换功能
- 性能对比

### 2. 高级功能
- 语音输入输出
- 图片理解
- 实时协作

### 3. 集成优化
- 地图深度集成
- 实时数据同步
- 离线功能支持

## 总结

新的AI架构V4通过简化设计、优化性能和增强可靠性，为用户提供了更好的AI旅游规划体验。架构的模块化设计也为未来的功能扩展奠定了良好的基础。