#!/usr/bin/env node

// Script to verify D1 database status in Cloudflare Workers
const https = require('https');

// Database configuration from wrangler.jsonc
const DATABASE_ID = 'fc7c9a6d-ca65-4768-b3f9-07ec5afb38c5';
const DATABASE_NAME = 'alleato';

// Check for environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.log('❌ Environment variables not set. To verify D1 database, you need:');
  console.log('');
  console.log('export CLOUDFLARE_ACCOUNT_ID="your-account-id"');
  console.log('export CLOUDFLARE_API_TOKEN="your-api-token"');
  console.log('');
  console.log('You can find these in your Cloudflare dashboard at:');
  console.log('- Account ID: Right sidebar of any Cloudflare dashboard page');
  console.log('- API Token: My Profile > API Tokens > Create Token');
  console.log('');
  console.log('ℹ️  The D1 database configuration is ready:');
  console.log(`   Database ID: ${DATABASE_ID}`);
  console.log(`   Database Name: ${DATABASE_NAME}`);
  console.log('   Tables: meetings, sync_analytics');
  process.exit(1);
}

// Function to make Cloudflare API requests
function makeCloudflareRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      port: 443,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(`API Error: ${JSON.stringify(result.errors)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Function to execute SQL on D1
async function queryD1(sql) {
  const path = `/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
  return makeCloudflareRequest(path, 'POST', { sql });
}

// Main verification function
async function verifyD1Database() {
  console.log('🔍 Verifying D1 Database in Cloudflare Workers...\n');

  try {
    // 1. Check if database exists and is accessible
    console.log('1. Checking database connectivity...');
    const dbInfo = await makeCloudflareRequest(`/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}`);
    console.log(`✅ Database "${dbInfo.result.name}" is accessible`);
    console.log(`   Database ID: ${dbInfo.result.uuid}`);
    console.log(`   Created: ${new Date(dbInfo.result.created_at).toLocaleDateString()}`);
    console.log('');

    // 2. Check what tables exist
    console.log('2. Checking database tables...');
    const tablesResult = await queryD1("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    const tables = tablesResult.result[0].results;
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found. Database needs to be initialized.');
      console.log('   Run: node workers/execute-d1-sql.js');
    } else {
      console.log(`✅ Found ${tables.length} tables:`);
      tables.forEach(table => {
        console.log(`   - ${table.name}`);
      });
    }
    console.log('');

    // 3. Check table schemas if tables exist
    const expectedTables = ['meetings', 'sync_analytics'];
    for (const tableName of expectedTables) {
      const tableExists = tables.some(t => t.name === tableName);
      
      if (tableExists) {
        console.log(`3. Checking ${tableName} table structure...`);
        const schemaResult = await queryD1(`PRAGMA table_info(${tableName});`);
        const columns = schemaResult.result[0].results;
        
        console.log(`✅ Table "${tableName}" has ${columns.length} columns:`);
        columns.forEach(col => {
          console.log(`   - ${col.name}: ${col.type}${col.pk ? ' (PRIMARY KEY)' : ''}${col.notnull ? ' NOT NULL' : ''}`);
        });
        
        // Check row count
        const countResult = await queryD1(`SELECT COUNT(*) as count FROM ${tableName};`);
        const rowCount = countResult.result[0].results[0].count;
        console.log(`   Rows: ${rowCount}`);
        console.log('');
      } else {
        console.log(`❌ Table "${tableName}" not found`);
      }
    }

    // 4. Check indexes
    console.log('4. Checking database indexes...');
    const indexResult = await queryD1("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
    const indexes = indexResult.result[0].results;
    
    if (indexes.length > 0) {
      console.log(`✅ Found ${indexes.length} custom indexes:`);
      indexes.forEach(idx => {
        console.log(`   - ${idx.name} on table ${idx.tbl_name}`);
      });
    } else {
      console.log('⚠️  No custom indexes found. Performance may be slower.');
    }
    console.log('');

    // 5. Summary
    console.log('📊 D1 Database Verification Summary:');
    console.log('━'.repeat(50));
    console.log(`Database Status: ${dbInfo.result ? '✅ Online' : '❌ Offline'}`);
    console.log(`Tables Created: ${tables.length > 0 ? '✅ Yes' : '❌ No'}`);
    console.log(`Ready for Data: ${tables.length >= 2 ? '✅ Yes' : '❌ No - Run setup script'}`);
    
    if (tables.length >= 2) {
      console.log('\n🚀 Database is ready! You can now:');
      console.log('1. Deploy the sync worker: cd workers && wrangler deploy sync-worker.ts');
      console.log('2. Trigger document sync: POST to your sync worker endpoint');
      console.log('3. Start indexing your 350 documents');
    } else {
      console.log('\n⚙️  Next steps:');
      console.log('1. Set up environment variables (shown above)');
      console.log('2. Run: node workers/execute-d1-sql.js');
      console.log('3. Deploy the sync worker');
    }

  } catch (error) {
    console.error('❌ D1 Database verification failed:', error.message);
    
    if (error.message.includes('10000')) {
      console.log('\n💡 This might be an authentication issue. Please verify:');
      console.log('1. Your API token has D1 permissions');
      console.log('2. Your account ID is correct');
      console.log('3. The database ID exists in your account');
    }
  }
}

// Run the verification
verifyD1Database();