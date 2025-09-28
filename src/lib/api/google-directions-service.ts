// Google Directions API 服务
// 用于获取步行路径数据，供 Mapbox 地图使用

export interface GoogleDirectionsRequest {
    origin: { lat: number; lng: number }
    destination: { lat: number; lng: number }
}

export interface GoogleDirectionsResponse {
    path: Array<{ lat: number; lng: number }>
    distance?: number
    duration?: number
}

class GoogleDirectionsService {
    private apiKey: string
    private isLoaded: boolean = false

    constructor() {
        this.apiKey = process.env.NEXT_PUBLIC_GOOGLE_ACCESS_TOKEN || ''
    }

    // 加载 Google Maps API
    private async loadGoogleMapsAPI(): Promise<void> {
        if (this.isLoaded) return

        return new Promise((resolve, reject) => {
            if (window.google && window.google.maps && window.google.maps.DirectionsService) {
                this.isLoaded = true
                resolve()
                return
            }

            // 检查是否已有脚本正在加载
            const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
            if (existingScript) {
                const checkLoaded = () => {
                    if (window.google && window.google.maps && window.google.maps.DirectionsService) {
                        this.isLoaded = true
                        resolve()
                    } else {
                        setTimeout(checkLoaded, 100)
                    }
                }
                checkLoaded()
                return
            }

            // 创建脚本元素
            const script = document.createElement('script')
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=directions&loading=async`
            script.async = true
            script.defer = true
            script.crossOrigin = 'anonymous'
            script.onload = () => {
                const checkAPIReady = () => {
                    if (window.google && window.google.maps && window.google.maps.DirectionsService) {
                        this.isLoaded = true
                        resolve()
                    } else {
                        setTimeout(checkAPIReady, 50)
                    }
                }
                setTimeout(checkAPIReady, 100)
            }
            script.onerror = () => {
                reject(new Error('Failed to load Google Maps API'))
            }
            document.head.appendChild(script)
        })
    }

    // 获取步行+公共交通路径
    async getWalkingRoute(request: GoogleDirectionsRequest): Promise<GoogleDirectionsResponse> {
        try {
            await this.loadGoogleMapsAPI()

            if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
                throw new Error('Google Maps Directions Service not available')
            }

            const directionsService = new window.google.maps.DirectionsService()
            
            const directionsRequest = {
                origin: request.origin,
                destination: request.destination,
                travelMode: window.google.maps.TravelMode.TRANSIT,
                transitOptions: {
                    modes: [window.google.maps.TransitMode.BUS, window.google.maps.TransitMode.SUBWAY, window.google.maps.TransitMode.TRAIN],
                    routingPreference: window.google.maps.TransitRoutePreference.FEWER_TRANSFERS
                },
                avoidHighways: false,
                avoidTolls: false
            }

            return new Promise((resolve, reject) => {
                directionsService.route(directionsRequest, (result: any, status: any) => {
                    if (status === window.google.maps.DirectionsStatus.OK && result && result.routes && result.routes.length > 0) {
                        const route = result.routes[0]
                        const path = route.overview_path || []
                        
                        // 转换坐标格式
                        const coordinates = path.map((point: any) => ({
                            lat: point.lat(),
                            lng: point.lng()
                        }))

                        resolve({
                            path: coordinates,
                            distance: route.legs?.[0]?.distance?.value,
                            duration: route.legs?.[0]?.duration?.value
                        })
                    } else {
                        // 如果公共交通路径失败，尝试步行路径作为备选
                        console.warn('公共交通路径失败，尝试步行路径:', status)
                        
                        const walkingRequest = {
                            origin: request.origin,
                            destination: request.destination,
                            travelMode: window.google.maps.TravelMode.WALKING,
                            avoidHighways: false,
                            avoidTolls: false
                        }
                        
                        directionsService.route(walkingRequest, (walkingResult: any, walkingStatus: any) => {
                            if (walkingStatus === window.google.maps.DirectionsStatus.OK && walkingResult && walkingResult.routes && walkingResult.routes.length > 0) {
                                const walkingRoute = walkingResult.routes[0]
                                const walkingPath = walkingRoute.overview_path || []
                                
                                const walkingCoordinates = walkingPath.map((point: any) => ({
                                    lat: point.lat(),
                                    lng: point.lng()
                                }))
                                
                                resolve({
                                    path: walkingCoordinates,
                                    distance: walkingRoute.legs?.[0]?.distance?.value,
                                    duration: walkingRoute.legs?.[0]?.duration?.value
                                })
                            } else {
                                // 如果步行路径也失败，返回直线路径
                                console.warn('步行路径也失败，使用直线路径:', walkingStatus)
                                resolve({
                                    path: [request.origin, request.destination]
                                })
                            }
                        })
                    }
                })
            })
        } catch (error) {
            console.error('Google Directions API 错误:', error)
            // 返回直线路径作为备选
            return {
                path: [request.origin, request.destination]
            }
        }
    }
}

// 导出单例实例
export const googleDirectionsService = new GoogleDirectionsService()
