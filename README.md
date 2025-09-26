# マップ案内 (MapAnNai) - 交互式地图编辑器

一个基于Next.js和Mapbox的交互式地图标记编辑平台，支持富文本内容编辑、坐标跳转、标记分类等功能。

## 🚀 快速开始

### 环境变量配置
```bash
# 复制环境变量示例文件
cp env.example .env
# 编辑 .env 文件，填入您的实际配置
```

详细的配置说明请参考：[环境变量配置指南](DEPLOYMENT.md#1-环境变量配置)

### 服务配置

#### Mapbox 配置
1. 访问 [Mapbox官网](https://www.mapbox.com/) 注册账户
2. 获取 Access Token
![Mapbox Access Tokens](READMEIMG/mapbox1.png)
![Mapbox Access Tokens](READMEIMG/mapbox2.png)
3. 创建 Dataset（可选）
4. 将配置添加到 `.env` 文件

#### 腾讯云 COS 配置
1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 创建 COS 存储桶
3. 创建 API 密钥
4. 将配置添加到 `.env` 文件

**详细配置步骤请参考：[DEPLOYMENT.md](DEPLOYMENT.md)**

### 3. 添加城市配置
在 `cities` 配置中添加您需要的城市：

```typescript
cities: {
    // 现有城市...
    yourCity: {
        name: '您的城市名',
        coordinates: { longitude: 经度, latitude: 纬度 },
        zoom: 缩放级别
    },
}
```

## 🚀 部署

### Docker 部署
```bash
# 构建并运行
docker-compose up -d mapannai

# 访问应用
# http://localhost:3000
```

### 云平台部署
支持部署到 AWS Amplify、Vercel 等云平台。

**详细的部署指南请参考：[DEPLOYMENT.md](DEPLOYMENT.md)**

#### AWS Amplify 部署示例
![Amplify 部署步骤](READMEIMG/amplify1.png)
![Amplify 部署步骤](READMEIMG/amplify2.png)
![Amplify 部署步骤](READMEIMG/amplify3.png)
![Amplify 部署步骤](READMEIMG/amplify4.png)
![Amplify 部署步骤](READMEIMG/amplify5.png)


## 🎯 功能详情

![Mapbox Access Tokens](READMEIMG/编辑模式1.png)
![Mapbox Access Tokens](READMEIMG/编辑模式2.png)
![Mapbox Access Tokens](READMEIMG/浏览模式.png)
![Mapbox Access Tokens](READMEIMG/浏览模式2.png)

#### 1. 标记分类
- **活动** 🎯：活动和娱乐场所
- **位置** 📍：一般地点标记
- **酒店** 🏨：住宿和酒店
- **购物** 🛍️：购物中心和商店

#### 2. 富文本编辑
- 支持标题、段落、列表
- 支持引用、图片
- 支持链接和格式化

#### 3. 数据同步
- 标记数据自动保存到 Mapbox Dataset
- 图片自动上传到 AWS S3
- 支持多人协作编辑


## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📞 支持

如果您遇到问题或有建议，请：

1. 查看 [Issues](../../issues) 页面
2. 创建新的 Issue
3. 联系项目维护者

