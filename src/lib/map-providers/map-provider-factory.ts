import { MapProvider, MapProviderType, MapProviderFactory } from '@/types/map-provider'
import { MapboxProvider } from './mapbox-provider'

export class MapProviderFactoryImpl implements MapProviderFactory {
    private providers: Map<MapProviderType, () => MapProvider> = new Map()

    constructor() {
        this.registerProvider('mapbox', () => new MapboxProvider())
        // 未来可以注册其他地图提供者
        // this.registerProvider('baidu', () => new BaiduProvider())
        // this.registerProvider('google', () => new GoogleProvider())
    }

    createProvider(type: MapProviderType): MapProvider {
        const providerFactory = this.providers.get(type)
        if (!providerFactory) {
            throw new Error(`Unsupported map provider: ${type}`)
        }
        return providerFactory()
    }

    getSupportedProviders(): MapProviderType[] {
        return Array.from(this.providers.keys())
    }

    private registerProvider(type: MapProviderType, factory: () => MapProvider): void {
        this.providers.set(type, factory)
    }
}

// 单例实例
export const mapProviderFactory = new MapProviderFactoryImpl()
