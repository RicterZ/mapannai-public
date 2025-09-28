# Mapannai AI 接入快速启动指南

## 🚀 5分钟快速开始

### 步骤1: 启动Mapannai应用

```bash
# 在项目根目录
npm run dev
```

确保应用运行在 `http://localhost:3000`

### 步骤2: 配置MCP Server

```bash
# 进入MCP服务器目录
cd mcp-server

# 安装依赖
npm install

# 配置环境变量
cp env.example .env
```

编辑 `.env` 文件：
```env
MAPANNAI_API_URL=http://localhost:3000
MAPANNAI_API_KEY=your_api_key_here
```

### 步骤3: 构建MCP Server

```bash
npm run build
```

### 步骤4: 配置AI助手

#### Claude Desktop 配置

在Claude Desktop设置中添加MCP服务器：

```json
{
  "mcpServers": {
    "mapannai": {
      "command": "node",
      "args": ["/Users/ricterzheng/Desktop/mapannai-public/mcp-server/dist/index.js"],
      "env": {
        "MAPANNAI_API_URL": "http://localhost:3000",
        "MAPANNAI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### 步骤5: 测试连接

运行演示脚本：

```bash
node demo.js
```

## 🎯 使用示例

### 创建旅游计划

向AI助手说：
```
请帮我创建一个京都3日游的旅游计划，包括主要景点、美食和住宿推荐。
```

### 更新标记信息

向AI助手说：
```
请为清水寺标记添加详细信息，包括门票价格、开放时间和游览建议。
```

### 创建美食路线

向AI助手说：
```
请搜索京都的美食地点，并创建一个美食之旅的行程链。
```

## 🔧 故障排除

### 问题1: MCP Server连接失败
**解决方案**: 检查Mapannai应用是否运行在 `http://localhost:3000`

### 问题2: 工具调用失败
**解决方案**: 检查参数格式，查看服务器日志

### 问题3: 权限错误
**解决方案**: 确认API密钥配置正确

## 📚 详细文档

- [完整接入指南](./AI_INTEGRATION.md)
- [MCP Server文档](./mcp-server/README.md)
- [API文档](./API_DOCUMENTATION.md)

## 🆘 获取帮助

如有问题，请：
1. 查看控制台日志
2. 检查网络连接
3. 确认配置正确
4. 提交Issue获取帮助
