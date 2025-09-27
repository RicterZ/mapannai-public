import COS from 'cos-nodejs-sdk-v5'
import { config } from './config'

// Configure Tencent Cloud COS SDK
const cos = new COS({
    SecretId: config.tencent.cos.secretId,
    SecretKey: config.tencent.cos.secretKey,
})

export interface UploadImageOptions {
    file: Buffer
    filename: string
    contentType: string
    folder?: string
}

export interface UploadImageResult {
    url: string
    key: string
    size: number
}

export interface PresignedUrlResult {
    presignedUrl: string
    publicUrl: string
    key: string
}

export interface UploadJsonOptions {
    data: any
    filename: string
    folder?: string
}

export interface UploadJsonResult {
    url: string
    key: string
    size: number
}

export class COSService {
    private cos: COS
    private bucket: string
    private region: string

    constructor() {
        this.cos = cos
        this.bucket = config.tencent.cos.bucket
        this.region = config.tencent.cos.region
    }

    async uploadImage(options: UploadImageOptions): Promise<UploadImageResult> {
        const { file, filename, contentType, folder = 'markers' } = options

        const key = folder ? `${folder}/${filename}` : filename

        const uploadParams = {
            Bucket: this.bucket,
            Region: this.region,
            Key: key,
            Body: file,
            ContentType: contentType,
        }

        try {
            const result = await this.cos.putObject(uploadParams)

            return {
                url: result.Location,
                key: key,
                size: file.length,
            }
        } catch (error) {
            console.error('COS upload error:', error)
            throw new Error('Failed to upload image to COS')
        }
    }

    async deleteImage(key: string): Promise<void> {
        const deleteParams = {
            Bucket: this.bucket,
            Region: this.region,
            Key: key,
        }

        try {
            await this.cos.deleteObject(deleteParams)
        } catch (error) {
            console.error('COS delete error:', error)
            throw new Error('Failed to delete image from COS')
        }
    }

    async getImageUrl(key: string): Promise<string> {
        return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`
    }

    async getPresignedUrl(key: string, contentType: string, expires: number = 300): Promise<PresignedUrlResult> {
        try {
            const presignedUrl = await this.cos.getObjectUrl({
                Bucket: this.bucket,
                Region: this.region,
                Key: key,
                Method: 'PUT',
                Sign: true,
                Expires: expires,
                Headers: {
                    'Content-Type': contentType,
                },
            })

            const publicUrl = await this.getImageUrl(key)

            return {
                presignedUrl,
                publicUrl,
                key,
            }
        } catch (error) {
            console.error('COS presigned URL error:', error)
            throw new Error('Failed to generate presigned URL')
        }
    }

    async uploadImageByUrl(imageUrl: string, filename: string): Promise<UploadImageResult> {
        try {
            // Fetch image from URL
            const response = await fetch(imageUrl)
            
            if (!response.ok) {
                throw new Error('Failed to fetch image from URL')
            }

            const contentType = response.headers.get('content-type') || 'image/jpeg'
            const arrayBuffer = await response.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            // Validate file size (max 10MB)
            const maxSize = 10 * 1024 * 1024 // 10MB
            if (buffer.length > maxSize) {
                throw new Error('File size must be less than 10MB')
            }

            return await this.uploadImage({
                file: buffer,
                filename,
                contentType,
            })
        } catch (error) {
            console.error('COS upload by URL error:', error)
            throw new Error('Failed to upload image by URL to COS')
        }
    }

    // 上传 JSON 数据到 COS
    async uploadJson(options: UploadJsonOptions): Promise<UploadJsonResult> {
        const { data, filename, folder = 'data' } = options

        const key = folder ? `${folder}/${filename}` : filename
        const jsonString = JSON.stringify(data, null, 2)
        const buffer = Buffer.from(jsonString, 'utf-8')

        const uploadParams = {
            Bucket: this.bucket,
            Region: this.region,
            Key: key,
            Body: buffer,
            ContentType: 'application/json',
        }

        try {
            const result = await this.cos.putObject(uploadParams)

            return {
                url: result.Location,
                key: key,
                size: buffer.length,
            }
        } catch (error) {
            console.error('COS JSON upload error:', error)
            throw new Error('Failed to upload JSON data to COS')
        }
    }

    // 从 COS 下载 JSON 数据
    async downloadJson(key: string): Promise<any> {
        const downloadParams = {
            Bucket: this.bucket,
            Region: this.region,
            Key: key,
        }

        try {
            const result = await this.cos.getObject(downloadParams)
            const jsonString = result.Body.toString('utf-8')
            return JSON.parse(jsonString)
        } catch (error) {
            console.error('COS JSON download error:', error)
            throw new Error('Failed to download JSON data from COS')
        }
    }

    // 删除 JSON 文件
    async deleteJson(key: string): Promise<void> {
        const deleteParams = {
            Bucket: this.bucket,
            Region: this.region,
            Key: key,
        }

        try {
            await this.cos.deleteObject(deleteParams)
        } catch (error) {
            console.error('COS JSON delete error:', error)
            throw new Error('Failed to delete JSON file from COS')
        }
    }

    // 获取 JSON 文件的公共 URL
    async getJsonUrl(key: string): Promise<string> {
        return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`
    }
}

export const cosService = new COSService()