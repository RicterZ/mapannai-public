# Mapannai AI 中间层

基于 Ollama 和 MCP 服务的智能旅游规划助手。

## 功能特性

- 🤖 **智能对话**：基于 Ollama 的自然语言处理
- 🗺️ **地图操作**：创建、查看、删除标记点
- 🔍 **地点搜索**：搜索附近景点和地点
- 📅 **行程规划**：智能生成旅游计划
- 🔧 **工具调用**：自动识别用户意图并调用相应工具
- 🌐 **网页控制台**：直观的 Web 界面

## 快速开始

### 1. 环境配置

```bash
# 复制环境变量文件
cp env.example .env

# 编辑环境变量
nano .env
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

### 4. 访问控制台

打开浏览器访问：http://localhost:3001

## 环境变量

```env
# Ollama 配置
OLLAMA_API_URL=http://192.168.13.3:11434
OLLAMA_MODEL=qwen3:4b

# AI 中间层配置
AI_MIDDLEWARE_PORT=3001

# Mapannai API 配置
MAPANNAI_API_URL=http://localhost:3000
MAPANNAI_API_KEY=your_api_key_here
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
2. **create_marker_v2** - 通过地名创建标记（内部搜索坐标）。为提高准确度，请尽量提供更具体的查询，例如“函馆山附近 炸猪排店”。
3. **update_marker_content** - 更新标记内容
4. **create_travel_chain** - 创建旅游行程链
5. **search_places** - 搜索地点
6. **get_markers** - 获取所有标记
7. **get_marker** - 获取特定标记
8. **create_travel_plan** - 创建旅游计划（MCP 服务器内部实现）

## 使用示例

### 完整旅游规划
```
### 通过地名创建标记（v2）
```http
POST /tools/call
Content-Type: application/json

{
  "toolName": "create_marker_v2",
  "arguments": {
    "name": "函馆山附近 炸猪排店",
    "iconType": "food",
    "content": "招牌猪排，夜景视野好"
  }
}
```
用户：请为我规划一个京都一日游，包含经典景点、美食推荐和合理的游览路线

AI：我来为您规划一个完整的京都一日游！

## 第一步：规划景点
让我先分析京都的经典景点，选择最适合一日游的路线...

[AI 会流式创建标记点，生成详细信息，创建行程链等]
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
ollama pull qwen3:4b
```

### 3. 端口冲突
```bash
# 修改端口
export AI_MIDDLEWARE_PORT=3002
npm run ai
```

## 项目结构

```
mcp-server/
├── src/
│   ├── ai-middleware.ts    # AI 中间层主文件
│   ├── index.ts           # MCP 服务器
│   ├── api-client.ts      # API 客户端
│   └── types.ts           # 类型定义
├── public/
│   └── index.html         # 网页控制台
├── package.json
└── README.md
```

## 开发说明

### 添加新工具

1. 在 `ai-middleware.ts` 的 `callTool` 方法中添加新工具的处理逻辑
2. 在 `parseToolCalls` 方法中添加工具调用检测规则
3. 更新 `/tools` 端点返回的工具列表

### 自定义 AI 行为

修改 `processMessage` 方法中的系统提示词来改变 AI 的行为模式。

## 注意事项

- 确保 Ollama 服务正常运行
- 确保 Mapannai API 服务可访问
- 模型 `qwen3:4b` 需要足够的系统资源
- 建议在生产环境中使用更稳定的模型