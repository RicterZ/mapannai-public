import { NextRequest, NextResponse } from 'next/server';

// 获取地点详情
export async function GET(
  request: NextRequest,
  { params }: { params: { placeId: string } }
) {
  try {
    // 这里可以集成Google Places API或其他地点服务
    // 目前返回模拟数据
    const placeDetails = {
      placeId: params.placeId,
      name: '示例地点',
      address: '示例地址',
      phone: '+81-3-1234-5678',
      website: 'https://example.com',
      rating: 4.5,
      priceLevel: 2,
      openingHours: {
        openNow: true,
        periods: [
          { open: { day: 0, time: '0900' }, close: { day: 0, time: '1800' } }
        ]
      },
      photos: [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg'
      ],
      reviews: [
        {
          author: '用户1',
          rating: 5,
          text: '很棒的地方！',
          time: new Date().toISOString()
        }
      ]
    };

    return NextResponse.json(placeDetails);
  } catch (error) {
    console.error('获取地点详情失败:', error);
    return NextResponse.json(
      { error: '获取地点详情失败' },
      { status: 500 }
    );
  }
}
