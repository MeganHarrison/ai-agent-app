// Search API Worker for Alleato Documents
// Provides search functionality for the Next.js chat interface

interface Env {
  ALLEATO_DB: D1Database;
  AI: Ai;
}

interface SearchRequest {
  query: string;
  limit?: number;
  filters?: {
    project?: string;
    department?: string;
    dateFrom?: string;
    dateTo?: string;
    type?: string;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Enable CORS for the Next.js app
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    
    if (url.pathname === '/search' && request.method === 'POST') {
      return handleSearch(request, env, corsHeaders);
    } else if (url.pathname === '/health') {
      return Response.json(
        { status: 'healthy', timestamp: new Date().toISOString() },
        { headers: corsHeaders }
      );
    }
    
    return Response.json(
      { error: 'Endpoint not found' },
      { status: 404, headers: corsHeaders }
    );
  }
};

async function handleSearch(request: Request, env: Env, corsHeaders: HeadersInit): Promise<Response> {
  try {
    const searchRequest: SearchRequest = await request.json();
    const { query, limit = 10, filters } = searchRequest;

    if (!query || query.trim().length === 0) {
      return Response.json(
        { error: 'Query parameter is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Search in D1 database using full-text search
    let sql = `
      SELECT 
        id, title, date, summary, project, department, 
        priority, status, keywords, tags, action_items, 
        decisions, participants, duration, word_count
      FROM meetings
      WHERE searchable_text LIKE ?
    `;
    
    const params: any[] = [`%${query.toLowerCase()}%`];
    
    // Apply filters if provided
    if (filters) {
      if (filters.project) {
        sql += ' AND project = ?';
        params.push(filters.project);
      }
      if (filters.department) {
        sql += ' AND department = ?';
        params.push(filters.department);
      }
      if (filters.dateFrom) {
        sql += ' AND date >= ?';
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        sql += ' AND date <= ?';
        params.push(filters.dateTo);
      }
      if (filters.type) {
        sql += ' AND category = ?';
        params.push(filters.type);
      }
    }
    
    // Order by relevance (simple scoring based on title match)
    sql += `
      ORDER BY 
        CASE 
          WHEN title LIKE ? THEN 1 
          WHEN summary LIKE ? THEN 2 
          ELSE 3 
        END,
        date DESC
      LIMIT ?
    `;
    
    params.push(`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`, limit);
    
    const stmt = env.ALLEATO_DB.prepare(sql);
    const results = await stmt.bind(...params).all();
    
    // Parse JSON fields
    const formattedResults = results.results.map(row => ({
      ...row,
      action_items: row.action_items ? JSON.parse(row.action_items as string) : [],
      decisions: row.decisions ? JSON.parse(row.decisions as string) : []
    }));
    
    // Use AI to generate a contextual response if results are found
    let aiResponse = '';
    if (formattedResults.length > 0) {
      aiResponse = await generateAIResponse(query, formattedResults, env.AI);
    }
    
    return Response.json(
      {
        query,
        results: formattedResults,
        response: aiResponse,
        count: formattedResults.length,
        timestamp: new Date().toISOString()
      },
      { headers: corsHeaders }
    );
    
  } catch (error) {
    console.error('Search error:', error);
    return Response.json(
      {
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function generateAIResponse(query: string, results: any[], ai: Ai): Promise<string> {
  const prompt = `You are a helpful assistant for the Alleato document search system. 
  The user asked: "${query}"
  
  Here are the relevant documents found:
  ${results.slice(0, 3).map((doc, i) => `
  ${i + 1}. ${doc.title} (${doc.date})
  Summary: ${doc.summary}
  ${doc.action_items?.length > 0 ? `Action Items: ${doc.action_items.slice(0, 2).join(', ')}` : ''}
  ${doc.decisions?.length > 0 ? `Key Decisions: ${doc.decisions.slice(0, 2).join(', ')}` : ''}
  `).join('\n')}
  
  Please provide a helpful, conversational response that:
  1. Directly answers the user's question based on these documents
  2. References specific documents when relevant
  3. Highlights key action items or decisions if applicable
  4. Keeps the response concise and focused
  
  Respond in a natural, conversational tone.`;
  
  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }]
    });
    
    return response.response as string;
  } catch (error) {
    console.error('AI response generation failed:', error);
    return formatFallbackResponse(query, results);
  }
}

function formatFallbackResponse(query: string, results: any[]): string {
  if (results.length === 0) {
    return `I couldn't find any documents matching "${query}". Try using different keywords or checking the spelling.`;
  }
  
  const topResult = results[0];
  let response = `I found ${results.length} document${results.length > 1 ? 's' : ''} related to "${query}". `;
  
  response += `The most relevant is "${topResult.title}" from ${topResult.date}. `;
  
  if (topResult.summary) {
    response += topResult.summary;
  }
  
  if (topResult.action_items?.length > 0) {
    response += ` Key action items include: ${topResult.action_items.slice(0, 2).join(', ')}.`;
  }
  
  return response;
}