# マップ案内 (MapAnNai) - 交互式地图编辑器

一个基于Next.js和Mapbox的交互式地图标记编辑平台，支持富文本内容编辑、坐标跳转、标记分类等功能。

![](READMEIMG/1.png)
![](READMEIMG/2.png)
![](READMEIMG/3.png)

## 🚀 部署

### 环境变量配置
```bash
# 复制环境变量示例文件
cp env.example .env
# 编辑 .env 文件，填入您的实际配置
```

详细的配置说明请参考：[环境变量配置指南](DEPLOYMENT.md#1-环境变量配置)

### 服务配置
**详细配置步骤请参考：**
- [DEPLOYMENT.md](DEPLOYMENT.md) - 当前版本的配置指南
- [原版本配置指南](https://github.com/OikuraAmatsume/mapannai-public) - 包含 Mapbox 和 AWS S3 的详细配置步骤

### 城市配置
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


## 🎯 功能详情

#### 1. 标记分类
优化了标记按照类型分组显示，优化部分交互逻辑。

- **活动** 🎯：活动和娱乐场所
- **位置** 📍：一般地点标记
- **酒店** 🏨：住宿和酒店
- **购物** 🛍️：购物中心和商店
- **美食** 🍜：美食和小吃
- **地标** 🌆：地标性建筑和知名地点
- **游乐场** 🎡：公园和游乐场
- **自然景观** 🗻：自然景观
- **人文景观** ⛩️：人文景观

#### 2. Markdown 编辑
修改了原版的 UI 和编辑器。

- 支持 Markdown 格式的富文本编辑
- 支持标题、段落、列表、引用
- 支持代码块、链接和图片
- 实时预览编辑效果

#### 3. 数据同步
切换到了腾讯云 COS。

- 标记数据自动保存到 Mapbox Dataset
- 图片自动上传到腾讯云 COS
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

