#!/bin/bash

echo "🚀 R2 to D1 Document Sync Setup"
echo "==============================="
echo ""

# Check if wrangler is authenticated
echo "Checking Cloudflare authentication..."
if ! ./node_modules/.bin/wrangler whoami > /dev/null 2>&1; then
    echo "❌ Not authenticated with Cloudflare"
    echo "Please run: ./node_modules/.bin/wrangler login"
    echo "Then run this script again."
    exit 1
fi

echo "✅ Authenticated with Cloudflare"
echo ""

# Step 1: Create D1 tables
echo "Step 1: Creating D1 database tables..."
./node_modules/.bin/wrangler d1 execute alleato --file=workers/setup-d1-tables.sql --remote

if [ $? -eq 0 ]; then
    echo "✅ D1 tables created successfully"
else
    echo "❌ Failed to create D1 tables"
    exit 1
fi

# Step 2: Deploy sync worker
echo ""
echo "Step 2: Deploying sync worker..."
cd workers
../node_modules/.bin/wrangler deploy -c sync-worker.wrangler.jsonc

if [ $? -eq 0 ]; then
    echo "✅ Sync worker deployed successfully"
else
    echo "❌ Failed to deploy sync worker"
    exit 1
fi

# Get the deployed worker URL
WORKER_URL=$(../node_modules/.bin/wrangler deployments list | grep "alleato-sync-worker" | head -1 | awk '{print $2}')

if [ -z "$WORKER_URL" ]; then
    # If we can't get the URL automatically, construct it
    ACCOUNT_SUBDOMAIN=$(../node_modules/.bin/wrangler whoami | grep -oE '[a-zA-Z0-9-]+\.workers\.dev' | cut -d'.' -f1)
    WORKER_URL="https://alleato-sync-worker.${ACCOUNT_SUBDOMAIN}.workers.dev"
fi

cd ..

# Step 3: Deploy API worker
echo ""
echo "Step 3: Deploying API worker..."
cd workers
../node_modules/.bin/wrangler deploy -c api-worker.wrangler.jsonc

if [ $? -eq 0 ]; then
    echo "✅ API worker deployed successfully"
else
    echo "❌ Failed to deploy API worker"
    exit 1
fi

cd ..

# Step 4: Trigger the sync
echo ""
echo "Step 4: Ready to sync documents!"
echo "================================"
echo ""
echo "Your workers are deployed! To sync your documents:"
echo ""
echo "Full sync (all 350 documents):"
echo "curl ${WORKER_URL}/sync-all"
echo ""
echo "Recent sync (last 24 hours only):"
echo "curl ${WORKER_URL}/sync-recent"
echo ""
echo "Would you like to start the full sync now? (y/n)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Starting full document sync..."
    curl -X GET "${WORKER_URL}/sync-all"
    echo ""
    echo "✅ Sync initiated! Monitor progress in Cloudflare dashboard > Workers > Logs"
else
    echo ""
    echo "You can run the sync later using the curl commands above."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your Next.js app environment variables in .env.local"
echo "2. The D1 database is now populated with document metadata"
echo "3. Your API endpoints are available at the deployed worker URLs"