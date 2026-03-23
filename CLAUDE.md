# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MapAnNai Plus** (マップ案内) is a Next.js 14 interactive map editor with MCP-powered trip planning. Users create and manage location markers on a Mapbox map, edit them with markdown content, and plan trips via external AI assistants (e.g. Claude Desktop) using the built-in MCP server.

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

**Frontend** → Zustand store (`src/store/map-store.ts`) → **Next.js API routes** (`src/app/api/`) → **Service layer** (`src/lib/`) → External APIs (Mapbox, Google, Tencent COS)

**External AI** → MCP Client → `POST /api/mcp` → **MCP Server** (`src/lib/mcp/server.ts`) → Service layer

### Key Layers

**State Management** — A single Zustand store (`src/store/map-store.ts`) holds all markers, UI state (sidebar open/closed, selected marker, active chains), and trip chain data.

**Map Providers** — The map rendering is abstracted behind a provider pattern in `src/lib/map/providers/`. `MapProviderFactory` selects between `MapboxProvider` and `GoogleServerProvider`. The main map container is `src/components/map/abstract-map.tsx`.

**MCP Server** — Lives in `src/lib/mcp/`:
- `server.ts` — `McpServer` singleton with all 10 tools registered
- `tools/marker-tools.ts` — `list_markers`, `create_marker`, `update_marker`, `delete_marker`
- `tools/chain-tools.ts` — `list_trip_chains`, `create_trip_chain`
- `tools/search-tools.ts` — `search_places`, `get_place_details`, `get_walking_directions`
- `plan_day_trip` is a convenience tool registered directly in `server.ts` that combines marker creation + chain linking

The MCP endpoint is at `src/app/api/mcp/route.ts` using `WebStandardStreamableHTTPServerTransport` (stateless mode — one transport instance per request). Tools call the service layer directly without going through HTTP.

**Marker Storage** — Markers are stored and synced to **Mapbox Dataset** via `src/lib/api/dataset-service.ts`. The API routes at `src/app/api/markers/` handle CRUD; `v2/route.ts` creates markers by place name (search → coordinates → upsert). Deduplication uses a coordinate MD5 hash as feature ID (`coord_<hash>`), with a 10m radius fallback check.

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

Available MCP tools: `list_markers`, `create_marker`, `update_marker`, `delete_marker`, `list_trip_chains`, `create_trip_chain`, `search_places`, `get_place_details`, `get_walking_directions`, `plan_day_trip`.

### Configuration

- `src/lib/config.ts` — City presets, zoom levels, Mapbox/Google API config reading from env vars
- `src/types/marker.ts` — Marker type definitions and 9 emoji-based icon categories (`MarkerIconType`)
- `env.example` — All required environment variables (Mapbox tokens, Google API key, Tencent COS credentials)
- TypeScript path alias: `@/*` maps to `src/*`

### External API Integrations

| Service | Used For | Key File |
|---------|----------|----------|
| Mapbox GL | Map rendering + Dataset storage | `src/lib/api/dataset-service.ts` |
| Google Places | Place search + details | `src/lib/api/search-service.ts` |
| Google Directions | Route planning | `src/lib/api/google-directions-service.ts` |
| Tencent COS | Image storage | `src/lib/cos-client.ts` |
