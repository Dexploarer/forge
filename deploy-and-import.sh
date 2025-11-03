#!/bin/bash
# Deploy backend changes and run import script on Railway

echo "🚀 Deploying backend changes to Railway..."
railway up

echo ""
echo "⏳ Waiting for deployment to complete..."
sleep 10

echo ""
echo "📦 Running asset import script on Railway..."
railway run --service forge "cd /app && bun scripts/import-hyperscape-assets.ts"
