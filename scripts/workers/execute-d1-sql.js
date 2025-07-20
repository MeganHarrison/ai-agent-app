#!/usr/bin/env node

// This script executes SQL commands on the D1 database using the Cloudflare API
// Since we cannot use wrangler CLI due to npm permission issues

const fs = require('fs');
const https = require('https');

// Read environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DATABASE_ID = 'fc7c9a6d-ca65-4768-b3f9-07ec5afb38c5'; // From wrangler.jsonc

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.error('Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set');
  process.exit(1);
}

// Read SQL file
const sqlFilePath = '/Users/meganharrison/Downloads/github/ai-agent-app/workers/setup-d1-tables.sql';
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// Split SQL content into individual statements
const sqlStatements = sqlContent
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0)
  .map(stmt => stmt + ';');

console.log(`Found ${sqlStatements.length} SQL statements to execute`);

// Function to execute a single SQL statement
function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ sql });

    const options = {
      hostname: 'api.cloudflare.com',
      port: 443,
      path: `/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(`API Error: ${JSON.stringify(result.errors)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Execute all SQL statements
async function main() {
  console.log('Starting D1 database setup...');
  
  for (let i = 0; i < sqlStatements.length; i++) {
    const stmt = sqlStatements[i];
    console.log(`\nExecuting statement ${i + 1}/${sqlStatements.length}:`);
    console.log(stmt.substring(0, 50) + '...');
    
    try {
      const result = await executeSQL(stmt);
      console.log('✓ Success');
    } catch (error) {
      console.error('✗ Error:', error.message);
      // Continue with other statements even if one fails
    }
  }
  
  console.log('\nD1 database setup complete!');
  
  // Now let's check the database state
  console.log('\nChecking database state...');
  
  try {
    const tablesResult = await executeSQL("SELECT name FROM sqlite_master WHERE type='table';");
    console.log('\nTables in database:', tablesResult.result[0].results);
    
    const meetingsCount = await executeSQL("SELECT COUNT(*) as count FROM meetings;");
    console.log('Meetings table row count:', meetingsCount.result[0].results);
    
    const analyticsCount = await executeSQL("SELECT COUNT(*) as count FROM sync_analytics;");
    console.log('Sync analytics table row count:', analyticsCount.result[0].results);
  } catch (error) {
    console.error('Error checking database state:', error.message);
  }
}

main().catch(console.error);