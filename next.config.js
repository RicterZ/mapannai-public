/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
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