# 部署指南

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

包含以下环境变量：

```bash
# Mapbox 配置
MAPBOX_SECRET_ACCESS_TOKEN=sk.your_mapbox_secret_token_here
MAPBOX_USERNAME=your_mapbox_username
MAPBOX_DATASET_ID=your_dataset_id_here

# 腾讯云 COS 配置
TENCENT_COS_SECRET_ID=your_tencent_secret_id
TENCENT_COS_SECRET_KEY=your_tencent_secret_key
TENCENT_COS_REGION=ap-chongqing
TENCENT_COS_BUCKET=your_bucket_name
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
- `NEXT_PUBLIC_*` 变量必须在构建时传递（通过 `args`）
- 其他变量在运行时传递（通过 `env_file`）
- 确保 `.env` 文件存在且包含所有必要的变量

#### 实际配置说明
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`: 您的 Mapbox 公钥令牌（以 `pk.` 开头）
- `NEXT_PUBLIC_MAPBOX_STYLE`: Mapbox 地图样式，默认为中文街道样式
- `NEXT_PUBLIC_IMAGE_DOMAINS`: 图片域名，用于 Next.js 图片优化，格式为 `bucket-name.cos.region.myqcloud.com`

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

