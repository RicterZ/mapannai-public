# Mapannai AI 接入指南

本文档介绍如何将AI助手接入Mapannai交互式地图编辑器，让AI能够帮助用户创建标记、填写内容和创建旅游行程链。

## 概述

通过MCP (Model Context Protocol) 服务器，AI助手可以：
- 🎯 在地图上创建各种类型的标记点
- 📝 为标记添加详细的旅游信息（门票、开放时间、注意事项等）
- 🔗 创建智能的旅游行程链
- 🔍 搜索和获取地点信息
- 🧠 根据用户需求生成完整的旅游计划

## 快速开始

### 1. 启动Mapannai应用

```bash
# 在项目根目录
npm run dev
```

确保应用运行在 `http://localhost:3000`

### 2. 配置MCP Server

```bash
# 进入MCP服务器目录
cd mcp-server

# 安装依赖
npm install

# 配置环境变量
cp env.example .env
```

编辑 `.env` 文件：
```env
MAPANNAI_API_URL=http://localhost:3000
MAPANNAI_API_KEY=your_api_key_here
```

### 3. 构建和启动MCP Server

```bash
# 构建
npm run build

# 启动
npm start
```

## AI助手配置

### Claude Desktop 配置

1. 打开Claude Desktop设置
2. 在MCP服务器配置中添加：

```json
{
  "mcpServers": {
    "mapannai": {
      "command": "node",
      "args": ["/Users/ricterzheng/Desktop/mapannai-public/mcp-server/dist/index.js"],
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

### 示例1: 创建京都旅游计划

**用户请求:**
```
请帮我创建一个京都3日游的旅游计划，包括主要景点、美食和住宿推荐。
```

**AI操作流程:**
1. 使用 `search_places` 搜索京都的主要景点
2. 使用 `create_marker` 为每个景点创建标记
3. 使用 `update_marker_content` 添加详细信息
4. 使用 `create_travel_chain` 创建合理的游览路线

### 示例2: 更新标记信息

**用户请求:**
```
请为清水寺标记添加详细信息，包括门票价格、开放时间和游览建议。
```

**AI操作:**
```javascript
// AI会调用 update_marker_content 工具
{
  "markerId": "清水寺标记ID",
  "title": "清水寺",
  "markdownContent": `
# 清水寺

## 基本信息
- **门票价格**: 400日元
- **开放时间**: 6:00-18:00
- **最佳游览时间**: 早上8点前（避开人群）

## 游览建议
- 建议游览时间：2-3小时
- 需要脱鞋进入主殿
- 可以购买御守和护身符
- 秋季红叶季节最美

## 交通信息
- 从京都站乘坐巴士约15分钟
- 巴士站：清水道站
  `
}
```

### 示例3: 创建美食之旅

**用户请求:**
```
请搜索京都的美食地点，并创建一个美食之旅的行程链。
```

**AI操作:**
1. 搜索传统日式料理、抹茶体验、当地小吃等
2. 为每个美食地点创建标记
3. 按地理位置和用餐时间安排创建行程链

## 可用工具详解

### 1. create_marker - 创建标记

**功能**: 在地图上创建新的标记点

**参数**:
- `coordinates`: 坐标 {latitude: number, longitude: number}
- `title`: 标记标题
- `iconType`: 图标类型
  - `activity`: 🎯 活动
  - `location`: 📍 位置  
  - `hotel`: 🏨 酒店
  - `shopping`: 🛍️ 购物
  - `food`: 🍚 美食
  - `landmark`: 🌆 地标建筑
  - `park`: 🎡 游乐场
  - `natural`: 🗻 自然景观
  - `culture`: ⛩️ 人文景观
- `content`: 标记内容（可选）

**示例**:
```javascript
{
  "coordinates": { "latitude": 35.0116, "longitude": 135.7681 },
  "title": "清水寺",
  "iconType": "landmark",
  "content": "京都最著名的寺庙之一"
}
```

### 2. update_marker_content - 更新标记内容

**功能**: 为标记添加详细的旅游信息

**参数**:
- `markerId`: 标记ID
- `title`: 标记标题（可选）
- `headerImage`: 头图URL（可选）
- `markdownContent`: Markdown格式的详细内容

**示例内容模板**:
```markdown
# 景点名称

## 基本信息
- **门票价格**: XXX日元
- **开放时间**: XX:XX-XX:XX
- **最佳游览时间**: 建议时间

## 游览建议
- 建议游览时间：X小时
- 注意事项
- 特色活动

## 交通信息
- 如何到达
- 附近交通站点

## 周边推荐
- 附近景点
- 美食推荐
```

### 3. create_travel_chain - 创建行程链

**功能**: 连接多个标记点创建旅游路线

**参数**:
- `markerIds`: 标记ID列表，按游览顺序排列
- `chainName`: 行程链名称（可选）
- `description`: 行程链描述（可选）

**示例**:
```javascript
{
  "markerIds": ["marker1", "marker2", "marker3"],
  "chainName": "京都一日游",
  "description": "包含清水寺、金阁寺、岚山的经典路线"
}
```

### 4. search_places - 搜索地点

**功能**: 搜索地点信息

**参数**:
- `query`: 搜索关键词
- `location`: 搜索中心位置（可选）

### 5. create_travel_plan - 智能旅游规划

**功能**: AI智能创建完整的旅游计划

**参数**:
- `destination`: 目的地
- `startDate`: 开始日期（可选）
- `endDate`: 结束日期（可选）
- `interests`: 兴趣偏好（可选）
- `budget`: 预算范围（可选）
- `duration`: 行程天数（可选）

## 最佳实践

### 1. 标记内容结构

为每个标记添加结构化的内容：

```markdown
# 景点名称

## 基本信息
- 门票价格
- 开放时间
- 最佳游览时间

## 游览建议
- 建议游览时长
- 注意事项
- 特色活动

## 实用信息
- 交通方式
- 周边设施
- 联系方式
```

### 2. 行程链规划

- 考虑地理位置，减少交通时间
- 合理安排游览顺序
- 考虑开放时间和最佳游览时间
- 平衡景点类型（文化、自然、美食等）

### 3. 用户体验

- 提供详细但简洁的信息
- 包含实用的游览建议
- 考虑不同用户的需求（预算、时间、兴趣）

## 故障排除

### 常见问题

1. **MCP Server连接失败**
   - 检查Mapannai应用是否运行
   - 确认API URL配置正确
   - 检查网络连接

2. **工具调用失败**
   - 检查参数格式是否正确
   - 确认标记ID存在
   - 查看服务器日志

3. **权限错误**
   - 确认API密钥有效
   - 检查服务器配置

### 调试技巧

1. 查看MCP Server日志输出
2. 检查浏览器开发者工具的网络请求
3. 使用 `get_markers` 工具查看当前状态

## 扩展开发

### 添加新工具

1. 在 `mcp-server/src/types.ts` 中定义类型
2. 在 `mcp-server/src/api-client.ts` 中添加API调用
3. 在 `mcp-server/src/index.ts` 中添加工具定义和处理逻辑
4. 在主应用中添加对应的API端点

### 自定义功能

- 集成更多地图服务（Google Places、Foursquare等）
- 添加天气信息
- 集成实时交通信息
- 添加用户评价和推荐

## 支持

如有问题，请查看：
- [MCP Server文档](./mcp-server/README.md)
- [项目GitHub仓库](https://github.com/your-repo/mapannai-public)
- 提交Issue获取帮助
