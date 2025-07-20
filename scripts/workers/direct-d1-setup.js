#!/usr/bin/env node

// Direct D1 setup using Cloudflare API without npm dependencies
const https = require('https');
const fs = require('fs');

// Configuration - You need to set these
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DATABASE_ID = 'fc7c9a6d-ca65-4768-b3f9-07ec5afb38c5';

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error('❌ Error: Please set environment variables:');
  console.error('export CLOUDFLARE_ACCOUNT_ID="your-account-id"');
  console.error('export CLOUDFLARE_API_TOKEN="your-api-token"');
  console.error('\nYou can find these in your Cloudflare dashboard');
  process.exit(1);
}

// Read SQL file
const sqlContent = fs.readFileSync(__dirname + '/setup-d1-tables.sql', 'utf8');

// Function to make API request
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`API Error ${res.statusCode}: ${body}`));
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

// Execute SQL on D1
async function executeSql(sql) {
  const options = {
    hostname: 'api.cloudflare.com',
    port: 443,
    path: `/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  return makeRequest(options, { sql });
}

// Main execution
async function main() {
  console.log('🚀 Direct D1 Setup Starting...\n');

  try {
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const result = await executeSql(stmt + ';');
        console.log('✅ Success');
        
        if (result.result && result.result.length > 0) {
          console.log('Result:', JSON.stringify(result.result, null, 2));
        }
      } catch (err) {
        console.error('❌ Failed:', err.message);
        // Continue with next statement even if one fails
      }
      
      console.log('');
    }

    console.log('✨ D1 setup complete!\n');
    console.log('Next steps:');
    console.log('1. Deploy the sync worker');
    console.log('2. Trigger the sync to migrate your 350 documents\n');

  } catch (error) {
    console.error('💥 Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
main();