# 🚀 Quick Setup - Run This on Railway

## Current Situation

- ✅ Code is deployed and ready
- ✅ All environment variables are set
- ⏳ Need to initialize Qdrant collections and embed data

## The Problem

Running `railway run` executes **locally** with Railway env vars, but can't access `qdrant.railway.internal` (internal network only).

## Solution: Run Commands After Deploy

### Option A: Wait for Deployment, Then Use Railway CLI

```bash
# 1. Deploy your current changes
git add .
git commit -m "Add Qdrant vector search integration"
git push

# 2. Wait for deployment to complete (check Railway dashboard)

# 3. Once deployed, the forge service will be running

# 4. Then you can run the setup via Railway's ephemeral service:
# Unfortunately railway run won't work for internal network access
```

### Option B: Add One-Time Setup Job (RECOMMENDED)

Create `scripts/setup-once.ts`:

```typescript
#!/usr/bin/env bun
/**
 * ONE-TIME SETUP: Run this once after deployment
 * Initializes Qdrant and embeds all manifest data
 */

console.log('🚀 Running one-time Qdrant setup...\n')

// Check if already initialized
import { qdrantService } from '@/services/qdrant.service'

const isHealthy = await qdrantService.healthCheck()
if (!isHealthy) {
  console.log('❌ Qdrant not accessible - check QDRANT_URL')
  process.exit(1)
}

console.log('✅ Qdrant is accessible\n')

// Run initialization
console.log('Step 1/2: Initializing collections...')
await import('./init-qdrant.ts')

console.log('\nStep 2/2: Embedding manifests...')
await import('./embed-manifests.ts')

console.log('\n✅ Setup complete!')
process.exit(0)
```

Then add to `package.json`:
```json
{
  "scripts": {
    "setup:qdrant:once": "bun scripts/setup-once.ts"
  }
}
```

### Option C: Automatic Setup on First Start (EASIEST!)

Add this to your `src/index.ts` or `src/server.ts`:

```typescript
// At the top of the file
import { qdrantService } from './services/qdrant.service'

// Before starting the server
async function initializeQdrantIfNeeded() {
  try {
    const stats = await qdrantService.getAllStats()
    const hasData = Object.values(stats).some((stat: any) =>
      stat.points_count && stat.points_count > 0
    )

    if (!hasData) {
      console.log('🔵 First-time setup: Initializing Qdrant...')

      // Initialize collections
      await qdrantService.initializeCollections()
      console.log('✅ Collections initialized')

      // Embed manifests (this might be done elsewhere)
      console.log('💡 Tip: Run `bun scripts/embed-manifests.ts` to populate data')
    } else {
      console.log('✅ Qdrant already initialized with data')
    }
  } catch (error) {
    console.error('⚠️  Qdrant initialization check failed:', error)
    // Don't fail the server start
  }
}

// Call before starting server
await initializeQdrantIfNeeded()
```

## Simplest Approach Right Now

**Just commit and push your code:**

```bash
git add .
git commit -m "Add Qdrant semantic search with auto-initialization"
git push
```

The code I wrote will auto-construct the Qdrant URL from Railway's `QDRANT_PRIVATE_DOMAIN` + `QDRANT_PORT`, so the connection will work automatically once deployed.

Then you can manually run the embedding script by:

1. Adding a simple API endpoint to trigger it:

```typescript
// In src/routes/admin.ts or create new file
server.post('/admin/setup-qdrant', {
  onRequest: [server.authenticate],
}, async (request, reply) => {
  // Check if user is admin
  if (request.user?.role !== 'admin') {
    return reply.status(403).send({ error: 'Admin only' })
  }

  const { exec } = require('child_process')
  exec('bun scripts/init-qdrant.ts && bun scripts/embed-manifests.ts',
    (error: any, stdout: any, stderr: any) => {
      if (error) {
        return reply.status(500).send({ error: error.message })
      }
      return reply.send({
        success: true,
        output: stdout,
        message: 'Qdrant setup complete'
      })
    }
  )
})
```

2. Then just call: `curl -X POST https://your-app.railway.app/admin/setup-qdrant`

## What Happens After Deploy

Once you push and Railway deploys:

1. ✅ Service starts with correct `QDRANT_URL` (auto-constructed)
2. ✅ Qdrant connection works (internal network)
3. ⏳ Collections need to be initialized (run init script)
4. ⏳ Data needs to be embedded (run embed script)

**You only need to run steps 3 and 4 once!**

## Next Steps

1. Commit and push your current code
2. Wait for Railway deployment
3. Choose one of the options above to run the setup
4. Done! Semantic search will be working

The easiest is **Option C** - let me add that to your server startup now...
