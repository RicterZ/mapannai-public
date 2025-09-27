# API服务层

这个目录包含了API服务的抽象层实现，支持多种地图backend。

## 架构设计

### 1. 搜索服务 (`search-service.ts`)
- `SearchService`: 定义了搜索服务接口
- `MapSearchService`: 基于地图提供者的搜索服务实现
- 支持通过 `/api/search` 端点进行地点搜索

### 2. 数据集服务 (`dataset-service.ts`)
- `DatasetService`: 定义了数据集服务接口
- `MapDatasetService`: 基于地图提供者的数据集服务实现
- 支持通过 `/api/dataset` 端点进行数据集操作

## 当前实现

### Mapbox支持
- ✅ 搜索功能：直接调用Mapbox Geocoding API
- ✅ 数据集获取：调用Mapbox Datasets API
- ✅ 特征创建/更新：使用Mapbox Datasets API
- ✅ 特征删除：使用Mapbox Datasets API

### 其他地图提供者
- 🔄 高德地图：待实现
- 🔄 百度地图：待实现
- 🔄 Google地图：待实现

## 使用方法

### 搜索API
```typescript
// 前端调用
const response = await fetch('/api/search?q=东京&limit=5')
const data = await response.json()
```

### 数据集API
```typescript
// 获取所有特征
const response = await fetch('/api/dataset')
const data = await response.json()

// 创建/更新特征
const response = await fetch('/api/dataset', {
    method: 'POST',
    body: JSON.stringify({
        featureId: 'marker-123',
        coordinates: { latitude: 35.6895, longitude: 139.6917 },
        properties: { name: '东京塔' }
    })
})

// 删除特征
const response = await fetch('/api/dataset?featureId=marker-123', {
    method: 'DELETE'
})
```

## 配置要求

### Mapbox配置
```bash
NEXT_PUBLIC_MAP_PROVIDER=mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token
MAPBOX_USERNAME=your_username
MAPBOX_SECRET_ACCESS_TOKEN=sk.your_secret_token
MAPBOX_DATASET_ID=your_dataset_id
```

## 错误处理

所有API都包含完整的错误处理：
- 网络错误
- API认证错误
- 数据格式错误
- 服务器错误

错误响应格式：
```json
{
    "error": "错误描述",
    "details": "详细错误信息"
}
```

## 扩展新地图提供者

1. 在 `dataset-service.ts` 中添加新的私有方法
2. 在 `getAllFeatures` 等方法中添加条件判断
3. 实现对应的API调用逻辑
4. 更新配置以支持新的环境变量
