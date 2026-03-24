#!/usr/bin/env tsx
/**
 * One-time migration: move Marker data from Mapbox Dataset → SQLite
 *
 * Usage:
 *   npx tsx scripts/migrate-dataset-to-sqlite.ts
 *
 * Requires env vars:
 *   MAPBOX_USERNAME, MAPBOX_SECRET_ACCESS_TOKEN, MAPBOX_DATASET_ID
 *   (optionally SQLITE_PATH to override default ./data/mapannai.db)
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const MAPBOX_USERNAME = process.env.MAPBOX_USERNAME
const MAPBOX_SECRET_TOKEN = process.env.MAPBOX_SECRET_ACCESS_TOKEN
const MAPBOX_DATASET_ID = process.env.MAPBOX_DATASET_ID

if (!MAPBOX_USERNAME || !MAPBOX_SECRET_TOKEN || !MAPBOX_DATASET_ID) {
    console.error('❌  Missing required env vars: MAPBOX_USERNAME, MAPBOX_SECRET_ACCESS_TOKEN, MAPBOX_DATASET_ID')
    process.exit(1)
}

// ── Fetch all features from Mapbox Dataset ────────────────────────────────────

interface MapboxFeature {
    type: 'Feature'
    id: string
    geometry: {
        type: 'Point'
        coordinates: [number, number]
    }
    properties: Record<string, any>
}

async function fetchAllFeatures(): Promise<MapboxFeature[]> {
    const allFeatures: MapboxFeature[] = []
    let start: string | undefined = undefined
    const limit = 100

    console.log(`📡 Fetching features from Mapbox Dataset ${MAPBOX_DATASET_ID}…`)

    while (true) {
        const url = new URL(
            `https://api.mapbox.com/datasets/v1/${MAPBOX_USERNAME}/${MAPBOX_DATASET_ID}/features`
        )
        url.searchParams.set('access_token', MAPBOX_SECRET_TOKEN!)
        url.searchParams.set('limit', String(limit))
        if (start) url.searchParams.set('start', start)

        const res = await fetch(url.toString())
        if (!res.ok) {
            throw new Error(`Mapbox API error ${res.status}: ${await res.text()}`)
        }

        const fc = await res.json() as { type: string; features: MapboxFeature[]; next?: string }
        const batch = fc.features || []
        allFeatures.push(...batch)

        console.log(`   fetched ${batch.length} features (total so far: ${allFeatures.length})`)

        if (!fc.next || batch.length < limit) break
        // Extract the "start" cursor from the Link header or next URL
        const nextUrl = new URL(fc.next)
        start = nextUrl.searchParams.get('start') || undefined
        if (!start) break
    }

    return allFeatures
}

// ── SQLite setup ──────────────────────────────────────────────────────────────

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'mapannai.db')
console.log(`🗄  SQLite path: ${DB_PATH}`)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

// Dynamic import to avoid compile-time issues with native addon
const Database = require('better-sqlite3')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Ensure markers table exists
db.exec(`
    CREATE TABLE IF NOT EXISTS markers (
        id               TEXT PRIMARY KEY,
        longitude        REAL NOT NULL,
        latitude         REAL NOT NULL,
        title            TEXT,
        address          TEXT,
        header_image     TEXT,
        icon_type        TEXT NOT NULL DEFAULT 'location',
        markdown_content TEXT NOT NULL DEFAULT '',
        next             TEXT NOT NULL DEFAULT '[]',
        description      TEXT,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
    );
`)

const insert = db.prepare(`
    INSERT INTO markers
        (id, longitude, latitude, title, address, header_image, icon_type, markdown_content, next, description, created_at, updated_at)
    VALUES
        (@id, @longitude, @latitude, @title, @address, @headerImage, @iconType, @markdownContent, @next, @description, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
        longitude        = excluded.longitude,
        latitude         = excluded.latitude,
        title            = excluded.title,
        address          = excluded.address,
        header_image     = excluded.header_image,
        icon_type        = excluded.icon_type,
        markdown_content = excluded.markdown_content,
        next             = excluded.next,
        description      = excluded.description,
        updated_at       = excluded.updated_at
`)

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const features = await fetchAllFeatures()
    console.log(`\n✅  Total features fetched: ${features.length}`)

    // Filter out trip/day features (they were previously stored in the same dataset)
    const markerFeatures = features.filter(f => {
        const id = f.id || ''
        const featureType = f.properties?.featureType
        return !id.startsWith('trip_') &&
               !id.startsWith('day_') &&
               featureType !== 'trip' &&
               featureType !== 'tripDay' &&
               f.geometry?.type === 'Point' &&
               Array.isArray(f.geometry.coordinates) &&
               f.geometry.coordinates.length >= 2
    })

    console.log(`📍 Marker features to import: ${markerFeatures.length}`)
    console.log(`⏭️  Skipped (trip/day/invalid): ${features.length - markerFeatures.length}`)

    let imported = 0
    let failed = 0
    const errors: Array<{ id: string; error: string }> = []

    const migrateAll = db.transaction(() => {
        for (const f of markerFeatures) {
            try {
                const [longitude, latitude] = f.geometry.coordinates
                const props = f.properties || {}
                const meta = props.metadata || {}
                const now = new Date().toISOString()

                insert.run({
                    id: f.id,
                    longitude,
                    latitude,
                    title: meta.title ?? props.title ?? null,
                    address: props.address ?? null,
                    headerImage: props.headerImage ?? null,
                    iconType: props.iconType ?? 'location',
                    markdownContent: props.markdownContent ?? '',
                    next: JSON.stringify(props.next ?? []),
                    description: meta.description ?? null,
                    createdAt: meta.createdAt ?? now,
                    updatedAt: meta.updatedAt ?? now,
                })
                imported++
            } catch (err: any) {
                failed++
                errors.push({ id: f.id, error: err?.message ?? String(err) })
                console.warn(`  ⚠️  Failed to import ${f.id}: ${err?.message}`)
            }
        }
    })

    migrateAll()

    console.log(`\n📊 Migration complete:`)
    console.log(`   ✅  Imported: ${imported}`)
    console.log(`   ❌  Failed:   ${failed}`)

    if (errors.length > 0) {
        console.log(`\n💥 Errors:`)
        errors.forEach(e => console.log(`   ${e.id}: ${e.error}`))
    }

    // Verify
    const count = (db.prepare(`SELECT COUNT(*) as cnt FROM markers`).get() as any).cnt
    console.log(`\n🔍 Verification: markers table now has ${count} rows`)

    db.close()
}

main().catch(err => {
    console.error('❌  Migration failed:', err)
    process.exit(1)
})
