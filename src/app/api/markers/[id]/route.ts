import { NextRequest, NextResponse } from 'next/server';
import { useMapStore } from '@/store/map-store';

// 获取特定标记
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const store = useMapStore.getState();
    const marker = store.markers.find(m => m.id === params.id);
    
    if (!marker) {
      return NextResponse.json(
        { error: '标记未找到' },
        { status: 404 }
      );
    }

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

    const store = useMapStore.getState();
    const marker = store.markers.find(m => m.id === params.id);
    
    if (!marker) {
      return NextResponse.json(
        { error: '标记未找到' },
        { status: 404 }
      );
    }

    store.updateMarkerContent(params.id, {
      title,
      headerImage,
      markdownContent,
    });

    const updatedMarker = store.markers.find(m => m.id === params.id);
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
    const store = useMapStore.getState();
    const marker = store.markers.find(m => m.id === params.id);
    
    if (!marker) {
      return NextResponse.json(
        { error: '标记未找到' },
        { status: 404 }
      );
    }

    store.deleteMarker(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除标记失败:', error);
    return NextResponse.json(
      { error: '删除标记失败' },
      { status: 500 }
    );
  }
}
