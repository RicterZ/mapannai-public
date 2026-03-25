import { NextRequest, NextResponse } from 'next/server';
import { Marker, MarkerIconType } from '@/types/marker';
import {
    getAllMarkers,
    upsertMarker,
    findNearbyMarker,
    generateCoordinateHash,
} from '@/lib/db/marker-service';

// 获取所有标记
export async function GET() {
  try {
    const featureCollection = getAllMarkers();
    const markers = featureCollection.features
      .filter((feature) => {
        return feature &&
          feature.id &&
          feature.geometry &&
          feature.geometry.coordinates &&
          Array.isArray(feature.geometry.coordinates) &&
          feature.geometry.coordinates.length >= 2;
      })
      .map((feature) => {
        const coordinates = feature.geometry.coordinates;
        const properties = feature.properties;
        const metadata = properties.metadata || {};

        const markerId = feature.id;

        return {
          id: markerId,
          coordinates: {
            latitude: coordinates[1],
            longitude: coordinates[0],
          },
          content: {
            id: markerId,
            title: metadata.title || '未命名标记',
            address: properties.address || undefined,
            headerImage: properties.headerImage || undefined,
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
    const { coordinates, title, iconType, address, content } = body;

    if (!coordinates || !title || !iconType) {
      return NextResponse.json(
        { error: '缺少必需参数: coordinates, title, iconType' },
        { status: 400 }
      );
    }

    const coordinateHash = generateCoordinateHash(coordinates.longitude, coordinates.latitude);
    const coordinateBasedId = `coord_${coordinateHash}`;

    // 检查是否存在相近的标记（10米范围内，哈希优先）
    const existing =
        findNearbyMarker(coordinates.longitude, coordinates.latitude, 10);

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
    const now = new Date();
    const properties = {
      markdownContent: content || '',
      headerImage: null,
      address: address || null,
      iconType: iconType as MarkerIconType,
      next: [],
      metadata: {
        id: coordinateBasedId,
        title: title || '新标记',
        description: '用户创建的标记',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        isPublished: true,
        coordinateHash,
      },
    };

    const feature = upsertMarker(coordinateBasedId, coordinates.longitude, coordinates.latitude, properties);
    const meta = feature.properties.metadata || {};

    const marker: Marker = {
      id: feature.id,
      coordinates: {
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
      },
      content: {
        id: feature.id,
        title: meta.title || '新标记',
        address: feature.properties.address || undefined,
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
