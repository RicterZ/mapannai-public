import axios from 'axios';
import { Marker, CreateMarkerRequest, UpdateMarkerContentRequest, CreateChainRequest, CreateMarkerV2Request } from './types.js';

export class MapannaiApiClient {
  private client: any;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 30000,
    });
  }

  // 创建标记
  async createMarker(request: CreateMarkerRequest): Promise<Marker> {
    try {
      const response = await this.client.post('/api/markers', {
        coordinates: request.coordinates,
        title: request.title,
        iconType: request.iconType,
        content: request.content || '',
      });
      return response.data;
    } catch (error) {
      console.error('创建标记失败:', error);
      throw new Error(`创建标记失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 更新标记内容
  async updateMarkerContent(request: UpdateMarkerContentRequest): Promise<Marker> {
    try {
      const response = await this.client.put(`/api/markers/${request.markerId}`, {
        title: request.title,
        headerImage: request.headerImage,
        markdownContent: request.markdownContent,
      });
      return response.data;
    } catch (error) {
      console.error('更新标记内容失败:', error);
      throw new Error(`更新标记内容失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 获取所有标记
  async getMarkers(): Promise<Marker[]> {
    try {
      const response = await this.client.get('/api/markers');
      return response.data;
    } catch (error) {
      console.error('获取标记失败:', error);
      throw new Error(`获取标记失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 获取单个标记
  async getMarker(markerId: string): Promise<Marker> {
    try {
      const response = await this.client.get(`/api/markers/${markerId}`);
      return response.data;
    } catch (error) {
      console.error('获取标记失败:', error);
      throw new Error(`获取标记失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  

  // 创建行程链
  async createChain(request: CreateChainRequest): Promise<{ id: string; name: string; markerIds: string[] }> {
    try {
      const response = await this.client.post('/api/chains', {
        markerIds: request.markerIds,
        name: request.chainName,
        description: request.description,
      });
      return response.data;
    } catch (error) {
      console.error('创建行程链失败:', error);
      throw new Error(`创建行程链失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 获取所有行程链
  async getChains(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/chains');
      return response.data;
    } catch (error) {
      console.error('获取行程链失败:', error);
      throw new Error(`获取行程链失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 搜索地点 (直接使用 /api/search)
  async searchPlaces(query: string, location?: { latitude: number; longitude: number }): Promise<any[]> {
    try {
      const params: any = { 
        q: query,
        limit: 10,
        language: 'zh-CN',
        country: 'JP'
      };
      if (location) {
        params.lat = location.latitude;
        params.lng = location.longitude;
      }
      const response = await this.client.get('/api/search', { params });
      return response.data.data || response.data;
    } catch (error) {
      console.error('搜索地点失败:', error);
      throw new Error(`搜索地点失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 获取地点详情
  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/places/${placeId}`);
      return response.data;
    } catch (error) {
      console.error('获取地点详情失败:', error);
      throw new Error(`获取地点详情失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // v2: 通过地名创建标记
  async createMarkerFromPlaceName(request: CreateMarkerV2Request): Promise<Marker> {
    // 1) 搜索地点
    const results = await this.searchPlaces(request.name);
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('地点未搜索到');
    }

    // 2) 从结果中选择最贴近的：当前无参，直接取第一个
    const chosen = results[0];

    // 3) 调用 createMarker
    const marker = await this.createMarker({
      coordinates: {
        latitude: chosen.coordinates.latitude,
        longitude: chosen.coordinates.longitude
      },
      title: request.name,
      iconType: request.iconType,
      content: request.content || ''
    });

    return marker;
  }
}
