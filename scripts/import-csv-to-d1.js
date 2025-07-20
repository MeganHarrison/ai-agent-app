#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CSV_FILE_PATH = '/Users/meganharrison/Downloads/github/ai-agent-app/Messages - Brandon Clymer2.csv';
const DATABASE_NAME = 'megan_personal';
const TABLE_NAME = 'texts-bc';
const BATCH_SIZE = 1000; // D1 batch API supports up to 1000 statements per batch

// Simple CSV parser function
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const fields = [];
        let currentField = '';
        let inQuotes = false;
        let j = 0;
        
        while (j < line.length) {
            const char = line[j];
            
            if (char === '"') {
                if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
                    // Handle escaped quotes
                    currentField += '"';
                    j += 2;
                } else {
                    inQuotes = !inQuotes;
                    j++;
                }
            } else if (char === ',' && !inQuotes) {
                fields.push(currentField);
                currentField = '';
                j++;
            } else {
                currentField += char;
                j++;
            }
        }
        
        // Add the last field
        fields.push(currentField);
        result.push(fields);
    }
    
    return result;
}

// Function to execute D1 query using wrangler
function executeQuery(sql) {
    try {
        const sqlEscaped = sql.replace(/'/g, "''");
        const command = `npx wrangler d1 execute ${DATABASE_NAME} --command="${sqlEscaped}" --remote`;
        const result = execSync(command, { encoding: 'utf-8', cwd: process.cwd() });
        return { success: true, result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Function to write SQL to temp file and execute
function executeBatchFromFile(statements) {
    try {
        // Create a temporary SQL file
        const tempFileName = `temp_batch_${Date.now()}.sql`;
        const tempFilePath = path.join(process.cwd(), tempFileName);
        
        // Write all statements to the file
        const sqlContent = statements.map(stmt => {
            if (stmt.params) {
                // Replace placeholders with actual values
                let sql = stmt.sql;
                stmt.params.forEach((param, index) => {
                    const placeholder = '?';
                    if (param === null || param === undefined) {
                        sql = sql.replace(placeholder, 'NULL');
                    } else if (typeof param === 'string') {
                        // Escape single quotes in strings
                        const escapedParam = param.replace(/'/g, "''");
                        sql = sql.replace(placeholder, `'${escapedParam}'`);
                    } else {
                        sql = sql.replace(placeholder, param.toString());
                    }
                });
                return sql + ';';
            } else {
                return stmt.sql + ';';
            }
        }).join('\n');
        
        fs.writeFileSync(tempFilePath, sqlContent);
        
        // Execute the SQL file
        const command = `npx wrangler d1 execute ${DATABASE_NAME} --file="${tempFileName}" --remote`;
        const result = execSync(command, { encoding: 'utf-8', cwd: process.cwd() });
        
        // Clean up temp file
        fs.unlinkSync(tempFilePath);
        
        return { success: true, result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Function to extract time from date_time
function extractTime(dateTime) {
    if (!dateTime) return null;
    const match = dateTime.match(/\d{2}:\d{2}:\d{2}/);
    return match ? match[0] : null;
}

// Function to convert date format from MM/DD/YY to YYYY-MM-DD
function convertDate(dateStr) {
    if (!dateStr) return null;
    
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (!match) return null;
    
    const [, month, day, year] = match;
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    
    return `${fullYear}-${paddedMonth}-${paddedDay}`;
}

function main() {
    try {
        console.log('Reading CSV file...');
        const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
        
        console.log('Parsing CSV data...');
        const rows = parseCSV(csvContent);
        
        if (rows.length === 0) {
            console.log('No data found in CSV file');
            return;
        }
        
        // Skip header row
        const dataRows = rows.slice(1);
        console.log(`Found ${dataRows.length} data rows to import`);
        
        // Prepare insert statements
        const insertStatements = [];
        let processedCount = 0;
        let skippedCount = 0;
        
        for (const row of dataRows) {
            // CSV columns: id,date_time,date,,type,sender,message,attachment,sender_id,sentiment,category,tag
            // Note: there's an empty column at index 3
            const [csvId, dateTime, date, , type, sender, message, attachment, senderId, sentiment, category, tag] = row;
            
            // Skip rows that don't have essential data
            if (!dateTime && !date && !type) {
                skippedCount++;
                continue;
            }
            
            // Map to database columns: id, date, type, sender, message, attachment, sender_id, time, date_time, sentiment, category, tag
            const dbId = csvId || null;
            const dbDate = convertDate(date);
            const dbType = type || null;
            const dbSender = sender || null;
            const dbMessage = message || null;
            const dbAttachment = attachment || null;
            const dbSenderId = senderId || null;
            const dbTime = extractTime(dateTime);
            const dbDateTime = dateTime || null;
            const dbSentiment = sentiment || null;
            const dbCategory = category || null;
            const dbTag = tag || null;
            
            const sql = `INSERT INTO "${TABLE_NAME}" (id, date, type, sender, message, attachment, sender_id, time, date_time, sentiment, category, tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const params = [dbId, dbDate, dbType, dbSender, dbMessage, dbAttachment, dbSenderId, dbTime, dbDateTime, dbSentiment, dbCategory, dbTag];
            
            insertStatements.push({ sql, params });
            processedCount++;
        }
        
        console.log(`Prepared ${insertStatements.length} insert statements`);
        console.log(`Skipped ${skippedCount} rows due to missing essential data`);
        
        // Process in batches
        let totalInserted = 0;
        const totalBatches = Math.ceil(insertStatements.length / BATCH_SIZE);
        
        for (let i = 0; i < insertStatements.length; i += BATCH_SIZE) {
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const batch = insertStatements.slice(i, i + BATCH_SIZE);
            
            console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
            
            try {
                const result = executeBatchFromFile(batch);
                
                if (result.success) {
                    totalInserted += batch.length;
                    console.log(`✓ Batch ${batchNumber} completed successfully`);
                    console.log(`  Wrangler output: ${result.result.split('\n').slice(-3).join(' ')}`);
                } else {
                    console.error(`✗ Batch ${batchNumber} failed:`, result.error);
                }
            } catch (error) {
                console.error(`✗ Batch ${batchNumber} failed with exception:`, error.message);
            }
            
            // Add a small delay between batches to avoid overwhelming the system
            if (i + BATCH_SIZE < insertStatements.length) {
                console.log('  Waiting 1 second before next batch...');
                execSync('sleep 1');
            }
        }
        
        console.log('\n=== Import Summary ===');
        console.log(`Total rows in CSV: ${dataRows.length}`);
        console.log(`Rows processed: ${processedCount}`);
        console.log(`Rows skipped: ${skippedCount}`);
        console.log(`Records inserted: ${totalInserted}`);
        console.log(`Batches processed: ${totalBatches}`);
        
    } catch (error) {
        console.error('Import failed:', error.message);
        process.exit(1);
    }
}

// Run the import
main();