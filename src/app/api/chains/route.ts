import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
    getAllMarkers,
    getMarkerById,
    upsertMarker,
} from '@/lib/db/marker-service';

// 获取所有行程链
export async function GET() {
  try {
    const featureCollection = getAllMarkers();
    const markers = featureCollection.features.map((feature) => {
      const properties = feature.properties;
      const metadata = properties.metadata || {};

      return {
        id: feature.id,
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

    const chainId = uuidv4();

    // 更新标记的next字段来创建链式连接
    for (let i = 0; i < markerIds.length - 1; i++) {
      const currentMarkerId = markerIds[i];
      const nextMarkerId = markerIds[i + 1];

      const feature = getMarkerById(currentMarkerId);
      if (feature) {
        const coordinates = feature.geometry.coordinates;
        const properties = { ...feature.properties };
        const updatedNext = [...(properties.next || [])];
        if (!updatedNext.includes(nextMarkerId)) {
          updatedNext.push(nextMarkerId);
        }
        properties.next = updatedNext;

        upsertMarker(currentMarkerId, coordinates[0], coordinates[1], properties);
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
