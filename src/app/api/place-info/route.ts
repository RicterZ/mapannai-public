import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic';

/**
 * POST - 根据坐标获取地点信息（placeId和详细信息）
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { latitude, longitude } = body

        if (!latitude || !longitude) {
            return NextResponse.json(
                { error: '需要提供坐标信息' },
                { status: 400 }
            )
        }

        const apiKey = config.map.google.accessToken
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Google API Key 未配置' },
                { status: 500 }
            )
        }

        // 第一步：使用 Reverse Geocoding API 获取地点信息
        const reverseGeocodeUrl = `${config.map.google.baseUrl}/maps/api/geocode/json`
        const reverseGeocodeParams = new URLSearchParams({
            latlng: `${latitude},${longitude}`,
            key: apiKey,
            language: 'zh-CN'
        })

        const reverseGeocodeResponse = await fetch(`${reverseGeocodeUrl}?${reverseGeocodeParams}`)
        
        if (!reverseGeocodeResponse.ok) {
            throw new Error(`Google Reverse Geocoding API 请求失败: ${reverseGeocodeResponse.status}`)
        }

        const reverseGeocodeData = await reverseGeocodeResponse.json()
        
        if (reverseGeocodeData.status !== 'OK') {
            throw new Error(`Google Reverse Geocoding API 错误: ${reverseGeocodeData.status} - ${reverseGeocodeData.error_message || 'Unknown error'}`)
        }

        // 获取第一个结果
        const firstResult = reverseGeocodeData.results?.[0]
        if (!firstResult) {
            return NextResponse.json({
                success: true,
                data: {
                    name: '未知地点',
                    address: '无法获取地址信息',
                    placeId: null,
                    coordinates: { latitude, longitude }
                }
            })
        }

        // 提取基本信息
        const address = firstResult.formatted_address || '未知地址'
        const placeId = firstResult.place_id

        // 第二步：如果有 placeId，获取详细信息
        let detailedInfo = null
        if (placeId) {
            try {
                const placeDetailsUrl = `${config.map.google.baseUrl}/maps/api/place/details/json`
                const placeDetailsParams = new URLSearchParams({
                    place_id: placeId,
                    key: apiKey,
                    language: 'zh-CN',
                    fields: 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,price_level,opening_hours,types'
                })

                const placeDetailsResponse = await fetch(`${placeDetailsUrl}?${placeDetailsParams}`)
                
                if (placeDetailsResponse.ok) {
                    const placeDetailsData = await placeDetailsResponse.json()
                    
                    if (placeDetailsData.status === 'OK' && placeDetailsData.result) {
                        const result = placeDetailsData.result
                        detailedInfo = {
                            name: result.name || address,
                            address: result.formatted_address || address,
                            phone: result.formatted_phone_number,
                            website: result.website,
                            rating: result.rating,
                            user_ratings_total: result.user_ratings_total,
                            price_level: result.price_level,
                            opening_hours: result.opening_hours,
                            types: result.types
                        }
                    }
                }
            } catch (error) {
                console.warn('获取地点详细信息失败:', error)
                // 即使详细信息获取失败，也返回基本信息
            }
        }

        // 返回结果
        const result = {
            name: detailedInfo?.name || firstResult.formatted_address || '未知地点',
            address: detailedInfo?.address || address,
            placeId: placeId,
            coordinates: { latitude, longitude },
            phone: detailedInfo?.phone,
            website: detailedInfo?.website,
            rating: detailedInfo?.rating,
            user_ratings_total: detailedInfo?.user_ratings_total,
            price_level: detailedInfo?.price_level,
            opening_hours: detailedInfo?.opening_hours,
            types: detailedInfo?.types || firstResult.types
        }

        return NextResponse.json({
            success: true,
            data: result
        })

    } catch (error) {
        console.error('获取地点信息失败:', error)
        return NextResponse.json(
            { 
                success: false,
                error: '获取地点信息失败', 
                details: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        )
    }
}
