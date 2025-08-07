import { NextRequest, NextResponse } from 'next/server'
import AWS from 'aws-sdk'
import { config } from '@/lib/config'
import { v4 as uuidv4 } from 'uuid'

// Configure AWS SDK
const s3 = new AWS.S3({
    accessKeyId: config.aws.s3.accessKeyId,
    secretAccessKey: config.aws.s3.secretAccessKey,
    region: config.aws.s3.region,
})

export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json()

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { success: 0, message: 'URL is required' },
                { status: 400 }
            )
        }

        // Validate URL format
        try {
            new URL(url)
        } catch {
            return NextResponse.json(
                { success: 0, message: 'Invalid URL format' },
                { status: 400 }
            )
        }

        // Fetch image from URL
        const response = await fetch(url)

        if (!response.ok) {
            return NextResponse.json(
                { success: 0, message: 'Failed to fetch image from URL' },
                { status: 400 }
            )
        }

        const contentType = response.headers.get('content-type')

        if (!contentType || !contentType.startsWith('image/')) {
            return NextResponse.json(
                { success: 0, message: 'URL does not point to an image' },
                { status: 400 }
            )
        }

        // Get file extension from content type
        const fileExtension = contentType.split('/')[1] || 'jpg'
        const filename = `markers/${uuidv4()}.${fileExtension}`

        // Convert response to buffer
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (buffer.length > maxSize) {
            return NextResponse.json(
                { success: 0, message: 'Image size must be less than 10MB' },
                { status: 400 }
            )
        }

        // Upload to S3
        const uploadParams: AWS.S3.PutObjectRequest = {
            Bucket: config.aws.s3.bucket,
            Key: filename,
            Body: buffer,
            ContentType: contentType,
            ACL: 'public-read',
        }

        const uploadResult = await s3.upload(uploadParams).promise()

        // Get original filename from URL
        const urlParts = url.split('/')
        const originalName = urlParts[urlParts.length - 1] || 'image'

        // Return Editor.js compatible response
        return NextResponse.json({
            success: 1,
            file: {
                url: uploadResult.Location,
                name: originalName,
                size: buffer.length,
            },
        })
    } catch (error) {
        console.error('Error uploading image by URL:', error)
        return NextResponse.json(
            { success: 0, message: 'Upload failed' },
            { status: 500 }
        )
    }
}

export async function GET() {
    return NextResponse.json(
        { message: 'Image upload by URL endpoint. Use POST with URL in body.' },
        { status: 200 }
    )
} 