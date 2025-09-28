/** @type {import('next').NextConfig} */
const nextConfig = {
    // 启用 standalone 输出模式，用于 Docker 优化
    output: 'standalone',
    images: {
        // 从环境变量获取图片域名
        domains: process.env.NEXT_PUBLIC_IMAGE_DOMAINS?.split(',') || [
            'mapannai-1253047877.cos.ap-chongqing.myqcloud.com'
        ],
    },
    webpack: (config) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
        };
        return config;
    },
}

module.exports = nextConfig 
