import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 1. Fetch meetings from Fireflies API
    const firefliesResponse = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIREFLIES_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query GetTranscripts($limit: Int) {
            transcripts(limit: $limit) {
              id
              title
              date
              duration
              meeting_attendees {
                displayName
                email
              }
              transcript_url
              sentences {
                text
                speaker_name
                start_time
              }
            }
          }
        `,
        variables: {
          limit: 10 // Limit to last 10 meetings for initial sync
        }
      })
    });

    if (!firefliesResponse.ok) {
      throw new Error(`Fireflies API error: ${firefliesResponse.status}`);
    }

    const firefliesData = await firefliesResponse.json();
    
    if (!firefliesData.data?.transcripts) {
      throw new Error('No transcripts found in Fireflies response');
    }
    
    // 2. Convert to markdown and upload to R2 bucket connected to AutoRAG
    const syncResults = await Promise.allSettled(
      firefliesData.data.transcripts.map(async (transcript: any) => {
        const markdownContent = convertToMarkdown(transcript);
        
        // Upload to R2 bucket that's connected to your AutoRAG
        const uploadResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${process.env.R2_BUCKET_NAME}/objects/meetings/meeting-${transcript.id}.md`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'text/markdown',
          },
          body: markdownContent
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload meeting ${transcript.id}: ${uploadResponse.status}`);
        }

        return transcript.id;
      })
    );

    // Count successful uploads
    const successfulUploads = syncResults.filter(result => result.status === 'fulfilled').length;
    const failedUploads = syncResults.filter(result => result.status === 'rejected').length;

    // 3. Trigger AutoRAG sync to reindex new content
    try {
      await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/autorag/rags/alleato-docs/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        }
      });
    } catch (syncError) {
      console.warn('AutoRAG sync trigger failed:', syncError);
      // Don't fail the entire operation if sync trigger fails
    }

    return NextResponse.json({ 
      count: successfulUploads,
      failed: failedUploads,
      message: `Successfully synced ${successfulUploads} meetings${failedUploads > 0 ? ` (${failedUploads} failed)` : ''}`
    });

  } catch (error) {
    console.error('Sync meetings error:', error);
    
    return NextResponse.json({ 
      error: 'Failed to sync meetings',
      details: error instanceof Error ? error.message : 'Unknown error',
      count: 0
    }, { status: 200 }); // Return 200 so frontend handles gracefully
  }
}

function convertToMarkdown(transcript: any): string {
  // Add structured metadata at the top
  const metadata = {
    project: extractProjectFromTitle(transcript.title),
    date: transcript.date,
    type: 'meeting-transcript',
    priority: 'high',
    department: 'operations',
    status: 'completed',
    tags: `meeting,transcript,${transcript.title.toLowerCase().replace(/\s+/g, '-')}`
  };
  
  const attendees = transcript.meeting_attendees?.map((a: any) => a.displayName).join(', ') || 'Unknown';
  const duration = transcript.duration ? `${Math.round(transcript.duration / 60)} minutes` : 'Unknown';
  
  return `---
title: ${transcript.title}
project: ${metadata.project}
date: ${new Date(transcript.date).toISOString()}
type: ${metadata.type}
priority: ${metadata.priority}
department: ${metadata.department}
status: ${metadata.status}
tags: ${metadata.tags}
duration: ${duration}
attendees: ${attendees}
---

# ${transcript.title}

**Project:** ${metadata.project}
**Date:** ${new Date(transcript.date).toLocaleDateString()}
**Type:** Meeting Transcript
**Priority:** ${metadata.priority}

## Meeting Details
- **Duration:** ${duration}
- **Attendees:** ${attendees}
- **Meeting ID:** ${transcript.id}

## Transcript

${transcript.sentences?.map((sentence: any, index: number) => {
  const timestamp = sentence.start_time ? `[${Math.floor(sentence.start_time / 60)}:${String(Math.floor(sentence.start_time % 60)).padStart(2, '0')}]` : '';
  return `${timestamp} **${sentence.speaker_name}:** ${sentence.text}`;
}).join('\n\n') || 'No transcript content available.'}

---

**Document Metadata:**
- **Project:** ${metadata.project}
- **Department:** ${metadata.department}
- **Status:** ${metadata.status}
- **Tags:** ${metadata.tags}
- **Indexed:** ${new Date().toISOString()}
`;
}

// Helper function to extract project from meeting title
function extractProjectFromTitle(title: string): string {
  // Smart project extraction based on common patterns
  const projectPatterns = [
    /project\s+(\w+)/i,
    /(\w+)\s+project/i,
    /(\w+)\s+meeting/i,
    /weekly\s+(\w+)/i,
    /(\w+)\s+standup/i,
    /(\w+)\s+review/i,
    /port\s+collective/i,
    /collective/i
  ];
  
  for (const pattern of projectPatterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  
  return 'general';
}