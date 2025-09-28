import { NextRequest, NextResponse } from 'next/server';
import { useMapStore } from '@/store/map-store';
import { Marker, MarkerIconType } from '@/types/marker';
import { v4 as uuidv4 } from 'uuid';

// 获取所有标记
export async function GET() {
  try {
    const store = useMapStore.getState();
    await store.loadMarkersFromDataset();
    const markers = store.markers;
    
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

    const store = useMapStore.getState();
    const markerId = store.addMarker(coordinates, content);
    
    // 更新标记的标题和图标类型
    const marker = store.markers.find(m => m.id === markerId);
    if (marker) {
      store.updateMarker(markerId, {
        content: {
          ...marker.content,
          title,
          iconType: iconType as MarkerIconType,
        }
      });
    }

    const updatedMarker = store.markers.find(m => m.id === markerId);
    return NextResponse.json(updatedMarker);
  } catch (error) {
    console.error('创建标记失败:', error);
    return NextResponse.json(
      { error: '创建标记失败' },
      { status: 500 }
    );
  }
}
