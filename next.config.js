/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        // 需要修改为自己的 S3 域名
        domains: ['mapannai.s3.ap-northeast-1.amazonaws.com'],
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