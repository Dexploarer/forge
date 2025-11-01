# 🔧 Fix Qdrant Connection in Railway

## Problem Detected

Your Railway environment has `QDRANT_URL` set incorrectly:
```
❌ QDRANT_URL=qdrant-staging-ace4.up.railway.app
```

This is missing:
- Protocol (`http://`)
- Port (`:6333`)
- Should use internal domain, not public

## ✅ Fix It Now

Run this command to set the correct value:

```bash
railway variables set QDRANT_URL=http://qdrant.railway.internal:6333
```

## Why This Matters

**Current (Broken):**
```
QDRANT_URL=qdrant-staging-ace4.up.railway.app
```
- ❌ No protocol → `new QdrantClient()` will fail
- ❌ No port → Can't connect
- ❌ Public domain → Slower, unnecessary external routing

**Correct (Fixed):**
```
QDRANT_URL=http://qdrant.railway.internal:6333
```
- ✅ Full URL with protocol
- ✅ Includes port 6333
- ✅ Uses internal Railway network (faster, more secure)

## Alternative: Let Code Auto-Construct

Good news! The code now auto-constructs the URL from Railway's variables if `QDRANT_URL` is missing or invalid:

```typescript
// In qdrant.service.ts
if (!qdrantUrl && env.QDRANT_PRIVATE_DOMAIN) {
  const host = env.QDRANT_PRIVATE_DOMAIN  // qdrant.railway.internal
  const port = env.QDRANT_PORT || 6333
  qdrantUrl = `http://${host}:${port}`
}
```

So the service **should work** even with the incorrect `QDRANT_URL`, because it falls back to `QDRANT_PRIVATE_DOMAIN` + `QDRANT_PORT`.

## Verify It's Working

After setting the env var:

```bash
# Deploy the changes
railway up

# Then test the connection
railway run bun scripts/init-qdrant.ts
```

Expected output:
```
[QdrantService] Initialized {
  url: "http://qdrant.railway.internal:6333",
  vectorSize: 1536,
  distance: "Cosine"
}
✅ Qdrant connection successful
```

If you see `http://qdrant.railway.internal:6333` in the logs, it's working correctly!

## Quick Checklist

- [ ] Run: `railway variables set QDRANT_URL=http://qdrant.railway.internal:6333`
- [ ] Verify other Qdrant vars exist (they do!):
  - ✅ `QDRANT_PRIVATE_DOMAIN=qdrant.railway.internal`
  - ✅ `QDRANT_PORT=6333`
  - ✅ `QDRANT_API_KEY=` (empty is correct for internal network)
- [ ] Deploy: `railway up` (or wait for auto-deploy)
- [ ] Test: `railway run bun scripts/init-qdrant.ts`
- [ ] Embed data: `railway run bun scripts/embed-manifests.ts`

## Summary

**What's wrong:** `QDRANT_URL` is incomplete (missing `http://` and `:6333`)

**Quick fix:** `railway variables set QDRANT_URL=http://qdrant.railway.internal:6333`

**Backup plan:** Code auto-constructs URL from `QDRANT_PRIVATE_DOMAIN` + `QDRANT_PORT`, so it should work anyway

**Recommendation:** Set it explicitly for clarity and reliability
