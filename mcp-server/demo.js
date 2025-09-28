#!/usr/bin/env node

/**
 * Mapannai MCP Server 演示脚本
 * 展示如何使用MCP工具创建旅游计划
 */

import { MapannaiApiClient } from './dist/api-client.js';

// 配置
const API_URL = process.env.MAPANNAI_API_URL || 'http://localhost:3000';
const API_KEY = process.env.MAPANNAI_API_KEY || '';

async function demo() {
  console.log('🎯 Mapannai MCP Server 演示');
  console.log('===============================\n');

  const client = new MapannaiApiClient(API_URL, API_KEY);

  try {
    // 1. 创建京都主要景点标记
    console.log('📍 创建京都景点标记...');
    
    const kyotoAttractions = [
      {
        coordinates: { latitude: 35.0116, longitude: 135.7681 },
        title: '清水寺',
        iconType: 'landmark',
        content: '京都最著名的寺庙之一，以清水舞台闻名'
      },
      {
        coordinates: { latitude: 35.0394, longitude: 135.7299 },
        title: '金阁寺',
        iconType: 'landmark',
        content: '金光闪闪的寺庙，京都的象征'
      },
      {
        coordinates: { latitude: 35.0162, longitude: 135.6756 },
        title: '岚山',
        iconType: 'natural',
        content: '以竹林和红叶闻名的自然景观'
      }
    ];

    const markers = [];
    for (const attraction of kyotoAttractions) {
      const marker = await client.createMarker(attraction);
      markers.push(marker);
      console.log(`✅ 创建标记: ${marker.content.title}`);
    }

    // 2. 更新标记内容
    console.log('\n📝 更新标记详细内容...');
    
    const detailedContent = `
# 清水寺

## 基本信息
- **门票价格**: 400日元
- **开放时间**: 6:00-18:00
- **最佳游览时间**: 早上8点前（避开人群）

## 游览建议
- 建议游览时间：2-3小时
- 需要脱鞋进入主殿
- 可以购买御守和护身符
- 秋季红叶季节最美

## 交通信息
- 从京都站乘坐巴士约15分钟
- 巴士站：清水道站

## 周边推荐
- 二年坂三年坂：传统街道
- 八坂神社：步行5分钟
- 祇园：传统艺伎区
`;

    await client.updateMarkerContent({
      markerId: markers[0].id,
      title: '清水寺',
      markdownContent: detailedContent
    });
    console.log('✅ 更新清水寺详细信息');

    // 3. 创建行程链
    console.log('\n🔗 创建京都一日游行程链...');
    
    const chain = await client.createChain({
      markerIds: markers.map(m => m.id),
      chainName: '京都经典一日游',
      description: '包含清水寺、金阁寺、岚山的经典路线'
    });
    console.log(`✅ 创建行程链: ${chain.name}`);

    // 4. 搜索美食地点
    console.log('\n🔍 搜索京都美食...');
    
    const foodPlaces = await client.searchPlaces('京都 传统料理');
    console.log(`✅ 找到 ${foodPlaces.length} 个美食地点`);

    // 5. 获取所有标记
    console.log('\n📌 当前所有标记:');
    const allMarkers = await client.getMarkers();
    allMarkers.forEach((marker, index) => {
      console.log(`${index + 1}. ${marker.content.title} (${marker.content.iconType})`);
    });

    console.log('\n🎉 演示完成！');
    console.log('现在你可以在Mapannai应用中看到创建的标记和行程链。');

  } catch (error) {
    console.error('❌ 演示过程中出现错误:', error.message);
    console.log('\n请确保:');
    console.log('1. Mapannai应用正在运行 (http://localhost:3000)');
    console.log('2. MCP Server已正确配置');
    console.log('3. API密钥有效');
  }
}

// 运行演示
demo();
