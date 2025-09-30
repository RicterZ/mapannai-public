import { NextRequest, NextResponse } from 'next/server';
import { useMapStore } from '@/store/map-store';
import { Marker, MarkerIconType } from '@/types/marker';
import { v4 as uuidv4 } from 'uuid';
import { datasetService } from '@/lib/api/dataset-service';
import { config } from '@/lib/config';
import { isWithinDistance } from '@/utils/distance';

// 获取所有标记
export async function GET() {
  try {
    const datasetId = config.map.mapbox.dataset?.datasetId;
    if (!datasetId) {
      return NextResponse.json(
        { error: '未配置数据集ID' },
        { status: 500 }
      );
    }

    const featureCollection = await datasetService.getAllFeatures(datasetId);
    const markers = featureCollection.features
      .filter((feature: any) => {
        const hasValidId = feature.id || feature.properties?.metadata?.id;
        return feature &&
          hasValidId &&
          feature.geometry &&
          feature.geometry.coordinates &&
          Array.isArray(feature.geometry.coordinates) &&
          feature.geometry.coordinates.length >= 2 &&
          feature.properties;
      })
      .map((feature: any) => {
        const coordinates = feature.geometry.coordinates;
        const properties = feature.properties;
        const metadata = properties.metadata || {};

        const markerId = feature.id || metadata.id || `marker-${Date.now()}-${Math.random()}`;

        return {
          id: markerId,
          coordinates: {
            latitude: coordinates[1],
            longitude: coordinates[0],
          },
          content: {
            id: metadata.id || markerId,
            title: metadata.title || '未命名标记',
            headerImage: properties.headerImage,
            iconType: properties.iconType,
            markdownContent: properties.markdownContent || '',
            next: properties.next || [],
            createdAt: metadata.createdAt ? new Date(metadata.createdAt) : new Date(),
            updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : new Date(),
          },
        };
      });
    
    return NextResponse.json(markers);
  } catch (error) {
    console.error('获取标记失败:', error);
    return NextResponse.json(
      { error: '获取标记失败' },
      { status: 500 }
    );
  }
}

// 创建新标记
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coordinates, title, iconType, content } = body;

    if (!coordinates || !title || !iconType) {
      return NextResponse.json(
        { error: '缺少必需参数: coordinates, title, iconType' },
        { status: 400 }
      );
    }

    // 检查是否存在相近的标记（10米范围内）
    const datasetId = config.map.mapbox.dataset?.datasetId;
    if (datasetId) {
      try {
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
          // 找到相近标记，直接返回现有标记信息，客户端无感知
          const existingMarker = {
            id: nearbyMarker.id,
            coordinates: {
              latitude: nearbyMarker.geometry.coordinates[1],
              longitude: nearbyMarker.geometry.coordinates[0],
            },
            content: {
              id: nearbyMarker.id,
              title: nearbyMarker.properties?.metadata?.title || '未命名标记',
              iconType: nearbyMarker.properties?.iconType || 'location',
              markdownContent: nearbyMarker.properties?.markdownContent || '',
              next: nearbyMarker.properties?.next || [],
              createdAt: nearbyMarker.properties?.metadata?.createdAt 
                ? new Date(nearbyMarker.properties.metadata.createdAt) 
                : new Date(),
              updatedAt: nearbyMarker.properties?.metadata?.updatedAt 
                ? new Date(nearbyMarker.properties.metadata.updatedAt) 
                : new Date(),
            },
          };

          return NextResponse.json(existingMarker);
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
        title,
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
        },
      };

      await datasetService.upsertFeature(datasetId, markerId, coordinates, properties);
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
