# MinIO + Manifest Integration - Complete Setup

## Overview

This document describes the complete MinIO object storage and game manifest integration for the Forge backend. All generated assets are now stored in MinIO on Railway, and all game metadata is accessible to the AI for context-aware generation.

## MinIO Configuration

### Buckets
- **assets** - General asset storage
- **uploads** - User uploads
- **audio** - Music, SFX, voice generations
- **3d-models** - 3D model files (.glb, .obj)
- **images** - Generated images (DALL-E, concept art)

All buckets are configured with **public download access** for frontend consumption.

### Environment Variables
```bash
MINIO_ENDPOINT=bucket.railway.internal     # Internal Railway network
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_PUBLIC_HOST=bucket-staging-4c7a.up.railway.app  # Public HTTPS access
MINIO_ROOT_USER=y1m84YjYcO9QVUlWS1gU1GQgT7B7bDGp
MINIO_ROOT_PASSWORD=5Z3fbifEkI3gPAKSjnUYAobnoV51F95G2oFTYu8hg3MYCVJr
```

## Migration Summary

### Local Uploads Migration
- **179 files** migrated from `./uploads/` to MinIO
  - 3 images → `images` bucket
  - 1 3D model → `3d-models` bucket
  - 175 audio files → `audio` bucket

### Hyperscape Assets Migration
- **228 files** from github.com/HyperscapeAI/assets
  - All assets organized into appropriate buckets
  - Filenames preserve directory structure (e.g., `music_intro_1.mp3`)

### Manifest Data Import
- **13 manifest files** imported into `preview_manifests` table:
  - 15 items (weapons, tools, resources)
  - 20 music tracks
  - 12 zones
  - 8 biomes
  - 5 banks, 5 stores
  - 1 NPC, 1 world area, 1 avatar
  - Asset requirements, generation configs, resources

## Service Integration

### MinIO Storage Service
**File**: `src/services/minio.service.ts`

```typescript
import { minioStorageService } from '@/services/minio.service'

// Upload file to MinIO
const { path, url, filename, bucket } = await minioStorageService.uploadFile(
  buffer,           // File buffer
  'image/png',      // MIME type
  'concept.png',    // Original filename
  'images'          // Optional bucket override
)

// Delete file
await minioStorageService.deleteFile('images/file.png')

// Get presigned URL (expires in 7 days)
const url = await minioStorageService.getPresignedUrl('images/file.png')

// List files in bucket
const files = await minioStorageService.listFiles('audio', 'music_')
```

### Manifest Service
**File**: `src/services/manifest.service.ts`

```typescript
import { manifestService } from '@/services/manifest.service'

// Get all items
const items = await manifestService.getAllItems()

// Get specific item
const bronzeSword = await manifestService.getItemById('bronze_sword')

// Validate item reference
const isValid = await manifestService.validateItemId('steel_sword')

// Get AI context for generation
const context = await manifestService.getItemGenerationContext()

// Get items by type
const weapons = await manifestService.getItemsByType('weapon')

// Get world data
const biomes = await manifestService.getAllBiomes()
const zones = await manifestService.getAllZones()
const music = await manifestService.getAllMusic()
```

## AI Integration

### How AI Uses Manifest Data

1. **Item Generation**: AI queries existing items to match stats, requirements, and progression
   ```typescript
   // Get context before generating
   const context = await manifestService.getItemGenerationContext()

   // Validate generated item references
   const isValid = await manifestService.validateItemId('bronze_sword')
   ```

2. **NPC Generation**: AI references existing NPCs, zones, and biomes for consistency
   ```typescript
   const zones = await manifestService.getAllZones()
   const npcs = await manifestService.getAllNPCs()
   ```

3. **Music/Audio Generation**: AI knows existing music tracks and can match style/category
   ```typescript
   const musicTracks = await manifestService.getAllMusic()
   ```

### Updated Generation Services

All AI generation services now use MinIO:

- **`generation.service.ts`** - 3D models and concept art
- **`voice-generation.processor.ts`** - ElevenLabs voice
- **`image-generation.processor.ts`** - DALL-E images
- **`audio-generation.service.ts`** - Music, SFX, voice
- **Routes**: `assets.ts`, `music.ts`, `sound-effects.ts`

## Frontend Access

All generated assets are accessible via public HTTPS URLs:

```
https://bucket-staging-4c7a.up.railway.app/images/uuid.png
https://bucket-staging-4c7a.up.railway.app/audio/uuid.mp3
https://bucket-staging-4c7a.up.railway.app/3d-models/uuid.glb
```

No authentication required for downloads (public read access configured on all buckets).

## Scripts

### Migration Scripts
```bash
# Migrate database-tracked assets
bun scripts/migrate-to-minio.ts
bun scripts/migrate-to-minio.ts --dry-run  # Test mode

# Migrate all local files
bun scripts/migrate-all-files-to-minio.ts

# Migrate Hyperscape assets
bun scripts/migrate-hyperscape-assets.ts
```

### Metadata Scripts
```bash
# Import manifest data
bun scripts/import-hyperscape-metadata.ts

# Verify imported data
bun scripts/verify-manifests.ts

# Demo AI context usage
bun scripts/demo-ai-context.ts
```

## Database Schema

### Assets Table
Assets now include MinIO metadata:
```typescript
{
  fileUrl: "https://bucket-staging-4c7a.up.railway.app/images/uuid.png",
  metadata: {
    minioBucket: "images",
    minioPath: "images/uuid.png",
    minioUrl: "https://...",
    storageMode: "minio"
  }
}
```

### Preview Manifests Table
Game metadata stored for AI context:
```sql
CREATE TABLE preview_manifests (
  id UUID PRIMARY KEY,
  user_id UUID,           -- NULL for global manifests
  team_id UUID,           -- NULL for global manifests
  manifest_type VARCHAR,  -- 'items', 'npcs', 'music', etc.
  content JSONB,          -- Array of manifest items
  version INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Example: AI-Generated Item with Context

```typescript
// 1. AI queries existing items for context
const context = await manifestService.getItemGenerationContext()

// 2. AI generates new item matching existing patterns
const steelSword = await manifestService.getItemById('steel_sword')

// 3. AI creates item with appropriate stats
const newItem = {
  id: 'iron_sword',
  name: 'Iron Sword',
  type: 'weapon',
  bonuses: {
    attack: steelSword.bonuses.attack - 2,   // Slightly weaker
    strength: steelSword.bonuses.strength - 2
  },
  requirements: {
    level: steelSword.requirements.level - 2,
    skills: {
      attack: steelSword.requirements.skills.attack - 2
    }
  },
  value: Math.floor(steelSword.value * 0.6)
}

// 4. Upload 3D model to MinIO
const modelBuffer = await generate3DModel(newItem)
const { url } = await minioStorageService.uploadFile(
  modelBuffer,
  'model/gltf-binary',
  `${newItem.id}.glb`,
  '3d-models'
)

newItem.modelPath = url
```

## Benefits

1. **Context-Aware Generation**: AI generates items, NPCs, quests that match existing game data
2. **Centralized Storage**: All assets in MinIO, accessible via HTTPS
3. **Scalable**: MinIO handles unlimited file storage, no local disk constraints
4. **Consistent**: AI validates item IDs, stats, requirements against manifests
5. **Frontend Ready**: Public URLs for direct asset access from frontend

## Verification

Run the demo to see AI context in action:
```bash
bun scripts/demo-ai-context.ts
```

Output shows:
- Available manifest types
- Item stats and progression
- AI generating new items with proper context
- Validation of item references

## Next Steps

1. **Update AI prompts** to include manifest context
2. **Add manifest querying** to generation endpoints
3. **Implement item validation** before saving generated content
4. **Create frontend manifest API** to expose game data to clients
5. **Add manifest versioning** for content updates
