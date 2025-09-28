# Mapannai MCP Server

这是一个为Mapannai交互式地图编辑器设计的MCP (Model Context Protocol) 服务器，允许AI助手直接与地图应用交互，创建标记、填写内容和创建旅游行程链。

## 功能特性

- 🎯 **创建标记**: AI可以在地图上创建各种类型的标记点
- 📝 **填写内容**: AI可以为标记添加详细的旅游信息
- 🔗 **创建行程链**: AI可以连接多个标记点创建完整的旅游路线
- 🔍 **搜索地点**: AI可以搜索和获取地点信息
- 🧠 **智能规划**: AI可以根据用户需求生成完整的旅游计划

## 安装和配置

### 1. 安装依赖

```bash
cd mcp-server
npm install
```

### 2. 配置环境变量

复制 `env.example` 到 `.env` 并配置：

```bash
cp env.example .env
```

编辑 `.env` 文件：

```env
# Mapannai API配置
MAPANNAI_API_URL=http://localhost:3000
MAPANNAI_API_KEY=your_api_key_here

# MCP Server配置（可选）
MCP_SERVER_PORT=3001
MCP_SERVER_HOST=localhost
```

### 3. 构建和运行

```bash
# 构建
npm run build

# 运行
npm start

# 开发模式
npm run dev
```

## 可用工具

### 1. create_marker
在地图上创建新的标记点

**参数:**
- `coordinates`: 坐标 {latitude: number, longitude: number}
- `title`: 标记标题
- `iconType`: 图标类型 (activity, location, hotel, shopping, food, landmark, park, natural, culture)
- `content`: 标记内容（可选）

### 2. update_marker_content
更新标记的详细内容

**参数:**
- `markerId`: 标记ID
- `title`: 标记标题（可选）
- `headerImage`: 头图URL（可选）
- `markdownContent`: Markdown格式的详细内容

### 3. create_travel_chain
创建旅游行程链，连接多个标记点

**参数:**
- `markerIds`: 标记ID列表，按游览顺序排列
- `chainName`: 行程链名称（可选）
- `description`: 行程链描述（可选）

### 4. search_places
搜索地点信息

**参数:**
- `query`: 搜索关键词
- `location`: 搜索中心位置（可选）

### 5. get_markers
获取所有标记

### 6. get_marker
获取特定标记的详细信息

**参数:**
- `markerId`: 标记ID

### 7. delete_marker
删除标记

**参数:**
- `markerId`: 标记ID

### 8. create_travel_plan
AI智能创建完整的旅游计划

**参数:**
- `destination`: 目的地
- `startDate`: 开始日期（可选）
- `endDate`: 结束日期（可选）
- `interests`: 兴趣偏好（可选）
- `budget`: 预算范围（可选）
- `duration`: 行程天数（可选）

## 接入AI助手

### Claude Desktop 配置

在Claude Desktop的配置文件中添加MCP服务器：

```json
{
  "mcpServers": {
    "mapannai": {
      "command": "node",
      "args": ["/path/to/mapannai-public/mcp-server/dist/index.js"],
      "env": {
        "MAPANNAI_API_URL": "http://localhost:3000",
        "MAPANNAI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### 其他AI助手

MCP Server使用标准协议，可以与任何支持MCP的AI助手集成。请参考相应AI助手的MCP集成文档。

## 使用示例

### 创建京都旅游计划

```
请帮我创建一个京都3日游的旅游计划，包括：
1. 创建主要景点的标记
2. 为每个景点添加详细信息（门票、开放时间、注意事项）
3. 创建合理的游览路线
```

### 更新标记内容

```
请为清水寺标记添加详细信息，包括：
- 门票价格：400日元
- 开放时间：6:00-18:00
- 最佳游览时间：早上8点前
- 注意事项：需要脱鞋进入
```

### 创建美食路线

```
请搜索京都的美食地点，并创建一个美食之旅的行程链，包括：
- 传统日式料理
- 抹茶体验
- 当地小吃
```

## 开发

### 项目结构

```
mcp-server/
├── src/
│   ├── index.ts          # MCP服务器主文件
│   ├── api-client.ts     # API客户端
│   └── types.ts         # 类型定义
├── dist/                 # 构建输出
├── package.json
├── tsconfig.json
└── README.md
```

### 添加新工具

1. 在 `types.ts` 中定义新的类型
2. 在 `api-client.ts` 中添加API调用方法
3. 在 `index.ts` 中添加工具定义和处理逻辑

### 调试

使用开发模式运行服务器：

```bash
npm run dev
```

这将启动热重载，方便开发和调试。

## 故障排除

### 常见问题

1. **连接失败**: 检查MAPANNAI_API_URL是否正确
2. **权限错误**: 确认MAPANNAI_API_KEY有效
3. **工具调用失败**: 检查参数格式是否正确

### 日志

服务器会在控制台输出详细的日志信息，包括：
- 工具调用请求
- API响应
- 错误信息

## 许可证

MIT License
