// 环境变量验证
export function validateEnvironmentVariables() {
    const requiredEnvVars = {
        // Mapbox 配置
        NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
        MAPBOX_SECRET_ACCESS_TOKEN: process.env.MAPBOX_SECRET_ACCESS_TOKEN,
        MAPBOX_USERNAME: process.env.MAPBOX_USERNAME,
        MAPBOX_DATASET_ID: process.env.MAPBOX_DATASET_ID,
        
        // 腾讯云 COS 配置
        TENCENT_COS_SECRET_ID: process.env.TENCENT_COS_SECRET_ID,
        TENCENT_COS_SECRET_KEY: process.env.TENCENT_COS_SECRET_KEY,
        TENCENT_COS_REGION: process.env.TENCENT_COS_REGION,
        TENCENT_COS_BUCKET: process.env.TENCENT_COS_BUCKET,
    }

    const missingVars: string[] = []
    
    for (const [key, value] of Object.entries(requiredEnvVars)) {
        if (!value || value.trim() === '') {
            missingVars.push(key)
        }
    }

    if (missingVars.length > 0) {
        console.error('❌ 缺少必要的环境变量:')
        missingVars.forEach(varName => {
            console.error(`   - ${varName}`)
        })
        console.error('\n请检查 .env 文件并确保所有必要的环境变量都已设置。')
        console.error('参考 .env.example 文件了解需要设置的环境变量。')
        
        if (typeof window === 'undefined') {
            // 服务器端环境
            throw new Error(`缺少必要的环境变量: ${missingVars.join(', ')}`)
        }
    } else {
        console.log('✅ 所有必要的环境变量都已设置')
    }

    return missingVars.length === 0
}

// 在开发环境中自动验证
if (process.env.NODE_ENV === 'development') {
    validateEnvironmentVariables()
}
