#!/bin/bash

echo "🚀 Quick R2 to D1 Document Sync"
echo "==============================="
echo ""

# Navigate to project directory
cd /Users/meganharrison/Downloads/github/ai-agent-app

# Step 1: Setup D1 tables
echo "Step 1: Creating D1 tables..."
npx wrangler d1 execute alleato --file=workers/setup-d1-tables.sql --remote

# Step 2: Deploy sync worker
echo ""
echo "Step 2: Deploying sync worker..."
npx wrangler deploy workers/sync-worker.ts -c workers/sync-worker.wrangler.jsonc

# Step 3: Get worker URL (you'll need to replace this with your actual worker URL)
echo ""
echo "Step 3: Triggering sync..."
echo ""
echo "Your sync worker should now be deployed at:"
echo "https://alleato-sync-worker.[your-account].workers.dev"
echo ""
echo "To start the sync, run one of these commands:"
echo ""
echo "Full sync (all 350 documents):"
echo "curl https://alleato-sync-worker.[your-account].workers.dev/sync-all"
echo ""
echo "Recent sync (last 24 hours):"
echo "curl https://alleato-sync-worker.[your-account].workers.dev/sync-recent"
echo ""
echo "Replace [your-account] with your Cloudflare account subdomain"