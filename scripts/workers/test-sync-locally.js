// Test the sync logic locally before deploying
// Run with: node test-sync-locally.js

const mockDocuments = [
  {
    key: "2025-07-15 - Goodwill Bloomington Morning Meeting.md",
    content: `Goodwill Bloomington Morning Meeting
Meeting ID: 01JZGD41X5JE6S3QGEAED0527W
Date: 2025-07-15
Duration: 15.5 minutes
Transcript: [View Transcript](https://app.fireflies.ai/view/01JZGD41X5JE6S3QGEAED0527W)
Participants: greulice@bloomington.in.gov, amulder@goodwillindy.org
Transcript:

Discussion about project timeline and budget adjustments...`
  },
  {
    key: "project-plan-goodwill-expansion.md",
    content: `# Goodwill Expansion Project Plan

## Overview
This document outlines the expansion plans for Goodwill Bloomington...`
  }
];

// Simulate metadata extraction
function extractMetadata(content, filename) {
  const meetingIdMatch = content.match(/Meeting ID:\s*([A-Z0-9]+)/);
  const dateMatch = content.match(/Date:\s*(\d{4}-\d{2}-\d{2})/) || filename.match(/(\d{4}-\d{2}-\d{2})/);
  const titleMatch = content.match(/^#?\s*(.+?)$/m);
  
  return {
    id: meetingIdMatch?.[1] || 'DOC_' + Date.now(),
    title: titleMatch?.[1] || filename.replace(/\.md$/, ''),
    filename,
    type: meetingIdMatch ? 'meeting-transcript' : 'business-document',
    date: dateMatch?.[1] || new Date().toISOString().split('T')[0],
    r2_key: filename
  };
}

// Test the extraction
console.log('Testing document metadata extraction:\n');
mockDocuments.forEach(doc => {
  const metadata = extractMetadata(doc.content, doc.key);
  console.log(`Document: ${doc.key}`);
  console.log('Extracted metadata:', metadata);
  console.log('---\n');
});

console.log(`
Next Steps:
1. Run the SQL setup script on your D1 database
2. Deploy the sync worker
3. Trigger the sync endpoint
4. Your 350 documents will be processed and indexed in D1!
`);