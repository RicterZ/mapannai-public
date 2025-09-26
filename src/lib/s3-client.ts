import { cosService } from './cos-client'

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
    async uploadImage(options: UploadImageOptions): Promise<UploadImageResult> {
        return await cosService.uploadImage(options)
    }

    async deleteImage(key: string): Promise<void> {
        return await cosService.deleteImage(key)
    }

    async getImageUrl(key: string): Promise<string> {
        return await cosService.getImageUrl(key)
    }
}

export const s3Service = new S3Service() 