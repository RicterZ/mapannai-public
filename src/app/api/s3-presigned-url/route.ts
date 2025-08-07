import { NextRequest, NextResponse } from 'next/server'
import AWS from 'aws-sdk'
import { config } from '@/lib/config'
import { v4 as uuidv4 } from 'uuid'

// Configure AWS SDK
const s3 = new AWS.S3({
    accessKeyId: config.aws.s3.accessKeyId,
    secretAccessKey: config.aws.s3.secretAccessKey,
    region: config.aws.s3.region,
    signatureVersion: 'v4',
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { fileName, fileType } = body

        if (!fileName || !fileType) {
            return NextResponse.json(
                { success: 0, message: 'fileName and fileType are required' },
                { status: 400 }
            )
        }

        // Validate file type
        if (!fileType.startsWith('image/')) {
            return NextResponse.json(
                { success: 0, message: 'File must be an image' },
                { status: 400 }
            )
        }

        // Generate unique filename
        const fileExtension = fileName.split('.').pop()
        const uniqueFileName = `markers/${uuidv4()}.${fileExtension}`

        // Generate presigned URL for PUT operation
        const presignedUrl = s3.getSignedUrl('putObject', {
            Bucket: config.aws.s3.bucket,
            Key: uniqueFileName,
            ContentType: fileType,
            Expires: 300, // URL expires in 5 minutes
        })

        // Generate the public URL for the uploaded file
        const publicUrl = `https://${config.aws.s3.bucket}.s3.${config.aws.s3.region}.amazonaws.com/${uniqueFileName}`

        return NextResponse.json({
            success: 1,
            presignedUrl,
            publicUrl,
            key: uniqueFileName,
        })
    } catch (error) {
        console.error('Error generating presigned URL:', error)
        return NextResponse.json(
            { success: 0, message: 'Failed to generate presigned URL' },
            { status: 500 }
        )
    }
} 