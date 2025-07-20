// src/index.ts
// Cloudflare Worker for RAG with Enhanced Metadata Extraction

import { DocumentMetadataExtractor, DocumentMetadata, processDocumentWithMetadata, searchDocumentsByMetadata, DocumentSearchQuery } from './metadata-extractor';

interface Env {
  // R2 Buckets
  DOCUMENTS_BUCKET: R2Bucket;
  METADATA_BUCKET: R2Bucket;
  
  // Vectorize
  VECTORIZE_INDEX: VectorizeIndex;
  
  // Workers AI
  AI: Ai;
  
  // Environment variables
  FIREFLIES_API_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  AUTORAG_ENDPOINT: string;
  
  // D1 Database for metadata queries
  METADATA_DB: D1Database;
}

interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;
  duration: number;
  meeting_attendees: Array<{
    displayName: string;
    email: string;
  }>;
  transcript: {
    sentences: Array<{
      text: string;
      speaker_name: string;
      start_time: number;
    }>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    try {
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      switch (url.pathname) {
        case '/api/chat':
          return handleChatQuery(request, env, corsHeaders);
        
        case '/api/sync-meetings':
          return handleMeetingSync(request, env, ctx, corsHeaders);
        
        case '/api/search-metadata':
          return handleMetadataSearch(request, env, corsHeaders);
        
        case '/api/upload-document':
          return handleDocumentUpload(request, env, ctx, corsHeaders);
        
        case '/api/analytics':
          return handleAnalytics(request, env, corsHeaders);
        
        default:
          return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Enhanced chat query with metadata-aware search
 */
async function handleChatQuery(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const { message, context } = await request.json();

  try {
    // First, try to extract search intent from the message
    const searchContext = await extractSearchContext(message, env.AI);
    
    // If the query has specific metadata filters, search with those first
    let relevantDocs: DocumentMetadata[] = [];
    if (searchContext.hasMetadataFilters) {
      relevantDocs = await searchDocumentsByMetadata(searchContext.filters, env.METADATA_BUCKET);
    }

    // Prepare the enhanced query for AutoRAG
    const enhancedQuery = await enhanceQueryWithContext(message, searchContext, relevantDocs, env.AI);

    // Query AutoRAG with enhanced context
    const autoragResponse = await fetch(env.AUTORAG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: enhancedQuery,
        query_rewrite: true,
        maximum_number_of_results: 15,
        match_threshold: 0.7,
        metadata_filters: searchContext.vectorizeFilters // Pass metadata filters to Vectorize
      })
    });

    if (!autoragResponse.ok) {
      throw new Error(`AutoRAG API error: ${autoragResponse.status}`);
    }

    const data = await autoragResponse.json();
    const aiResponse = data.result?.response || 'I apologize, but I could not generate a response at this time.';

    // Log the interaction for analytics
    await logInteraction(env.METADATA_DB, {
      query: message,
      response: aiResponse,
      context: searchContext,
      timestamp: new Date().toISOString(),
      documentCount: relevantDocs.length
    });

    return new Response(JSON.stringify({ 
      response: aiResponse,
      sources: data.result?.sources || [],
      metadata: {
        searchContext,
        documentCount: relevantDocs.length,
        queryEnhanced: enhancedQuery !== message
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Chat query error:', error);
    return new Response(JSON.stringify({ 
      response: 'I\'m having trouble accessing my knowledge base right now. Please try again.',
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Enhanced meeting sync with comprehensive metadata extraction
 */
async function handleMeetingSync(request: Request, env: Env, ctx: ExecutionContext, corsHeaders: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Fetch latest meetings from Fireflies
    const firefliesResponse = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.FIREFLIES_API_KEY}`,
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
              transcript {
                sentences {
                  text
                  speaker_name
                  start_time
                }
              }
            }
          }
        `,
        variables: { limit: 20 }
      })
    });

    if (!firefliesResponse.ok) {
      throw new Error(`Fireflies API error: ${firefliesResponse.status}`);
    }

    const firefliesData = await firefliesResponse.json();
    
    if (!firefliesData.data?.transcripts) {
      throw new Error('No transcripts found in Fireflies response');
    }

    const extractor = new DocumentMetadataExtractor();
    const processedDocuments: DocumentMetadata[] = [];

    // Process each transcript with enhanced metadata extraction
    const syncResults = await Promise.allSettled(
      firefliesData.data.transcripts.map(async (transcript: FirefliesTranscript) => {
        // Convert to enhanced markdown with structured metadata
        const markdownContent = convertToEnhancedMarkdown(transcript);
        const filename = `${transcript.date.split('T')[0]}-${transcript.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')}.md`;
        
        // Extract comprehensive metadata
        const metadata = await extractor.extractMetadata(markdownContent, filename);
        
        // Store document in R2
        await env.DOCUMENTS_BUCKET.put(`meetings/${filename}`, markdownContent, {
          httpMetadata: {
            contentType: 'text/markdown'
          },
          customMetadata: {
            documentId: metadata.id,
            type: metadata.type,
            project: metadata.project,
            category: metadata.category,
            priority: metadata.priority,
            date: metadata.date
          }
        });

        // Store metadata separately for fast querying
        await env.METADATA_BUCKET.put(`metadata/${metadata.id}.json`, JSON.stringify(metadata, null, 2), {
          httpMetadata: {
            contentType: 'application/json'
          }
        });

        // Store structured metadata in D1 for complex queries
        await storeMetadataInD1(env.METADATA_DB, metadata);

        // Generate embeddings and store in Vectorize with metadata
        const embedding = await generateEmbedding(metadata.searchableText, env.AI);
        await env.VECTORIZE_INDEX.upsert([{
          id: metadata.id,
          values: embedding,
          metadata: {
            title: metadata.title,
            project: metadata.project,
            category: metadata.category,
            type: metadata.type,
            date: metadata.date,
            priority: metadata.priority,
            participants: metadata.participants?.join(',') || '',
            tags: metadata.tags.join(',')
          }
        }]);

        processedDocuments.push(metadata);
        return metadata.id;
      })
    );

    const successfulUploads = syncResults.filter(result => result.status === 'fulfilled').length;
    const failedUploads = syncResults.filter(result => result.status === 'rejected').length;

    // Update analytics
    await updateAnalytics(env.METADATA_DB, {
      documentsProcessed: successfulUploads,
      documentsWithMetadata: processedDocuments.length,
      averageWordCount: processedDocuments.reduce((sum, doc) => sum + doc.wordCount, 0) / processedDocuments.length
    });

    return new Response(JSON.stringify({ 
      count: successfulUploads,
      failed: failedUploads,
      message: `Successfully synced ${successfulUploads} meetings with enhanced metadata`,
      processed: processedDocuments.map(doc => ({
        id: doc.id,
        title: doc.title,
        project: doc.project,
        category: doc.category,
        participants: doc.participants?.length || 0,
        actionItems: doc.actionItems?.length || 0
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Meeting sync error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to sync meetings',
      details: error.message,
      count: 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Search documents by metadata
 */
async function handleMetadataSearch(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const query: DocumentSearchQuery = await request.json();

  try {
    const results = await searchDocumentsByMetadata(query, env.METADATA_BUCKET);
    
    return new Response(JSON.stringify({
      results,
      count: results.length,
      query
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Metadata search error:', error);
    return new Response(JSON.stringify({ 
      error: 'Search failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Upload and process custom documents
 */
async function handleDocumentUpload(request: Request, env: Env, ctx: ExecutionContext, corsHeaders: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filename = file.name;
    const content = await file.text();

    // Process with metadata extraction
    const metadata = await processDocumentWithMetadata(content, filename, env.METADATA_BUCKET);

    // Store in appropriate bucket
    await env.DOCUMENTS_BUCKET.put(`uploads/${filename}`, content, {
      httpMetadata: {
        contentType: file.type
      },
      customMetadata: {
        documentId: metadata.id,
        type: metadata.type,
        project: metadata.project
      }
    });

    // Store in D1 and Vectorize
    await storeMetadataInD1(env.METADATA_DB, metadata);
    const embedding = await generateEmbedding(metadata.searchableText, env.AI);
    await env.VECTORIZE_INDEX.upsert([{
      id: metadata.id,
      values: embedding,
      metadata: {
        title: metadata.title,
        project: metadata.project,
        category: metadata.category,
        type: metadata.type
      }
    }]);

    return new Response(JSON.stringify({
      success: true,
      metadata,
      message: 'Document uploaded and processed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Document upload error:', error);
    return new Response(JSON.stringify({ 
      error: 'Upload failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Analytics endpoint
 */
async function handleAnalytics(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const analytics = await getAnalytics(env.METADATA_DB);
    
    return new Response(JSON.stringify(analytics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return new Response(JSON.stringify({ 
      error: 'Analytics retrieval failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Helper functions

/**
 * Convert Fireflies transcript to enhanced markdown with structured metadata
 */
function convertToEnhancedMarkdown(transcript: FirefliesTranscript): string {
  const attendees = transcript.meeting_attendees?.map(a => a.displayName).join(', ') || 'Unknown';
  const duration = transcript.duration ? `${Math.round(transcript.duration / 60)} minutes` : 'Unknown';
  const date = new Date(transcript.date);
  
  // Generate YAML frontmatter for better metadata parsing
  const frontmatter = `---
title: "${transcript.title}"
meetingId: "${transcript.id}"
date: "${date.toISOString().split('T')[0]}"
duration: ${transcript.duration || 0}
type: "meeting-transcript"
attendees: ${JSON.stringify(transcript.meeting_attendees?.map(a => a.displayName) || [])}
attendeeEmails: ${JSON.stringify(transcript.meeting_attendees?.map(a => a.email) || [])}
---`;

  const content = `${frontmatter}

# ${transcript.title}

**Meeting ID:** ${transcript.id}  
**Date:** ${date.toLocaleDateString()}  
**Duration:** ${duration}  
**Attendees:** ${attendees}  

## Transcript

${transcript.transcript?.sentences?.map((sentence, index) => {
  const timestamp = sentence.start_time ? `[${Math.floor(sentence.start_time / 60)}:${String(Math.floor(sentence.start_time % 60)).padStart(2, '0')}]` : '';
  return `${timestamp} **${sentence.speaker_name}:** ${sentence.text}`;
}).join('\n\n') || 'No transcript content available.'}

---

**Document Metadata:**
- **Indexed:** ${new Date().toISOString()}
- **Source:** Fireflies.ai
- **Format:** Enhanced Markdown with Metadata
`;

  return content;
}

/**
 * Extract search context from natural language query
 */
async function extractSearchContext(message: string, ai: Ai): Promise<{
  hasMetadataFilters: boolean;
  filters: DocumentSearchQuery;
  vectorizeFilters: Record<string, any>;
}> {
  // Use AI to extract intent and filters from the message
  const systemPrompt = `Extract search filters from this query. Respond with JSON only:
{
  "hasMetadataFilters": boolean,
  "project": string | null,
  "category": string | null,
  "type": string | null,
  "dateRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } | null,
  "priority": string | null,
  "participants": string[] | null,
  "keywords": string[] | null
}

Examples:
"Show me Goodwill meetings from last month" -> {"hasMetadataFilters": true, "project": "goodwill", "type": "meeting-transcript", "dateRange": {...}}
"What design decisions were made?" -> {"hasMetadataFilters": true, "category": "design", "keywords": ["decisions"]}`;

  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    const filters = JSON.parse(response.response);
    
    return {
      hasMetadataFilters: filters.hasMetadataFilters,
      filters,
      vectorizeFilters: {
        ...(filters.project && { project: filters.project }),
        ...(filters.category && { category: filters.category }),
        ...(filters.type && { type: filters.type })
      }
    };
  } catch (error) {
    console.error('Failed to extract search context:', error);
    return {
      hasMetadataFilters: false,
      filters: {},
      vectorizeFilters: {}
    };
  }
}

/**
 * Enhance query with context and relevant document metadata
 */
async function enhanceQueryWithContext(
  originalQuery: string, 
  searchContext: any, 
  relevantDocs: DocumentMetadata[], 
  ai: Ai
): Promise<string> {
  if (!searchContext.hasMetadataFilters || relevantDocs.length === 0) {
    return originalQuery;
  }

  const contextInfo = relevantDocs.slice(0, 5).map(doc => 
    `${doc.title} (${doc.project}, ${doc.date})`
  ).join(', ');

  return `${originalQuery}

Context: Found ${relevantDocs.length} relevant documents including: ${contextInfo}`;
}

/**
 * Generate embeddings using Workers AI
 */
async function generateEmbedding(text: string, ai: Ai): Promise<number[]> {
  const response = await ai.run('@cf/baai/bge-base-en-v1.5', {
    text: text.slice(0, 2000) // Limit text length
  });
  
  return response.data[0];
}

/**
 * Store metadata in D1 database for complex queries
 */
async function storeMetadataInD1(db: D1Database, metadata: DocumentMetadata): Promise<void> {
  await db.prepare(`
    INSERT OR REPLACE INTO document_metadata 
    (id, title, filename, type, category, project, department, client, date, priority, status, 
     word_count, participants, tags, keywords, created_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    metadata.id,
    metadata.title,
    metadata.filename,
    metadata.type,
    metadata.category,
    metadata.project,
    metadata.department,
    metadata.client || null,
    metadata.date,
    metadata.priority,
    metadata.status,
    metadata.wordCount,
    metadata.participants?.join(',') || '',
    metadata.tags.join(','),
    metadata.keywords.join(','),
    metadata.createdDate
  ).run();
}

/**
 * Log interaction for analytics
 */
async function logInteraction(db: D1Database, interaction: any): Promise<void> {
  await db.prepare(`
    INSERT INTO interactions (query, response_length, document_count, timestamp, context)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    interaction.query,
    interaction.response.length,
    interaction.documentCount,
    interaction.timestamp,
    JSON.stringify(interaction.context)
  ).run();
}

/**
 * Update analytics counters
 */
async function updateAnalytics(db: D1Database, stats: any): Promise<void> {
  await db.prepare(`
    INSERT INTO analytics (date, documents_processed, avg_word_count, timestamp)
    VALUES (date('now'), ?, ?, datetime('now'))
  `).bind(
    stats.documentsProcessed,
    Math.round(stats.averageWordCount)
  ).run();
}

/**
 * Get analytics data
 */
async function getAnalytics(db: D1Database): Promise<any> {
  const results = await db.prepare(`
    SELECT 
      COUNT(*) as total_documents,
      AVG(word_count) as avg_word_count,
      COUNT(DISTINCT project) as unique_projects,
      COUNT(DISTINCT category) as unique_categories
    FROM document_metadata
  `).first();

  const recentInteractions = await db.prepare(`
    SELECT COUNT(*) as count, date(timestamp) as date
    FROM interactions 
    WHERE timestamp > datetime('now', '-7 days')
    GROUP BY date(timestamp)
    ORDER BY date DESC
  `).all();

  return {
    totalDocuments: results.total_documents,
    avgWordCount: Math.round(results.avg_word_count),
    uniqueProjects: results.unique_projects,
    uniqueCategories: results.unique_categories,
    recentActivity: recentInteractions.results
  };
}