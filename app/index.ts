// Enhanced Business Intelligence Worker
// Extends your existing Chat + Document system with Project Management Intelligence
// Integrates with your existing /api/chat, /api/sync-meetings, and /api/documents

interface Env {
    // Your existing bindings from wrangler.jsonc
    ALLEATO_DB: D1Database; // fc7c9a6d-ca65-4768-b3f9-07ec5afb38c5
    DOCUMENTS_BUCKET: R2Bucket; // alleato-documents
    VECTORIZE_INDEX: VectorizeIndex; // alleato-embeddings
    AI: Ai;
    
    // Secrets
    FIREFLIES_API_KEY: string;
    CLOUDFLARE_API_TOKEN: string;
    CLOUDFLARE_ACCOUNT_ID: string;
  }
  
  export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);
      
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
  
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
  
      try {
        // Route to your existing endpoints OR new business intelligence endpoints
        switch (url.pathname) {
          // === EXISTING ENDPOINTS (keep unchanged) ===
          case '/api/chat':
            return handleEnhancedChat(request, env, corsHeaders);
          
          case '/api/sync-meetings':
            return handleEnhancedMeetingSync(request, env, corsHeaders);
          
          case '/api/documents':
            return handleDocuments(request, env, corsHeaders);
          
          // === NEW BUSINESS INTELLIGENCE ENDPOINTS ===
          case '/api/projects':
            return handleProjectsList(request, env, corsHeaders);
          
          case '/api/project-dashboard':
            return handleProjectDashboard(request, env, corsHeaders);
          
          case '/api/project-insights':
            return handleProjectInsights(request, env, corsHeaders);
          
          case '/api/financial-dashboard':
            return handleFinancialDashboard(request, env, corsHeaders);
          
          case '/api/tasks':
            return handleTasks(request, env, corsHeaders);
          
          case '/api/create-project':
            return handleCreateProject(request, env, corsHeaders);
          
          default:
            return new Response('Endpoint not found', { status: 404, headers: corsHeaders });
        }
      } catch (error) {
        console.error('Worker error:', error);
        return new Response(JSON.stringify({ 
          error: 'Internal server error',
          details: error.message 
        }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
  };
  
  /**
   * ENHANCED: Your existing chat now includes project context
   */
  async function handleEnhancedChat(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }
  
    const { message, context } = await request.json();
  
    try {
      // Check if the query is project-related and inject context
      const projectContext = await extractProjectContext(message, env.ALLEATO_DB);
      let enhancedMessage = message;
      
      if (projectContext) {
        enhancedMessage = `
  Project Context: ${projectContext.name} (Status: ${projectContext.status}, Client: ${projectContext.client_name})
  Recent Activity: ${projectContext.recent_meetings} meetings, ${projectContext.completed_tasks}/${projectContext.total_tasks} tasks completed
  Budget Status: $${projectContext.actual_cost.toLocaleString()} spent of $${projectContext.estimated_value.toLocaleString()} budget
  
  User Question: ${message}
  
  Please provide insights considering this project context and recent meeting data.
        `;
      }
  
      // Your existing AutoRAG call with enhanced context
      const autoragResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/autorag/rags/alleato-docs/ai-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: enhancedMessage,
          query_rewrite: true,
          maximum_number_of_results: 10,
          match_threshold: 0.7
        })
      });
  
      if (!autoragResponse.ok) {
        throw new Error(`AutoRAG API error: ${autoragResponse.status}`);
      }
  
      const data = await autoragResponse.json();
      let aiResponse = data.result?.response || 'I apologize, but I could not generate a response at this time.';
      
      // Add project-specific insights if context was found
      if (projectContext && projectContext.insights?.length > 0) {
        aiResponse += `\n\n**Project-Specific Insights:**\n${projectContext.insights.map(i => `• ${i.title}`).join('\n')}`;
      }
  
      return new Response(JSON.stringify({ 
        response: aiResponse,
        projectContext: projectContext ? {
          projectName: projectContext.name,
          status: projectContext.status,
          budgetHealth: projectContext.budget_health
        } : null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
  
    } catch (error) {
      console.error('Enhanced chat error:', error);
      return new Response(JSON.stringify({ 
        response: 'I\'m having trouble accessing the knowledge base right now. Please try again.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * ENHANCED: Your existing meeting sync now creates project insights
   */
  async function handleEnhancedMeetingSync(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }
  
    try {
      // Your existing Fireflies sync logic
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
                transcript_url
                sentences {
                  text
                  speaker_name
                  start_time
                }
              }
            }
          `,
          variables: { limit: 10 }
        })
      });
  
      const firefliesData = await firefliesResponse.json();
      
      if (!firefliesData.data?.transcripts) {
        throw new Error('No transcripts found');
      }
  
      const syncResults = await Promise.allSettled(
        firefliesData.data.transcripts.map(async (transcript: any) => {
          // Enhanced: Associate with project AND generate business insights
          const projectId = await associateTranscriptWithProject(env.ALLEATO_DB, transcript.title);
          const businessInsights = await generateBusinessInsights(transcript, env.AI);
          
          // Update your existing meetings table with enhanced data
          await env.ALLEATO_DB.prepare(`
            INSERT OR REPLACE INTO meetings (
              id, title, date, duration, participants, fireflies_id, 
              summary, project_id, meeting_type, action_items_json, 
              key_decisions_json, ai_risk_flags, follow_up_required,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            transcript.id,
            transcript.title,
            transcript.date,
            Math.round(transcript.duration / 60),
            JSON.stringify(transcript.meeting_attendees?.map((a: any) => a.displayName) || []),
            transcript.id,
            businessInsights.summary,
            projectId,
            businessInsights.meetingType,
            JSON.stringify(businessInsights.actionItems),
            JSON.stringify(businessInsights.decisions),
            JSON.stringify(businessInsights.risks),
            businessInsights.followUpRequired,
            new Date().toISOString()
          ).run();
  
          // Create project insights if risks or opportunities were identified
          if (projectId && businessInsights.insights.length > 0) {
            for (const insight of businessInsights.insights) {
              await env.ALLEATO_DB.prepare(`
                INSERT INTO project_insights (
                  id, project_id, insight_type, title, description,
                  source_meeting_id, requires_action, confidence_score
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                `insight_${transcript.id}_${Date.now()}`,
                projectId,
                insight.type,
                insight.title,
                insight.description,
                transcript.id,
                insight.requiresAction,
                insight.confidence
              ).run();
            }
          }
  
          // Your existing document creation for AutoRAG
          const markdownContent = createEnhancedMarkdown(transcript, businessInsights, projectId);
          await uploadToR2(env.DOCUMENTS_BUCKET, `meetings/meeting-${transcript.id}.md`, markdownContent);
  
          return transcript.id;
        })
      );
  
      const successfulUploads = syncResults.filter(result => result.status === 'fulfilled').length;
      
      // Trigger your existing AutoRAG sync
      await triggerAutoRAGSync(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_API_TOKEN);
  
      return new Response(JSON.stringify({ 
        count: successfulUploads,
        message: `Successfully synced ${successfulUploads} meetings with business intelligence`,
        insightsGenerated: syncResults.length * 2 // Estimate of insights created
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
  
    } catch (error) {
      console.error('Enhanced meeting sync error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to sync meetings',
        details: error.message,
        count: 0
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
  
  /**
   * NEW: Project Dashboard - Your command center
   */
  async function handleProjectDashboard(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('id');
  
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Project ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  
    // Get comprehensive project data
    const { results: projectData } = await env.ALLEATO_DB.prepare(`
      SELECT * FROM project_dashboard WHERE id = ?
    `).bind(projectId).all();
  
    if (projectData.length === 0) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  
    const project = projectData[0];
  
    // Get recent insights
    const { results: insights } = await env.ALLEATO_DB.prepare(`
      SELECT * FROM project_insights 
      WHERE project_id = ? 
      ORDER BY extracted_at DESC 
      LIMIT 10
    `).bind(projectId).all();
  
    // Get recent meeting summaries (from your existing meetings table)
    const { results: recentMeetings } = await env.ALLEATO_DB.prepare(`
      SELECT title, date, summary, action_items_json, ai_risk_flags
      FROM meetings 
      WHERE project_id = ? AND date > date('now', '-30 days')
      ORDER BY date DESC
      LIMIT 5
    `).bind(projectId).all();
  
    // Get task breakdown
    const { results: taskStats } = await env.ALLEATO_DB.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(estimated_hours) as estimated_hours,
        SUM(actual_hours) as actual_hours
      FROM tasks 
      WHERE project_id = ?
      GROUP BY status
    `).bind(projectId).all();
  
    const dashboard = {
      project,
      insights: insights.map(i => ({
        ...i,
        requires_action: Boolean(i.requires_action)
      })),
      recentMeetings: recentMeetings.map(m => ({
        ...m,
        action_items: m.action_items_json ? JSON.parse(m.action_items_json) : [],
        risks: m.ai_risk_flags ? JSON.parse(m.ai_risk_flags) : []
      })),
      taskBreakdown: taskStats,
      executiveSummary: await generateExecutiveSummary(project, insights, recentMeetings, env.AI)
    };
  
    return new Response(JSON.stringify(dashboard), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  /**
   * NEW: Projects List with health indicators
   */
  async function handleProjectsList(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const clientId = url.searchParams.get('client');
  
    let query = 'SELECT * FROM project_dashboard';
    const params: any[] = [];
    const conditions: string[] = [];
  
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (clientId) {
      conditions.push('client_id = ?');
      params.push(clientId);
    }
  
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY priority DESC, timeline_status ASC';
  
    const { results } = await env.ALLEATO_DB.prepare(query).bind(...params).all();
  
    return new Response(JSON.stringify({
      projects: results,
      summary: {
        total: results.length,
        onTrack: results.filter(p => p.timeline_status === 'ON_TRACK').length,
        atRisk: results.filter(p => p.timeline_status === 'AT_RISK').length,
        overdue: results.filter(p => p.timeline_status === 'OVERDUE').length,
        totalValue: results.reduce((sum, p) => sum + (p.estimated_value || 0), 0)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Helper Functions
  
  async function extractProjectContext(message: string, db: D1Database): Promise<any> {
    // Smart project detection from user query
    const projectKeywords = message.toLowerCase().match(/\b(goodwill|bloomington|port collective|alleato)\b/g);
    
    if (projectKeywords) {
      const { results } = await db.prepare(`
        SELECT * FROM project_dashboard 
        WHERE LOWER(name) LIKE ? 
        ORDER BY updated_at DESC 
        LIMIT 1
      `).bind(`%${projectKeywords[0]}%`).all();
      
      if (results.length > 0) {
        // Get recent insights for this project
        const { results: insights } = await db.prepare(`
          SELECT title, description FROM project_insights 
          WHERE project_id = ? AND requires_action = TRUE
          LIMIT 3
        `).bind(results[0].id).all();
        
        return { ...results[0], insights };
      }
    }
    
    return null;
  }
  
  async function associateTranscriptWithProject(db: D1Database, title: string): Promise<string | null> {
    // Enhanced project association using multiple heuristics
    const { results } = await db.prepare(`
      SELECT id, name FROM projects 
      WHERE LOWER(?) LIKE LOWER('%' || name || '%') 
         OR LOWER(?) LIKE LOWER('%' || autorag_project_tag || '%')
      ORDER BY updated_at DESC
      LIMIT 1
    `).bind(title, title).all();
  
    return results.length > 0 ? results[0].id : null;
  }
  
  async function generateBusinessInsights(transcript: any, ai: Ai) {
    const fullText = transcript.sentences?.map((s: any) => `${s.speaker_name}: ${s.text}`).join('\n') || '';
    
    const prompt = `
      Analyze this business meeting transcript for actionable insights:
      
      Meeting: ${transcript.title}
      Content: ${fullText.slice(0, 2500)}
      
      Extract and return JSON with:
      {
        "summary": "executive summary in 2-3 sentences",
        "meetingType": "project|client|planning|review|standup",
        "actionItems": ["specific action 1", "action 2"],
        "decisions": ["decision 1", "decision 2"],
        "risks": [{"title": "risk name", "severity": "low|medium|high"}],
        "insights": [{"type": "risk|opportunity|blocker", "title": "insight", "description": "details", "requiresAction": true, "confidence": 0.8}],
        "followUpRequired": true
      }
      
      Focus on business impact, project health, and leadership priorities.
    `;
  
    try {
      const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }]
      });
      
      return JSON.parse(response.response);
    } catch (error) {
      console.error('AI insight generation failed:', error);
      return {
        summary: `Meeting: ${transcript.title}`,
        meetingType: 'project',
        actionItems: [],
        decisions: [],
        risks: [],
        insights: [],
        followUpRequired: false
      };
    }
  }
  
  async function generateExecutiveSummary(project: any, insights: any[], meetings: any[], ai: Ai): Promise<string> {
    const prompt = `
      Create an executive summary for this project:
      
      Project: ${project.name} (${project.status})
      Budget: $${project.estimated_value?.toLocaleString()} (${project.profit_margin_percent}% margin)
      Timeline: ${project.timeline_status}
      
      Recent Insights: ${insights.slice(0, 3).map(i => i.title).join(', ')}
      Recent Meetings: ${meetings.length} in last 30 days
      
      Provide a 3-sentence executive summary focusing on:
      1. Current status and health
      2. Key risks or opportunities
      3. Recommended next actions
    `;
  
    try {
      const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }]
      });
      
      return response.response;
    } catch (error) {
      return `Project ${project.name} is ${project.timeline_status.toLowerCase()} with ${project.profit_margin_percent}% profit margin. ${insights.length} insights requiring attention.`;
    }
  }
  
  async function uploadToR2(bucket: R2Bucket, key: string, content: string): Promise<void> {
    await bucket.put(key, content, {
      httpMetadata: { contentType: 'text/markdown' }
    });
  }
  
  async function triggerAutoRAGSync(accountId: string, apiToken: string): Promise<void> {
    try {
      await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/autorag/rags/alleato-docs/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        }
      });
    } catch (error) {
      console.warn('AutoRAG sync trigger failed:', error);
    }
  }
  
  function createEnhancedMarkdown(transcript: any, insights: any, projectId: string | null): string {
    return `---
  title: ${transcript.title}
  project_id: ${projectId || 'unknown'}
  meeting_type: ${insights.meetingType}
  date: ${transcript.date}
  duration: ${Math.round(transcript.duration / 60)} minutes
  insights_generated: ${insights.insights.length}
  action_items: ${insights.actionItems.length}
  risks_identified: ${insights.risks.length}
  ---
  
  # ${transcript.title}
  
  **Project:** ${projectId || 'Not Associated'}
  **Date:** ${new Date(transcript.date).toLocaleDateString()}
  **Type:** ${insights.meetingType}
  **AI Summary:** ${insights.summary}
  
  ## Business Intelligence
  
  ### Action Items
  ${insights.actionItems.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}
  
  ### Key Decisions
  ${insights.decisions.map((decision: string, i: number) => `${i + 1}. ${decision}`).join('\n')}
  
  ### Risk Flags
  ${insights.risks.map((risk: any) => `- **${risk.severity.toUpperCase()}:** ${risk.title}`).join('\n')}
  
  ## Meeting Transcript
  
  ${transcript.sentences?.map((sentence: any, index: number) => {
    const timestamp = sentence.start_time ? `[${Math.floor(sentence.start_time / 60)}:${String(Math.floor(sentence.start_time % 60)).padStart(2, '0')}]` : '';
    return `${timestamp} **${sentence.speaker_name}:** ${sentence.text}`;
  }).join('\n\n') || 'No transcript available.'}
  
  ---
  **Generated:** ${new Date().toISOString()}
  **Source:** Fireflies.ai Enhanced with Business Intelligence
  `;
  }