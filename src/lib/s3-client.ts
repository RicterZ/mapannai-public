import AWS from 'aws-sdk'
import { config } from './config'

// Configure AWS SDK
const s3Client = new AWS.S3({
    accessKeyId: config.aws.s3.accessKeyId,
    secretAccessKey: config.aws.s3.secretAccessKey,
    region: config.aws.s3.region,
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

export class S3Service {
    private s3: AWS.S3

    constructor() {
        this.s3 = s3Client
    }

    async uploadImage(options: UploadImageOptions): Promise<UploadImageResult> {
        const { file, filename, contentType, folder = 'markers' } = options

        const key = folder ? `${folder}/${filename}` : filename

        const uploadParams: AWS.S3.PutObjectRequest = {
            Bucket: config.aws.s3.bucket,
            Key: key,
            Body: file,
            ContentType: contentType,
            // 移除 ACL: 'public-read' 以避免 AccessControlListNotSupported 错误
        }

        try {
            const result = await this.s3.upload(uploadParams).promise()

            return {
                url: result.Location,
                key: result.Key,
                size: file.length,
            }
        } catch (error) {
            console.error('S3 upload error:', error)
            throw new Error('Failed to upload image to S3')
        }
    }

    async deleteImage(key: string): Promise<void> {
        const deleteParams: AWS.S3.DeleteObjectRequest = {
            Bucket: config.aws.s3.bucket,
            Key: key,
        }

        try {
            await this.s3.deleteObject(deleteParams).promise()
        } catch (error) {
            console.error('S3 delete error:', error)
            throw new Error('Failed to delete image from S3')
        }
    }

    async getImageUrl(key: string): Promise<string> {
        return `https://${config.aws.s3.bucket}.s3.${config.aws.s3.region}.amazonaws.com/${key}`
    }
}

export const s3Service = new S3Service() 