import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    // Call your Cloudflare AutoRAG using the correct REST API endpoint
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/autorag/rags/alleato-docs/ai-search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: message,
        query_rewrite: true,
        maximum_number_of_results: 10,
        match_threshold: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`AutoRAG API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the response from the AutoRAG result
    const aiResponse = data.result?.response || 'I apologize, but I could not generate a response at this time.';
    
    return NextResponse.json({ response: aiResponse });
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Return a helpful fallback response
    return NextResponse.json({ 
      response: 'I\'m having trouble connecting to my knowledge base right now. Please check that your AutoRAG is properly configured and try again.' 
    }, { status: 200 }); // Return 200 so the frontend handles it gracefully
  }
}