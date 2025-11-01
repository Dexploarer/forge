# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository

## Project Overview

**Forge Backend** - Production-ready game asset management and AI-powered content generation platform built with Bun, Fastify, Drizzle ORM, and PostgreSQL. The platform specializes in 3D assets, audio processing (music, SFX, voice), game content (NPCs, quests, lore), and multi-agent AI systems for game development.

## Core Technology Stack

- **Runtime**: Bun >= 1.0.0 (NOT Node.js - use `bun` commands exclusively)
- **Framework**: Fastify 5.x with Zod type provider for runtime validation
- **Database**: PostgreSQL 14+ with Drizzle ORM (connection pooling enabled)
- **Authentication**: Privy JWT (Web3-native auth with Farcaster support)
- **AI Services**: OpenAI, Anthropic (Claude), Meshy (3D), ElevenLabs (Voice) via Vercel AI SDK v5
- **Validation**: Zod v4 for all schemas and environment variables
- **Logging**: Pino with pino-pretty for development
- **Audio Processing**: FFmpeg with graceful degradation

## Essential Commands

### Development
```bash
bun run dev              # Hot-reload development server
bun run typecheck        # TypeScript validation (run before commits)
bun test                 # Run all tests
bun test:watch           # Watch mode for TDD
```

### Database Operations
```bash
bun run db:generate      # Generate migration from schema changes
bun run db:migrate       # Apply migrations (ALWAYS run after generate)
bun run db:push          # Direct schema push (development ONLY)
bun run db:studio        # Open Drizzle Studio GUI
bun run db:seed          # Seed database with test data
```

### Testing (Specific Test Suites)
```bash
bun test:health          # Health check endpoints
bun test:auth            # Authentication flow
bun test:assets          # Asset management
bun test:teams           # Team collaboration
bun test:projects        # Project management
bun test:admin           # Admin operations
bun test:ai-services     # AI integrations
bun test:3d-features     # 3D asset processing
```

### Production
```bash
bun run build            # Build for production
bun run start            # Start production server
```

## Architecture Principles

### 1. Type Safety First
- **Strict TypeScript** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **PostgreSQL enums** for status/type fields (defined in `src/database/schema/enums.ts`)
- **Zod validation** on ALL API inputs and environment variables
- **Fastify Type Provider** for compile-time route validation
- **NO `any` types** - use proper typing or `unknown` with guards

### 2. Database Schema Design
- **Enums-first approach**: Define PostgreSQL enums before tables
- **Composite indexes** on frequently queried combinations (owner_id + status, owner_id + type)
- **Foreign key constraints** with proper cascade behavior
- **jsonb columns** for flexible metadata (game_params, generation_params)
- **Timestamps**: All tables have `createdAt`/`updatedAt` via Drizzle helpers

### 3. Plugin-Based Architecture
Fastify plugins are registered in strict order (see `src/server.ts`):
1. **CORS** - Configure allowed origins
2. **Database** - Connection pooling decorator
3. **Auth** - Privy JWT verification + `request.user` decorator
4. **API Key Auth** - Service-to-service authentication
5. **Swagger** - OpenAPI documentation
6. **Multipart** - File upload handling
7. **Activity Logger** - User action tracking

### 4. Route Organization
Routes follow RESTful conventions with Zod schemas:
```
/api/auth              - Authentication & sessions
/api/users             - User management
/api/teams             - Team collaboration
/api/projects          - Project CRUD
/api/assets            - Asset management + uploads
/api/admin             - Admin-only operations

# Game Content
/api/npcs              - NPC definitions + AI generation
/api/lore              - World-building content
/api/quests            - Quest system

# Audio Systems
/api/music             - Music tracks + generation
/api/sfx               - Sound effects
/api/voice             - Voice generation (ElevenLabs)
/api/voice-assignments - NPC voice mappings

# AI & Advanced Features
/api/ai                - OpenAI/Claude chat, embeddings, vision, audio
/api/ai-gateway        - Vercel AI SDK unified gateway
/api/ai-context        - Context preference management
/api/multi-agent       - Multi-NPC collaboration system
/api/manifests         - Preview manifest management
/api/3d                - 3D asset analysis + generation
/api/embeddings        - Vector embeddings (Qdrant)
/api/content-generation - Batch AI content generation
```

### 5. Service Layer Pattern
Business logic lives in `src/services/*.service.ts`:
- Services are exported as singleton instances (e.g., `export const userService = new UserService()`)
- Services handle database queries, external API calls, and complex business logic
- Controllers (routes) remain thin - just validation, auth checks, and service calls
- Error handling propagates AppError instances with proper status codes

### 6. Error Handling Strategy
- **AppError class** (`src/utils/errors.ts`) for all application errors
- **HTTP-first design**: Always include `statusCode`, `code`, `message`
- **Validation errors**: Automatically formatted by Zod + Fastify
- **Production mode**: Hides internal error details, logs full stack
- **Development mode**: Returns full error stack for debugging

## Path Aliases (tsconfig.json)

```typescript
import { db } from '@/database/db'
import { env } from '@/config/env'
import { userService } from '@/services/user.service'
import { AppError } from '@/utils/errors'
import type { User } from '@/database/schema'
```

Aliases: `@/config`, `@/database`, `@/plugins`, `@/routes`, `@/services`, `@/utils`, `@/types`

## Database Schema Structure

### Core Tables
- **users** - Privy authentication, wallet addresses, Farcaster integration
- **teams** - Team collaboration with membership roles
- **projects** - Game projects with AI configuration
- **assets** - 3D models, textures, audio files with metadata
- **system_settings** - Global configuration (encryption keys, API credentials)

### Game Content Tables
- **npcs** - NPC definitions with personality, voice, appearance
- **lore** - World-building lore with categorization
- **quests** - Quest system with NPCs/rewards/objectives
- **preview_manifests** - Structured game content exports

### Audio Tables
- **music_tracks** - Music with stems, BPM, tags
- **sound_effects** - SFX with categories, parameters
- **voice_samples** - ElevenLabs voice generations
- **voice_assignments** - NPC-to-voice mappings

### AI & System Tables
- **ai_usage_logs** - Track all AI service calls with costs
- **activity_logs** - User action auditing
- **api_keys** - Service authentication tokens (encrypted)
- **user_credentials** - User-specific AI service keys (encrypted)
- **ai_context_preferences** - Per-user AI context settings
- **model_configs** - AI model configurations
- **prompt_templates** - Reusable AI prompts
- **3d_asset_metadata** - Weapon detection, poly counts, dimensions

## Important Implementation Details

### 1. Authentication Flow
- **Privy JWT tokens** verified in `auth` plugin (`src/plugins/auth.ts`)
- **API key authentication** for service-to-service calls via `apiKeyAuth` plugin
- Routes use `onRequest: [server.authenticate]` or `onRequest: [server.requireApiKey]`
- `request.user` populated after auth (type: `PrivyUser`)
- Admin routes check `user.role === 'admin'`

### 2. File Uploads
- Handled by `@fastify/multipart` plugin
- Files saved to `FILE_STORAGE_PATH` (default: `./uploads`)
- Served via `@fastify/static` at `/files/*` prefix
- Asset metadata stored in `assets` table with file URLs

### 3. AI Service Integration
- **Vercel AI SDK v5** (`ai` package) for unified model access
- **Usage tracking**: Every AI call logged to `ai_usage_logs` with token counts + costs
- **Rate limiting**: Per-user limits enforced on AI endpoints
- **Cost estimation**: `/api/ai-gateway/estimate` before making expensive calls
- **Graceful degradation**: Services return errors when API keys missing (no crashes)

### 4. FFmpeg Audio Processing
- Optional dependency - backend works without it (estimation mode)
- Check availability: `audioProcessorService.isAvailable()`
- Custom paths via `FFMPEG_PATH` and `FFPROBE_PATH` environment variables
- Used for: normalization, silence trimming, format conversion, metadata extraction

### 5. Multi-Agent System
- Collaborative NPC content generation via `/api/multi-agent`
- Multiple AI personas interact to generate dialogue, quests, relationships
- Cross-validation between agents for quality assurance
- Session tracking with emergent content extraction

### 6. Environment Variables
**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `PRIVY_APP_ID` - Privy application ID
- `PRIVY_APP_SECRET` - Privy application secret

**AI Services** (all optional - features degrade gracefully):
- `OPENAI_API_KEY` - GPT models, DALL-E, Whisper, embeddings
- `ANTHROPIC_API_KEY` - Claude models via Vercel AI SDK
- `MESHY_API_KEY` - 3D model generation
- `ELEVENLABS_API_KEY` - Voice generation
- `AI_GATEWAY_API_KEY` - Vercel AI Gateway unified access
- `QDRANT_URL` + `QDRANT_API_KEY` - Vector database for embeddings

**Storage & Security**:
- `ENCRYPTION_KEY` - 64-char hex for encrypting API keys (required for credentials)
- `FILE_STORAGE_PATH` - Local file uploads directory
- `ALLOWED_ORIGINS` - CORS comma-separated origins

## Development Workflow

### Adding New Features

1. **Schema first**: Update Drizzle schema in `src/database/schema/*.ts`
2. **Generate migration**: `bun run db:generate` (creates SQL in `src/database/migrations/`)
3. **Apply migration**: `bun run db:migrate` (test on local DB)
4. **Create service**: Business logic in `src/services/*.service.ts`
5. **Build routes**: API endpoints in `src/routes/*.ts` with Zod schemas
6. **Register route**: Add to `src/server.ts` with appropriate prefix
7. **Write tests**: Create test file in `tests/*.test.ts`
8. **Run tests**: `bun test` to verify functionality
9. **Typecheck**: `bun run typecheck` before committing

### Migration Guidelines
- **NEVER use `db:push` in production** (bypasses migrations)
- **Always review generated SQL** before applying migrations
- **Test migrations on local copy** of production data
- Migration files in `src/database/migrations/` are versioned
- Apply migrations before starting server: `bun run db:migrate && bun run start`

### Testing Best Practices
- Each route file should have corresponding test in `tests/`
- Tests use Bun's built-in test runner (NOT Jest)
- Mock Privy auth by setting `request.user` manually
- Database tests use transactions and rollback (or separate test DB)
- Run specific test suites with `bun test:*` commands

## Deployment (Railway)

Current configuration uses **NIXPACKS** (deprecated - needs migration to Railpacks):
- Build: `bun install && bun run db:migrate`
- Start: `bun run start`
- Healthcheck: `/health` endpoint
- Auto-restart on failure (max 10 retries)

**TODO**: Migrate from Nixpacks to Railway's new Railpacks builder. Use Deepwiki MCP or Web Search to understand Railpacks configuration.

## Code Quality Standards (kluster.ai Integration)

This project uses kluster.ai verification rules (`.cursor/rules/kluster-code-verify.mdc`):

1. **Automatic verification** runs after ANY code change
2. **Manual verification** via "verify with kluster" command
3. **Dependency validation** before package operations
4. **Todo list management** from kluster feedback must be completed
5. **Session tracking** via `chat_id` across kluster calls
6. **End-of-session summary** required when kluster tools used

## Common Gotchas

1. **Use Bun, not Node**: All commands use `bun`, NOT `npm`/`yarn`/`node`
2. **TypeScript strict mode**: Null checks required everywhere (`noUncheckedIndexedAccess`)
3. **Enum imports**: Always import PostgreSQL enums from schema before using in queries
4. **Plugin order matters**: Database must load before auth, auth before protected routes
5. **API key encryption**: Requires `ENCRYPTION_KEY` environment variable (64-char hex)
6. **File uploads**: Must use multipart plugin - standard JSON body won't work
7. **AI service failures**: Always handle missing API keys gracefully (don't crash server)
8. **Drizzle queries**: Use `.prepare()` for repeated queries (performance optimization)
9. **Zod v4**: Some breaking changes from v3 - check docs if schemas fail
10. **Railway deployment**: Remember to run `db:migrate` in build command

## Key Files to Understand

- `src/server.ts` - Fastify server configuration, plugin registration, error handling
- `src/config/env.ts` - Environment variable validation with Zod
- `src/database/schema/index.ts` - Complete database schema export
- `src/plugins/auth.ts` - Privy JWT authentication implementation
- `src/utils/errors.ts` - AppError class for consistent error handling
- `drizzle.config.ts` - Drizzle ORM configuration for migrations

## Support Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Fastify Documentation](https://fastify.dev)
- [Privy Authentication](https://docs.privy.io)
- [Vercel AI SDK v5](https://sdk.vercel.ai)
- [Bun Documentation](https://bun.sh/docs)
