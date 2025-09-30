/**
 * Map marker related tools
 */

import { Tool } from '../core/tool-executor'

// Get dynamic base URL for API calls
function getApiUrl(path: string): string {
  // In server environment (API routes), we can use relative URLs
  if (typeof window === 'undefined') {
    // Server-side: construct full URL for fetch calls
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = process.env.VERCEL_URL || 'localhost:3000';
    
    // Try to detect current port from process.env.PORT or common Next.js ports
    let port = '';
    if (!process.env.VERCEL_URL) {
      const detectedPort = process.env.PORT || '3000';
      // Check if port 3000 is available, otherwise try common alternatives
      port = `:${detectedPort}`;
    }
    
    return `${protocol}://${host.replace(/^https?:\/\//, '')}${port}${path}`;
  }
  
  // Client-side: use current origin
  return `${window.location.origin}${path}`;
}

// Helper function to search places and get coordinates
async function searchPlace(name: string): Promise<{latitude: number, longitude: number}> {
  try {
    const url = getApiUrl(`/api/search?q=${encodeURIComponent(name)}&limit=1&language=zh-CN&country=JP`);
    console.log('🔍 Searching place:', name, 'URL:', url);
    
    const searchResponse = await fetch(url);
    
    if (!searchResponse.ok) {
      throw new Error(`Search place failed: ${searchResponse.status}`);
    }
    
    const searchResults = await searchResponse.json();
    if (!searchResults.data || searchResults.data.length === 0) {
      throw new Error('Place not found');
    }
    
    const place = searchResults.data[0];
    console.log('✅ Place found:', place.name, place.coordinates);
    return {
      latitude: place.coordinates.latitude,
      longitude: place.coordinates.longitude
    };
  } catch (error) {
    console.error('❌ Search place failed:', error);
    throw new Error(`Search place failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to create marker directly
async function createMarkerDirectly(name: string, iconType: string, content: string = '') {
  try {
    // Search place to get coordinates
    const coordinates = await searchPlace(name);
    
    // Call marker creation API
    const url = getApiUrl('/api/markers/v2');
    console.log('🔧 Creating marker via API:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        iconType,
        content
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Create marker failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Marker created successfully:', result.id);
    return result;
  } catch (error) {
    console.error('❌ Create marker failed:', error);
    throw new Error(`Create marker failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create Marker Tool V2
 */
export const createMarkerV2Tool: Tool = {
  name: 'create_marker_v2',
  description: 'Create map markers by place name, supports single or batch creation',
  parameters: {
    type: 'object',
    properties: {
      places: {
        type: 'array',
        description: 'Place list (batch creation)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Place name' },
            iconType: { type: 'string', description: 'Icon type' },
            content: { type: 'string', description: 'Description content' }
          },
          required: ['name', 'iconType']
        }
      },
      name: { type: 'string', description: 'Place name (single creation)' },
      iconType: { type: 'string', description: 'Icon type (single creation)' },
      content: { type: 'string', description: 'Description content (single creation)' }
    }
  },
  execute: async (args) => {
    console.log('🔧 Executing create_marker_v2 tool, args:', args);
    
    try {
      // Batch creation
      if (args.places && Array.isArray(args.places)) {
        console.log('🔧 Batch creating markers, count:', args.places.length);
        const results = []
        
        for (const place of args.places) {
          try {
            console.log('🔧 Creating marker:', place.name);
            const marker = await createMarkerDirectly(place.name, place.iconType, place.content || '');
            results.push(marker);
          } catch (error) {
            console.error('❌ Marker creation failed:', place.name, error);
            results.push({
              error: error instanceof Error ? error.message : 'Creation failed',
              place: place.name
            });
          }
        }

        console.log('🔧 Batch creation completed, success:', results.filter(r => !r.error).length, 'failed:', results.filter(r => r.error).length);
        return { type: 'batch', results };
      }
      
      // Single creation
      if (!args.name) {
        throw new Error('Place name cannot be empty');
      }

      console.log('🔧 Single marker creation:', args.name);
      const marker = await createMarkerDirectly(args.name, args.iconType || 'location', args.content || '');
      return marker;
    } catch (error) {
      console.error('❌ create_marker_v2 tool execution failed:', error);
      throw new Error(`Create marker failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Update Marker Content Tool
 */
export const updateMarkerContentTool: Tool = {
  name: 'update_marker_content',
  description: 'Update detailed content of map markers',
  parameters: {
    type: 'object',
    properties: {
      markerId: { type: 'string', description: 'Marker ID' },
      title: { type: 'string', description: 'Title' },
      markdownContent: { type: 'string', description: 'Markdown format content' }
    },
    required: ['markerId', 'markdownContent']
  },
  execute: async (args) => {
    console.log('🔧 Executing update_marker_content tool, args:', args);
    
    if (!args.markerId) {
      throw new Error('Marker ID cannot be empty');
    }

    try {
      const url = getApiUrl(`/api/markers/${args.markerId}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: args.title,
          markdownContent: args.markdownContent
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Update marker failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Marker content updated successfully:', args.markerId);
      return result;
    } catch (error) {
      console.error('❌ update_marker_content tool execution failed:', error);
      throw new Error(`Update marker failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Create Travel Chain Tool
 */
export const createTravelChainTool: Tool = {
  name: 'create_travel_chain',
  description: 'Create travel chain connecting multiple marker points',
  parameters: {
    type: 'object',
    properties: {
      markerIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Marker ID list'
      },
      chainName: { type: 'string', description: 'Travel chain name' },
      description: { type: 'string', description: 'Travel description' }
    },
    required: ['markerIds']
  },
  execute: async (args) => {
    console.log('🔧 Executing create_travel_chain tool, args:', args);
    
    if (!args.markerIds || !Array.isArray(args.markerIds) || args.markerIds.length === 0) {
      throw new Error('Marker ID list cannot be empty');
    }

    try {
      const url = getApiUrl('/api/chains');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markerIds: args.markerIds,
          name: args.chainName || 'Unnamed itinerary',
          description: args.description || ''
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Create travel chain failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Travel chain created successfully:', result.id);
      return result;
    } catch (error) {
      console.error('❌ create_travel_chain tool execution failed:', error);
      throw new Error(`Create travel chain failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}