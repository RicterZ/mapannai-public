# 部署指南

## 组件与依赖（务必先准备）

- Mapbox 账号与公钥（必需）：用于前端地图渲染
  - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`（pk. 开头）
  - `NEXT_PUBLIC_MAPBOX_STYLE`（推荐中文样式）
- Mapbox Dataset 写入能力（强烈推荐，用于持久化标记/行程链）
  - `MAPBOX_SECRET_ACCESS_TOKEN`（sk. 开头）
  - `MAPBOX_USERNAME`
  - `MAPBOX_DATASET_ID`
- Ollama 推理服务（可选：用于 AI 聊天与生成计划）
  - `OLLAMA_URL`（例如 `http://localhost:11434`）
  - `OLLAMA_MODEL`（例如 `deepseek-r1:8b`）
- Google API Key（必需，用于地点搜索与路径规划）
  - `GOOGLE_API_KEY`
  - `GOOGLE_API_BASE_URL`（默认 `https://maps.googleapis.com`）
- 反向代理需支持 SSE（推荐 Nginx，需关闭代理缓冲，见文末配置）
- 运行环境：Node 18+/Docker（推荐 Docker 部署）

## Docker 部署

### 快速开始
```bash
# 1. 配置环境变量
# 确保 .env 文件存在并包含必要的环境变量

# 2. 构建并运行生产环境
docker-compose up -d mapannai

# 3. 访问应用
# 生产环境: http://localhost:3000
```

### Docker Compose
```bash
# 启动生产环境
docker-compose up -d mapannai

# 查看日志
docker-compose logs -f mapannai

# 停止服务
docker-compose down
```

## 手动部署指引

### 1. 环境变量配置

#### 创建 .env 文件
在项目根目录创建 `.env` 文件，可以参考 `env.example` 文件：

```bash
# 复制示例文件
cp env.example .env
# 然后编辑 .env 文件，填入您的实际配置
```

包含以下环境变量（按用途分组）：

```bash
# Mapbox（必需）
MAPBOX_SECRET_ACCESS_TOKEN=sk.your_mapbox_secret_token_here
MAPBOX_USERNAME=your_mapbox_username
MAPBOX_DATASET_ID=your_dataset_id_here

# Google API（必需，用于地点搜索与路径规划）
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_API_BASE_URL=https://maps.googleapis.com

# 腾讯云 COS（可选，如需上传资产）
TENCENT_COS_SECRET_ID=your_tencent_secret_id
TENCENT_COS_SECRET_KEY=your_tencent_secret_key
TENCENT_COS_REGION=ap-chongqing
TENCENT_COS_BUCKET=your_bucket_name

# AI 服务（可选：启用 AI 聊天/计划）
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:8b
# AI 请求“无活动超时”（秒）。只在流中“无新数据”达到该时间才会超时
AI_REQUEST_TIMEOUT_SEC=180

# 前端可见的基础地址（少数字段在服务端内部使用到构造绝对URL）
# 若反向代理导致 server fetch 需要绝对地址，建议设置此项
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 2. Docker Compose 配置

#### 修改 docker-compose.yml
确保 `docker-compose.yml` 中的 `args` 配置正确：

```yaml
services:
  mapannai:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk...
        - NEXT_PUBLIC_MAPBOX_STYLE=mapbox://styles/mapbox/streets-zh-v1
        - NEXT_PUBLIC_IMAGE_DOMAINS=mapannai-123456.cos.ap-chongqing.myqcloud.com
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
```

#### 关键点
- 仅支持 Mapbox；`NEXT_PUBLIC_*` 变量需在构建时通过 `args` 传入
- 其他变量在运行时通过 `env_file` 注入
- 确保 `.env` 文件存在且包含必要变量（见上）

> 提示：若使用 AI 功能，请同时在容器/服务器上提供可访问的 OLLAMA_URL 服务。

#### 地图/AI 配置要点
- Mapbox：必须配置 `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` 与 `NEXT_PUBLIC_MAPBOX_STYLE`
- Mapbox Dataset：要持久化标记/行程链，需提供 `MAPBOX_SECRET_ACCESS_TOKEN`、`MAPBOX_USERNAME`、`MAPBOX_DATASET_ID`
- AI（Ollama）：如需使用 AI 聊天与计划，请提供 `OLLAMA_URL` 与 `OLLAMA_MODEL`
- Google API：必须提供 `GOOGLE_API_KEY` 与 `GOOGLE_API_BASE_URL` 才能正常进行地点搜索与路径规划

#### 实际配置说明
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`: 您的 Mapbox 公钥令牌（以 `pk.` 开头）
- `NEXT_PUBLIC_MAPBOX_STYLE`: Mapbox 地图样式，默认为中文街道样式
- `GOOGLE_API_KEY`: Google API 密钥，用于后端搜索和路径规划
- `GOOGLE_API_BASE_URL`: Google API 基础 URL，默认为 `https://maps.googleapis.com`
- `NEXT_PUBLIC_IMAGE_DOMAINS`: 图片域名，用于 Next.js 图片优化，格式为 `bucket-name.cos.region.myqcloud.com`
- `OLLAMA_URL`/`OLLAMA_MODEL`: AI 服务地址与模型（如使用 Ollama 等）
- `AI_REQUEST_TIMEOUT_SEC`: AI 流式“无活动超时”秒数（流中持续有数据时不会超时）
- `NEXT_PUBLIC_BASE_URL`: 在部分服务端逻辑需要绝对URL时使用

### 3. 部署步骤

#### 本地部署
```bash
# 1. 确保 .env 文件存在并配置正确
# 2. 构建并启动服务
docker-compose up -d mapannai

# 3. 查看日志
docker-compose logs -f mapannai

# 4. 访问应用
# http://localhost:3000
```

#### 服务器部署
```bash
# 1. 上传项目文件到服务器
# 2. 确保 .env 文件在服务器上配置正确
# 3. 构建并启动
docker-compose up -d mapannai

# 4. 设置开机自启（可选）
docker-compose up -d --restart unless-stopped mapannai
```

### 4. 云平台部署

#### AWS Amplify 部署
1. 在 Amplify 控制台中，进入您的应用
2. 进入 "Environment variables" 设置
3. 添加上述环境变量

#### Vercel 部署
1. 在 Vercel 控制台中，进入您的项目
2. 进入 "Settings" > "Environment Variables"
3. 添加上述环境变量

#### 其他平台
根据您使用的部署平台，在相应的环境变量设置中添加上述变量。

## 安全注意事项

1. **不要将 `.env` 文件提交到版本控制系统**
2. **确保生产环境中的密钥与开发环境不同**
3. **定期轮换 API 密钥**
4. **使用最小权限原则配置云服务权限**

## 验证配置

应用启动时会自动验证环境变量配置。如果缺少必要的环境变量，会在控制台显示错误信息。

---

## 实时功能与反向代理配置

为确保 AI 流式响应（SSE）与地图实时渲染正常，请确认反向代理关闭缓冲并正确透传 `text/event-stream`：

Nginx 示例：

```nginx
location /api/ai/ {
  proxy_http_version 1.1;
  proxy_set_header Connection '';
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  proxy_buffering off;      # 关闭缓冲，保证SSE实时传输
  proxy_cache off;
  chunked_transfer_encoding on;

  proxy_pass http://127.0.0.1:3000;
}
```

注意事项：
- 生产环境必须确保 `GOOGLE_API_KEY` 可用，否则搜索与路径规划将不可用（连线可能退化为直线或失败）。
- Mapbox 需使用有效公钥（`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`）且数据集 ID 可读写，行程链写入依赖 Dataset 的 upsert 权限。
- 若后端需要构造绝对 URL，请设置 `NEXT_PUBLIC_BASE_URL` 指向外部可访问的域名。

## 部署后自检清单

- 地图能正常加载（无 token 错误）。
- 搜索地点可用（`/api/search` 成功返回）。
- 创建标记成功，地图即时显示新点（无需刷新）。
- 创建行程链后，蓝色路径即时出现；首次计算可能稍有延迟，随后命中本地缓存。
- AI 聊天/计划：流式输出持续，无活动期间才会超时（由 `AI_REQUEST_TIMEOUT_SEC` 控制）。

