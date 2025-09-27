# Google Maps 集成指南

本文档介绍如何在项目中使用 Google Maps 作为地图提供者。

## 环境配置

### 1. 获取 Google Maps API Key

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用以下 API：
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. 创建 API Key 并配置限制

### 2. 环境变量配置

在 `.env.local` 文件中添加：

```bash
# 选择 Google Maps 作为地图提供者
NEXT_PUBLIC_MAP_PROVIDER=google

# Google Maps API Key
NEXT_PUBLIC_GOOGLE_ACCESS_TOKEN=your_google_api_key_here

# Google Maps 样式（可选）
NEXT_PUBLIC_GOOGLE_STYLE=roadmap

# Google Maps 数据集 ID（可选）
GOOGLE_DATASET_ID=your_google_dataset_id
```

## 使用方法

### 1. 基本使用

```tsx
import { GoogleMap } from '@/components/map'
import { config } from '@/lib/config'

function MyMapComponent() {
    const mapConfig = {
        accessToken: config.map.google.accessToken,
        style: config.map.google.style
    }

    const markers = [
        {
            id: 'marker1',
            coordinates: { latitude: 35.6895, longitude: 139.6917 },
            content: {
                title: '东京',
                iconType: 'default'
            }
        }
    ]

    const handleMapClick = (coordinates) => {
        console.log('点击位置:', coordinates)
    }

    const handleMarkerClick = (markerId) => {
        console.log('点击标记:', markerId)
    }

    return (
        <GoogleMap
            config={mapConfig}
            markers={markers}
            onMapClick={handleMapClick}
            onMarkerClick={handleMarkerClick}
            className="w-full h-96"
        />
    )
}
```

### 2. 高级配置

```tsx
import { GoogleMap } from '@/components/map'
import { GoogleMapConfig } from '@/types/google-maps'

function AdvancedMapComponent() {
    const mapConfig: GoogleMapConfig = {
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_ACCESS_TOKEN!,
        style: 'dark',
        center: { lat: 35.6895, lng: 139.6917 },
        zoom: 12,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        fullscreenControl: true
    }

    return (
        <GoogleMap
            config={mapConfig}
            markers={[]}
            onMapLoad={() => console.log('地图加载完成')}
            onMapError={(error) => console.error('地图错误:', error)}
            style={{ height: '500px' }}
        />
    )
}
```

## API 功能

### 1. 地图提供者接口

Google Maps 提供者实现了完整的 `MapProvider` 接口：

- **地图实例管理**: `createMapInstance`, `destroyMapInstance`
- **视图控制**: `setViewState`, `getViewState`, `flyTo`
- **标记管理**: `addMarker`, `removeMarker`, `updateMarker`
- **事件处理**: `onMapClick`, `onMarkerClick`, `onMapLoad`, `onMapError`
- **搜索功能**: `searchPlaces`
- **样式配置**: `getMapStyle`, `getAttribution`

### 2. 搜索功能

```tsx
import { mapProviderFactory } from '@/lib/map-providers'
import { config } from '@/lib/config'

async function searchPlaces(query: string) {
    const provider = mapProviderFactory.createProvider('google')
    const results = await provider.searchPlaces(query, config.map.google)
    
    console.log('搜索结果:', results)
    return results
}
```

### 3. 自定义样式

```tsx
const customStyles = [
    {
        featureType: 'all',
        elementType: 'geometry',
        stylers: [{ color: '#242f3e' }]
    },
    {
        featureType: 'all',
        elementType: 'labels.text.stroke',
        stylers: [{ light: -80 }]
    }
]

const mapConfig = {
    accessToken: 'your_api_key',
    style: 'dark',
    styles: customStyles
}
```

## 样式选项

Google Maps 支持以下内置样式：

- `roadmap`: 标准道路地图
- `satellite`: 卫星图像
- `hybrid`: 卫星图像 + 道路标签
- `terrain`: 地形图
- `dark`: 深色主题（自定义）
- `light`: 浅色主题（自定义）

## 标记图标

支持自定义标记图标：

```tsx
const markers = [
    {
        id: 'restaurant',
        coordinates: { latitude: 35.6895, longitude: 139.6917 },
        content: {
            title: '餐厅',
            iconType: 'restaurant' // 对应 /icons/marker-restaurant.png
        }
    }
]
```

支持的图标类型：
- `default`: 默认标记
- `restaurant`: 餐厅
- `hotel`: 酒店
- `attraction`: 景点
- `shopping`: 购物
- `transport`: 交通

## 错误处理

```tsx
const handleMapError = (error: Error) => {
    console.error('地图错误:', error)
    
    if (error.message.includes('API key')) {
        console.error('请检查 Google Maps API Key 配置')
    } else if (error.message.includes('quota')) {
        console.error('API 配额已用完')
    }
}
```

## 性能优化

1. **延迟加载**: Google Maps API 只在需要时加载
2. **标记优化**: 大量标记时考虑使用 MarkerClusterer
3. **事件清理**: 组件卸载时自动清理事件监听器
4. **缓存策略**: 合理使用 Google Maps 缓存

## 注意事项

1. **API 配额**: 注意 Google Maps API 的使用配额和计费
2. **域名限制**: 在 Google Cloud Console 中配置 API Key 的域名限制
3. **HTTPS**: 生产环境必须使用 HTTPS
4. **加载顺序**: 确保 Google Maps API 完全加载后再初始化地图

## 故障排除

### 常见问题

1. **"Google Maps API not loaded"**
   - 检查 API Key 是否正确
   - 确认网络连接正常
   - 检查浏览器控制台是否有 CORS 错误

2. **地图不显示**
   - 检查容器元素是否有明确的高度
   - 确认 API Key 有正确的权限
   - 检查是否启用了必要的 API

3. **标记不显示**
   - 检查坐标是否正确
   - 确认标记图标路径有效
   - 检查地图缩放级别是否合适

### 调试技巧

```tsx
// 启用调试模式
const mapConfig = {
    accessToken: 'your_api_key',
    style: 'roadmap',
    // 添加调试选项
    disableDefaultUI: false,
    zoomControl: true
}

// 监听地图事件
const handleMapLoad = () => {
    console.log('地图加载完成')
}

const handleMapError = (error) => {
    console.error('地图错误详情:', error)
}
```
