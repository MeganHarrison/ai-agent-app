# Quick Start: R2 to D1 Document Sync

## Prerequisites Completed ✅
- Wrangler installed in project
- Workers created (sync-worker.ts and api-worker.ts)
- Wrangler configuration files ready
- D1 SQL schema prepared

## Steps to Run the Sync

### 1. Authenticate with Cloudflare
```bash
./node_modules/.bin/wrangler login
```
This will open a browser window. Log in with your Cloudflare account.

### 2. Run the Complete Setup
```bash
./setup-and-sync.sh
```

This script will:
1. ✅ Verify authentication
2. ✅ Create D1 database tables
3. ✅ Deploy the sync worker
4. ✅ Deploy the API worker
5. ✅ Provide sync commands

### 3. Alternative: Manual Steps

If you prefer to run commands individually:

```bash
# Create D1 tables
./node_modules/.bin/wrangler d1 execute alleato --file=workers/setup-d1-tables.sql --remote

# Deploy sync worker
cd workers
../node_modules/.bin/wrangler deploy -c sync-worker.wrangler.jsonc
cd ..

# Deploy API worker
cd workers
../node_modules/.bin/wrangler deploy -c api-worker.wrangler.jsonc
cd ..

# Trigger sync (replace with your actual worker URL)
curl https://alleato-sync-worker.your-account.workers.dev/sync-all
```

## What Happens During Sync

1. **Document Reading**: Reads all 350 markdown files from R2
2. **AI Analysis**: Extracts metadata, summaries, and insights
3. **D1 Storage**: Stores structured data for fast queries
4. **Progress Tracking**: Logs success/failure for each document

## Monitoring Progress

- **Cloudflare Dashboard**: Workers → Logs
- **Sync Response**: Shows processed/success/error counts
- **D1 Query**: 
  ```bash
  ./node_modules/.bin/wrangler d1 execute alleato --command="SELECT COUNT(*) FROM meetings" --remote
  ```

## After Sync Completes

Your D1 database will contain:
- Document metadata (title, date, participants)
- AI-generated summaries
- Action items and decisions
- Searchable keywords and tags
- Project categorization

## Troubleshooting

- **Authentication Error**: Run `wrangler login` again
- **D1 Not Found**: Check database ID in wrangler.jsonc matches your D1 instance
- **R2 Access Error**: Verify R2 bucket binding in wrangler.jsonc
- **AI Errors**: The system will use default values and continue

## Next Steps

1. Update `.env.local` with your Cloudflare credentials
2. Use the API worker endpoints in your Next.js app
3. Set up automatic sync (cron job every 6 hours)