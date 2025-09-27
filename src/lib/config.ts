// Configuration file for the application
export const config = {
    // 地图提供者配置
    map: {
        provider: (process.env.NEXT_PUBLIC_MAP_PROVIDER || 'mapbox') as 'mapbox' | 'amap' | 'baidu' | 'google',
        mapbox: {
            accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
            style: process.env.NEXT_PUBLIC_MAPBOX_STYLE || 'mapbox://styles/mapbox/streets-zh-v1',
            dataset: {
                username: process.env.MAPBOX_USERNAME || '',
                secretAccessToken: process.env.MAPBOX_SECRET_ACCESS_TOKEN || '',
                datasetId: process.env.MAPBOX_DATASET_ID || '',
            },
        },
        // 未来可以添加其他地图提供者配置
        amap: {
            accessToken: process.env.NEXT_PUBLIC_AMAP_ACCESS_TOKEN || '',
            style: process.env.NEXT_PUBLIC_AMAP_STYLE || 'normal',
        },
        baidu: {
            accessToken: process.env.NEXT_PUBLIC_BAIDU_ACCESS_TOKEN || '',
            style: process.env.NEXT_PUBLIC_BAIDU_STYLE || 'normal',
        },
        google: {
            accessToken: process.env.NEXT_PUBLIC_GOOGLE_ACCESS_TOKEN || '',
            style: process.env.NEXT_PUBLIC_GOOGLE_STYLE || 'roadmap',
        },
    },
    // AWS S3 配置（已弃用）
    aws: {
        s3: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            region: process.env.AWS_REGION || 'ap-northeast-1',
            bucket: process.env.AWS_S3_BUCKET || '',
        },
    },
    // 腾讯云COS配置
    tencent: {
        cos: {
            secretId: process.env.TENCENT_COS_SECRET_ID || '',
            secretKey: process.env.TENCENT_COS_SECRET_KEY || '',
            region: process.env.TENCENT_COS_REGION || 'ap-chongqing',
            bucket: process.env.TENCENT_COS_BUCKET || '',
        },
    },
    app: {
        name: 'マップ案内 - 交互式地图编辑器',
        version: '1.0.0',
        defaultCenter: {
            latitude: 35.452,
            longitude: 139.638,
        },
        defaultZoom: 14.09,
    },
    // 城市快速跳转配置
    cities: {
        kyoto: {
            name: '京都',
            coordinates: { longitude: 135.7681, latitude: 35.0116 },
            zoom: 14
        },
        osaka: {
            name: '大阪',
            coordinates: { longitude: 135.5022, latitude: 34.6937 },
            zoom: 14
        },
        yokohama: {
            name: '横滨',
            coordinates: { longitude: 139.6380, latitude: 35.452 },
            zoom: 14
        },
        tokyo: {
            name: '东京',
            coordinates: { longitude: 139.6917, latitude: 35.6895 },
            zoom: 11
        },
        // nagoya: {
        //     name: '名古屋',
        //     coordinates: { longitude: 136.9066, latitude: 35.1815 },
        //     zoom: 11
        // },
    },
} as const

export type Config = typeof config 
