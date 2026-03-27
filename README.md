# MapAnNai Plus — 交互式旅行地图编辑器

基于 Next.js + Mapbox 的旅行规划平台。在地图上创建和管理地点标记，按旅行/天组织行程，并通过 **MCP 协议**让 AI 助手（Claude Desktop、Cursor 等）直接操作地图。

<img width="1481" height="918" alt="Clipboard_Screenshot_1774582478" src="https://github.com/user-attachments/assets/8cc1543e-1e5c-4f9b-93b8-66b72e73fce9" />


<img width="1481" height="918" alt="Clipboard_Screenshot_1774582430" src="https://github.com/user-attachments/assets/5e806e0e-86ff-4758-a85e-dae49e4afc8a" />



---

## 快速开始

### 1. 环境变量

```bash
cp env.example .env
# 编辑 .env，填入以下配置
```

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox 公开 token（`pk.`开头），用于地图渲染 |
| `MAPBOX_SECRET_ACCESS_TOKEN` | Mapbox 私密 token（`sk.`开头），**仅迁移脚本需要**，迁移完成后可删除 |
| `MAPBOX_USERNAME` | Mapbox 用户名，**仅迁移脚本需要**，迁移完成后可删除 |
| `MAPBOX_DATASET_ID` | Mapbox Dataset ID，**仅迁移脚本需要**，迁移完成后可删除 |
| `GOOGLE_API_KEY` | Google Maps API Key，用于地点搜索和路径规划 |
| `GOOGLE_API_BASE_URL` | Google API 地址，默认 `https://maps.googleapis.com`（国内可填代理） |
| `TENCENT_COS_*` | 腾讯云 COS 配置，用于图片上传 |

### 2. 本地开发

```bash
npm install
npm run dev       # http://localhost:3000
npm run type-check
```

### 3. Docker 部署

```bash
docker-compose up -d mapannai
docker-compose logs -f mapannai
```

详细部署步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。

---

## MCP 接入（AI 助手操作地图）

MapAnNai 内置 MCP Server，任何支持 MCP 协议的 AI 客户端都可以直接创建标记、规划行程。

### Claude Desktop 配置

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "mapannai": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

> 远程部署时将 `localhost:3000` 替换为实际域名。

### 可用工具

| 分类 | 工具 | 说明 |
|------|------|------|
| **旅行** | `create_trip` | 创建旅行，自动按日期生成每天行程 |
| | `list_trips` | 列出所有旅行 |
| | `get_trip_detail` | 获取旅行详情（含每天地点） |
| | `add_day_to_trip` | 手动新增一天 |
| | `delete_trip` | 删除旅行（不删标记） |
| **行程规划** | `plan_trip_day` | ⭐ 批量创建地点并加入指定天，一步完成 |
| | `assign_marker_to_day` | 将已有标记加入某天 |
| | `reorder_day_markers` | 调整当天地点顺序 |
| **标记** | `create_marker` | 按地名创建标记（支持批量） |
| | `list_markers` | 列出地图上所有标记 |
| | `update_marker` | 更新标记内容/图标 |
| | `delete_marker` | 删除标记 |
| **搜索** | `search_places` | 搜索地点（返回坐标） |
| | `get_place_details` | 获取地点详情（电话、评分、营业时间） |
| | `get_walking_directions` | 获取步行路线 |
| **路线** | `create_trip_chain` | 将标记连线为路线 |
| | `list_trip_chains` | 列出所有路线 |

### 推荐 Workflow

**规划一次新旅行：**
```
1. create_trip("东京2024春", "2024-03-01", "2024-03-05")
   → 返回 trip.id 和 days[0..4].id

2. plan_trip_day(tripId, days[0].id, [
     { name: "新宿御苑", iconType: "park" },
     { name: "东京塔", iconType: "landmark" },
     { name: "筑地市场", iconType: "food" }
   ])
   → 一步创建标记并加入第1天

3. 重复步骤2为每天规划地点
```

**继续规划已有旅行：**
```
list_trips() → get_trip_detail(tripId) → plan_trip_day(...)
```

连接后可调用 `workflow` prompt 让 AI 自动获取使用指南。

---

## 标记类型

| 图标 | 类型 | 说明 |
|------|------|------|
| 🎯 | `activity` | 活动和娱乐 |
| 📍 | `location` | 一般地点 |
| 🏨 | `hotel` | 住宿 |
| 🛍️ | `shopping` | 购物 |
| 🍜 | `food` | 美食 |
| 🌆 | `landmark` | 地标建筑 |
| 🎡 | `park` | 公园游乐 |
| 🗻 | `natural` | 自然景观 |
| ⛩️ | `culture` | 人文景观 |
| 🚉 | `transit` | 交通枢纽 |

---

## 城市快速跳转配置

在 `src/lib/config.ts` 的 `cities` 中添加城市：

```typescript
yourCity: {
    name: '城市名',
    coordinates: { longitude: 135.0, latitude: 35.0 },
    zoom: 12
}
```
