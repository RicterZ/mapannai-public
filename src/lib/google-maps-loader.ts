// Google Maps API 动态加载器
// 用于在需要时动态加载 Google Maps API，支持混合搜索功能

interface GoogleMapsLoaderOptions {
    apiKey: string
    libraries?: string[]
    language?: string
    region?: string
}

class GoogleMapsLoader {
    private static instance: GoogleMapsLoader
    private isLoaded = false
    private isLoading = false
    private loadPromise: Promise<void> | null = null

    private constructor() {}

    static getInstance(): GoogleMapsLoader {
        if (!GoogleMapsLoader.instance) {
            GoogleMapsLoader.instance = new GoogleMapsLoader()
        }
        return GoogleMapsLoader.instance
    }

    async loadAPI(options: GoogleMapsLoaderOptions): Promise<void> {
        // 如果已经加载，直接返回
        if (this.isLoaded && window.google && window.google.maps) {
            return Promise.resolve()
        }

        // 如果正在加载，返回现有的 Promise
        if (this.isLoading && this.loadPromise) {
            return this.loadPromise
        }

        // 开始加载
        this.isLoading = true
        this.loadPromise = this._loadScript(options)
        
        try {
            await this.loadPromise
            this.isLoaded = true
            this.isLoading = false
        } catch (error) {
            this.isLoading = false
            this.loadPromise = null
            throw error
        }
    }

    private _loadScript(options: GoogleMapsLoaderOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            // 检查是否已经存在 Google Maps 脚本
            const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
            if (existingScript) {
                // 如果脚本已存在，等待加载完成
                const checkLoaded = () => {
                    if (window.google && window.google.maps) {
                        resolve()
                    } else {
                        setTimeout(checkLoaded, 100)
                    }
                }
                checkLoaded()
                return
            }

            // 构建 API URL
            const libraries = options.libraries || ['places']
            const language = options.language || 'zh-CN'
            const region = options.region || 'JP'
            
            const script = document.createElement('script')
            script.src = `https://maps.googleapis.com/maps/api/js?key=${options.apiKey}&libraries=${libraries.join(',')}&language=${language}&region=${region}&callback=initGoogleMaps`
            
            // 设置全局回调函数
            window.initGoogleMaps = () => {
                resolve()
            }

            script.onerror = () => {
                reject(new Error('Failed to load Google Maps API'))
            }

            document.head.appendChild(script)
        })
    }

    isAPILoaded(): boolean {
        return this.isLoaded && !!(window.google && window.google.maps)
    }

    // 检查特定的 Google Maps 组件是否可用
    isComponentAvailable(component: string): boolean {
        if (!this.isAPILoaded()) return false
        
        const components = component.split('.')
        let current = window.google
        
        for (const comp of components) {
            if (!current || !current[comp]) {
                return false
            }
            current = current[comp]
        }
        
        return true
    }
}

export const googleMapsLoader = GoogleMapsLoader.getInstance()

// 便捷函数：加载 Google Maps API 用于搜索
export async function loadGoogleMapsForSearch(apiKey: string): Promise<void> {
    return googleMapsLoader.loadAPI({
        apiKey,
        libraries: ['places'],
        language: 'zh-CN',
        region: 'JP'
    })
}

// 便捷函数：检查 Google Maps API 是否已加载
export function isGoogleMapsLoaded(): boolean {
    return googleMapsLoader.isAPILoaded()
}

// 便捷函数：检查 Places API 是否可用
export function isPlacesAPIAvailable(): boolean {
    return googleMapsLoader.isComponentAvailable('maps.places.PlacesService')
}
