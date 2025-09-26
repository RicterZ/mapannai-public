import { NextRequest, NextResponse } from 'next/server'
import { cosService } from '@/lib/cos-client'
import { v4 as uuidv4 } from 'uuid'

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
        const filename = `${uuidv4()}.${fileExtension}`

        // Upload to COS using the service
        const uploadResult = await cosService.uploadImageByUrl(url, filename)

        // Get original filename from URL
        const urlParts = url.split('/')
        const originalName = urlParts[urlParts.length - 1] || 'image'

        // Return Editor.js compatible response
        return NextResponse.json({
            success: 1,
            file: {
                url: uploadResult.url,
                name: originalName,
                size: uploadResult.size,
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