import { NextRequest, NextResponse } from 'next/server';
import {
    getMarkerById,
    upsertMarker,
    deleteMarker,
} from '@/lib/db/marker-service';

// 获取特定标记
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const feature = getMarkerById(params.id);

    if (!feature) {
      return NextResponse.json(
        { error: '标记未找到' },
        { status: 404 }
      );
    }

    const coordinates = feature.geometry.coordinates;
    const properties = feature.properties;
    const metadata = properties.metadata || {};

    const marker = {
      id: feature.id,
      coordinates: {
        latitude: coordinates[1],
        longitude: coordinates[0],
      },
      content: {
        id: metadata.id || feature.id,
        title: metadata.title || '未命名标记',
        headerImage: properties.headerImage || undefined,
        iconType: properties.iconType,
        markdownContent: properties.markdownContent || '',
        next: properties.next || [],
        createdAt: metadata.createdAt ? new Date(metadata.createdAt) : new Date(),
        updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : new Date(),
      },
    };

    return NextResponse.json(marker);
  } catch (error) {
    console.error('获取标记失败:', error);
    return NextResponse.json(
      { error: '获取标记失败' },
      { status: 500 }
    );
  }
}

// 更新标记
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { title, headerImage, markdownContent, iconType } = body;

    const feature = getMarkerById(params.id);

    if (!feature) {
      return NextResponse.json(
        { error: '标记未找到' },
        { status: 404 }
      );
    }

    const coordinates = feature.geometry.coordinates;
    const existingProps = feature.properties;
    const existingMeta = existingProps.metadata || {};

    const now = new Date();
    const updatedProperties = {
      ...existingProps,
      headerImage: headerImage !== undefined ? headerImage : existingProps.headerImage,
      markdownContent: markdownContent !== undefined ? markdownContent : existingProps.markdownContent,
      iconType: iconType !== undefined ? iconType : existingProps.iconType,
      metadata: {
        ...existingMeta,
        title: title !== undefined ? title : existingMeta.title,
        updatedAt: now.toISOString(),
      },
    };

    const updated = upsertMarker(params.id, coordinates[0], coordinates[1], updatedProperties);
    const updatedMeta = updated.properties.metadata || {};

    const updatedMarker = {
      id: updated.id,
      coordinates: {
        latitude: updated.geometry.coordinates[1],
        longitude: updated.geometry.coordinates[0],
      },
      content: {
        id: updatedMeta.id || updated.id,
        title: updatedMeta.title || '未命名标记',
        headerImage: updated.properties.headerImage || undefined,
        iconType: updated.properties.iconType,
        markdownContent: updated.properties.markdownContent || '',
        next: updated.properties.next || [],
        createdAt: updatedMeta.createdAt ? new Date(updatedMeta.createdAt) : new Date(),
        updatedAt: new Date(updatedMeta.updatedAt),
      },
    };

    return NextResponse.json(updatedMarker);
  } catch (error) {
    console.error('更新标记失败:', error);
    return NextResponse.json(
      { error: '更新标记失败' },
      { status: 500 }
    );
  }
}

// 删除标记
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const feature = getMarkerById(params.id);

    if (!feature) {
      return NextResponse.json(
        { error: '标记未找到' },
        { status: 404 }
      );
    }

    deleteMarker(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除标记失败:', error);
    return NextResponse.json(
      { error: '删除标记失败' },
      { status: 500 }
    );
  }
}
