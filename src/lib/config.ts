// Configuration file for the application
export const config = {
    mapbox: {
        accessToken: 'pk.YOUR_PUBLIC_ACCESS_TOKEN', // 替换为您的 Public Token
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        dataset: {
            username: 'YOUR_MAPBOX_USERNAME', // 替换为您的 Mapbox 用户名
            secretAccessToken: 'sk.YOUR_SECRET_ACCESS_TOKEN', // 替换为您的 Secret Token
            datasetId: 'YOUR_DATASET_ID', // 替换为您的 Dataset ID
        },
    },
    aws: {
        s3: {
            accessKeyId: 'YOUR_AWS_ACCESS_KEY_ID',
            secretAccessKey: 'YOUR_AWS_SECRET_ACCESS_KEY',
            region: 'ap-northeast-1',
            bucket: 'mapannai', // 您的 S3 存储桶名称
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
        // 您可以在这里添加更多城市
        // tokyo: {
        //     name: '东京',
        //     coordinates: { longitude: 139.6917, latitude: 35.6895 },
        //     zoom: 11
        // },
        // nagoya: {
        //     name: '名古屋',
        //     coordinates: { longitude: 136.9066, latitude: 35.1815 },
        //     zoom: 11
        // },
    },
} as const

export type Config = typeof config 