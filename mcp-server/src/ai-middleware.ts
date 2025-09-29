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
  private conversationSessions: Map<string, ConversationMessage[]> = new Map();

  constructor() {
    this.app = express();
    this.ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'qwen3:8b';
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
        const { message, sessionId, clearHistory = false } = req.body;
        
        if (!message) {
          return res.status(400).json({ error: '消息不能为空' });
        }

        // 生成或使用sessionId
        const currentSessionId = sessionId || this.generateSessionId();
        
        // 获取或创建对话历史
        let conversation: ConversationMessage[] = [];
        if (clearHistory) {
          // 清除历史，开始新对话
          this.conversationSessions.delete(currentSessionId);
        } else {
          // 获取现有对话历史
          conversation = this.conversationSessions.get(currentSessionId) || [];
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
            content: `你是旅游规划助手，帮助用户创建地图标记和规划行程。请真心实意的帮助用户，为用户深度考虑住、行、吃、游、购、娱等要素。

## 输出格式
<think>
[深度思考用户需求，列出具体地点计划A、B、C、D、E和推荐顺序，包括住宿、餐饮、景点等类型，并考虑交通和时间安排。思考应详细但聚焦，确保后续工具调用有明确目标。]
</think>

<execute>
[只能包含工具调用，不能有其他内容]
</execute>

## 核心规则
1. **深度思考优先**：在<think>内必须完成全面需求分析，列出所有推荐地点（如A、B、C、D、E）和推荐游览顺序（如A→C→D→E→B），包括地点类型（住宿、餐厅、景点等）和关键信息（如门票价格、营业时间等，基于常识）。
3. **标记复用原则**：只复用思考阶段列出且已存在的标记，避免被其他标记干扰。
4. **行程链最小要求**：create_travel_chain必须基于思考阶段的规划顺序，且需要至少2个有效markerIds。
5. **信息补充机制**：创建标记后，应使用update_marker_content添加详细信息（如门票、营业时间、交通提示等），基于常识或工具返回数据。
6. **分离执行步骤**：严格按步骤执行工具调用，一次只调用一个工具。
7. **目的地细化搜索**：搜索地点时必须使用具体名称（如"函馆山"而非"函馆"），确保精度。

## 完整工作流程
1) **深度思考阶段**：在<think>内分析用户需求，列出5-8个推荐地点（涵盖住、行、吃、游、购、娱），确定最佳游览顺序，并备注每个地点的类型和关键信息。
2) **标记补齐阶段**：对思考阶段列出的每个地点：
   - 检查是否在现有标记中（标题匹配）
   - 如不存在 → create_marker_v2(尽量提供更具体的查询，例如“函馆山附近 炸猪排店”，并选择合适iconType) → update_marker_content(添加详细信息)
3) **行程链创建**：基于思考阶段的顺序，调用create_travel_chain组织markerIds。
4) **任务完成**：输出 ✅ 任务已完成，并简要总结行程。

## 可用工具
- **create_marker_v2**: 通过地名创建标记（内部搜索坐标；建议使用更具体的查询）
- **create_marker**: 创建标记 (coordinates, title, iconType) [如已知坐标时使用]
- **search_places**: 搜索地点坐标 (query: string) [可选，不推荐优先使用]
- **get_marker**: 获取单个标记 (markerId: string)
- **update_marker_content**: 更新标记内容 (markerId, title, markdownContent) - [用于添加门票价格、营业时间、交通等信息]
- **create_travel_chain**: 创建行程链 (markerIds, chainName, description)

## 工具调用格式
TOOL_CALL_START
{
  "tool": "工具名称",
  "arguments": { "参数": "值" }
}
TOOL_CALL_END

## 图标类型选择指导
- **landmark**: 地标建筑、纪念碑
- **culture**: 博物馆、艺术馆、历史遗迹
- **natural**: 自然景观、公园、海滩
- **food**: 餐厅、美食街、咖啡厅
- **shopping**: 商场、购物中心、市场
- **activity**: 娱乐场所、运动场馆
- **location**: 一般位置、地址
- **hotel**: 酒店、住宿、民宿
- **park**: 公园、绿地

## 信息补充指南
使用update_marker_content时，markdownContent应包含：
- **基本描述**：地点特色和推荐理由
- **实用信息**：门票价格（如"成人票¥1000"）、营业时间（如"9:00-18:00"）
- **交通提示**：公共交通方式、停车信息
- **注意事项**：最佳游览时间、预订建议等
基于常识填充，如无法确定则标注"信息待核实"。

## 专注当前规划规则
- **计划驱动执行**：严格按照思考阶段制定的计划执行，不被现有标记库中的其他地点分散注意力。
- **只复用计划内标记**：只有当思考阶段列出的地点在现有标记中存在时，才复用这些标记。

## 示例：函馆一日游（正确流程）
<think>
用户需要函馆一日游，深度考虑住宿、餐饮、景点和交通。推荐地点：
1. 函馆山（景点）- 地标，夜景著名，门票约¥1500，缆车运营时间10:00-22:00
2. 五棱郭公园（文化）- 历史遗迹，免费入园，塔楼门票¥900，9:00-18:00
3. 函馆朝市（美食）- 海鲜市场，早餐推荐，6:00-14:00
4. 元町区域（购物/文化）- 西洋建筑群，商店10:00-18:00
5. 汤之川温泉（住宿）- 温泉旅馆，可过夜
推荐顺序：函馆朝市(早餐)→五棱郭公园→元町区域(午餐)→函馆山(夜景)→汤之川温泉(住宿)，考虑交通便利性和时间安排。
</think>

<execute>
TOOL_CALL_START
{
  "tool": "create_marker_v2",
  "arguments": { "name": "函馆山", "iconType": "natural" }
}
TOOL_CALL_END
</execute>

<execute>
TOOL_CALL_START
{
  "tool": "update_marker_content",
  "arguments": { "markerId": "新标记ID", "title": "函馆山", "markdownContent": "**函馆山夜景**\n- 门票：缆车往返¥1500\n- 时间：10:00-22:00\n- 交通：乘巴士或缆车上山\n- 提示：日落时分最佳，避开人群" }
}
TOOL_CALL_END
</execute>

[重复以上步骤为其他计划地点创建标记并更新内容...]

<think>
所有计划中的函馆地点标记已创建并更新信息，现在基于规划顺序创建行程链。
</think>

<execute>
TOOL_CALL_START
{
  "tool": "create_travel_chain",
  "arguments": { "markerIds": ["id1", "id2", "id3", "id4", "id5"], "chainName": "函馆深度一日游", "description": "涵盖早餐市场、历史公园、文化区域、夜景和温泉住宿" }
}
TOOL_CALL_END
</execute>

✅ 任务已完成：已创建函馆深度一日游行程链，包含5个地点，涵盖景点、美食、购物和住宿，并补充实用信息。`
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
          let inExecutionSection = false;
          
          // 流式调用 Ollama
          await this.callOllamaStream(currentMessages, async (chunk: string) => {
            currentResponse += chunk;
            fullResponse += chunk;
            
            // 发送流式数据
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            
            // 检查是否进入执行部分
            if (currentResponse.includes('<execute>')) {
              inExecutionSection = true;
            }
            
            // 检查是否包含工具调用（只在执行部分检测）
            if (inExecutionSection) {
              if (chunk.includes('TOOL_CALL_START')) {
                hasToolCalls = true;
              } else if (/<execute>[\s\S]*?TOOL_CALL_START/.test(currentResponse)) {
                hasToolCalls = true;
              }
            }
          });
          
          // 检查完整的响应中是否包含工具调用（只在<execute>标签内检测）
          if (!hasToolCalls && currentResponse.includes('TOOL_CALL_START') && currentResponse.includes('<execute>')) {
            hasToolCalls = true;
          }
          
          // 检查是否任务已完成（只有在没有工具调用时才检查完成标记）
          if (!hasToolCalls) {
            // 检查是否有正式的完成标记（必须是独立一行的格式）
            const completionPattern = /^✅\s*任务已完成/m;
            if (currentResponse.match(completionPattern)) {
              console.log('检测到正式的任务完成标识，但继续保持对话状态');
              // 不再停止循环，让AI继续输出后续内容（如询问是否需要其他帮助）
              hasToolCalls = false;
            }
          }
          
          // 如果检测到工具调用，执行工具并重新开始对话
          if (hasToolCalls) {
            // 解析工具调用
            const toolCalls = this.parseToolCalls(currentResponse);
            
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
                    res.write(`data: ${JSON.stringify({ type: 'tool_error', tool: toolCall.tool, error: result.error })}\n\n`);
                  } else {
                    res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: toolCall.tool, result: result.result })}\n\n`);
                  }
                }
                
                // 将工具调用结果添加到对话上下文中，优化内容长度
                const toolResults = results.map((result, index) => {
                  const toolCall = toolCalls[index];
                  const toolResult = result.result || result.error;
                  
                  // 根据工具类型优化返回内容
                  if (toolCall.tool === 'get_markers') {
                    if (Array.isArray(toolResult) && toolResult.length > 0) {
                      // 只返回关键信息：id, title, coordinates，智能限制数量
                      const totalMarkers = toolResult.length;
                      let maxMarkers = 50; // 默认最多显示50个标记
                      
                      // 如果标记数量很多，适当增加显示数量
                      if (totalMarkers > 100) {
                        maxMarkers = 100; // 超过100个标记时，显示前100个
                      } else if (totalMarkers > 200) {
                        maxMarkers = 150; // 超过200个标记时，显示前150个
                      }
                      
                      const markersToShow = toolResult.slice(0, maxMarkers);
                      const simplifiedMarkers = markersToShow.map(marker => ({
                        id: marker.id,
                        // 一些后端返回的title位于 content.title，这里做兼容
                        title: (marker as any)?.title ?? (marker as any)?.content?.title ?? '',
                        coordinates: (marker as any)?.coordinates
                      }));
                      
                      let result = `工具调用结果 (${toolCall.tool}): 找到 ${totalMarkers} 个标记`;
                      if (totalMarkers > maxMarkers) {
                        result += ` (显示前 ${maxMarkers} 个)`;
                      }
                      result += `\n${JSON.stringify(simplifiedMarkers, null, 2)}`;
                      return result;
                    } else {
                      return `工具调用结果 (${toolCall.tool}): 没有找到任何标记`;
                    }
                  } else if (toolCall.tool === 'search_places') {
                    if (Array.isArray(toolResult) && toolResult.length > 0) {
                      // 只返回第一个结果的坐标和标题
                      const firstResult = toolResult[0];
                      return `工具调用结果 (${toolCall.tool}): 找到 ${toolResult.length} 个地点\n第一个结果: ${JSON.stringify({
                        title: firstResult.title,
                        coordinates: firstResult.coordinates
                      }, null, 2)}`;
                    } else {
                      return `工具调用结果 (${toolCall.tool}): 没有找到相关地点`;
                    }
                  } else if (toolCall.tool === 'create_marker') {
                    // 创建标记成功，返回关键信息
                    return `工具调用结果 (${toolCall.tool}): 标记创建成功\n${JSON.stringify({
                      id: toolResult.id,
                      title: toolResult.title,
                      coordinates: toolResult.coordinates
                    }, null, 2)}`;
                  } else {
                    // 其他工具返回完整结果
                    return `工具调用结果 (${toolCall.tool}): ${JSON.stringify(toolResult)}`;
                  }
                }).join('\n\n');
                
                // 限制工具结果的总长度，避免上下文过长
                const maxToolResultLength = 8000; // 限制工具结果最大长度，支持更多标记
                let finalToolResults = toolResults;
                if (toolResults.length > maxToolResultLength) {
                  finalToolResults = toolResults.substring(0, maxToolResultLength) + '\n\n[内容过长，已截断]';
                }
                
                // 更新对话上下文，添加工具结果
                currentMessages.push({
                  role: 'assistant',
                  content: currentResponse
                });
                currentMessages.push({
                  role: 'user',
                  content: `🔧 MCP工具返回结果：

${finalToolResults}

请基于这些真实结果继续下一步操作。如果任务已完成，请说明完成情况。如果需要继续操作，请按照格式要求输出。`
                });

                // 更新session中的对话历史
                this.updateSessionHistory(currentSessionId, currentResponse, `🔧 MCP工具返回结果：\n\n${finalToolResults}`);
                
                // 继续循环，让AI基于工具结果生成下一步响应
                hasToolCalls = true;
                
              } catch (error) {
                console.error('工具调用执行异常:', error);
                res.write(`data: ${JSON.stringify({ type: 'tool_error', error: error instanceof Error ? error.message : '工具调用执行异常' })}\n\n`);
                hasToolCalls = false;
              }
            } else {
              hasToolCalls = false;
            }
          }
        }

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
            name: 'create_marker_v2',
            description: '通过地名创建标记：内部搜索地点并择优坐标。为提高准确度，请尽量提供更具体的查询，例如“函馆山附近 炸猪排店”。',
            parameters: {
              name: 'string',
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

    // 清除对话历史端点
    this.app.post('/chat/clear', (req, res) => {
      try {
        const { sessionId } = req.body;
        if (sessionId) {
          this.conversationSessions.delete(sessionId);
          res.json({ success: true, message: '对话历史已清除' });
        } else {
          res.status(400).json({ error: 'sessionId 不能为空' });
        }
      } catch (error) {
        console.error('清除对话历史错误:', error);
        res.status(500).json({ error: '清除对话历史失败' });
      }
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
    
    // 只在<execute>标签内查找工具调用
    let executionSection = '';
    
    // 提取<execute>标签内的内容
    const executeMatch = response.match(/<execute>([\s\S]*?)<\/execute>/);
    if (executeMatch) {
      executionSection = executeMatch[1];
    } else {
      // 备用方案：如果没有闭合标签，尝试匹配开始标签后的内容
      const openExecuteMatch = response.match(/<execute>([\s\S]*?)(?=<\/execute>|<think>|✅|$)/);
      if (openExecuteMatch) {
        executionSection = openExecuteMatch[1];
      } else {
        return toolCalls;
      }
    }
    
    // 使用正则表达式匹配工具调用格式，支持多行JSON
    const toolCallRegex = /TOOL_CALL_START\s*(\{[\s\S]*?\})\s*TOOL_CALL_END/g;
    let match;
    
    // 重置正则表达式的 lastIndex，因为 test() 方法会改变它
    toolCallRegex.lastIndex = 0;
    
    while ((match = toolCallRegex.exec(executionSection)) !== null) {
      try {
        const toolCallData = JSON.parse(match[1]);
        if (toolCallData.tool) {
          // 如果没有 arguments 字段，自动添加空对象
          const args = toolCallData.arguments || {};
          toolCalls.push({
            tool: toolCallData.tool,
            args: args
          });
        } else {
        }
      } catch (error) {
        // 安静失败，不输出大量日志
      }
    }
    
    return toolCalls;
  }


  private async executeToolCalls(toolCalls: Array<{ tool: string; args: any }>): Promise<any[]> {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        console.log(`[MCP CALL] ${toolCall.tool} args: ${JSON.stringify(toolCall.args)}`);
        const result = await this.callTool(toolCall.tool, toolCall.args);
        console.log(`[MCP RESULT] ${toolCall.tool} result: ${JSON.stringify(result)}`);
        results.push({ tool: toolCall.tool, result });
      } catch (error) {
        console.log(`[MCP RESULT] ${toolCall.tool} error: ${error instanceof Error ? error.message : '未知错误'}`);
        results.push({ 
          tool: toolCall.tool, 
          error: error instanceof Error ? error.message : '未知错误' 
        });
      }
    }

    return results;
  }

  

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private updateSessionHistory(sessionId: string, assistantResponse: string, toolResults: string): void {
    const sessionHistory = this.conversationSessions.get(sessionId) || [];
    
    // 添加AI回复
    sessionHistory.push({
      role: 'assistant',
      content: assistantResponse
    });
    
    // 添加工具结果
    sessionHistory.push({
      role: 'user',
      content: toolResults
    });
    
    // 更新session
    this.conversationSessions.set(sessionId, sessionHistory);
  }

  private async callTool(toolName: string, args: any): Promise<any> {
    try {
      switch (toolName) {
        case 'create_marker':
          const result = await this.apiClient.createMarker(args);
          
          if (!result) {
            throw new Error('API 返回了 null，标记创建失败');
          }
          
          return result;
        case 'create_marker_v2':
          return await this.apiClient.createMarkerFromPlaceName(args);
        
        case 'update_marker_content':
          const updateResult = await this.apiClient.updateMarkerContent(args);
          return updateResult;
        
        case 'create_travel_chain':
          return await this.apiClient.createChain(args);
        
        case 'search_places':
          const searchResult = await this.apiClient.searchPlaces(args.query, args.location);
          return searchResult;
        
        case 'get_markers':
          return await this.apiClient.getMarkers();
        
        case 'get_marker':
          return await this.apiClient.getMarker(args.markerId);
        
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
