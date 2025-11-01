# 🚀 Deploy Qdrant Setup to Railway

## Current Status

✅ **Code is ready** - All scripts and services are implemented
✅ **Railway env vars set** - `QDRANT_URL=http://qdrant.railway.internal:6333`
⏳ **Need to run setup** - Must execute from within Railway network

## Why Local Execution Fails

Running `railway run` executes commands **locally** with Railway env vars injected. However:
- ❌ Local machine cannot access `qdrant.railway.internal` (internal network)
- ❌ Public Qdrant endpoint may not be exposed
- ✅ Must run from **inside** Railway service

## Option 1: Run via Railway Dashboard (Easiest)

### Step 1: Open Railway Service Shell
1. Go to https://railway.app/project/[your-project-id]
2. Click on `forge` service
3. Click "Shell" tab at the top
4. This gives you a terminal inside the running service

### Step 2: Run Setup Commands
```bash
# Initialize Qdrant collections
bun scripts/init-qdrant.ts

# Embed all manifest data
bun scripts/embed-manifests.ts

# Verify it works
bun scripts/test-qdrant.ts
```

## Option 2: Deploy as One-Time Job

### Create a Railway Job

Add to `railway.json` (create if doesn't exist):
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "bun run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "jobs": {
    "init-qdrant": {
      "command": "bun scripts/init-qdrant.ts && bun scripts/embed-manifests.ts",
      "schedule": null
    }
  }
}
```

Then trigger via CLI:
```bash
railway run --job init-qdrant
```

## Option 3: SSH into Service

### Using Railway CLI
```bash
# SSH into the running forge service
railway shell

# Once inside, run:
cd /app
bun scripts/init-qdrant.ts
bun scripts/embed-manifests.ts
bun scripts/test-qdrant.ts
```

## Option 4: Add to Deployment Script

### Update package.json
```json
{
  "scripts": {
    "setup:qdrant": "bun scripts/init-qdrant.ts && bun scripts/embed-manifests.ts",
    "postinstall": "bun run db:migrate && bun run setup:qdrant"
  }
}
```

This will auto-run on every deployment (may slow down deploys).

## Recommended Approach

**Use Option 1 (Railway Dashboard Shell)** - It's the quickest and most straightforward:

1. Open Railway Dashboard → `forge` service → Shell tab
2. Run: `bun scripts/init-qdrant.ts`
3. Run: `bun scripts/embed-manifests.ts`
4. Done! ✅

## Expected Output

### init-qdrant.ts
```
🔵 Qdrant Initialization
============================================================

📡 Testing Qdrant connection...
✅ Qdrant connection successful

🔧 Initializing content type collections...
Creating 7 collections:
  - content_asset
  - content_lore
  - content_quest
  - content_npc
  - content_manifest
  - content_item
  - content_character

✅ All collections initialized successfully

📊 Collection Statistics:
  ✅ content_item:
     Points: 0
     Vector size: 1536
     Distance: Cosine
     Status: green
  ...
```

### embed-manifests.ts
```
🎮 Embedding Game Manifests into Qdrant
============================================================

🔧 Initializing Content Embedder + Qdrant...
✅ Ready to embed content

📖 Loading manifests from database...
Found 13 global manifests

📦 Processing items manifest...
   Items to embed: 15
   ✅ Embedded 15 items
   ⏱️  Duration: 3500ms

...

📊 Embedding Summary
============================================================
TOTAL:
  ✅ Successfully embedded: 71 items
  ❌ Failed: 0 items
  ⏱️  Total duration: 45000ms (45.00s)

💡 Semantic Search Now Available!
```

## After Setup

Once complete, you can use semantic search in your application:

```typescript
// Search for items by description
const items = await manifestService.findSimilarItems('powerful weapon for warriors')
// Returns: [mithril_sword, steel_sword, ...]

// Build AI context for generation
const context = await manifestService.getItemGenerationContextSemantic(
  'Create sword for level 15 player'
)
// AI gets context about steel (lvl 10) and mithril (lvl 20) swords
```

## Troubleshooting

**If shell command fails with "command not found":**
```bash
# Check if bun is available
which bun

# If not, use the full path
/usr/local/bin/bun scripts/init-qdrant.ts
```

**If connection still fails:**
- Verify Qdrant service is running: `railway status`
- Check logs: `railway logs -s Qdrant`
- Verify QDRANT_URL env var: `echo $QDRANT_URL`

## Summary

The code is **100% ready**. You just need to run 2 commands from inside Railway:
1. `bun scripts/init-qdrant.ts` (30 seconds)
2. `bun scripts/embed-manifests.ts` (45 seconds)

That's it! Then semantic search will be fully operational. 🎉
