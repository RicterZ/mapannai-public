#!/bin/bash

# Docker 构建脚本 - 支持 NEXT_PUBLIC_ 环境变量
# 使用方法: ./scripts/docker-build.sh

set -e

echo "🚀 开始构建 Docker 镜像..."

# 检查 .env 文件是否存在
if [ ! -f ".env" ]; then
    echo "❌ 错误: .env 文件不存在"
    echo "请确保 .env 文件存在并包含必要的环境变量"
    exit 1
fi

# 加载环境变量
export $(cat .env | grep -v '^#' | xargs)

# 构建 Docker 镜像，传递构建参数
docker-compose build \
    --build-arg NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN" \
    --build-arg NEXT_PUBLIC_MAPBOX_STYLE="$NEXT_PUBLIC_MAPBOX_STYLE" \
    --build-arg NEXT_PUBLIC_IMAGE_DOMAINS="$NEXT_PUBLIC_IMAGE_DOMAINS" \
    mapannai

echo "✅ Docker 镜像构建完成！"
echo "运行命令: docker-compose up mapannai"