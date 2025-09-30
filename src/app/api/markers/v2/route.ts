import { NextRequest, NextResponse } from 'next/server';
import { Marker, MarkerIconType } from '@/types/marker';
import { v4 as uuidv4 } from 'uuid';
import { datasetService } from '@/lib/api/dataset-service';
import { config } from '@/lib/config';
import { isWithinDistance } from '@/utils/distance';
import crypto from 'crypto';

// 生成坐标哈希，用于唯一标识
function generateCoordinateHash(latitude: number, longitude: number): string {
  const lat = Math.round(latitude * 1000000) / 1000000;
  const lng = Math.round(longitude * 1000000) / 1000000;
  return crypto.createHash('md5').update(`${lat},${lng}`).digest('hex');
}

// 搜索地点获取坐标
async function searchPlace(name: string): Promise<{latitude: number, longitude: number}> {
  const searchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/search?q=${encodeURIComponent(name)}&limit=1&language=zh-CN&country=JP`);
  
  if (!searchResponse.ok) {
    throw new Error(`搜索地点失败: ${searchResponse.status}`);
  }
  
  const searchResults = await searchResponse.json();
  if (!searchResults.data || searchResults.data.length === 0) {
    throw new Error('未找到该地点');
  }
  
  const place = searchResults.data[0];
  return {
    latitude: place.coordinates.latitude,
    longitude: place.coordinates.longitude
  };
}

// 创建新标记 (v2 - 通过地点名称)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, iconType, content } = body;

    if (!name || !iconType) {
      return NextResponse.json(
        { error: '缺少必需参数: name, iconType' },
        { status: 400 }
      );
    }

    // 搜索地点获取坐标
    const coordinates = await searchPlace(name);
    
    // 生成坐标哈希用于唯一标识
    const coordinateHash = generateCoordinateHash(coordinates.latitude, coordinates.longitude);
    
    // 检查是否存在相近的标记（10米范围内）
    const datasetId = config.map.mapbox.dataset?.datasetId;
    
    if (datasetId) {
      try {
        // 使用坐标哈希作为特征ID的一部分，确保唯一性
        const coordinateBasedId = `coord_${coordinateHash}`;
        
        // 首先尝试通过坐标哈希查找现有标记
        let existingMarker = null;
        try {
          const allFeatures = await datasetService.getAllFeatures(datasetId);
          const existingFeature = allFeatures.features.find(feature => feature.id === coordinateBasedId);
          if (existingFeature) {
            existingMarker = existingFeature;
          }
        } catch (error) {
          // 如果通过坐标哈希没找到，继续使用距离检查
        }
        
        // 如果坐标哈希没找到，使用距离检查作为备用方案
        if (!existingMarker) {
          const existingFeatures = await datasetService.getAllFeatures(datasetId);
          
          const nearbyMarker = existingFeatures.features.find(feature => {
            if (!feature.geometry || !feature.geometry.coordinates) return false;
            
            const [lng, lat] = feature.geometry.coordinates;
            
            return isWithinDistance(
              coordinates.latitude,
              coordinates.longitude,
              lat,
              lng,
              10 // 10米范围内
            );
          });
          
          if (nearbyMarker) {
            existingMarker = nearbyMarker;
          }
        }

        if (existingMarker) {
          // 找到相近标记，直接返回现有标记信息，客户端无感知
          const marker = {
            id: existingMarker.id,
            coordinates: {
              latitude: existingMarker.geometry.coordinates[1],
              longitude: existingMarker.geometry.coordinates[0],
            },
            content: {
              id: existingMarker.id,
              title: existingMarker.properties?.metadata?.title || '未命名标记',
              iconType: existingMarker.properties?.iconType || 'location',
              markdownContent: existingMarker.properties?.markdownContent || '',
              next: existingMarker.properties?.next || [],
              createdAt: existingMarker.properties?.metadata?.createdAt
                ? new Date(existingMarker.properties.metadata.createdAt)
                : new Date(),
              updatedAt: existingMarker.properties?.metadata?.updatedAt
                ? new Date(existingMarker.properties.metadata.updatedAt)
                : new Date(),
            },
          };

          return NextResponse.json(marker);
        }
      } catch (error) {
        console.warn('检查相近标记时出错，继续创建新标记:', error);
      }
    }

    // 创建标记对象
    const markerId = uuidv4();
    const now = new Date();
    const marker: Marker = {
      id: markerId,
      coordinates,
      content: {
        id: uuidv4(),
        title: name,
        iconType: iconType as MarkerIconType,
        markdownContent: content || '',
        next: [],
        createdAt: now,
        updatedAt: now,
      },
    };

    // 直接保存到数据集
    if (datasetId) {
      const properties = {
        markdownContent: marker.content.markdownContent,
        headerImage: marker.content.headerImage || null,
        iconType: marker.content.iconType || 'location',
        next: marker.content.next || [],
        metadata: {
          id: marker.id,
          title: marker.content.title || '新标记',
          description: '用户创建的标记',
          createdAt: marker.content.createdAt.toISOString(),
          updatedAt: marker.content.updatedAt.toISOString(),
          isPublished: true,
          coordinateHash: coordinateHash, // 添加坐标哈希到元数据
        },
      };

      // 使用坐标哈希作为特征ID，确保相同坐标的标记会被覆盖而不是重复创建
      const featureId = `coord_${coordinateHash}`;
      
      await datasetService.upsertFeature(datasetId, featureId, coordinates, properties);
      
      // 返回数据集中的实际特征ID
      marker.id = featureId;
      marker.content.id = featureId;
    }

    return NextResponse.json(marker);
  } catch (error) {
    console.error('创建标记失败:', error);
    return NextResponse.json(
      { error: '创建标记失败' },
      { status: 500 }
    );
  }
}
