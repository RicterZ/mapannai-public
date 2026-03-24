#!/usr/bin/env tsx
/**
 * One-time migration: move Trip/TripDay data from Mapbox Dataset → SQLite
 *
 * Usage:
 *   npx tsx scripts/migrate-trips-from-mapbox.ts
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

async function fetchAllFeatures(): Promise<any[]> {
    const url = `https://api.mapbox.com/datasets/v1/${MAPBOX_USERNAME}/${MAPBOX_DATASET_ID}/features?access_token=${MAPBOX_SECRET_TOKEN}&limit=100`
    console.log('🔄  Fetching features from Mapbox Dataset...')
    const res = await fetch(url)
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Mapbox API error ${res.status}: ${body}`)
    }
    const data = await res.json()
    const features = data.features || []
    console.log(`   → ${features.length} total features fetched`)
    return features
}

// ── Write to SQLite ───────────────────────────────────────────────────────────

async function main() {
    const features = await fetchAllFeatures()

    const tripFeatures = features.filter((f: any) => f.properties?.featureType === 'trip')
    const dayFeatures  = features.filter((f: any) => f.properties?.featureType === 'tripDay')

    console.log(`   → ${tripFeatures.length} trip features, ${dayFeatures.length} tripDay features`)

    if (tripFeatures.length === 0 && dayFeatures.length === 0) {
        console.log('✅  Nothing to migrate.')
        return
    }

    // Dynamic import so the DB module initialises after env vars are set
    const { upsertTrip, upsertTripDay } = await import('../src/lib/db/trip-service')

    let tripsMigrated = 0
    let daysMigrated  = 0
    const errors: string[] = []

    for (const f of tripFeatures) {
        try {
            const trip = f.properties.data
            upsertTrip(trip)
            tripsMigrated++
            console.log(`  ✓ trip  ${trip.id}  "${trip.name}"`)
        } catch (err) {
            const msg = `trip ${f.id}: ${err instanceof Error ? err.message : String(err)}`
            errors.push(msg)
            console.error(`  ✗ ${msg}`)
        }
    }

    for (const f of dayFeatures) {
        try {
            const day = f.properties.data
            upsertTripDay(day)
            daysMigrated++
            console.log(`  ✓ day   ${day.id}  (trip=${day.tripId}  date=${day.date})`)
        } catch (err) {
            const msg = `day ${f.id}: ${err instanceof Error ? err.message : String(err)}`
            errors.push(msg)
            console.error(`  ✗ ${msg}`)
        }
    }

    console.log('')
    console.log(`✅  Migration complete:  ${tripsMigrated} trips,  ${daysMigrated} days`)
    if (errors.length > 0) {
        console.warn(`⚠️   ${errors.length} error(s):`)
        errors.forEach(e => console.warn(`   - ${e}`))
    }
}

main().catch(err => {
    console.error('💥  Migration failed:', err)
    process.exit(1)
})
