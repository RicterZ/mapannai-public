/**
 * migrate-next-to-chains.ts
 *
 * 迁移脚本：将旧的 marker.next 有向图结构迁移到 TripDay.chains 有序链列表。
 *
 * 背景：
 *   旧模型：连线关系存储在每个 marker 的 `next` 字段（全局有向边，与 trip/day 无关）
 *   新模型：连线关系存储在 TripDay.chains（每天的有序链列表，e.g. [[A,B,C],[D,E]]）
 *
 * 迁移逻辑：
 *   对每个 TripDay：
 *   1. 取 day.markerIds，限定在 day 内构建有向图（marker.next 只保留 day 内的边）
 *   2. 从入度为 0 的节点出发走链，得到若干条链
 *   3. 写入 day 的 chains 字段
 *
 * 用法：
 *   npx tsx scripts/migrate-next-to-chains.ts
 *   或指定 DB 路径：
 *   SQLITE_PATH=/path/to/mapannai.db npx tsx scripts/migrate-next-to-chains.ts
 *
 * 注意：
 *   - 脚本是幂等的，可以重复执行
 *   - 执行前请备份数据库：cp data/mapannai.db data/mapannai.db.bak
 *   - 脚本不会删除 marker.next 数据（保留以备回滚）
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'mapannai.db')

if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ 数据库文件不存在: ${DB_PATH}`)
    process.exit(1)
}

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Step 1: 确保 chains 列存在 ────────────────────────────────────────────────

const cols = db.prepare(`PRAGMA table_info(trip_days)`).all() as { name: string }[]
if (!cols.some(c => c.name === 'chains')) {
    console.log('📦 添加 trip_days.chains 列...')
    db.exec(`ALTER TABLE trip_days ADD COLUMN chains TEXT NOT NULL DEFAULT '[]'`)
    console.log('   ✅ chains 列添加成功')
} else {
    console.log('ℹ️  trip_days.chains 列已存在，跳过 ALTER TABLE')
}

// ── Step 2: 读取所有 marker 的 next 图 ───────────────────────────────────────

interface MarkerRow {
    id: string
    next: string
}

const markerRows = db.prepare(`SELECT id, next FROM markers`).all() as MarkerRow[]
const nextMap = new Map<string, string[]>()
for (const row of markerRows) {
    try {
        const next: string[] = JSON.parse(row.next || '[]')
        if (next.length > 0) nextMap.set(row.id, next)
    } catch {
        // ignore malformed JSON
    }
}

console.log(`\n📍 共读取 ${markerRows.length} 个 marker，其中 ${nextMap.size} 个有 next 指针`)

// ── Step 3: 遍历所有 TripDay，推导 chains ────────────────────────────────────

interface DayRow {
    id: string
    trip_id: string
    marker_ids: string
    chains: string
}

const dayRows = db.prepare(`SELECT id, trip_id, marker_ids, chains FROM trip_days ORDER BY date ASC`).all() as DayRow[]

console.log(`\n📅 共 ${dayRows.length} 天行程需要处理`)

let updatedCount = 0
let skippedCount = 0

const updateStmt = db.prepare(`UPDATE trip_days SET chains = ? WHERE id = ?`)

const migrate = db.transaction(() => {
    for (const row of dayRows) {
        const markerIds: string[] = JSON.parse(row.marker_ids || '[]')
        if (markerIds.length === 0) {
            skippedCount++
            continue
        }

        // 已有 chains 且非空则跳过（幂等）
        const existingChains: string[][] = JSON.parse(row.chains || '[]')
        if (existingChains.length > 0) {
            skippedCount++
            continue
        }

        const dayIdSet = new Set(markerIds)

        // 构建 day 内有向图：仅保留指向 day 内其他 marker 的边
        const inDegree = new Map<string, number>()
        const dayNext = new Map<string, string[]>()

        for (const id of markerIds) {
            inDegree.set(id, 0)
            const allNext = nextMap.get(id) || []
            const filteredNext = allNext.filter(nid => dayIdSet.has(nid))
            if (filteredNext.length > 0) dayNext.set(id, filteredNext)
        }

        for (const entry of Array.from(dayNext.entries())) {
            for (const nid of entry[1]) {
                inDegree.set(nid, (inDegree.get(nid) || 0) + 1)
            }
        }

        // 从入度为 0 且有出边的节点出发，走链
        const visited = new Set<string>()
        const chains: string[][] = []

        const starters = markerIds.filter(
            id => inDegree.get(id) === 0 && (dayNext.get(id) || []).length > 0
        )

        for (const starter of starters) {
            const chain: string[] = []
            let cur: string | undefined = starter
            while (cur && !visited.has(cur)) {
                visited.add(cur)
                chain.push(cur)
                const nexts: string[] = dayNext.get(cur) || []
                cur = nexts.find((id: string) => !visited.has(id))
            }
            if (chain.length >= 2) {
                chains.push(chain)
            }
        }

        if (chains.length > 0) {
            updateStmt.run(JSON.stringify(chains), row.id)
            updatedCount++
            console.log(`   ✅ ${row.id} (${row.trip_id}): ${markerIds.length} markers → ${chains.length} 条链`)
            chains.forEach((c, i) => console.log(`      链${i + 1}: ${c.join(' → ')}`))
        } else {
            skippedCount++
        }
    }
})

migrate()

console.log(`\n🎉 迁移完成！`)
console.log(`   更新: ${updatedCount} 天`)
console.log(`   跳过: ${skippedCount} 天（无数据或已迁移）`)
console.log(`\n⚠️  marker.next 数据未删除（保留以备回滚），可手动清理：`)
console.log(`   UPDATE markers SET next = '[]';`)

db.close()
