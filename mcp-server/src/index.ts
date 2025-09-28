#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { MapannaiApiClient } from './api-client.js';
import { 
  CreateMarkerRequest, 
  UpdateMarkerContentRequest, 
  CreateChainRequest,
  TravelPlanRequest,
  TravelPlanResponse,
  MarkerIconType 
} from './types.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

class MapannaiMCPServer {
  private server: Server;
  private apiClient: MapannaiApiClient;

  constructor() {
    this.server = new Server(
      {
        name: 'mapannai-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 初始化API客户端
    const apiUrl = process.env.MAPANNAI_API_URL || 'http://localhost:3000';
    const apiKey = process.env.MAPANNAI_API_KEY || '';
    this.apiClient = new MapannaiApiClient(apiUrl, apiKey);

    this.setupHandlers();
  }

  private setupHandlers() {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_marker',
            description: '在地图上创建新的标记点',
            inputSchema: {
              type: 'object',
              properties: {
                coordinates: {
                  type: 'object',
                  properties: {
                    latitude: { type: 'number', description: '纬度' },
                    longitude: { type: 'number', description: '经度' }
                  },
                  required: ['latitude', 'longitude']
                },
                title: { type: 'string', description: '标记标题' },
                iconType: { 
                  type: 'string', 
                  enum: ['activity', 'location', 'hotel', 'shopping', 'food', 'landmark', 'park', 'natural', 'culture'],
                  description: '标记图标类型'
                },
                content: { type: 'string', description: '标记内容（可选）' }
              },
              required: ['coordinates', 'title', 'iconType']
            }
          },
          {
            name: 'update_marker_content',
            description: '更新标记的详细内容',
            inputSchema: {
              type: 'object',
              properties: {
                markerId: { type: 'string', description: '标记ID' },
                title: { type: 'string', description: '标记标题（可选）' },
                headerImage: { type: 'string', description: '头图URL（可选）' },
                markdownContent: { type: 'string', description: 'Markdown格式的详细内容' }
              },
              required: ['markerId', 'markdownContent']
            }
          },
          {
            name: 'create_travel_chain',
            description: '创建旅游行程链，连接多个标记点',
            inputSchema: {
              type: 'object',
              properties: {
                markerIds: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: '标记ID列表，按游览顺序排列'
                },
                chainName: { type: 'string', description: '行程链名称（可选）' },
                description: { type: 'string', description: '行程链描述（可选）' }
              },
              required: ['markerIds']
            }
          },
          {
            name: 'search_places',
            description: '搜索地点信息',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: '搜索关键词' },
                location: {
                  type: 'object',
                  properties: {
                    latitude: { type: 'number' },
                    longitude: { type: 'number' }
                  },
                  description: '搜索中心位置（可选）'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_markers',
            description: '获取所有标记',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_marker',
            description: '获取特定标记的详细信息',
            inputSchema: {
              type: 'object',
              properties: {
                markerId: { type: 'string', description: '标记ID' }
              },
              required: ['markerId']
            }
          },
          {
            name: 'delete_marker',
            description: '删除标记',
            inputSchema: {
              type: 'object',
              properties: {
                markerId: { type: 'string', description: '标记ID' }
              },
              required: ['markerId']
            }
          },
          {
            name: 'create_travel_plan',
            description: 'AI智能创建完整的旅游计划，包括标记和行程链',
            inputSchema: {
              type: 'object',
              properties: {
                destination: { type: 'string', description: '目的地' },
                startDate: { type: 'string', description: '开始日期（可选）' },
                endDate: { type: 'string', description: '结束日期（可选）' },
                interests: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: '兴趣偏好（可选）'
                },
                budget: { type: 'string', description: '预算范围（可选）' },
                duration: { type: 'number', description: '行程天数（可选）' }
              },
              required: ['destination']
            }
          }
        ]
      };
    });

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_marker':
            return await this.handleCreateMarker(args as unknown as CreateMarkerRequest);
          
          case 'update_marker_content':
            return await this.handleUpdateMarkerContent(args as unknown as UpdateMarkerContentRequest);
          
          case 'create_travel_chain':
            return await this.handleCreateTravelChain(args as unknown as CreateChainRequest);
          
          case 'search_places':
            return await this.handleSearchPlaces(args as { query: string; location?: { latitude: number; longitude: number } });
          
          case 'get_markers':
            return await this.handleGetMarkers();
          
          case 'get_marker':
            return await this.handleGetMarker(args as { markerId: string });
          
          case 'delete_marker':
            return await this.handleDeleteMarker(args as { markerId: string });
          
          case 'create_travel_plan':
            return await this.handleCreateTravelPlan(args as unknown as TravelPlanRequest);
          
          default:
            throw new Error(`未知工具: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error instanceof Error ? error.message : '未知错误'}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private async handleCreateMarker(args: CreateMarkerRequest) {
    const marker = await this.apiClient.createMarker(args);
    return {
      content: [
        {
          type: 'text',
          text: `✅ 成功创建标记: ${marker.content.title}\n` +
                `📍 位置: ${marker.coordinates.latitude}, ${marker.coordinates.longitude}\n` +
                `🏷️ 类型: ${marker.content.iconType}\n` +
                `🆔 标记ID: ${marker.id}`
        }
      ]
    };
  }

  private async handleUpdateMarkerContent(args: UpdateMarkerContentRequest) {
    const marker = await this.apiClient.updateMarkerContent(args);
    return {
      content: [
        {
          type: 'text',
          text: `✅ 成功更新标记内容: ${marker.content.title}\n` +
                `📝 内容已更新\n` +
                `🆔 标记ID: ${marker.id}`
        }
      ]
    };
  }

  private async handleCreateTravelChain(args: CreateChainRequest) {
    const chain = await this.apiClient.createChain(args);
    return {
      content: [
        {
          type: 'text',
          text: `✅ 成功创建行程链: ${chain.name}\n` +
                `🔗 包含 ${chain.markerIds.length} 个标记点\n` +
                `🆔 行程链ID: ${chain.id}`
        }
      ]
    };
  }

  private async handleSearchPlaces(args: { query: string; location?: { latitude: number; longitude: number } }) {
    const places = await this.apiClient.searchPlaces(args.query, args.location);
    return {
      content: [
        {
          type: 'text',
          text: `🔍 搜索 "${args.query}" 找到 ${places.length} 个结果:\n\n` +
                places.map((place, index) => 
                  `${index + 1}. ${place.name}\n   📍 ${place.address}\n   🆔 ${place.placeId}`
                ).join('\n\n')
        }
      ]
    };
  }

  private async handleGetMarkers() {
    const markers = await this.apiClient.getMarkers();
    return {
      content: [
        {
          type: 'text',
          text: `📌 当前共有 ${markers.length} 个标记:\n\n` +
                markers.map((marker, index) => 
                  `${index + 1}. ${marker.content.title}\n   📍 ${marker.coordinates.latitude}, ${marker.coordinates.longitude}\n   🏷️ ${marker.content.iconType}\n   🆔 ${marker.id}`
                ).join('\n\n')
        }
      ]
    };
  }

  private async handleGetMarker(args: { markerId: string }) {
    const marker = await this.apiClient.getMarker(args.markerId);
    return {
      content: [
        {
          type: 'text',
          text: `📌 标记详情: ${marker.content.title}\n` +
                `📍 位置: ${marker.coordinates.latitude}, ${marker.coordinates.longitude}\n` +
                `🏷️ 类型: ${marker.content.iconType}\n` +
                `📝 内容: ${marker.content.markdownContent}\n` +
                `🆔 标记ID: ${marker.id}`
        }
      ]
    };
  }

  private async handleDeleteMarker(args: { markerId: string }) {
    await this.apiClient.deleteMarker(args.markerId);
    return {
      content: [
        {
          type: 'text',
          text: `✅ 成功删除标记 ID: ${args.markerId}`
        }
      ]
    };
  }

  private async handleCreateTravelPlan(args: TravelPlanRequest): Promise<any> {
    // 这是一个智能旅游计划创建的示例实现
    // 在实际应用中，这里会调用AI服务来生成旅游计划
    
    const suggestions = {
      attractions: [
        `${args.destination}的主要景点`,
        `${args.destination}的历史遗迹`,
        `${args.destination}的自然景观`
      ],
      restaurants: [
        `${args.destination}的当地美食`,
        `${args.destination}的特色餐厅`
      ],
      hotels: [
        `${args.destination}的推荐酒店`,
        `${args.destination}的精品住宿`
      ],
      activities: [
        `${args.destination}的文化体验`,
        `${args.destination}的户外活动`
      ]
    };

    return {
      content: [
        {
          type: 'text',
          text: `🎯 AI智能旅游计划: ${args.destination}\n\n` +
                `📅 行程天数: ${args.duration || 3} 天\n` +
                `💰 预算: ${args.budget || '灵活'}\n\n` +
                `🏛️ 推荐景点:\n${suggestions.attractions.map(a => `• ${a}`).join('\n')}\n\n` +
                `🍽️ 美食推荐:\n${suggestions.restaurants.map(r => `• ${r}`).join('\n')}\n\n` +
                `🏨 住宿推荐:\n${suggestions.hotels.map(h => `• ${h}`).join('\n')}\n\n` +
                `🎪 活动推荐:\n${suggestions.activities.map(a => `• ${a}`).join('\n')}\n\n` +
                `💡 提示: 使用 create_marker 工具创建具体标记点，然后使用 create_travel_chain 工具连接成行程链。`
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Mapannai MCP Server 已启动');
  }
}

// 启动服务器
const server = new MapannaiMCPServer();
server.run().catch(console.error);
