import { NextRequest, NextResponse } from 'next/server';
import { Marker, MarkerIconType } from '@/types/marker';
import {
    upsertMarker,
    findNearbyMarker,
    generateCoordinateHash,
} from '@/lib/db/marker-service';

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

    // 检查是否存在相近的标记（哈希 + 10米范围内）
    const existing = findNearbyMarker(coordinates.longitude, coordinates.latitude, 10);

    if (existing) {
      const meta = existing.properties.metadata || {};
      const marker = {
        id: existing.id,
        coordinates: {
          latitude: existing.geometry.coordinates[1],
          longitude: existing.geometry.coordinates[0],
        },
        content: {
          id: existing.id,
          title: meta.title || '未命名标记',
          iconType: existing.properties.iconType || 'location',
          markdownContent: existing.properties.markdownContent || '',
          next: existing.properties.next || [],
          createdAt: meta.createdAt ? new Date(meta.createdAt) : new Date(),
          updatedAt: meta.updatedAt ? new Date(meta.updatedAt) : new Date(),
        },
      };
      return NextResponse.json(marker);
    }

    // 创建新标记
    const coordinateHash = generateCoordinateHash(coordinates.longitude, coordinates.latitude);
    const featureId = `coord_${coordinateHash}`;
    const now = new Date();

    const properties = {
      markdownContent: content || '',
      headerImage: null,
      iconType: iconType as MarkerIconType,
      next: [],
      metadata: {
        id: featureId,
        title: name,
        description: '用户创建的标记',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        isPublished: true,
        coordinateHash,
      },
    };

    const feature = upsertMarker(featureId, coordinates.longitude, coordinates.latitude, properties);
    const meta = feature.properties.metadata || {};

    const marker: Marker = {
      id: feature.id,
      coordinates: {
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
      },
      content: {
        id: feature.id,
        title: name,
        iconType: feature.properties.iconType,
        markdownContent: feature.properties.markdownContent || '',

        createdAt: meta.createdAt ? new Date(meta.createdAt) : now,
        updatedAt: meta.updatedAt ? new Date(meta.updatedAt) : now,
      },
    };

    return NextResponse.json(marker);
  } catch (error) {
    console.error('创建标记失败:', error);
    return NextResponse.json(
      { error: '创建标记失败' },
      { status: 500 }
    );
  }
}
