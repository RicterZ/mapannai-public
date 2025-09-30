/**
 * 计算两个经纬度坐标之间的距离（米）
 * 使用 Haversine 公式
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000 // 地球半径（米）
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  
  return distance
}

/**
 * 将角度转换为弧度
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * 检查两个坐标是否在指定距离范围内
 */
export function isWithinDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  maxDistance: number = 10 // 默认10米
): boolean {
  const distance = calculateDistance(lat1, lng1, lat2, lng2)
  return distance <= maxDistance
}
