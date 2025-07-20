import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables first
    if (!process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID === 'your-account-id-here' ||
        !process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN === 'your-api-token-here') {
      console.error('Missing or invalid Cloudflare credentials');
      return NextResponse.json({ 
        response: 'Configuration error: Please set your CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the .env.local file.' 
      }, { status: 200 });
    }
    
    const { message } = await request.json();
    
    // Call Cloudflare AutoRAG API
    const autoragUrl = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/autorag/rags/alleato-docs/ai-search`;
    
    console.log('Calling AutoRAG API:', autoragUrl);
    
    const response = await fetch(autoragUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: message,
        query_rewrite: true,
        maximum_number_of_results: 10,
        match_threshold: 0.5
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AutoRAG API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      // If AutoRAG returns 404, it might not be set up yet
      if (response.status === 404) {
        return NextResponse.json({ 
          response: 'The AutoRAG knowledge base is not configured yet. Please ensure AutoRAG is set up in your Cloudflare account with the index name "alleato-docs".' 
        }, { status: 200 });
      }
      
      throw new Error(`AutoRAG API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('AutoRAG response:', JSON.stringify(data, null, 2));
    
    // Extract the AI response from AutoRAG
    let aiResponse = data.result?.response || data.response || 'I apologize, but I could not generate a response at this time.';
    
    // If AutoRAG returns no matches, provide a helpful message
    if (data.result?.matches && data.result.matches.length === 0) {
      aiResponse = "I couldn't find any relevant documents for your query. This might be because:\n\n1. The knowledge base is empty - try syncing some meetings first\n2. Your query doesn't match any indexed content\n3. Try rephrasing your question or being more specific";
    }
    
    return NextResponse.json({ response: aiResponse });
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Check for common configuration issues
    let errorMessage = 'I\'m having trouble connecting to the AutoRAG knowledge base.';
    
    if (!process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID === 'your-account-id-here') {
      errorMessage += ' Please set your CLOUDFLARE_ACCOUNT_ID in the .env.local file.';
    } else if (!process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN === 'your-api-token-here') {
      errorMessage += ' Please set your CLOUDFLARE_API_TOKEN in the .env.local file.';
    } else {
      errorMessage += ' Please ensure AutoRAG is configured in your Cloudflare account with the index "alleato-docs".';
    }
    
    // Return a helpful fallback response
    return NextResponse.json({ 
      response: errorMessage 
    }, { status: 200 }); // Return 200 so the frontend handles it gracefully
  }
}

function formatSearchResults(results: any[], query: string): string {
  if (!results || results.length === 0) {
    return "I couldn't find any relevant documents for your query. Try rephrasing or being more specific.";
  }
  
  // Format search results into a helpful response
  const topResults = results.slice(0, 3);
  let response = `Based on the documents I found, here's what I can tell you about "${query}":\n\n`;
  
  topResults.forEach((result, index) => {
    response += `**${index + 1}. ${result.title}**\n`;
    if (result.summary) {
      response += `${result.summary}\n`;
    }
    if (result.action_items && result.action_items.length > 0) {
      response += `Key action items: ${result.action_items.slice(0, 2).join(', ')}\n`;
    }
    response += '\n';
  });
  
  return response.trim();
}