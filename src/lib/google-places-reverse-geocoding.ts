// Google Maps 反向地理编码服务
// 通过坐标获取 placeId 和地点信息

interface ReverseGeocodingResult {
    placeId?: string
    name?: string
    address?: string
    types?: string[]
}

/**
 * 通过坐标获取 Google Maps placeId
 * @param latitude 纬度
 * @param longitude 经度
 * @param apiKey Google Maps API 密钥
 * @returns Promise<ReverseGeocodingResult>
 */
export async function getPlaceIdFromCoordinates(
    latitude: number, 
    longitude: number, 
    apiKey: string
): Promise<ReverseGeocodingResult> {
    try {
        // 检查 Google Maps API 是否已加载
        if (!window.google || !window.google.maps) {
            // 这里可以尝试动态加载 API，但为了简化，我们直接返回空结果
            return {}
        }

        // 使用 Google Maps Geocoder 进行反向地理编码
        const geocoder = new window.google.maps.Geocoder()
        
        const latLng = new window.google.maps.LatLng(latitude, longitude)
        
        return new Promise((resolve, reject) => {
            geocoder.geocode({ 
                location: latLng,
                language: 'zh-CN'  // 设置语言为中文
            }, (results: any, status: any) => {
                if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
                    // 获取第一个结果（通常是最精确的）
                    const result = results[0]
                    
                    const placeInfo: ReverseGeocodingResult = {
                        placeId: result.place_id,
                        name: result.formatted_address,
                        address: result.formatted_address,
                        types: result.types
                    }
                    
                    
                    resolve(placeInfo)
                } else {
                    resolve({})
                }
            })
        })
    } catch (error) {
        console.error('获取 placeId 时出错:', error)
        return {}
    }
}

/**
 * 使用 Places API 获取更详细的地点信息
 * @param latitude 纬度
 * @param longitude 经度
 * @param apiKey Google Maps API 密钥
 * @returns Promise<ReverseGeocodingResult>
 */
export async function getPlaceDetailsFromCoordinates(
    latitude: number, 
    longitude: number, 
    apiKey: string
): Promise<ReverseGeocodingResult> {
    try {
        // 检查 Google Maps API 是否已加载
        if (!window.google || !window.google.maps) {
            console.log('Google Maps API 未加载')
            return {}
        }

        // 首先获取 placeId
        const placeIdResult = await getPlaceIdFromCoordinates(latitude, longitude, apiKey)
        
        if (!placeIdResult.placeId) {
            return placeIdResult
        }

        // 使用 Places API 获取详细信息
        const service = new window.google.maps.places.PlacesService(document.createElement('div'))
        
        return new Promise((resolve, reject) => {
            service.getDetails({
                placeId: placeIdResult.placeId,
                fields: ['name', 'formatted_address', 'place_id', 'types', 'geometry', 'rating', 'user_ratings_total'],
                language: 'zh-CN'  // 设置语言为中文
            }, (place: any, status: any) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
                    const detailedInfo: ReverseGeocodingResult = {
                        placeId: place.place_id,
                        name: place.name,
                        address: place.formatted_address,
                        types: place.types
                    }
                    
                    
                    resolve(detailedInfo)
                } else {
                    resolve(placeIdResult) // 返回基本信息
                }
            })
        })
    } catch (error) {
        console.error('获取详细地点信息时出错:', error)
        return {}
    }
}
