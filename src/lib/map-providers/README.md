# 地图提供者抽象层

这个目录包含了地图提供者的抽象层实现，支持多种地图backend。

## 架构设计

### 1. 接口定义 (`../types/map-provider.ts`)
- `MapProvider`: 定义了所有地图提供者必须实现的接口
- `MapProviderType`: 支持的地图提供者类型
- `MapProviderFactory`: 地图提供者工厂接口

### 2. 当前实现
- `MapboxProvider`: Mapbox地图的实现
- `MapProviderFactoryImpl`: 提供者工厂实现

### 3. 配置支持
通过环境变量 `NEXT_PUBLIC_MAP_PROVIDER` 选择地图提供者：
- `mapbox`: 使用Mapbox地图（默认）
- `baidu`: 使用百度地图（未来支持）
- `google`: 使用Google地图（未来支持）

## 使用方法

### 1. 环境配置
```bash
# 选择地图提供者
NEXT_PUBLIC_MAP_PROVIDER=mapbox

# Mapbox配置
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token
NEXT_PUBLIC_MAPBOX_STYLE=mapbox://styles/mapbox/streets-zh-v1
```

### 2. 代码中使用
```typescript
import { mapProviderFactory } from '@/lib/map-providers'
import { config } from '@/lib/config'

// 获取当前配置的地图提供者
const mapProvider = mapProviderFactory.createProvider(config.map.provider)

// 使用地图提供者
const results = await mapProvider.searchPlaces('东京', mapConfig)
```

## 添加新的地图提供者

### 1. 实现MapProvider接口
```typescript
export class BaiduProvider implements MapProvider {
    // 实现所有必需的方法
    async createMapInstance(container: HTMLElement, config: MapProviderConfig): Promise<any> {
        // 实现地图实例创建
    }
    
    // ... 其他方法
}
```

### 2. 注册到工厂
```typescript
// 在 MapProviderFactoryImpl 构造函数中
this.registerProvider('baidu', () => new BaiduProvider())
```

### 3. 更新配置
```typescript
// 在 config.ts 中添加配置
baidu: {
    accessToken: process.env.NEXT_PUBLIC_BAIDU_ACCESS_TOKEN || '',
    style: process.env.NEXT_PUBLIC_BAIDU_STYLE || 'normal',
}
```

## 优势

1. **解耦**: 地图逻辑与业务逻辑分离
2. **可扩展**: 轻松添加新的地图提供者
3. **配置化**: 通过环境变量切换地图提供者
4. **类型安全**: 完整的TypeScript类型支持
5. **向后兼容**: 现有代码无需修改

## 注意事项

- 每个地图提供者需要实现完整的MapProvider接口
- 地图样式和API调用方式可能不同，需要适配
- 确保所有提供者都支持相同的功能集
- 测试时需要在不同提供者之间切换验证
