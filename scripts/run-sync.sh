#!/bin/bash

echo "🚀 R2 to D1 Document Sync Setup Script"
echo "======================================"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Fix npm permissions
echo "Step 1: Fixing npm permissions..."
echo "Please run: sudo chown -R $(whoami) ~/.npm"
echo "Press Enter after you've run the command..."
read

# Step 2: Install wrangler
echo ""
echo "Step 2: Installing wrangler..."
if ! command_exists wrangler; then
    npm install -g wrangler
    echo "✅ Wrangler installed"
else
    echo "✅ Wrangler already installed"
fi

# Step 3: Login to Cloudflare (if needed)
echo ""
echo "Step 3: Authenticating with Cloudflare..."
wrangler whoami || wrangler login

# Step 4: Create D1 tables
echo ""
echo "Step 4: Creating D1 database tables..."
echo "Running SQL setup..."
wrangler d1 execute alleato --file=workers/setup-d1-tables.sql --remote

# Step 5: Deploy sync worker
echo ""
echo "Step 5: Deploying sync worker..."
cd workers
wrangler deploy -c sync-worker.wrangler.jsonc

# Get the deployed URL
WORKER_URL=$(wrangler deployments list | grep "alleato-sync-worker" | awk '{print $2}')

# Step 6: Trigger the sync
echo ""
echo "Step 6: Starting document sync..."
echo "This will process all 350 documents from R2 to D1"
echo ""
echo "Choose sync type:"
echo "1) Full sync (all documents)"
echo "2) Recent sync (last 24 hours only)"
echo -n "Enter choice [1-2]: "
read choice

case $choice in
    1)
        echo "Starting full sync..."
        curl -X GET "https://${WORKER_URL}/sync-all"
        ;;
    2)
        echo "Starting recent sync..."
        curl -X GET "https://${WORKER_URL}/sync-recent"
        ;;
    *)
        echo "Invalid choice. Starting full sync by default..."
        curl -X GET "https://${WORKER_URL}/sync-all"
        ;;
esac

echo ""
echo "✅ Sync process initiated!"
echo ""
echo "You can monitor the progress in:"
echo "1. Cloudflare Dashboard > Workers > Logs"
echo "2. The response from the sync endpoint above"
echo ""
echo "The sync worker will:"
echo "- Process documents in batches of 10"
echo "- Extract metadata using AI"
echo "- Store structured data in D1"
echo "- Track success/failure rates"