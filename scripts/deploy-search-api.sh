#!/bin/bash

echo "🚀 Deploying Search API Worker"
echo "============================="
echo ""

# Check if wrangler is authenticated
echo "Checking Cloudflare authentication..."
if ! ./node_modules/.bin/wrangler whoami > /dev/null 2>&1; then
    echo "❌ Not authenticated with Cloudflare"
    echo "Please run: ./node_modules/.bin/wrangler login"
    exit 1
fi

echo "✅ Authenticated with Cloudflare"
echo ""

# Deploy search API worker
echo "Deploying search API worker..."
cd workers
../node_modules/.bin/wrangler deploy -c search-api-worker.wrangler.jsonc

if [ $? -eq 0 ]; then
    echo "✅ Search API worker deployed successfully"
    
    # Get the worker URL
    WORKER_URL=$(../node_modules/.bin/wrangler deployments list | grep "alleato-search-api" | head -1 | awk '{print $2}')
    
    if [ -z "$WORKER_URL" ]; then
        # Construct URL if we can't get it automatically
        echo ""
        echo "Your search API is deployed at:"
        echo "https://alleato-search-api.[your-subdomain].workers.dev"
    else
        echo ""
        echo "Your search API is deployed at:"
        echo "$WORKER_URL"
    fi
    
    echo ""
    echo "Update your Next.js chat API route with this URL!"
    echo ""
else
    echo "❌ Failed to deploy search API worker"
    exit 1
fi

cd ..
echo "✅ Deployment complete!"