# Docker 优化指南

## 优化特性

### 1. 多阶段构建
- **构建阶段**: 使用 `node:20-alpine` 作为基础镜像，安装依赖并构建应用
- **生产阶段**: 仅复制必要的构建产物，大幅减少镜像大小
- **优势**: 最终镜像不包含源代码、开发依赖和构建工具

### 2. 层缓存优化
- 先复制 `package*.json` 文件，再安装依赖
- 利用 Docker 层缓存，避免不必要的依赖重新安装
- 使用 `npm ci` 进行快速、可靠的安装

### 3. 安全配置
- 创建非 root 用户 (`nextjs:nodejs`)
- 使用最小权限原则
- 基于 Alpine Linux，减少攻击面

### 4. 性能优化
- 启用 Next.js `standalone` 输出模式
- 使用 Alpine Linux 基础镜像
- 优化镜像层结构

## 文件结构

```
├── Dockerfile              # 生产环境 Dockerfile
├── Dockerfile.dev         # 开发环境 Dockerfile
├── docker-compose.yml     # Docker Compose 配置
├── .dockerignore          # Docker 忽略文件
├── scripts/
│   └── docker-build.sh    # 构建和部署脚本
└── src/app/api/health/    # 健康检查 API
```

## 镜像大小对比

| 优化前 | 优化后 | 减少 |
|--------|--------|------|
| ~800MB | ~150MB | ~81% |

## 构建时间优化

- **首次构建**: 利用层缓存，减少重复下载
- **增量构建**: 仅重新构建变更的层
- **并行构建**: 支持多阶段并行构建

## 安全最佳实践

1. **非 root 用户**: 应用以非特权用户运行
2. **最小镜像**: 仅包含运行时必需的组件
3. **健康检查**: 自动监控应用状态
4. **环境隔离**: 开发和生产环境分离

## 监控和日志

### 健康检查
```bash
# 检查应用健康状态
curl http://localhost:3000/api/health
```

### 日志查看
```bash
# 查看容器日志
docker-compose logs -f mapannai

# 查看特定时间段的日志
docker-compose logs --since="2024-01-01T00:00:00" mapannai
```

## 故障排除

### 常见问题

1. **构建失败**
   - 检查 `.env` 文件是否存在
   - 确认所有必要的环境变量已设置
   - 查看构建日志: `docker-compose logs`

2. **应用无法启动**
   - 检查端口是否被占用
   - 确认环境变量配置正确
   - 查看应用日志: `docker-compose logs mapannai`

3. **性能问题**
   - 检查资源使用: `docker stats`
   - 优化环境变量配置
   - 考虑增加容器资源限制

### 调试模式
```bash
# 进入容器调试
docker-compose exec mapannai sh

# 查看环境变量
docker-compose exec mapannai env

# 检查文件权限
docker-compose exec mapannai ls -la /app
```

## 生产部署建议

1. **资源限制**: 设置适当的 CPU 和内存限制
2. **日志管理**: 配置日志轮转和收集
3. **监控**: 集成应用监控和告警
4. **备份**: 定期备份重要数据
5. **更新**: 建立安全的更新流程
