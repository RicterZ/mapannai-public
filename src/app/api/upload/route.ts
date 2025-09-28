import { NextRequest, NextResponse } from 'next/server'
import { cosService } from '@/lib/cos-client'
import { v4 as uuidv4 } from 'uuid'

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
        const uniqueFileName = `${uuidv4()}.${fileExtension}`

        // Generate presigned URL for PUT operation
        const result = await cosService.getPresignedUrl(uniqueFileName, fileType, 300)

        return NextResponse.json({
            success: 1,
            presignedUrl: result.presignedUrl,
            publicUrl: result.publicUrl,
            key: result.key,
        })
    } catch (error) {
        console.error('Error generating presigned URL:', error)
        return NextResponse.json(
            { success: 0, message: 'Failed to generate presigned URL' },
            { status: 500 }
        )
    }
}
