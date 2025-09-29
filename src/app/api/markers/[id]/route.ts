import { NextRequest, NextResponse } from 'next/server';
import { useMapStore } from '@/store/map-store';
import { datasetService } from '@/lib/api/dataset-service';
import { config } from '@/lib/config';

// 获取特定标记
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const datasetId = config.map.mapbox.dataset?.datasetId;
    if (!datasetId) {
      return NextResponse.json(
        { error: '未配置数据集ID' },
        { status: 500 }
      );
    }

    const featureCollection = await datasetService.getAllFeatures(datasetId);
    const feature = featureCollection.features.find(f => f.id === params.id);
    
    if (!feature) {
      return NextResponse.json(
        { error: '标记未找到' },
        { status: 404 }
      );
    }

    // 转换为Marker格式
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
        headerImage: properties.headerImage,
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
    const { title, headerImage, markdownContent } = body;

    const datasetId = config.map.mapbox.dataset?.datasetId;
    if (!datasetId) {
      return NextResponse.json(
        { error: '未配置数据集ID' },
        { status: 500 }
      );
    }

    const featureCollection = await datasetService.getAllFeatures(datasetId);
    const feature = featureCollection.features.find(f => f.id === params.id);
    
    if (!feature) {
      return NextResponse.json(
        { error: '标记未找到' },
        { status: 404 }
      );
    }

    // 更新属性
    const coordinates = { 
      latitude: feature.geometry.coordinates[1], 
      longitude: feature.geometry.coordinates[0] 
    };
    const properties = { ...feature.properties };
    const metadata = { ...properties.metadata };
    
    if (title) metadata.title = title;
    if (headerImage) properties.headerImage = headerImage;
    if (markdownContent) properties.markdownContent = markdownContent;
    
    metadata.updatedAt = new Date().toISOString();
    properties.metadata = metadata;

    // 直接更新数据集
    await datasetService.upsertFeature(datasetId, params.id, coordinates, properties);

    // 返回更新后的标记
    const updatedMarker = {
      id: feature.id,
      coordinates,
      content: {
        id: metadata.id || feature.id,
        title: metadata.title || '未命名标记',
        headerImage: properties.headerImage,
        iconType: properties.iconType,
        markdownContent: properties.markdownContent || '',
        next: properties.next || [],
        createdAt: metadata.createdAt ? new Date(metadata.createdAt) : new Date(),
        updatedAt: new Date(metadata.updatedAt),
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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const datasetId = config.map.mapbox.dataset?.datasetId;
    if (!datasetId) {
      return NextResponse.json(
        { error: '未配置数据集ID' },
        { status: 500 }
      );
    }

    const featureCollection = await datasetService.getAllFeatures(datasetId);
    const feature = featureCollection.features.find(f => f.id === params.id);
    
    if (!feature) {
      return NextResponse.json(
        { error: '标记未找到' },
        { status: 404 }
      );
    }

    // 直接从数据集删除
    await datasetService.deleteFeature(datasetId, params.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除标记失败:', error);
    return NextResponse.json(
      { error: '删除标记失败' },
      { status: 500 }
    );
  }
}
