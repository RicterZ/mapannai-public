#!/bin/bash

# Mapannai MCP Server 启动脚本

echo "🚀 启动 Mapannai MCP Server..."

# 检查环境变量
if [ -z "$MAPANNAI_API_URL" ]; then
    echo "⚠️  警告: MAPANNAI_API_URL 未设置，使用默认值 http://localhost:3000"
    export MAPANNAI_API_URL="http://localhost:3000"
fi

if [ -z "$MAPANNAI_API_KEY" ]; then
    echo "⚠️  警告: MAPANNAI_API_KEY 未设置，使用空值"
    export MAPANNAI_API_KEY=""
fi

# 检查是否已构建
if [ ! -d "dist" ]; then
    echo "📦 构建项目..."
    npm run build
fi

# 启动服务器
echo "🎯 启动 MCP Server..."
node dist/index.js
