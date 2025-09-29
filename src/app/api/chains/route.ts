import { NextRequest, NextResponse } from 'next/server';
import { useMapStore } from '@/store/map-store';
import { v4 as uuidv4 } from 'uuid';
import { datasetService } from '@/lib/api/dataset-service';
import { config } from '@/lib/config';

// 获取所有行程链
export async function GET() {
  try {
    // 直接从数据集获取标记数据
    const datasetId = config.map.mapbox.dataset?.datasetId;
    if (!datasetId) {
      return NextResponse.json(
        { error: '未配置数据集ID' },
        { status: 500 }
      );
    }

    const featureCollection = await datasetService.getAllFeatures(datasetId);
    const markers = featureCollection.features.map((feature: any) => {
      const coordinates = feature.geometry.coordinates;
      const properties = feature.properties;
      const metadata = properties.metadata || {};

      return {
        id: feature.id || metadata.id,
        content: {
          title: metadata.title || '未命名标记',
          next: properties.next || [],
        },
      };
    });
    
    // 从标记中提取行程链信息
    const chains = markers
      .filter(marker => marker.content.next && marker.content.next.length > 0)
      .map(marker => ({
        id: marker.id,
        name: marker.content.title || '未命名行程',
        description: `从 ${marker.content.title} 开始的行程`,
        markerIds: [marker.id, ...marker.content.next],
        startMarker: marker.id,
      }));

    return NextResponse.json(chains);
  } catch (error) {
    console.error('获取行程链失败:', error);
    return NextResponse.json(
      { error: '获取行程链失败' },
      { status: 500 }
    );
  }
}

// 创建新行程链
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { markerIds, name, description } = body;

    if (!markerIds || !Array.isArray(markerIds) || markerIds.length < 2) {
      return NextResponse.json(
        { error: '行程链至少需要2个标记点' },
        { status: 400 }
      );
    }

    const datasetId = config.map.mapbox.dataset?.datasetId;
    if (!datasetId) {
      return NextResponse.json(
        { error: '未配置数据集ID' },
        { status: 500 }
      );
    }

    const chainId = uuidv4();
    
    // 直接更新数据集中的标记
    const featureCollection = await datasetService.getAllFeatures(datasetId);
    
    // 更新标记的next字段来创建链式连接
    for (let i = 0; i < markerIds.length - 1; i++) {
      const currentMarkerId = markerIds[i];
      const nextMarkerId = markerIds[i + 1];
      
      const feature = featureCollection.features.find(f => f.id === currentMarkerId);
      if (feature) {
        const coordinates = { 
          latitude: feature.geometry.coordinates[1], 
          longitude: feature.geometry.coordinates[0] 
        };
        const properties = { ...feature.properties };
        const updatedNext = [...(properties.next || []), nextMarkerId];
        properties.next = updatedNext;
        
        // 更新数据集中的特征
        await datasetService.upsertFeature(datasetId, currentMarkerId, coordinates, properties);
      }
    }

    const chain = {
      id: chainId,
      name: name || `行程链 ${new Date().toLocaleString()}`,
      description: description || 'AI创建的智能行程',
      markerIds,
    };

    return NextResponse.json(chain);
  } catch (error) {
    console.error('创建行程链失败:', error);
    return NextResponse.json(
      { error: '创建行程链失败' },
      { status: 500 }
    );
  }
}
