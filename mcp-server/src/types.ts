// MCP Server类型定义
export interface MarkerCoordinates {
  latitude: number;
  longitude: number;
}

export type MarkerIconType =
  | 'activity'      // 🎯 活动
  | 'location'      // 📍 位置
  | 'hotel'         // 🏨 酒店
  | 'shopping'      // 🛍️ 购物
  | 'food'          // 🍚 美食
  | 'landmark'      // 🌆 地标建筑
  | 'park'          // 🎡 游乐场
  | 'natural'       // 🗻 自然景观
  | 'culture';      // ⛩️ 人文景观

export interface MarkerContent {
  id: string;
  title?: string;
  headerImage?: string;
  iconType?: MarkerIconType;
  markdownContent: string;
  next: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Marker {
  id: string;
  coordinates: MarkerCoordinates;
  content: MarkerContent;
}


export interface CreateMarkerRequest {
  coordinates: MarkerCoordinates;
  title: string;
  iconType: MarkerIconType;
  content?: string;
}

export interface UpdateMarkerContentRequest {
  markerId: string;
  title?: string;
  headerImage?: string;
  markdownContent: string;
}

export interface CreateChainRequest {
  markerIds: string[];
  chainName?: string;
  description?: string;
}

// v2: 通过地名创建标记所需的入参与可选位置信息
export interface CreateMarkerV2Request {
  name: string;
  iconType: MarkerIconType;
  content?: string;
}

export interface TravelPlanRequest {
  destination: string;
  startDate?: string;
  endDate?: string;
  interests?: string[];
  budget?: string;
  duration?: number;
}

export interface TravelPlanResponse {
  markers: Marker[];
  chain: {
    id: string;
    name: string;
    description: string;
    markerIds: string[];
  };
  suggestions: {
    attractions: string[];
    restaurants: string[];
    hotels: string[];
    activities: string[];
  };
}
