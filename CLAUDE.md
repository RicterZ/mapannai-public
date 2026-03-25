# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MapAnNai Plus** (マップ案内) is a Next.js 14 interactive map editor with MCP-powered trip planning. Users create and manage location markers on a map, edit them with markdown content, and plan trips via external AI assistants (e.g. Claude Desktop) using the built-in MCP server.

## Commands

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Production build (standalone output)
npm start            # Run production server
npm run type-check   # TypeScript check without emit
```

There is no test framework configured in this project. ESLint is not yet configured (running `npm run lint` will trigger interactive setup).

Docker:
```bash
docker-compose up -d mapannai    # Start production container
docker-compose logs -f mapannai  # View logs
```

## Architecture

### Data Flow

**Frontend** → Zustand store (`src/store/map-store.ts`) → **Next.js API routes** (`src/app/api/`) → **Service layer** (`src/lib/`) → External APIs (Mapbox GL, Google, Tencent COS)

**External AI** → MCP Client → `POST /api/mcp` → **MCP Server** (`src/lib/mcp/server.ts`) → Service layer

### Key Layers

**State Management** — A single Zustand store (`src/store/map-store.ts`) holds all markers, UI state (sidebar open/closed, selected marker, active chains), trip data, and active view state (`ActiveView`).

**Map Providers** — The map rendering is abstracted behind a provider pattern in `src/lib/map/providers/`. `MapProviderFactory` selects between `MapboxProvider` and `GoogleServerProvider`. The main map container is `src/components/map/abstract-map.tsx`.

**MCP Server** — Lives in `src/lib/mcp/`. Each request gets a fresh `McpServer` instance (via `createMcpServer()` factory) because McpServer binds 1:1 with a transport:
- `server.ts` — factory with all 18 tools registered + `workflow` prompt
- `tools/marker-tools.ts` — `list_markers`, `create_marker`, `update_marker`, `delete_marker`
- `tools/chain-tools.ts` — `list_trip_chains`, `create_trip_chain`
- `tools/search-tools.ts` — `search_places`, `get_place_details`, `get_walking_directions`
- `tools/trip-tools.ts` — `list_trips`, `get_trip_detail`, `create_trip`, `add_day_to_trip`, `assign_marker_to_day`, `plan_trip_day`, `reorder_day_markers`, `delete_trip`
- `plan_day_trip` is a convenience tool registered directly in `server.ts` that combines marker creation + chain linking

The MCP endpoint is at `src/app/api/mcp/route.ts` using `WebStandardStreamableHTTPServerTransport` (stateless mode — one transport instance per request). Tools call the service layer directly without going through HTTP.

**Marker Storage** — Markers are stored in a local **SQLite** database (`./data/mapannai.db`) via `src/lib/db/marker-service.ts` (replaces the former Mapbox Dataset dependency). The API routes at `src/app/api/markers/` handle CRUD; `v2/route.ts` creates markers by place name (search → coordinates → upsert). Deduplication uses a coordinate MD5 hash as feature ID (`coord_<hash>`), with a 10m radius fallback check. A migration script is available at `scripts/migrate-dataset-to-sqlite.ts`.

**Trip Management** — Structured trip planning with `Trip` and `TripDay` entities stored in SQLite via `src/lib/db/trip-service.ts`. Types defined in `src/types/trip.ts`. API routes at `src/app/api/trips/`. The active view state (`ActiveView` with modes `overview` / `trip` / `day`) controls which trip/day is displayed in the UI.

**Trip Chains** — Ordered sequences of markers represented as `next: string[]` on each marker's `properties`. Visualized as polylines by `src/components/map/connection-lines.tsx`. Created via `src/app/api/chains/route.ts`.

**Image Upload** — Direct upload to Tencent COS via `src/lib/upload/direct-upload.ts` and `src/app/api/upload/route.ts`.

### MCP Integration

Claude Desktop config to connect to the local MCP server:
```json
{
  "mcpServers": {
    "mapannai": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

Available MCP tools (18 total):
- **Markers**: `list_markers`, `create_marker`, `update_marker`, `delete_marker`
- **Chains**: `list_trip_chains`, `create_trip_chain`
- **Search**: `search_places`, `get_place_details`, `get_walking_directions`
- **Trips**: `list_trips`, `get_trip_detail`, `create_trip`, `add_day_to_trip`, `assign_marker_to_day`, `plan_trip_day`, `reorder_day_markers`, `delete_trip`
- **Combo**: `plan_day_trip`

Recommended workflow: `create_trip` → `plan_trip_day` (批量创建地点并加入某天) → `create_trip_chain` (连线)

### Configuration

- `src/lib/config.ts` — City presets, zoom levels, Mapbox/Google API config reading from env vars
- `src/types/marker.ts` — Marker type definitions and 10 emoji-based icon categories (`MarkerIconType`): `activity` 🎯, `location` 📍, `hotel` 🏨, `shopping` 🛍️, `food` 🍜, `landmark` 🌆, `park` 🎡, `natural` 🗻, `culture` ⛩️, `transit` 🚉
- `src/types/trip.ts` — `Trip`, `TripDay`, `ActiveView` type definitions
- `env.example` — All required environment variables (Mapbox tokens, Google API key, Tencent COS credentials)
- TypeScript path alias: `@/*` maps to `src/*`

### External API Integrations

| Service | Used For | Key File |
|---------|----------|----------|
| Mapbox GL | Map rendering | `src/lib/map/providers/` |
| SQLite (better-sqlite3) | Marker + Trip storage | `src/lib/db/` |
| Google Places | Place search + details | `src/lib/api/search-service.ts` |
| Google Directions | Route planning | `src/lib/api/google-directions-service.ts` |
| Tencent COS | Image storage | `src/lib/cos-client.ts` |
