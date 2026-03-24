# 部署指南

## 组件与依赖（务必先准备）

- Mapbox 账号与公钥（必需）：用于前端地图渲染
  - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`（pk. 开头）
  - `NEXT_PUBLIC_MAPBOX_STYLE`（推荐中文样式）
- Google API Key（必需，用于地点搜索与路径规划）
  - `GOOGLE_API_KEY`
  - `GOOGLE_API_BASE_URL`（默认 `https://maps.googleapis.com`）
- 运行环境：Node 18+/Docker（推荐 Docker 部署）

> **注意：** Markers 数据现在完全存储在本地 SQLite（`data/mapannai.db`），不再依赖 Mapbox Dataset。`MAPBOX_SECRET_ACCESS_TOKEN`、`MAPBOX_USERNAME`、`MAPBOX_DATASET_ID` 仅在初次迁移时需要，迁移完成后可从 `.env` 中删除。

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
# Mapbox 前端渲染（必需）
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_public_token_here
NEXT_PUBLIC_MAPBOX_STYLE=mapbox://styles/mapbox/streets-zh-v1

# Google API（必需，用于地点搜索与路径规划）
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_API_BASE_URL=https://maps.googleapis.com

# 腾讯云 COS（可选，如需上传图片）
TENCENT_COS_SECRET_ID=your_tencent_secret_id
TENCENT_COS_SECRET_KEY=your_tencent_secret_key
TENCENT_COS_REGION=ap-chongqing
TENCENT_COS_BUCKET=your_bucket_name

# 前端可见的基础地址
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# SQLite 路径（可选，默认 ./data/mapannai.db）
# SQLITE_PATH=/data/mapannai.db
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
    volumes:
      - ./data:/app/data    # 持久化 SQLite 数据库
    restart: unless-stopped
```

#### 关键点
- 仅支持 Mapbox；`NEXT_PUBLIC_*` 变量需在构建时通过 `args` 传入
- 其他变量在运行时通过 `env_file` 注入
- **务必挂载 `./data` 目录**，否则 SQLite 数据在容器重启后丢失

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

## 数据迁移（从 Mapbox Dataset 迁移）

如果您有历史 marker 数据存储在 Mapbox Dataset，使用以下脚本一次性迁移到 SQLite：

```bash
# 确保 .env 中包含 Mapbox 凭据
# MAPBOX_SECRET_ACCESS_TOKEN=sk.xxx
# MAPBOX_USERNAME=yourname
# MAPBOX_DATASET_ID=xxx

npx tsx scripts/migrate-dataset-to-sqlite.ts

# 验证迁移结果
sqlite3 data/mapannai.db "SELECT COUNT(*) FROM markers;"
```

迁移完成后，`.env` 中的 `MAPBOX_SECRET_ACCESS_TOKEN`、`MAPBOX_USERNAME`、`MAPBOX_DATASET_ID` 可以安全删除。

## 安全注意事项

1. **不要将 `.env` 文件提交到版本控制系统**
2. **确保生产环境中的密钥与开发环境不同**
3. **定期轮换 API 密钥**
4. **使用最小权限原则配置云服务权限**

## 验证配置

应用启动时会自动验证环境变量配置。如果缺少必要的环境变量，会在控制台显示错误信息。

---

## 反向代理配置

Nginx 基础反向代理配置：

```nginx
location / {
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_pass http://127.0.0.1:3000;
}
```

## 部署后自检清单

- 地图能正常加载（无 token 错误）。
- 搜索地点可用（`/api/search` 成功返回）。
- 创建标记成功，地图即时显示新点（无需刷新）。
- 创建行程链后，蓝色路径即时出现。
- `sqlite3 data/mapannai.db "SELECT COUNT(*) FROM markers;"` 返回正确数量。
