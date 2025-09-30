#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { MapannaiApiClient } from './api-client.js';
import dotenv from 'dotenv';

const prompt = `你是旅游规划助手，帮助用户创建地图标记和规划行程。您的任务很简单：基于您的知识推荐景点，调用工具创建标记，补充地点信息，最后创建行程链。

## 输出格式
<think>
[深度思考用户需求，列出具体地点计划A、B、C、D、E和推荐顺序，包括住宿、餐饮、景点等类型，并考虑交通和时间安排。]
</think>

<execute>
[只能包含工具调用，不能有其他内容]
</execute>

## 核心规则
1. **深度思考优先**：在<think>内完成全面需求分析，列出5-8个推荐地点和游览顺序。
2. **日语地点名称**：创建标记时尽量使用日语官方名称，确保地点准确性。**必须包含城市信息**避免歧义（如"長崎市平和公園"而非"平和公園"）。
3. **直接创建标记**：无需检查现有标记，直接基于您的知识推荐地点并调用create_marker_v2创建标记。
4. **自动规划执行**：不需要向用户确认是否继续，AI应自行按计划执行所有步骤。
5. **严格等待工具结果**：这是最重要的规则：
   - 每次只能调用一个工具
   - 必须等待工具返回完整结果后才能继续下一步
   - 根据返回结果决定下一步操作
   - 如果工具调用失败，需要调整策略或重试
6. **信息补充机制**：创建标记后，使用update_marker_content添加详细信息（门票、营业时间、交通提示等）。
7. **行程链创建**：基于思考阶段的规划顺序，调用create_travel_chain组织markerIds。

## 简化工作流程
1) **思考阶段**：分析用户需求，列出推荐地点和顺序。
2) **标记创建阶段**：一次性创建所有推荐地点标记，使用日语名称。
3) **信息补充阶段**：为每个标记补充详细信息。
4) **行程链创建**：基于规划顺序创建行程链。
5) **任务完成**：输出 ✅ 任务已完成。

## 可用工具
- **create_marker_v2**: 通过地名创建标记 - 支持单个地点或批量创建
  - 单个地点: { "name": "地点名", "iconType": "类型", "content": "描述" }
  - 批量创建: { "places": [{"name": "地点1", "iconType": "类型1"}, {"name": "地点2", "iconType": "类型2"}] }
- **update_marker_content**: 更新标记内容 (markerId, title, markdownContent)
- **create_travel_chain**: 创建行程链 (markerIds, chainName, description)

## 图标类型规范
- **landmark**: 地标建筑、纪念碑、塔楼
- **culture**: 博物馆、艺术馆、历史遗迹、文化场所
- **natural**: 自然景观、公园、海滩、山景
- **food**: 餐厅、美食街、咖啡厅、市场
- **shopping**: 商场、购物中心、市场、商店
- **activity**: 娱乐场所、运动场馆、活动场所
- **location**: 一般位置、地址、普通地点
- **hotel**: 酒店、住宿、民宿、旅馆
- **park**: 公园、绿地、花园

## 工具调用格式
{
  "tool": "工具名称",
  "arguments": { "参数": "值" }
}

## 重要格式要求
- **create_marker_v2 必须使用 "places" 字段**，不能使用 "markers"
- **iconType 必须是预定义的类型**：landmark, culture, natural, food, shopping, activity, location, hotel, park
- **name 字段是必需的**，不能使用 "title"
- **批量创建格式**：{ "places": [{"name": "地点名", "iconType": "类型", "content": "描述"}] }

## 严格等待机制
- **一次只调用一个工具**：每个<execute>块中只能包含一个工具调用
- **等待结果**：调用工具后必须等待返回结果，再生成下一个<think>和<execute>
- **结果处理**：基于工具返回结果决定下一步操作
- **错误处理**：如果工具调用失败，在<think>中分析原因并调整策略

## 示例：函馆一日游（展示等待机制）
<think>
用户需要函馆一日游。推荐以下地点和顺序：
1. 函館市朝市（美食）- 海鲜市场，早餐推荐
2. 函館市五稜郭公園（文化）- 历史遗迹，免费入园
3. 函館市元町区域（购物/文化）- 西洋建筑群
4. 函館市函館山（景点）- 地标，夜景著名
5. 函館市湯の川温泉（住宿）- 温泉旅馆
顺序：函館市朝市→函館市五稜郭公園→函館市元町区域→函館市函館山→函館市湯の川温泉
</think>

<execute>
{
  "tool": "create_marker_v2",
  "arguments": {
    "places": [
      {
        "name": "函館市朝市",
        "iconType": "food",
        "content": "函館市著名的海鲜市场"
      },
      {
        "name": "函館市五稜郭公園",
        "iconType": "culture",
        "content": "函館市星形要塞历史公园"
      },
      {
        "name": "函館市元町区域",
        "iconType": "culture",
        "content": "函館市西洋建筑群"
      },
      {
        "name": "函館市函館山",
        "iconType": "landmark",
        "content": "函館市地标，夜景著名"
      },
      {
        "name": "函館市湯の川温泉",
        "iconType": "hotel",
        "content": "函館市温泉旅馆"
      }
    ]
  }
}
</execute>

***等待工具返回结果***

<think>
已收到批量创建结果，现在分析返回的markerId。根据结果，需要为每个标记补充详细信息。
首先处理函館市朝市，markerId为: marker_123
</think>

<execute>
{
  "tool": "update_marker_content",
  "arguments": {
    "markerId": "marker_123",
    "title": "函館市朝市",
    "markdownContent": "**函館市朝市**\n- 特色：新鲜海鲜、海胆、螃蟹\n- 时间：6:00-14:00\n- 推荐：海鲜丼早餐\n- 交通：JR函館站步行5分钟"
  }
}
</execute>

***等待工具返回结果***

<think>
已成功更新函館市朝市信息，继续处理下一个标记：函館市五稜郭公園，markerId为: marker_456
</think>

<execute>
{
  "tool": "update_marker_content",
  "arguments": {
    "markerId": "marker_456",
    "title": "函館市五稜郭公園",
    "markdownContent": "**函館市五稜郭公園**\n- 特色：星形要塞历史遗迹\n- 时间：9:00-18:00\n- 门票：免费\n- 交通：市电五稜郭公园前站步行5分钟"
  }
}
</execute>

***等待工具返回结果***

[继续处理其他标记...]

<think>
所有标记已创建并更新信息，现在基于规划顺序创建行程链。收集到的markerIds为: ["marker_123", "marker_456", "marker_789", "marker_101", "marker_112"]
</think>

<execute>
{
  "tool": "create_travel_chain",
  "arguments": {
    "markerIds": ["marker_123", "marker_456", "marker_789", "marker_101", "marker_112"],
    "chainName": "函館一日遊",
    "description": "从早餐市场开始，游览历史遗迹，欣赏西洋建筑，观看夜景，最后入住温泉旅馆"
  }
}
</execute>

✅ 任务已完成：已创建函館一日遊行程链，包含5个地点，涵盖美食、文化、购物和住宿。`

// 加载环境变量
dotenv.config();

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ToolExecutionState {
  hasPendingToolCall: boolean;
  currentToolResponse: string;
  toolCallIndex: number;
}

class AIMiddleware {
  private app: express.Application;
  private ollamaUrl: string;
  private ollamaModel: string;
  private apiClient: MapannaiApiClient;
  private port: number;
  private conversationSessions: Map<string, ConversationMessage[]> = new Map();
  private toolExecutionStates: Map<string, ToolExecutionState> = new Map();

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

    // 流式 AI 对话端点 - 主要修改部分
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
          this.conversationSessions.delete(currentSessionId);
          this.toolExecutionStates.delete(currentSessionId);
        } else {
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

        // 获取工具执行状态
        let toolState = this.toolExecutionStates.get(currentSessionId);
        if (!toolState) {
          toolState = {
            hasPendingToolCall: false,
            currentToolResponse: '',
            toolCallIndex: 0
          };
          this.toolExecutionStates.set(currentSessionId, toolState);
        }

        // 构建对话上下文
        let messages: ConversationMessage[] = [
          {
            role: 'system',
            content: prompt
          },
          ...conversation,
          {
            role: 'user',
            content: message
          }
        ];

        let fullResponse = '';
        let shouldContinue = true;
        let iterationCount = 0;
        const maxIterations = 10; // 防止无限循环

        // 主对话循环 - 确保每次只处理一个工具调用
        while (shouldContinue && iterationCount < maxIterations) {
          iterationCount++;
          
          let currentResponse = '';
          let hasToolCall = false;
          let executeBlockContent = '';

          // 流式调用 Ollama
          await this.callOllamaStream(messages, (chunk: string) => {
            currentResponse += chunk;
            fullResponse += chunk;
            
            // 实时发送流式数据
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            
            // 检测是否包含工具调用
            if (chunk.includes('<execute>') || executeBlockContent) {
              hasToolCall = true;
              // 收集execute块内容
              executeBlockContent += chunk;
            }
          });

          // 检查完整响应中是否包含工具调用
          if (!hasToolCall && currentResponse.includes('<execute>')) {
            hasToolCall = true;
            executeBlockContent = currentResponse;
          }

          // 解析工具调用
          if (hasToolCall) {
            console.log('🔍 检测到工具调用，解析内容:', executeBlockContent || currentResponse);
            const toolCalls = this.parseToolCalls(executeBlockContent || currentResponse);
            console.log('🔍 解析到的工具调用:', toolCalls);
            
            if (toolCalls.length > 0) {
              // 只执行第一个工具调用，确保顺序执行
              const toolCall = toolCalls[0];
              
              res.write(`data: ${JSON.stringify({ 
                type: 'tool_executing', 
                message: `正在执行工具: ${toolCall.tool}`,
                tools: [toolCall.tool]
              })}\n\n`);

              try {
                // 执行单个工具调用
                const results = await this.executeToolCalls([toolCall]);
                const result = results[0];
                
                if (result.error) {
                  res.write(`data: ${JSON.stringify({ 
                    type: 'tool_error', 
                    tool: toolCall.tool, 
                    error: result.error 
                  })}\n\n`);
                  
                  // 将错误信息添加到对话上下文中
                  messages.push({
                    role: 'assistant',
                    content: currentResponse
                  });
                  messages.push({
                    role: 'user',
                    content: `工具调用失败 (${toolCall.tool}): ${result.error}\n\n请调整策略或重试。`
                  });
                  
                } else {
                  res.write(`data: ${JSON.stringify({ 
                    type: 'tool_call', 
                    tool: toolCall.tool, 
                    result: result.result 
                  })}\n\n`);
                  
                  // 将成功结果添加到对话上下文中
                  messages.push({
                    role: 'assistant',
                    content: currentResponse
                  });
                  messages.push({
                    role: 'user',
                    content: `✅ 工具调用成功 (${toolCall.tool}): ${JSON.stringify(result.result)}\n\n请基于此结果继续下一步操作。`
                  });
                  
                  // 更新session中的对话历史
                  this.updateSessionHistory(
                    currentSessionId, 
                    currentResponse, 
                    `工具调用结果 (${toolCall.tool}): ${JSON.stringify(result.result)}`
                  );
                }
                
                // 发送等待AI响应的信号
                res.write(`data: ${JSON.stringify({ 
                  type: 'waiting_ai_response', 
                  message: '等待AI基于工具结果生成下一步响应...' 
                })}\n\n`);
                
                // 继续循环，让AI生成下一步响应
                shouldContinue = true;
                
              } catch (error) {
                console.error('工具调用执行异常:', error);
                res.write(`data: ${JSON.stringify({ 
                  type: 'tool_error', 
                  error: error instanceof Error ? error.message : '工具调用执行异常' 
                })}\n\n`);
                shouldContinue = false;
              }
            } else {
              // 没有工具调用，结束循环
              shouldContinue = false;
            }
          } else {
            // 没有检测到工具调用，结束循环
            shouldContinue = false;
          }

          // 检查任务完成标记
          if (currentResponse.includes('✅ 任务已完成')) {
            shouldContinue = false;
            res.write(`data: ${JSON.stringify({ 
              type: 'task_completed', 
              message: '检测到任务完成标记' 
            })}\n\n`);
          }
        }

        // 发送完成信号
        res.write(`data: ${JSON.stringify({ type: 'done', response: fullResponse })}\n\n`);
        res.end();

      } catch (error) {
        console.error('流式聊天处理错误:', error);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: error instanceof Error ? error.message : '未知错误' 
        })}\n\n`);
        res.end();
      }
    });

    // 其他路由保持不变...
    this.app.get('/tools', (req, res) => {
      const tools = [
        {
          name: 'create_marker_v2',
          description: '通过地名创建标记：内部搜索地点并择优坐标。为提高准确度，请尽量提供更具体的查询，例如"函馆山附近 炸猪排店"。注意：只需要提供name（地名）、iconType（图标类型）和可选的content（描述），不需要提供coordinates坐标。',
          parameters: {
            name: 'string (地名，如"美之海水族馆")',
            iconType: 'string (图标类型)',
            content: 'string (可选，描述信息)'
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
          this.toolExecutionStates.delete(sessionId);
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
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
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
                // 忽略解析错误
              }
            }
          }
        });

        (response.data as any).on('error', (error: Error) => {
          console.error('Ollama 流式响应错误:', error);
          reject(new Error(`Ollama 服务错误: ${error.message}`));
        });

        (response.data as any).on('end', () => {
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer);
              if (data.message && data.message.content) {
                const content = data.message.content;
                fullResponse += content;
                onChunk(content);
              }
            } catch (e) {
              // 忽略解析错误
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

  private parseToolCalls(response: string): Array<{ tool: string; args: any; uuid?: string }> {
    const toolCalls: Array<{ tool: string; args: any; uuid?: string }> = [];
    
    console.log('🔍 parseToolCalls 输入:', response);
    
    // 提取<execute>标签内的内容
    const executeMatch = response.match(/<execute>([\s\S]*?)<\/execute>/);
    if (!executeMatch) {
      console.log('🔍 未找到 <execute> 标签');
      return toolCalls;
    }
    
    const executionSection = executeMatch[1];
    console.log('🔍 execute 内容:', executionSection);
    
    // 使用更精确的方法匹配JSON对象
    const lines = executionSection.split('\n');
    let jsonBuffer = '';
    let braceCount = 0;
    let inJson = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes('{') && !inJson) {
        inJson = true;
        jsonBuffer = '';
        braceCount = 0;
      }
      
      if (inJson) {
        jsonBuffer += line + '\n';
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        
        if (braceCount === 0 && jsonBuffer.trim()) {
          try {
            const toolCallData = JSON.parse(jsonBuffer.trim());
            if (toolCallData.tool) {
              const args = toolCallData.arguments || {};
              toolCalls.push({
                tool: toolCallData.tool,
                args: args,
                uuid: toolCallData.uuid
              });
            }
          } catch (error) {
            // 安静失败
          }
          
          jsonBuffer = '';
          inJson = false;
        }
      }
    }
    
    return toolCalls;
  }

  private async executeToolCalls(toolCalls: Array<{ tool: string; args: any; uuid?: string }>): Promise<any[]> {
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
    
    sessionHistory.push({
      role: 'assistant',
      content: assistantResponse
    });
    
    sessionHistory.push({
      role: 'user',
      content: toolResults
    });
    
    this.conversationSessions.set(sessionId, sessionHistory);
  }

  private async callTool(toolName: string, args: any): Promise<any> {
    try {
      switch (toolName) {
        case 'create_marker_v2':
          // 支持两种格式：places 和 markers
          const batchData = args.places || args.markers;
          if (batchData && Array.isArray(batchData)) {
            const results = [];
            for (const item of batchData) {
              try {
                // 处理不同的参数格式
                const placeData = {
                  name: item.name || item.title,
                  iconType: item.iconType,
                  content: item.content || item.description || ''
                };
                const result = await this.apiClient.createMarkerFromPlaceName(placeData);
                results.push(result);
              } catch (error) {
                const itemName = item.name || item.title || '未知地点';
                console.error(`创建标记失败 ${itemName}:`, error);
                results.push({ error: error instanceof Error ? error.message : '创建失败', place: itemName });
              }
            }
            return { type: 'batch', results };
          } else {
            return await this.apiClient.createMarkerFromPlaceName(args);
          }
        
        case 'update_marker_content':
          return await this.apiClient.updateMarkerContent(args);
        
        case 'create_travel_chain':
          return await this.apiClient.createChain(args);
        
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