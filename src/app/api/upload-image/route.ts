import { NextRequest, NextResponse } from 'next/server'
import { cosService } from '@/lib/cos-client'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('image') as File

        if (!file) {
            return NextResponse.json(
                { success: 0, message: 'No file provided' },
                { status: 400 }
            )
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json(
                { success: 0, message: 'File must be an image' },
                { status: 400 }
            )
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { success: 0, message: 'File size must be less than 10MB' },
                { status: 400 }
            )
        }

        // Generate unique filename
        const fileExtension = file.name.split('.').pop()
        const filename = `${uuidv4()}.${fileExtension}`

        // Convert file to buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Upload to COS
        const uploadResult = await cosService.uploadImage({
            file: buffer,
            filename,
            contentType: file.type,
        })

        // Return Editor.js compatible response
        return NextResponse.json({
            success: 1,
            file: {
                url: uploadResult.url,
                name: file.name,
                size: file.size,
            },
        })
    } catch (error) {
        console.error('Error uploading image:', error)
        return NextResponse.json(
            { success: 0, message: 'Upload failed' },
            { status: 500 }
        )
    }
}

export async function GET() {
    return NextResponse.json(
        { message: 'Image upload endpoint. Use POST to upload images.' },
        { status: 200 }
    )
} 