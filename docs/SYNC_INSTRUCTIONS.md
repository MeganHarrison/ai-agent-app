# R2 to D1 Document Sync Instructions

## Prerequisites
1. Fix npm permissions (if needed):
   ```bash
   sudo chown -R $(whoami) ~/.npm
   ```

2. Install wrangler globally:
   ```bash
   npm install -g wrangler
   ```

## Step-by-Step Sync Process

### 1. Create D1 Database Tables

Run this command to create the necessary tables in your D1 database:

```bash
cd /Users/meganharrison/Downloads/github/ai-agent-app
wrangler d1 execute alleato --file=workers/setup-d1-tables.sql --remote
```

### 2. Deploy the Sync Worker

Deploy the worker that will handle the R2 to D1 sync:

```bash
cd workers
wrangler deploy -c sync-worker.wrangler.jsonc
```

After deployment, you'll see output like:
```
✨ Successfully published alleato-sync-worker
🌎 https://alleato-sync-worker.your-account.workers.dev
```

### 3. Trigger the Document Sync

You have two options:

#### Option A: Full Sync (All 350 Documents)
```bash
curl https://alleato-sync-worker.your-account.workers.dev/sync-all
```

#### Option B: Recent Sync (Last 24 Hours Only)
```bash
curl https://alleato-sync-worker.your-account.workers.dev/sync-recent
```

### 4. Monitor Progress

- Check Cloudflare Dashboard → Workers → Logs
- The sync response will show:
  - Number of documents processed
  - Success count
  - Error count
  - Any error details

### 5. Verify the Sync

Query your D1 database to verify documents were synced:

```bash
wrangler d1 execute alleato --command="SELECT COUNT(*) as total FROM meetings" --remote
```

## What Happens During Sync

1. **Document Reading**: Reads all markdown files from your R2 bucket
2. **Metadata Extraction**: 
   - Extracts meeting IDs, dates, participants
   - Uses AI to generate summaries and categorize documents
   - Creates searchable keywords and tags
3. **Database Storage**: Stores structured metadata in D1 for fast queries
4. **Batch Processing**: Processes documents in batches of 10 for optimal performance

## Troubleshooting

- **Permission Errors**: Run `sudo chown -R $(whoami) ~/.npm`
- **Login Required**: Run `wrangler login` and follow the browser prompt
- **D1 Database Not Found**: Ensure your database ID matches in wrangler.jsonc
- **R2 Bucket Access**: Verify bucket name and permissions in Cloudflare dashboard

## Next Steps

After successful sync:
1. Deploy the API worker for querying: `wrangler deploy -c api-worker.wrangler.jsonc`
2. Update your frontend to use the new D1-powered endpoints
3. Set up the cron job for automatic syncing (already configured for every 6 hours)