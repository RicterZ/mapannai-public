import axios from 'axios';
import { MapannaiApiClient } from './api-client';

const prompt = `你是旅游规划助手，帮助用户创建地图标记和规划行程。你的任务很简单：基于你的知识推荐景点，调用工具创建标记，补充地点信息，最后创建行程链。

输出格式
<think>
[深度思考用户需求，列出具体地点计划A、B、C、D、E和推荐顺序，包括住宿、餐饮、景点等类型，并考虑交通和时间安排。]
</think>

<execute>
[只能包含工具调用，不能有其他内容]
</execute>

核心规则
1. 深度思考优先：在<think>内完成全面需求分析，列出5-8个推荐地点和游览顺序。
2. 日语地点名称：创建标记时尽量使用日语官方名称，确保地点准确性。必须包含城市信息避免歧义（如"長崎市平和公園"而非"平和公園"）。
3. 直接创建标记：无需检查现有标记，直接基于你的知识推荐地点并调用create_marker_v2创建标记。
4. 自动规划执行：不需要向用户确认是否继续，AI应自行按计划执行所有步骤。
5. 严格等待工具结果：这是最重要的规则：
   - 每次只能调用一个工具
   - 必须等待工具返回完整结果后才能继续下一步
   - 根据返回结果决定下一步操作
   - 如果工具调用失败，需要调整策略或重试
6. 信息补充机制：创建标记后，使用update_marker_content添加详细信息（门票、营业时间、交通提示等）。
7. 行程链创建：最后使用create_travel_chain将所有标记连接成完整行程。

可用工具
- create_marker_v2: 通过地名创建标记 - 支持单个地点或批量创建
  - 单个地点: { "name": "地点名", "iconType": "类型", "content": "描述" }
  - 批量创建: { "places": [{"name": "地点1", "iconType": "类型1"}, {"name": "地点2", "iconType": "类型2"}] }
- update_marker_content: 更新标记内容 (markerId, title, markdownContent)
- create_travel_chain: 创建行程链 (markerIds, chainName, description)

图标类型规范
- landmark: 地标建筑、纪念碑、塔楼
- culture: 博物馆、艺术馆、历史遗迹、文化场所
- natural: 自然景观、公园、海滩、山景
- food: 餐厅、美食街、咖啡厅、市场
- shopping: 商场、购物中心、市场、商店
- activity: 娱乐场所、运动场馆、活动场所
- location: 一般位置、地址、普通地点
- hotel: 酒店、住宿、民宿、旅馆
- park: 公园、绿地、花园

工具调用格式
{
  "tool": "工具名称",
  "arguments": { "参数": "值" }
}

重要格式要求
- create_marker_v2 必须使用 "places" 字段，不能使用 "markers"
- iconType 必须是预定义的类型：landmark, culture, natural, food, shopping, activity, location, hotel, park
- name 字段是必需的，不能使用 "title"
- 批量创建格式：{ "places": [{"name": "地点名", "iconType": "类型", "content": "描述"}] }

严格等待机制
- 一次只调用一个工具：每个<execute>块中只能包含一个工具调用
- 等待结果：调用工具后必须等待返回结果，再生成下一个<think>和<execute>
- 结果处理：基于工具返回结果决定下一步操作

对话流程
1) 需求分析阶段：在<think>中分析用户需求，制定详细计划。
2) 标记创建阶段：一次性创建所有推荐地点标记，使用日语名称。
3) 信息补充阶段：为每个标记补充详细信息。
4) 行程链创建：基于规划顺序创建行程链。
5) 任务完成：输出 ✅ 任务已完成。

示例对话
用户：我想去函館市旅游，请帮我规划3天的行程

<think>
用户想要函館市3天旅游规划。函館市是北海道的重要城市，以夜景、海鲜、历史建筑闻名。

推荐地点和顺序：
1. 函館市朝市 - 海鲜市场，早餐体验
2. 函館市五稜郭公園 - 星形要塞历史公园
3. 函館市元町区域 - 西洋建筑群
4. 函館市函館山 - 夜景著名地标
5. 函館市湯の川温泉 - 温泉体验

计划：第一天朝市+五稜郭，第二天元町+函館山夜景，第三天温泉放松。
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
    "markdownContent": "函館市朝市\n特色：新鲜海鲜、海胆、螃蟹\n时间：6:00-14:00\n推荐：海鲜丼早餐\n交通：JR函館站步行5分钟"
  }
}
</execute>

***等待工具返回结果***

<think>
朝市信息已更新，现在处理五稜郭公園，markerId为: marker_124
</think>

<execute>
{
  "tool": "update_marker_content",
  "arguments": {
    "markerId": "marker_124",
    "title": "函館市五稜郭公園",
    "markdownContent": "函館市五稜郭公園\n历史：江户时代星形要塞\n樱花季：4月下旬-5月上旬\n开放时间：9:00-18:00\n门票：免费（五稜郭塔需付费）"
  }
}
</execute>

***等待工具返回结果***

<think>
五稜郭信息已更新，现在处理元町区域，markerId为: marker_125
</think>

<execute>
{
  "tool": "update_marker_content",
  "arguments": {
    "markerId": "marker_125",
    "title": "函館市元町区域",
    "markdownContent": "函館市元町区域\n特色：西洋建筑群、教堂\n推荐：八幡坂、旧函館区公会堂\n交通：市电元町站下车\n时间：2-3小时游览"
  }
}
</execute>

***等待工具返回结果***

<think>
元町区域信息已更新，现在处理函館山，markerId为: marker_126
</think>

<execute>
{
  "tool": "update_marker_content",
  "arguments": {
    "markerId": "marker_126",
    "title": "函館市函館山",
    "markdownContent": "函館市函館山\n世界三大夜景之一\n缆车时间：10:00-22:00\n最佳时间：日落时分\n缆车费用：往返1500日元"
  }
}
</execute>

***等待工具返回结果***

<think>
函館山信息已更新，现在处理湯の川温泉，markerId为: marker_127
</think>

<execute>
{
  "tool": "update_marker_content",
  "arguments": {
    "markerId": "marker_127",
    "title": "函館市湯の川温泉",
    "markdownContent": "函館市湯の川温泉\n北海道最古老的温泉\n推荐酒店：湯の川温泉ホテル\n特色：海景温泉\n交通：市电湯の川站下车"
  }
}
</execute>

***等待工具返回结果***

<think>
所有标记信息已补充完成，现在创建行程链，将所有标记按游览顺序连接。
</think>

<execute>
{
  "tool": "create_travel_chain",
  "arguments": {
    "markerIds": ["marker_123", "marker_124", "marker_125", "marker_126", "marker_127"],
    "chainName": "函館市3天深度游",
    "description": "函館市经典景点3天游览路线，包含朝市、历史建筑、夜景和温泉体验"
  }
}
</execute>

***等待工具返回结果***

✅ 任务已完成！已为您创建函館市3天旅游规划，包含5个精选景点和完整行程链。`;

export class AiService {
  private apiClient: MapannaiApiClient;
  private processedExecuteBlocks: Set<string> = new Set();
  private toolExecutionStates: Map<string, any> = new Map();

  constructor() {
    this.apiClient = new MapannaiApiClient();
  }

  async processMessage(message: string): Promise<ReadableStream<Uint8Array>> {
    try {
      console.log('AI服务开始处理消息:', message);
      // 调用Ollama API并返回流
      const stream = await this.callOllamaStream(message);
      console.log('Ollama流创建成功:', stream);
      return stream;
    } catch (error) {
      console.error('AI服务处理错误:', error);
      // 返回错误信息的流
      const errorText = '抱歉，AI服务暂时不可用，请稍后再试。';
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(errorText));
          controller.close();
        }
      });
    }
  }

  private async callOllamaStream(message: string): Promise<ReadableStream<Uint8Array>> {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'deepseek-r1:8b';
    
    console.log('调用Ollama API:', { ollamaUrl, model });
    console.log('请求URL:', `${ollamaUrl}/api/generate`);
    
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: `${prompt}\n\n用户消息: ${message}`,
        stream: true
      })
    });

    console.log('Ollama响应状态:', response.status);
    console.log('Ollama响应头:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API错误:', response.status, errorText);
      throw new Error(`Ollama API错误: ${response.status} - ${errorText}`);
    }

    console.log('Ollama响应体:', response.body);
    // 直接返回Ollama的流式响应
    return response.body!;
  }

  private async callOllama(message: string): Promise<string> {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'deepseek-r1:8b';
    
    const response = await axios.post(`${ollamaUrl}/api/generate`, {
      model: model,
      prompt: `${prompt}\n\n用户消息: ${message}`,
      stream: false
    });

    return response.data.response;
  }

  private async processToolCalls(response: string): Promise<string> {
    let currentResponse = '';
    let fullResponse = '';
    let shouldContinue = true;
    let iterationCount = 0;
    const maxIterations = 10;

    // 重置状态
    this.processedExecuteBlocks.clear();
    this.toolExecutionStates.clear();

    while (shouldContinue && iterationCount < maxIterations) {
      iterationCount++;
      
      // 模拟流式处理
      const chunks = response.split('\n');
      for (const chunk of chunks) {
        currentResponse += chunk + '\n';
        fullResponse += chunk + '\n';

        // 检查是否有工具调用
        if (currentResponse.includes('<execute>')) {
          const executeBlocks = this.extractExecuteBlocks(currentResponse);
          
          for (const block of executeBlocks) {
            if (!this.processedExecuteBlocks.has(block)) {
              this.processedExecuteBlocks.add(block);
              
              const toolCalls = this.parseToolCalls(block);
              if (toolCalls.length > 0) {
                // 只执行第一个工具调用
                const toolCall = toolCalls[0];
                const result = await this.callTool(toolCall.tool, toolCall.arguments);
                
                // 存储工具执行结果
                this.toolExecutionStates.set(toolCall.tool, result);
                
                // 生成下一步响应
                const nextResponse = await this.generateNextResponse(fullResponse, result);
                if (nextResponse) {
                  response = nextResponse;
                  currentResponse = '';
                  break;
                }
              }
            }
          }
        }
      }

      // 检查是否还有未处理的工具调用
      const remainingExecuteBlocks = this.extractExecuteBlocks(response);
      const unprocessedBlocks = remainingExecuteBlocks.filter(block => 
        !this.processedExecuteBlocks.has(block)
      );

      if (unprocessedBlocks.length === 0) {
        shouldContinue = false;
      }
    }

    return fullResponse;
  }

  private extractExecuteBlocks(text: string): string[] {
    const executeRegex = /<execute>([\s\S]*?)<\/execute>/g;
    const blocks: string[] = [];
    let match;

    while ((match = executeRegex.exec(text)) !== null) {
      blocks.push(match[1].trim());
    }

    return blocks;
  }

  private parseToolCalls(executeBlock: string): Array<{tool: string, arguments: any}> {
    try {
      const toolCalls: Array<{tool: string, arguments: any}> = [];
      
      // 尝试解析JSON格式的工具调用
      const jsonMatch = executeBlock.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const toolCall = JSON.parse(jsonMatch[0]);
        if (toolCall.tool && toolCall.arguments) {
          toolCalls.push(toolCall);
        }
      }

      return toolCalls;
    } catch (error) {
      console.error('解析工具调用失败:', error);
      return [];
    }
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

  private async generateNextResponse(currentResponse: string, toolResult: any): Promise<string | null> {
    // 这里可以添加逻辑来生成下一步的响应
    // 目前返回null表示不需要继续处理
    return null;
  }
}
