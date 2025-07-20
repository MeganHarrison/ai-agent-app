// High-Performance Hybrid RAG Query System
// Combines D1 structured queries with AutoRAG semantic search for optimal performance

interface Env {
    ALLEATO_DB: D1Database;
    AI: Ai;
  }
  
  interface ProjectInsight {
    projectId: string;
    projectTitle: string;
    clientName: string;
    projectManager: string;
    status: string;
    priority: string;
    
    // Meeting insights
    recentMeetings: Array<{
      title: string;
      date: string;
      summary: string;
      actionItems: string[];
      decisions: string[];
      participants: string[];
    }>;
    
    // Task insights
    activeTasks: Array<{
      title: string;
      assignedTo: string;
      priority: string;
      dueDate: string;
      status: string;
    }>;
    
    // Financial insights
    budget: number;
    estimatedValue: number;
    currentExpenses: number;
    profitMargin: number;
    
    // AI-generated insights
    keyRisks: string[];
    recommendations: string[];
    progressSummary: string;
    upcomingMilestones: string[];
    
    // Document summary
    totalDocuments: number;
    recentDocuments: string[];
  }
  
  export default {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
  
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
  
      try {
        switch (url.pathname) {
          case '/projects':
            return handleProjectsList(env, corsHeaders);
          
          case '/project-insight':
            const projectId = url.searchParams.get('projectId');
            if (!projectId) {
              return Response.json({ error: 'projectId required' }, { status: 400, headers: corsHeaders });
            }
            return handleProjectInsight(projectId, env, corsHeaders);
          
          case '/search':
            const query = url.searchParams.get('q');
            if (!query) {
              return Response.json({ error: 'query parameter required' }, { status: 400, headers: corsHeaders });
            }
            return handleHybridSearch(query, env, corsHeaders);
          
          case '/leadership-dashboard':
            return handleLeadershipDashboard(env, corsHeaders);
          
          default:
            return Response.json({ error: 'Endpoint not found' }, { status: 404, headers: corsHeaders });
        }
      } catch (error) {
        console.error('API Error:', error);
        return Response.json({
          error: 'Internal server error',
          details: error.message
        }, { status: 500, headers: corsHeaders });
      }
    }
  };
  
  async function handleProjectsList(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    const stmt = env.ALLEATO_DB.prepare(`
      SELECT 
        p.id,
        p.title,
        p.status,
        p.priority,
        p.estimated_value,
        p.budget,
        p.estimated_completion,
        c.company_name as client_name,
        e.first_name || ' ' || e.last_name as project_manager,
        p.document_count,
        p.last_meeting_date,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'completed') as open_tasks_count,
        (SELECT COUNT(*) FROM meetings m WHERE m.project_id = p.id AND m.date >= date('now', '-30 days')) as recent_meetings_count
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN employees e ON p.project_manager_id = e.id
      WHERE p.status IN ('planning', 'active')
      ORDER BY 
        CASE p.priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        p.estimated_completion ASC
    `);
    
    const { results } = await stmt.all();
    
    return Response.json({
      projects: results,
      count: results.length,
      timestamp: new Date().toISOString()
    }, { headers: corsHeaders });
  }
  
  async function handleProjectInsight(projectId: string, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    console.log(`🔍 Generating insights for project: ${projectId}`);
    
    // Get project basic info
    const projectStmt = env.ALLEATO_DB.prepare(`
      SELECT 
        p.*,
        c.company_name as client_name,
        e.first_name || ' ' || e.last_name as project_manager
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN employees e ON p.project_manager_id = e.id
      WHERE p.id = ?
    `);
    
    const project = await projectStmt.bind(projectId).first();
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders });
    }
    
    // Get recent meetings with rich context
    const meetingsStmt = env.ALLEATO_DB.prepare(`
      SELECT 
        title, 
        date, 
        summary, 
        action_items, 
        decisions, 
        participants,
        priority,
        follow_up_required
      FROM meetings 
      WHERE project_id = ? 
      ORDER BY date DESC 
      LIMIT 5
    `);
    
    const { results: meetings } = await meetingsStmt.bind(projectId).all();
    
    // Get active tasks
    const tasksStmt = env.ALLEATO_DB.prepare(`
      SELECT 
        t.title, 
        t.status, 
        t.priority, 
        t.due_date,
        e.first_name || ' ' || e.last_name as assigned_to,
        t.estimated_hours,
        t.actual_hours
      FROM tasks t
      LEFT JOIN employees e ON t.assigned_to = e.id
      WHERE t.project_id = ? AND t.status != 'completed'
      ORDER BY 
        CASE t.priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        t.due_date ASC
    `);
    
    const { results: tasks } = await tasksStmt.bind(projectId).all();
    
    // Get recent expenses
    const expensesStmt = env.ALLEATO_DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses 
      WHERE project_id = ? AND status = 'approved'
    `);
    
    const expenses = await expensesStmt.bind(projectId).first();
    
    // Get document count and recent documents
    const docsStmt = env.ALLEATO_DB.prepare(`
      SELECT 
        COUNT(*) as total_documents,
        GROUP_CONCAT(title) as recent_titles
      FROM (
        SELECT title 
        FROM document_metadata 
        WHERE project_id = ? 
        ORDER BY indexed_at DESC 
        LIMIT 5
      )
    `);
    
    const documents = await docsStmt.bind(projectId).first();
    
    // Generate AI insights
    const aiInsights = await generateProjectInsights(project, meetings, tasks, env.AI);
    
    const insight: ProjectInsight = {
      projectId: project.id,
      projectTitle: project.title,
      clientName: project.client_name || 'Unknown',
      projectManager: project.project_manager || 'Unassigned',
      status: project.status,
      priority: project.priority,
      
      recentMeetings: meetings.map(m => ({
        title: m.title,
        date: m.date,
        summary: m.summary || 'No summary available',
        actionItems: m.action_items ? JSON.parse(m.action_items) : [],
        decisions: m.decisions ? JSON.parse(m.decisions) : [],
        participants: m.participants ? m.participants.split(', ') : []
      })),
      
      activeTasks: tasks.map(t => ({
        title: t.title,
        assignedTo: t.assigned_to || 'Unassigned',
        priority: t.priority,
        dueDate: t.due_date,
        status: t.status
      })),
      
      budget: project.budget || 0,
      estimatedValue: project.estimated_value || 0,
      currentExpenses: expenses?.total_expenses || 0,
      profitMargin: project.profit_margin || 0,
      
      keyRisks: aiInsights.keyRisks,
      recommendations: aiInsights.recommendations,
      progressSummary: aiInsights.progressSummary,
      upcomingMilestones: aiInsights.upcomingMilestones,
      
      totalDocuments: documents?.total_documents || 0,
      recentDocuments: documents?.recent_titles ? documents.recent_titles.split(',') : []
    };
    
    return Response.json({
      insight,
      generatedAt: new Date().toISOString()
    }, { headers: corsHeaders });
  }
  
  async function generateProjectInsights(project: any, meetings: any[], tasks: any[], ai: Ai): Promise<{
    keyRisks: string[];
    recommendations: string[];
    progressSummary: string;
    upcomingMilestones: string[];
  }> {
    const prompt = `Analyze this project data and provide executive insights:
  
  PROJECT: ${project.title}
  STATUS: ${project.status}
  BUDGET: $${project.budget || 0}
  ESTIMATED VALUE: $${project.estimated_value || 0}
  
  RECENT MEETINGS (${meetings.length}):
  ${meetings.map(m => `- ${m.title} (${m.date}): ${m.summary}`).join('\n')}
  
  ACTIVE TASKS (${tasks.length}):
  ${tasks.map(t => `- ${t.title} - ${t.priority} priority, due ${t.due_date}, assigned to ${t.assigned_to}`).join('\n')}
  
  Provide a JSON response with:
  1. keyRisks (array of 2-3 critical risks to monitor)
  2. recommendations (array of 2-3 specific actions for leadership)
  3. progressSummary (1-2 sentences on current status and momentum)
  4. upcomingMilestones (array of 2-3 key upcoming deliverables/deadlines)
  
  Focus on actionable insights for project leadership. Respond with only valid JSON.`;
  
    try {
      const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }]
      });
      
      const insights = JSON.parse(response.response);
      return {
        keyRisks: insights.keyRisks || ['Data analysis pending'],
        recommendations: insights.recommendations || ['Generate updated project report'],
        progressSummary: insights.progressSummary || 'Project status analysis in progress',
        upcomingMilestones: insights.upcomingMilestones || ['Review project timeline']
      };
    } catch (error) {
      console.warn('AI insights generation failed:', error);
      return {
        keyRisks: ['Data analysis pending'],
        recommendations: ['Generate updated project report'],
        progressSummary: 'Project status analysis in progress',
        upcomingMilestones: ['Review project timeline']
      };
    }
  }
  
  async function handleHybridSearch(query: string, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    console.log(`🔍 Hybrid search for: "${query}"`);
    
    // First, search D1 for structured data
    const structuredResults = await searchStructuredData(query, env.ALLEATO_DB);
    
    // Then, search documents via AutoRAG (you'll need to implement this based on your AutoRAG setup)
    // const semanticResults = await searchAutoRAG(query, env);
    
    return Response.json({
      query,
      structuredResults,
      // semanticResults,
      searchType: 'hybrid',
      timestamp: new Date().toISOString()
    }, { headers: corsHeaders });
  }
  
  async function searchStructuredData(query: string, db: D1Database) {
    const searchTerm = `%${query.toLowerCase()}%`;
    
    // Search projects
    const projectsStmt = db.prepare(`
      SELECT 'project' as type, id, title, status, priority
      FROM projects 
      WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?
      LIMIT 5
    `);
    
    // Search meetings
    const meetingsStmt = db.prepare(`
      SELECT 'meeting' as type, id, title, date, summary
      FROM meetings 
      WHERE LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(searchable_text) LIKE ?
      ORDER BY date DESC
      LIMIT 5
    `);
    
    // Search tasks
    const tasksStmt = db.prepare(`
      SELECT 'task' as type, id, title, status, priority
      FROM tasks 
      WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?
      LIMIT 5
    `);
    
    const [projects, meetings, tasks] = await Promise.all([
      projectsStmt.bind(searchTerm, searchTerm).all(),
      meetingsStmt.bind(searchTerm, searchTerm, searchTerm).all(),
      tasksStmt.bind(searchTerm, searchTerm).all()
    ]);
    
    return {
      projects: projects.results,
      meetings: meetings.results,
      tasks: tasks.results,
      totalResults: projects.results.length + meetings.results.length + tasks.results.length
    };
  }
  
  async function handleLeadershipDashboard(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    console.log('📊 Generating leadership dashboard...');
    
    // Get key metrics
    const metricsStmt = env.ALLEATO_DB.prepare(`
      SELECT 
        COUNT(CASE WHEN status IN ('planning', 'active') THEN 1 END) as active_projects,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
        COALESCE(SUM(CASE WHEN status IN ('planning', 'active') THEN estimated_value END), 0) as active_project_value,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_projects,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_projects
      FROM projects
    `);
    
    const metrics = await metricsStmt.first();
    
    // Get recent activity (last 7 days)
    const activityStmt = env.ALLEATO_DB.prepare(`
      SELECT 
        'meeting' as activity_type,
        title,
        date as activity_date,
        project_id
      FROM meetings 
      WHERE date >= date('now', '-7 days')
      
      UNION ALL
      
      SELECT 
        'task_completed' as activity_type,
        title,
        completed_date as activity_date,
        project_id
      FROM tasks 
      WHERE completed_date >= date('now', '-7 days')
      
      ORDER BY activity_date DESC
      LIMIT 10
    `);
    
    const { results: recentActivity } = await activityStmt.all();
    
    // Get projects needing attention
    const attentionStmt = env.ALLEATO_DB.prepare(`
      SELECT 
        p.id,
        p.title,
        p.status,
        p.priority,
        c.company_name as client_name,
        p.estimated_completion,
        COALESCE(open_tasks.count, 0) as open_tasks_count,
        COALESCE(overdue_tasks.count, 0) as overdue_tasks_count
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as count 
        FROM tasks 
        WHERE status != 'completed' 
        GROUP BY project_id
      ) open_tasks ON p.id = open_tasks.project_id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as count 
        FROM tasks 
        WHERE status != 'completed' AND due_date < date('now')
        GROUP BY project_id
      ) overdue_tasks ON p.id = overdue_tasks.project_id
      WHERE p.status IN ('planning', 'active')
      AND (
        p.priority IN ('critical', 'high')
        OR overdue_tasks.count > 0
        OR p.estimated_completion <= date('now', '+30 days')
      )
      ORDER BY 
        CASE p.priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          ELSE 3 
        END,
        overdue_tasks.count DESC,
        p.estimated_completion ASC
      LIMIT 8
    `);
    
    const { results: projectsNeedingAttention } = await attentionStmt.all();
    
    return Response.json({
      metrics,
      recentActivity,
      projectsNeedingAttention,
      dashboardGenerated: new Date().toISOString()
    }, { headers: corsHeaders });
  }