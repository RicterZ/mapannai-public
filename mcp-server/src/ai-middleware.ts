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
2. **日语地点名称**：创建标记时尽量使用日语官方名称，确保地点准确性。
3. **直接创建标记**：无需检查现有标记，直接基于您的知识推荐地点并调用create_marker_v2创建标记。
4. **自动规划执行**：不需要向用户确认是否继续，AI应自行按计划执行所有步骤。
5. **等待工具结果**：每次调用工具后必须等待工具返回结果，再继续下一步。
6. **信息补充机制**：创建标记后，使用update_marker_content添加详细信息（门票、营业时间、交通提示等）。
7. **行程链创建**：基于思考阶段的规划顺序，调用create_travel_chain组织markerIds。

## 简化工作流程
1) **思考阶段**：分析用户需求，列出推荐地点和顺序。
2) **标记创建阶段**：对每个推荐地点直接创建标记，使用日语名称。
3) **信息补充阶段**：为每个标记补充详细信息。
4) **行程链创建**：基于规划顺序创建行程链。
5) **任务完成**：输出 ✅ 任务已完成。

## 可用工具
- **create_marker_v2**: 通过地名创建标记 (name, iconType, content可选) - 内部会搜索地点并获取坐标
- **update_marker_content**: 更新标记内容 (markerId, title, markdownContent)
- **create_travel_chain**: 创建行程链 (markerIds, chainName, description)

## 工具调用格式
{
  "tool": "工具名称",
  "arguments": { "参数": "值" },
  "uuid": "随机UUID字符串"
}

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
- **实用信息**：门票价格、营业时间
- **交通提示**：公共交通方式、停车信息
- **注意事项**：最佳游览时间、预订建议等

## 日语地点命名规则
- 优先使用日语官方名称（如"東京タワー"而非"Tokyo Tower"）
- 对于知名景点，使用当地常用名称
- 确保名称准确性，避免翻译错误

## 自动规划要求
- AI应自行完成所有规划步骤，不需要向用户确认
- 按思考阶段的计划自动执行所有工具调用
- 遇到工具错误时自动尝试解决或调整计划

## 对话流程要求
- 每次调用工具后必须等待工具返回结果
- 收到工具结果后，根据结果决定下一步操作
- 保持对话的自然流畅，但严格遵循思考-执行的分离格式

## 示例：函馆一日游（日语名称版本）
<think>用户需要函馆一日游。推荐以下地点和顺序：
1. 函館朝市（美食）- 海鲜市场，早餐推荐
2. 五稜郭公園（文化）- 历史遗迹，免费入园
3. 元町区域（购物/文化）- 西洋建筑群
4. 函館山（景点）- 地标，夜景著名
5. 湯の川温泉（住宿）- 温泉旅馆
顺序：函館朝市→五稜郭公園→元町区域→函館山→湯の川温泉</think>

<execute>
{
  "tool": "create_marker_v2",
  "arguments": {
    "name": "函館朝市",
    "iconType": "food",
    "content": "函館著名的海鲜市场"
  },
  "uuid": "abc123-def456-ghi789"
}
</execute>

<think>已创建函館朝市标记，等待工具返回markerId后补充详细信息。</think>

[等待工具返回结果...(这段话不必输出，这只是表示你需要等待返回结果)]

<execute>
{
  "tool": "update_marker_content",
  "arguments": {
    "markerId": "返回的markerId",
    "title": "函館朝市",
    "markdownContent": "**函館朝市**\n- 特色：新鲜海鲜、海胆、螃蟹\n- 时间：6:00-14:00\n- 推荐：海鲜丼早餐\n- 交通：JR函館站步行5分钟"
  },
  "uuid": "def456-ghi789-jkl012"
}
</execute>

<think>已更新函館朝市信息，继续创建下一个标记：五稜郭公園。</think>

<execute>
{
  "tool": "create_marker_v2",
  "arguments": {
    "name": "五稜郭公園",
    "iconType": "culture",
    "content": "星形要塞历史公园"
  },
  "uuid": "ghi789-jkl012-mno345"
}
</execute>

[重复以上步骤为其他地点创建标记并更新内容...]

<think>所有标记已创建并更新信息，现在基于规划顺序创建行程链。</think>

<execute>
{
  "tool": "create_travel_chain",
  "arguments": {
    "markerIds": ["id1", "id2", "id3", "id4", "id5"],
    "chainName": "函館一日遊",
    "description": "从早餐市场开始，游览历史遗迹，欣赏西洋建筑，观看夜景，最后入住温泉旅馆"
  },
  "uuid": "jkl012-mno345-pqr678"
}
</execute>

✅ 任务已完成：已创建函館一日遊行程链，包含5个地点，涵盖美食、文化、购物和住宿。`

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
  private executedToolCalls: Set<string> = new Set(); // 存储已执行的工具调用UUID

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
            content: prompt
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
          let responseBuffer = ''; // 用于处理跨chunk的标签
          
          // 流式调用 Ollama
          await this.callOllamaStream(currentMessages, async (chunk: string) => {
            currentResponse += chunk;
            fullResponse += chunk;
            responseBuffer += chunk;
            
            // 发送流式数据
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            
            // 检查是否有完整的execute块（处理跨chunk的情况）
            const executePattern = /<execute>[\s\S]*?<\/execute>/g;
            let match;
            let hasExecuteBlock = false;
            
            // 重置正则表达式的lastIndex
            executePattern.lastIndex = 0;
            
            while ((match = executePattern.exec(responseBuffer)) !== null) {
              hasExecuteBlock = true;
              const executeBlock = match[0];
              
              // 解析这个execute块中的工具调用
              const toolCalls = this.parseToolCalls(executeBlock);
              if (toolCalls.length > 0) {
                // 检查是否有重复的工具调用
                const newToolCalls = toolCalls.filter(toolCall => {
                  if (toolCall.uuid && this.executedToolCalls.has(toolCall.uuid)) {
                    console.log(`跳过重复的工具调用: ${toolCall.tool} (UUID: ${toolCall.uuid})`);
                    return false;
                  }
                  return true;
                });

                if (newToolCalls.length === 0) {
                  console.log('所有工具调用都已执行过，跳过');
                  continue;
                }

                res.write(`data: ${JSON.stringify({ type: 'tool_executing', message: '正在执行工具调用...' })}\n\n`);
                
                try {
                  // 同步执行所有工具调用
                  const results = await this.executeToolCalls(newToolCalls);
                  
                  // 发送工具调用结果
                  for (let i = 0; i < newToolCalls.length; i++) {
                    const toolCall = newToolCalls[i];
                    const result = results[i];
                    
                    // 记录已执行的工具调用UUID
                    if (toolCall.uuid) {
                      this.executedToolCalls.add(toolCall.uuid);
                    }
                    
                    if (result.error) {
                      res.write(`data: ${JSON.stringify({ type: 'tool_error', tool: toolCall.tool, error: result.error })}\n\n`);
                    } else {
                      res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: toolCall.tool, result: result.result })}\n\n`);
                    }
                  }
                  
                  // 将工具调用结果添加到对话上下文中
                  const toolResults = results.map((result, index) => {
                    const toolCall = newToolCalls[index];
                    const toolResult = result.result || result.error;
                    return `工具调用结果 (${toolCall.tool}): ${JSON.stringify(toolResult)}`;
                  }).join('\n\n');
                  
                  // 更新对话上下文，添加工具结果
                  currentMessages.push({
                    role: 'assistant',
                    content: currentResponse
                  });
                  currentMessages.push({
                    role: 'user',
                    content: `🔧 MCP工具返回结果：\n\n${toolResults}\n\n请基于这些真实结果继续下一步操作。如果任务已完成，请说明完成情况。如果需要继续操作，请按照格式要求输出。`
                  });

                  // 更新session中的对话历史
                  this.updateSessionHistory(currentSessionId, currentResponse, `🔧 MCP工具返回结果：\n\n${toolResults}`);
                  
                  // 设置标志，让AI继续生成下一步响应
                  hasToolCalls = true;
                  
                } catch (error) {
                  console.error('工具调用执行异常:', error);
                  res.write(`data: ${JSON.stringify({ type: 'tool_error', error: error instanceof Error ? error.message : '工具调用执行异常' })}\n\n`);
                  hasToolCalls = false;
                }
              }
            }
            
            // 如果找到了execute块，从缓冲区中移除已处理的部分
            if (hasExecuteBlock) {
              // 移除已处理的execute块，保留后续内容
              responseBuffer = responseBuffer.replace(executePattern, '');
            }
          });
          
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

  private parseToolCalls(response: string): Array<{ tool: string; args: any; uuid?: string }> {
    const toolCalls: Array<{ tool: string; args: any; uuid?: string }> = [];

    console.log(response)
    console.log("--------------------------------")
    
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
    
    // 使用更精确的方法匹配JSON对象
    // 找到所有包含"tool"的JSON对象
    const lines = executionSection.split('\n');
    let jsonBuffer = '';
    let braceCount = 0;
    let inJson = false;
    let startLine = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 如果行包含"tool"且不在JSON中，需要找到JSON对象的开始
      if (trimmedLine.includes('"tool"') && !inJson) {
        // 向前查找JSON对象的开始（包含{的行）
        let jsonStart = i;
        for (let j = i; j >= 0; j--) {
          if (lines[j].includes('{')) {
            jsonStart = j;
            break;
          }
        }
        
        inJson = true;
        jsonBuffer = '';
        braceCount = 0;
        startLine = jsonStart;
        
        // 从JSON开始行重新收集
        for (let k = jsonStart; k <= i; k++) {
          jsonBuffer += lines[k] + '\n';
          for (const char of lines[k]) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
          }
        }
      }
      
      if (inJson && i > startLine) {
        // 继续收集后续行
        jsonBuffer += line + '\n';
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        
        // 如果大括号平衡，说明JSON对象完整
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
            // 安静失败，不输出大量日志
          }
          
          // 重置状态
          jsonBuffer = '';
          inJson = false;
          braceCount = 0;
          startLine = -1;
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
