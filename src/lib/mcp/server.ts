/**
 * MapAnNai MCP Server
 *
 * Exposes map operations as MCP tools for external AI assistants
 * (Claude Desktop, Cursor, etc.) to plan trips and manage markers.
 *
 * Transport: StreamableHTTP via /api/mcp
 *
 * Available tools:
 *   Markers: list_markers, create_marker, update_marker, delete_marker
 *   Search:  search_places, get_place_details, get_walking_directions
 *   Trips:   list_trips, get_trip_detail, create_trip, add_day_to_trip,
 *            assign_marker_to_day, plan_trip_day, reorder_day_markers, delete_trip
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerMarkerTools } from './tools/marker-tools'
import { registerSearchTools } from './tools/search-tools'
import { registerTripTools } from './tools/trip-tools'

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'mapannai',
    version: '1.0.0',
    description: `MapAnNai 交互式旅行地图编辑器。核心概念：Marker（地点标记）、Trip（旅行）、TripDay（旅行中的某天）。推荐 Workflow：1) create_trip 创建旅行 → 2) plan_trip_day 批量创建地点并加入某天。可调用 workflow prompt 获取完整使用指南。`,
  })

  // Register all tools
  registerMarkerTools(server)
  registerSearchTools(server)
  registerTripTools(server)

  // Prompt: workflow guide that AI clients can request
  server.prompt(
    'workflow',
    '获取 MapAnNai 的完整使用指南和工具 Workflow',
    {},
    () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `# MapAnNai 使用指南

## 核心概念

- **Marker**：地图上的地点标记，包含坐标、标题、图标类型、Markdown 内容。
- **Trip**：一次旅行，包含名称、日期范围，创建时自动按天生成 TripDay。
- **TripDay**：旅行中的某一天，包含当天的 marker 列表和行程链（chains）。
- **Chain**：一天内 marker 的有序连线，用于在地图上显示游览路线。

## 推荐 Workflow

### 新建行程
1. \`create_trip\` — 创建旅行，指定名称和日期范围，自动生成每天的 TripDay。
2. \`plan_trip_day\` — 对每一天批量创建地点 marker 并加入当天行程，自动生成行程链。
3. 如需调整顺序，使用 \`reorder_day_markers\`。

### 查看已有行程
1. \`list_trips\` — 列出所有旅行。
2. \`get_trip_detail\` — 查看某次旅行的详细信息（每天的 marker 列表）。

### 单独管理地点
- \`search_places\` — 先搜索确认地点存在再创建。
- \`create_marker\` — 独立创建地点（不关联旅行时使用）。
- \`update_marker\` / \`delete_marker\` — 编辑或删除地点。

---

## 强制规则（必须遵守）

### 地点名称必须包含城市名
- ✅ 正确：「东京 浅草寺」「京都 金阁寺」「上海 外滩」
- ❌ 错误：「浅草寺」「金阁寺」「外滩」
- 原因：Google Places 对无城市名的简称容易返回错误地区的同名地点。

### country 参数说明
- \`search_places\`、\`create_marker\`、\`plan_trip_day\` 均有 \`country\` 参数，**默认值为 \`CN\`（中国）**。
- 规划其他国家时必须显式传入，例如日本传 \`JP\`，韩国传 \`KR\`，美国传 \`US\`。
- 填错会导致同名地点定位到错误国家。

### 同一天行程的地点合理性校验（必须执行）
- \`plan_trip_day\` 执行完成后，检查返回的所有成功地点的坐标。
- 若同一天内任意两点直线距离超过 **100 公里**，必须立即停止后续规划，向用户报告：
  - 哪个地点疑似定位错误
  - 该地点当前坐标是什么
  - 与其他地点距离多远
- 不得默默忽略异常坐标继续规划。

### 错误处理
- 若某地点返回 \`status: error\`，必须告知用户并建议使用更精确的名称重试。
- 不应静默跳过失败的地点。

---

## 工具一览

| 工具 | 用途 |
|------|------|
| \`list_markers\` | 列出地图上所有 marker |
| \`create_marker\` | 按地点名称批量创建 marker |
| \`update_marker\` | 更新 marker 标题/内容/图标 |
| \`delete_marker\` | 删除 marker |
| \`search_places\` | 搜索地点（确认坐标用） |
| \`get_place_details\` | 获取地点详细信息（电话/营业时间等） |
| \`get_walking_directions\` | 获取两点步行路线 |
| \`list_trips\` | 列出所有旅行 |
| \`get_trip_detail\` | 查看旅行详情 |
| \`create_trip\` | 创建旅行（自动生成每天 TripDay） |
| \`add_day_to_trip\` | 手动为旅行添加一天 |
| \`assign_marker_to_day\` | 将已有 marker 加入某天 |
| \`plan_trip_day\` | 批量创建地点并加入某天（推荐主力工具） |
| \`reorder_day_markers\` | 调整某天地点顺序 |
| \`delete_trip\` | 删除旅行 |
| \`plan_day_trip\` | 组合工具：批量创建地点 marker 并自动连线（Combo） |`,
        },
      }],
    })
  )

  return server
}

// Export factory — each request must get its own McpServer instance
// because McpServer binds 1:1 with a transport and cannot be reused
export { createMcpServer }
