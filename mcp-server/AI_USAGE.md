# AI 中间层使用说明

## 概述

AI 中间层结合了 Ollama 和 MCP 服务，提供智能旅游助手功能。用户可以通过自然语言与 AI 对话，AI 会自动调用相应的工具来创建标记、搜索地点、规划行程等。

## 功能特性

- 🤖 **智能对话**：基于 Ollama 的自然语言处理
- 🗺️ **地图操作**：创建、查看、删除标记点
- 🔍 **地点搜索**：搜索附近景点和地点
- 📅 **行程规划**：智能生成旅游计划
- 🔧 **工具调用**：自动识别用户意图并调用相应工具

## 快速开始

### 1. 环境配置

```bash
# 复制环境变量文件
cp env.example .env

# 编辑环境变量
nano .env
```

环境变量配置：
```env
# Ollama 配置
OLLAMA_API_URL=http://192.168.13.3:11434
OLLAMA_MODEL=qweb3:4b

# AI 中间层配置
AI_MIDDLEWARE_PORT=3001

# Mapannai API 配置
MAPANNAI_API_URL=http://localhost:3000
MAPANNAI_API_KEY=your_api_key_here
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务

```bash
# 开发模式
npm run ai:dev

# 生产模式
npm run build
npm run ai
```

### 4. 测试服务

```bash
# 运行测试脚本
node test-ai.js
```

## API 接口

### 健康检查
```http
GET /health
```

### AI 对话
```http
POST /chat
Content-Type: application/json

{
  "message": "我想创建一个标记点",
  "conversation": []
}
```

### 获取工具列表
```http
GET /tools
```

### 直接调用工具
```http
POST /tools/call
Content-Type: application/json

{
  "toolName": "create_marker",
  "arguments": {
    "coordinates": { "latitude": 39.9042, "longitude": 116.4074 },
    "title": "天安门",
    "iconType": "landmark"
  }
}
```

## 支持的工具

1. **create_marker** - 创建地图标记
2. **update_marker_content** - 更新标记内容
3. **create_travel_chain** - 创建旅游行程链
4. **search_places** - 搜索地点
5. **get_markers** - 获取所有标记
6. **get_marker** - 获取特定标记
7. **delete_marker** - 删除标记
8. **create_travel_plan** - 创建旅游计划

## 工作流程

AI 助手会按照以下步骤进行旅游规划：

1. **规划景点** - 分析目的地，选择经典必游景点
2. **流式创建标记** - 边思考边创建标记点
3. **生成详细信息** - 为每个景点生成详细游玩信息
4. **整体规划思考** - 评估路线合理性，优化游览顺序
5. **创建行程链** - 根据游览顺序创建行程链
6. **完成输出** - 总结整个行程规划

## 使用示例

### 完整旅游规划示例
```
用户：请为我规划一个京都一日游，包含经典景点、美食推荐和合理的游览路线

AI：我来为您规划一个完整的京都一日游！

## 第一步：规划景点
让我先分析京都的经典景点，选择最适合一日游的路线...

TOOL_CALL_START
{
  "tool": "create_marker",
  "arguments": {
    "coordinates": { "latitude": 35.0116, "longitude": 135.7681 },
    "title": "清水寺",
    "iconType": "landmark",
    "content": "京都最著名的寺庙之一"
  }
}
TOOL_CALL_END

TOOL_CALL_START
{
  "tool": "create_marker",
  "arguments": {
    "coordinates": { "latitude": 35.0044, "longitude": 135.7781 },
    "title": "伏见稻荷大社",
    "iconType": "culture",
    "content": "以千本鸟居闻名的神社"
  }
}
TOOL_CALL_END

## 第二步：生成详细信息
现在让我为每个景点生成详细的游玩信息...

TOOL_CALL_START
{
  "tool": "update_marker_content",
  "arguments": {
    "markerId": "marker1",
    "markdownContent": "# 清水寺\n\n## 基本信息\n- **门票价格**: 成人 400 日元\n- **开放时间**: 6:00-18:00\n- **游览时间**: 1-2小时\n\n## 游览建议\n- 最佳游览时间：早晨 8:00-10:00\n- 必看景点：清水舞台、音羽瀑布\n- 注意事项：需要爬坡，建议穿舒适的鞋子\n\n## 交通信息\n- 从京都站乘坐巴士 206 路，清水道站下车"
  }
}
TOOL_CALL_END

## 第三步：创建行程链
根据游览顺序创建行程链...

TOOL_CALL_START
{
  "tool": "create_travel_chain",
  "arguments": {
    "markerIds": ["marker1", "marker2", "marker3"],
    "chainName": "京都经典一日游",
    "description": "包含清水寺、伏见稻荷大社、金阁寺的经典路线"
  }
}
TOOL_CALL_END

## 完成规划
已成功为您规划了京都一日游！包含 3 个经典景点和 1 条游览路线...
```

### 创建标记
```
用户：我想在北京天安门创建一个标记点
AI：我来帮您在天安门创建一个标记点

TOOL_CALL_START
{
  "tool": "create_marker",
  "arguments": {
    "coordinates": { "latitude": 39.9042, "longitude": 116.4074 },
    "title": "天安门",
    "iconType": "landmark",
    "content": "北京天安门广场"
  }
}
TOOL_CALL_END

已成功创建天安门标记点！
```

### 搜索地点
```
用户：搜索北京的景点
AI：我来为您搜索北京的景点

TOOL_CALL_START
{
  "tool": "search_places",
  "arguments": {
    "query": "北京景点"
  }
}
TOOL_CALL_END

找到了以下景点：...
```

### 查看标记
```
用户：显示所有标记
AI：我来为您显示所有标记

TOOL_CALL_START
{
  "tool": "get_markers",
  "arguments": {}
}
TOOL_CALL_END

当前共有 X 个标记：...
```

### 创建行程链
```
用户：创建一个包含天安门和故宫的行程链
AI：我来为您创建一个行程链

TOOL_CALL_START
{
  "tool": "create_travel_chain",
  "arguments": {
    "markerIds": ["marker1", "marker2"],
    "chainName": "北京经典一日游",
    "description": "包含天安门和故宫的经典路线"
  }
}
TOOL_CALL_END

已成功创建行程链！
```

### 更新标记内容
```
用户：更新天安门标记的详细内容
AI：我来为您更新标记内容

TOOL_CALL_START
{
  "tool": "update_marker_content",
  "arguments": {
    "markerId": "marker1",
    "title": "天安门广场",
    "markdownContent": "# 天安门广场\n\n天安门广场是北京市中心的城市广场..."
  }
}
TOOL_CALL_END

已成功更新标记内容！
```

### 删除标记
```
用户：删除标记 marker1
AI：我来为您删除标记

TOOL_CALL_START
{
  "tool": "delete_marker",
  "arguments": {
    "markerId": "marker1"
  }
}
TOOL_CALL_END

已成功删除标记！
```

## 故障排除

### 1. Ollama 服务不可用
```bash
# 检查 Ollama 服务状态
curl http://192.168.13.3:11434/api/tags

# 启动 Ollama 服务
ollama serve
```

### 2. 模型未安装
```bash
# 拉取模型
ollama pull qweb3:4b
```

### 3. 端口冲突
```bash
# 修改端口
export AI_MIDDLEWARE_PORT=3002
npm run ai
```

## 开发说明

### 项目结构
```
mcp-server/
├── src/
│   ├── ai-middleware.ts    # AI 中间层主文件
│   ├── index.ts           # MCP 服务器
│   ├── api-client.ts      # API 客户端
│   └── types.ts           # 类型定义
├── test-ai.js             # 测试脚本
├── start-ai.sh           # 启动脚本
└── package.json
```

### 添加新工具

1. 在 `ai-middleware.ts` 的 `callTool` 方法中添加新工具的处理逻辑
2. 在 `extractToolCalls` 方法中添加工具调用检测规则
3. 更新 `/tools` 端点返回的工具列表

### 自定义 AI 行为

修改 `processMessage` 方法中的系统提示词来改变 AI 的行为模式。

## 注意事项

- 确保 Ollama 服务正常运行
- 确保 Mapannai API 服务可访问
- 模型 `qweb3:4b` 需要足够的系统资源
- 建议在生产环境中使用更稳定的模型
