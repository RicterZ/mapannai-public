#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { MapannaiApiClient } from './api-client.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

class AIMiddleware {
  private app: express.Application;
  private ollamaUrl: string;
  private ollamaModel: string;
  private apiClient: MapannaiApiClient;
  private port: number;

  constructor() {
    this.app = express();
    this.ollamaUrl = process.env.OLLAMA_API_URL || 'http://192.168.13.3:11434';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'deepseek-r1:7b';
    this.port = parseInt(process.env.AI_MIDDLEWARE_PORT || '3001');
    
    // 初始化 API 客户端
    const apiUrl = process.env.MAPANNAI_API_URL || 'http://localhost:3000';
    const apiKey = process.env.MAPANNAI_API_KEY || '';
    this.apiClient = new MapannaiApiClient(apiUrl, apiKey);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  private setupRoutes() {
    // 根路径重定向到控制台
    this.app.get('/', (req, res) => {
      res.sendFile('index.html', { root: 'public' });
    });

    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        ollama: this.ollamaUrl,
        model: this.ollamaModel
      });
    });


    // 流式 AI 对话端点
    this.app.post('/chat/stream', async (req, res) => {
      try {
        const { message, conversation = [] } = req.body;
        
        if (!message) {
          return res.status(400).json({ error: '消息不能为空' });
        }

        // 设置 SSE 头部
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // 构建对话上下文
        const messages: ConversationMessage[] = [
          {
            role: 'system',
            content: `你是旅游规划助手，帮助用户创建地图标记和规划行程。

## 核心规则
0. **绝对禁止编造坐标**：任何坐标数据都必须通过 search_places 工具获取，禁止假设、编造或使用示例坐标
1. **直接执行用户指令**：如果用户给出具体指令（如"在清水寺创建标记"），直接执行，不要思考其他
2. **必须先搜索坐标**：创建标记前必须用 search_places 搜索坐标，禁止假设坐标
3. **按步骤执行**：一次只调用一个工具，等待结果后再调用下一个工具
4. **无条件信任接口数据**：工具调用返回的所有数据都是真实准确的，包括 markerId、坐标、地址等，直接使用，不要质疑或修改
5. **思考要简洁**：💭 **思考**: 1-2句话说明要做什么，不要重复犹豫
6. **等待工具结果**：发出工具调用后，必须等待工具执行完成并返回结果，然后基于真实结果继续操作
7. **禁止在工具调用中编造数据**：在 TOOL_CALL_START 和 TOOL_CALL_END 之间，只能使用真实的工具调用，不能编造坐标或数据

## 可用工具

### search_places - 搜索地点坐标
- query: string (必需) - 搜索关键词
- location: { latitude: number, longitude: number } (可选) - 搜索中心点

### create_marker - 创建标记点
- coordinates: { latitude: number, longitude: number } (必需) - 坐标
- title: string (必需) - 标记标题
- iconType: string (必需) - 图标类型: 'landmark'|'culture'|'natural'|'food'|'shopping'|'activity'|'location'|'hotel'|'park'
- content: string (可选) - 标记内容

### update_marker_content - 更新标记内容
- markerId: string (必需) - 标记ID
- title: string (可选) - 新标题
- headerImage: string (可选) - 头图URL
- markdownContent: string (必需) - Markdown内容

### create_travel_chain - 创建行程链
- markerIds: string[] (必需) - 标记ID数组
- chainName: string (可选) - 链名称
- description: string (可选) - 链描述

### get_markers - 获取所有标记
无需参数

### get_marker - 获取单个标记
- markerId: string (必需) - 标记ID

### delete_marker - 删除标记
- markerId: string (必需) - 标记ID

## 工具调用格式
TOOL_CALL_START
{
  "tool": "工具名称",
  "arguments": { "参数": "值" }
}
TOOL_CALL_END


## 重要警告
- 在工具调用中绝对不能使用示例坐标如 35.0388, 135.7587
- 必须等待 search_places 工具返回真实坐标后再使用
- 如果还没有真实坐标，不要调用 create_marker

## 重要提醒
- 工具调用返回的 markerId、坐标、地址等数据都是真实准确的
- 直接使用这些数据，不要质疑、修改或编造
- 如果工具返回了数据，就认为它是正确的
- **绝对禁止编造坐标或数据**：必须通过工具调用获取真实数据
- **等待工具结果**：发出工具调用后，系统会暂停并等待工具执行完成，然后提供真实结果给你
- **禁止在工具调用中使用示例坐标**：如 35.0388, 135.7587 等示例坐标绝对不能使用
- **必须等待真实结果**：只有收到工具调用的真实结果后，才能继续下一步操作

请用中文回复，简洁思考，直接执行。`
          },
          ...conversation,
          {
            role: 'user',
            content: message
          }
        ];

        // 使用循环处理对话，每次工具调用后重新开始
        let currentMessages = [...messages];
        let hasToolCalls = true;
        let fullResponse = '';
        
        while (hasToolCalls) {
          // 重置标志
          hasToolCalls = false;
          let currentResponse = '';
          
          // 流式调用 Ollama
          await this.callOllamaStream(currentMessages, async (chunk: string) => {
            currentResponse += chunk;
            fullResponse += chunk;
            
            // 发送流式数据
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            
            // 检查是否包含工具调用
            if (chunk.includes('TOOL_CALL_START')) {
              console.log('检测到工具调用，中断当前对话');
              hasToolCalls = true;
            }
          });
          
          // 检查完整的响应中是否包含工具调用
          if (!hasToolCalls && currentResponse.includes('TOOL_CALL_START')) {
            console.log('在完整响应中检测到工具调用');
            hasToolCalls = true;
          }
          
          // 如果检测到工具调用，执行工具并重新开始对话
          if (hasToolCalls) {
            console.log('执行工具调用并重新开始对话');
            
            // 解析工具调用
            console.log('当前响应内容:', currentResponse);
            const toolCalls = this.parseToolCalls(currentResponse);
            console.log('解析到的工具调用:', toolCalls);
            
            if (toolCalls.length > 0) {
              // 发送工具执行状态
              res.write(`data: ${JSON.stringify({ type: 'tool_executing', message: '正在执行工具调用...' })}\n\n`);
              
              try {
                // 同步执行所有工具调用
                const results = await this.executeToolCalls(toolCalls);
                
                // 发送工具调用结果
                for (let i = 0; i < toolCalls.length; i++) {
                  const toolCall = toolCalls[i];
                  const result = results[i];
                  
                  if (result.error) {
                    console.log('工具调用执行失败:', toolCall.tool, result.error);
                    res.write(`data: ${JSON.stringify({ type: 'tool_error', tool: toolCall.tool, error: result.error })}\n\n`);
                  } else {
                    console.log('工具调用执行成功:', toolCall.tool);
                    res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: toolCall.tool, result: result.result })}\n\n`);
                  }
                }
                
                // 将工具调用结果添加到对话上下文中
                const toolResults = results.map((result, index) => {
                  const toolCall = toolCalls[index];
                  return `工具调用结果 (${toolCall.tool}): ${JSON.stringify(result.result || result.error)}`;
                }).join('\n');
                
                // 更新对话上下文，添加工具结果
                currentMessages.push({
                  role: 'assistant',
                  content: currentResponse
                });
                currentMessages.push({
                  role: 'user',
                  content: `工具调用结果：\n${toolResults}\n\n请基于这些真实结果继续操作。`
                });
                
                // 继续循环，让AI基于工具结果生成下一步响应
                hasToolCalls = true;
                
              } catch (error) {
                console.error('工具调用执行异常:', error);
                res.write(`data: ${JSON.stringify({ type: 'tool_error', error: error instanceof Error ? error.message : '工具调用执行异常' })}\n\n`);
                hasToolCalls = false;
              }
            } else {
              console.log('没有解析到有效的工具调用');
              hasToolCalls = false;
            }
          }
        }

        console.log('流式处理完成');

        // 发送完成信号
        res.write(`data: ${JSON.stringify({ type: 'done', response: fullResponse })}\n\n`);
        res.end();

      } catch (error) {
        console.error('流式聊天处理错误:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : '未知错误' })}\n\n`);
        res.end();
      }
    });

    // 获取可用工具
    this.app.get('/tools', (req, res) => {
      const tools = [
        {
          name: 'create_marker',
          description: '在地图上创建新的标记点',
          parameters: {
            coordinates: { latitude: 'number', longitude: 'number' },
            title: 'string',
            iconType: 'string',
            content: 'string (optional)'
          }
        },
        {
          name: 'update_marker_content',
          description: '更新标记的详细内容',
          parameters: {
            markerId: 'string',
            title: 'string (optional)',
            headerImage: 'string (optional)',
            markdownContent: 'string'
          }
        },
        {
          name: 'create_travel_chain',
          description: '创建旅游行程链，连接多个标记点',
          parameters: {
            markerIds: 'array of strings',
            chainName: 'string (optional)',
            description: 'string (optional)'
          }
        },
        {
          name: 'search_places',
          description: '搜索地点信息',
          parameters: {
            query: 'string',
            location: { latitude: 'number', longitude: 'number' } + ' (optional)'
          }
        },
        {
          name: 'get_markers',
          description: '获取所有标记',
          parameters: {}
        },
        {
          name: 'get_marker',
          description: '获取特定标记的详细信息',
          parameters: {
            markerId: 'string'
          }
        },
        {
          name: 'delete_marker',
          description: '删除标记',
          parameters: {
            markerId: 'string'
          }
        },
        {
          name: 'create_travel_plan',
          description: 'AI智能创建完整的旅游计划',
          parameters: {
            destination: 'string',
            startDate: 'string (optional)',
            endDate: 'string (optional)',
            interests: 'array (optional)',
            budget: 'string (optional)',
            duration: 'number (optional)'
          }
        }
      ];
      
      res.json({ tools });
    });

    // 直接调用工具
    this.app.post('/tools/call', async (req, res) => {
      try {
        const { toolName, arguments: args } = req.body;
        
        if (!toolName) {
          return res.status(400).json({ error: '工具名称不能为空' });
        }

        const result = await this.callTool(toolName, args);
        res.json(result);
      } catch (error) {
        console.error('工具调用错误:', error);
        res.status(500).json({ 
          error: '工具调用失败',
          details: error instanceof Error ? error.message : '未知错误'
        });
      }
    });
  }



  private async callOllamaStream(messages: ConversationMessage[], onChunk: (chunk: string) => void): Promise<string> {
    try {
      
      const response = await axios.post(`${this.ollamaUrl}/api/chat`, {
        model: this.ollamaModel,
        messages: messages,
        stream: true
      }, {
        responseType: 'stream',
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      let fullResponse = '';
      
      return new Promise((resolve, reject) => {
        let buffer = '';
        
        (response.data as any).on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          
          // 按行分割，处理完整的 JSON 对象
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个不完整的行
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                
                if (data.message && data.message.content) {
                  const content = data.message.content;
                  fullResponse += content;
                  onChunk(content);
                }
                if (data.done) {
                  resolve(fullResponse);
                  return;
                }
              } catch (e) {
              }
            }
          }
        });

        (response.data as any).on('error', (error: Error) => {
          console.error('Ollama 流式响应错误:', error);
          reject(new Error(`Ollama 服务错误: ${error.message}`));
        });

        (response.data as any).on('end', () => {
          // 处理最后剩余的数据
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer);
              if (data.message && data.message.content) {
                const content = data.message.content;
                fullResponse += content;
                onChunk(content);
              }
            } catch (e) {
            }
          }
          
          if (fullResponse) {
            resolve(fullResponse);
          } else {
            reject(new Error('Ollama 服务返回空响应'));
          }
        });
      });
    } catch (error: any) {
      console.error('Ollama API 流式调用失败:', error);
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`无法连接到 Ollama 服务 (${this.ollamaUrl})，请检查服务是否启动`);
      } else if (error.code === 'ENOTFOUND') {
        throw new Error(`Ollama 服务地址无法解析 (${this.ollamaUrl})，请检查网络连接`);
      } else if (error.message && error.message.includes('timeout')) {
        throw new Error('Ollama 服务响应超时，请检查服务状态');
      } else {
        throw new Error(`AI 服务错误: ${error.message || '未知错误'}`);
      }
    }
  }

  private parseToolCalls(response: string): Array<{ tool: string; args: any }> {
    const toolCalls: Array<{ tool: string; args: any }> = [];
    
    // 使用正则表达式匹配工具调用格式，支持多行JSON
    const toolCallRegex = /TOOL_CALL_START\s*(\{[\s\S]*?\})\s*TOOL_CALL_END/g;
    let match;
    
    // 重置正则表达式的 lastIndex，因为 test() 方法会改变它
    toolCallRegex.lastIndex = 0;
    
    while ((match = toolCallRegex.exec(response)) !== null) {
      try {
        const toolCallData = JSON.parse(match[1]);
        if (toolCallData.tool && toolCallData.arguments) {
          toolCalls.push({
            tool: toolCallData.tool,
            args: toolCallData.arguments
          });
          console.log('解析工具调用:', toolCallData.tool);
        }
      } catch (error) {
        console.error('解析工具调用失败:', error);
      }
    }
    
    console.log('最终解析的工具调用数量:', toolCalls.length);
    return toolCalls;
  }


  private async executeToolCalls(toolCalls: Array<{ tool: string; args: any }>): Promise<any[]> {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        const result = await this.callTool(toolCall.tool, toolCall.args);
        results.push({ tool: toolCall.tool, result });
      } catch (error) {
        results.push({ 
          tool: toolCall.tool, 
          error: error instanceof Error ? error.message : '未知错误' 
        });
      }
    }

    return results;
  }

  private async callTool(toolName: string, args: any): Promise<any> {
    try {
      switch (toolName) {
        case 'create_marker':
          console.log('调用 create_marker 工具，参数:', args);
          console.log('API 客户端配置:', {
            baseURL: this.apiClient['client'].defaults.baseURL,
            apiKey: this.apiClient['apiKey']
          });
          const result = await this.apiClient.createMarker(args);
          console.log('create_marker 工具调用结果:', result);
          
          if (!result) {
            throw new Error('API 返回了 null，标记创建失败');
          }
          
          return result;
        
        case 'update_marker_content':
          console.log('调用 update_marker_content 工具，参数:', args);
          const updateResult = await this.apiClient.updateMarkerContent(args);
          console.log('update_marker_content 工具调用结果:', updateResult);
          return updateResult;
        
        case 'create_travel_chain':
          return await this.apiClient.createChain(args);
        
        case 'search_places':
          console.log('调用 search_places 工具，参数:', args);
          const searchResult = await this.apiClient.searchPlaces(args.query, args.location);
          console.log('search_places 工具调用结果:', searchResult);
          return searchResult;
        
        case 'get_markers':
          return await this.apiClient.getMarkers();
        
        case 'get_marker':
          return await this.apiClient.getMarker(args.markerId);
        
        case 'delete_marker':
          return await this.apiClient.deleteMarker(args.markerId);
        
        case 'create_travel_plan':
          // create_travel_plan 是 MCP 服务器内部实现的工具
          // 这里返回一个模拟的旅游计划，实际应该通过 MCP 协议调用
          return {
            destination: args.destination,
            duration: args.duration || 3,
            suggestions: {
              attractions: [`${args.destination}的主要景点`],
              restaurants: [`${args.destination}的当地美食`],
              hotels: [`${args.destination}的推荐酒店`],
              activities: [`${args.destination}的文化体验`]
            }
          };
        
        default:
          throw new Error(`未知工具: ${toolName}`);
      }
    } catch (error) {
      console.error(`工具调用失败 ${toolName}:`, error);
      throw error;
    }
  }

  public async start() {
    this.app.listen(this.port, () => {
      console.log(`🤖 AI 中间层服务已启动`);
      console.log(`📡 端口: ${this.port}`);
      console.log(`🧠 Ollama API: ${this.ollamaUrl}`);
      console.log(`🎯 模型: ${this.ollamaModel}`);
      console.log(`🗺️  Mapannai API: ${process.env.MAPANNAI_API_URL || 'http://localhost:3000'}`);
    });
  }
}

// 启动服务
const middleware = new AIMiddleware();
middleware.start().catch(console.error);

// 优雅关闭
process.on('SIGINT', () => {
  console.log('正在关闭 AI 中间层服务...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('正在关闭 AI 中间层服务...');
  process.exit(0);
});
