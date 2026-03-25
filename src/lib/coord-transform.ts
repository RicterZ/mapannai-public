/**
 * 坐标系转换工具
 *
 * WGS-84：GPS 标准坐标系，MapLibre / 数据库统一使用
 * GCJ-02：中国火星坐标系，Google Maps 在中国境内使用
 *
 * 参考：https://github.com/wandergis/coordtransform
 */

const A = 6378245.0
const EE = 0.00669342162296594323

/** 判断坐标是否在中国境内（与 Google GCJ-02 偏移范围一致的标准矩形判断） */
export function isInChina(lng: number, lat: number): boolean {
    return lng >= 72.004 && lng <= 137.8347 && lat >= 0.8293 && lat <= 55.8271
}

function transformLat(lng: number, lat: number): number {
    let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat +
        0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng))
    ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0
    ret += (20.0 * Math.sin(lat * Math.PI) + 40.0 * Math.sin(lat / 3.0 * Math.PI)) * 2.0 / 3.0
    ret += (160.0 * Math.sin(lat / 12.0 * Math.PI) + 320.0 * Math.sin(lat * Math.PI / 30.0)) * 2.0 / 3.0
    return ret
}

function transformLng(lng: number, lat: number): number {
    let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng +
        0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng))
    ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0
    ret += (20.0 * Math.sin(lng * Math.PI) + 40.0 * Math.sin(lng / 3.0 * Math.PI)) * 2.0 / 3.0
    ret += (150.0 * Math.sin(lng / 12.0 * Math.PI) + 300.0 * Math.sin(lng / 30.0 * Math.PI)) * 2.0 / 3.0
    return ret
}

/** WGS-84 → GCJ-02，境外坐标原样返回 */
export function wgs84ToGcj02(lng: number, lat: number): { longitude: number; latitude: number } {
    if (!isInChina(lng, lat)) return { longitude: lng, latitude: lat }

    const radLat = (lat / 180.0) * Math.PI
    const magic = Math.sin(radLat)
    const sqrtMagic = Math.sqrt(1 - EE * magic * magic)

    let dLat = transformLat(lng - 105.0, lat - 35.0)
    let dLng = transformLng(lng - 105.0, lat - 35.0)

    dLat = (dLat * 180.0) / (((A * (1 - EE)) / (sqrtMagic * sqrtMagic * sqrtMagic)) * Math.PI)
    dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * Math.PI)

    return { longitude: lng + dLng, latitude: lat + dLat }
}

/** GCJ-02 → WGS-84（单步近似逆变换，误差 < 1m），境外坐标原样返回 */
export function gcj02ToWgs84(lng: number, lat: number): { longitude: number; latitude: number } {
    if (!isInChina(lng, lat)) return { longitude: lng, latitude: lat }

    const radLat = (lat / 180.0) * Math.PI
    const magic = Math.sin(radLat)
    const sqrtMagic = Math.sqrt(1 - EE * magic * magic)

    let dLat = transformLat(lng - 105.0, lat - 35.0)
    let dLng = transformLng(lng - 105.0, lat - 35.0)

    dLat = (dLat * 180.0) / (((A * (1 - EE)) / (sqrtMagic * sqrtMagic * sqrtMagic)) * Math.PI)
    dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * Math.PI)

    // 单步近似逆变换
    return { longitude: lng * 2 - (lng + dLng), latitude: lat * 2 - (lat + dLat) }
}
