import { NextRequest, NextResponse } from 'next/server';

interface DocumentMetadata {
  id: string;
  title: string;
  filename: string;
  type: 'meeting-transcript' | 'business-document' | 'report' | 'memo';
  category: string;
  summary: string;
  date: string;
  duration?: string;
  participants?: string[];
  project: string;
  department: string;
  priority: 'low' | 'medium' | 'high';
  status: 'draft' | 'review' | 'completed' | 'archived';
  tags: string[];
  fileSize: string;
  lastModified: string;
  url: string;
}

export async function GET(request: NextRequest) {
  try {
    // Check if this is a test request
    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test');
    const cursor = searchParams.get('cursor'); // Get cursor for pagination
    const fetchAll = searchParams.get('fetchAll') === 'true'; // Force fetch more files
    
    if (test === 'r2') {
      // Test R2 connection only
      const testResult = await testR2Connection();
      return NextResponse.json(testResult);
    }

    // First, try to fetch from D1 database if it exists
    const documents = await fetchDocumentsFromDatabase();
    
    if (documents.length > 0) {
      return NextResponse.json({ 
        documents,
        source: 'database',
        count: documents.length 
      });
    }

    // Fallback to fetching from R2 bucket directly
    const r2Result = await fetchDocumentsFromR2(cursor, fetchAll);
    
    return NextResponse.json({ 
      documents: r2Result.documents,
      source: 'r2',
      count: r2Result.documents.length,
      nextCursor: r2Result.nextCursor,
      hasMore: r2Result.hasMore
    });

  } catch (error) {
    console.error('Error fetching documents:', error);
    
    return NextResponse.json({ 
      error: 'Failed to fetch documents',
      details: error instanceof Error ? error.message : 'Unknown error',
      documents: [],
      count: 0
    }, { status: 500 });
  }
}

async function testR2Connection() {
  try {
    console.log('Testing R2 connection...');
    console.log('Account ID:', process.env.CLOUDFLARE_ACCOUNT_ID);
    console.log('Bucket Name:', process.env.R2_BUCKET_NAME);
    console.log('API Token present:', !!process.env.CLOUDFLARE_API_TOKEN);
    
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${process.env.R2_BUCKET_NAME}/objects`);
    url.searchParams.set('limit', '10'); // Just get first 10 for testing
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `R2 API error: ${response.status} - ${errorText}`,
        url: url.toString(),
        headers: response.headers ? Object.fromEntries(response.headers.entries()) : {}
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      message: 'R2 connection successful',
      fileCount: data.result?.length || 0,
      totalFiles: data.result_info?.count || 'unknown',
      sampleFiles: data.result?.slice(0, 5).map((f: { key: string; size: number; lastModified?: string }) => ({
        key: f.key,
        size: f.size,
        lastModified: f.lastModified
      })) || []
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'connection_error'
    };
  }
}

async function fetchDocumentsFromDatabase(): Promise<DocumentMetadata[]> {
  try {
    // Note: This would work in a Cloudflare Worker environment
    // In Next.js API routes, we'll fall back to R2 for now
    // You can implement D1 connection here if running in Workers
    console.log('D1 database connection not available in Next.js environment');
    return [];
  } catch (error) {
    console.error('Error fetching from D1 database:', error);
    return [];
  }
}

async function fetchDocumentsFromR2(startCursor?: string | null, fetchAll = false): Promise<{documents: DocumentMetadata[], nextCursor?: string, hasMore: boolean}> {
  try {
    console.log('Fetching documents from R2 bucket:', process.env.R2_BUCKET_NAME);
    
    const documents: DocumentMetadata[] = [];
    let cursor: string | undefined = startCursor || undefined;
    let hasMore = true;
    
    // Fetch all documents using pagination
    while (hasMore) {
      const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${process.env.R2_BUCKET_NAME}/objects`);
      url.searchParams.set('limit', '100'); // Use a more reasonable limit
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`R2 API error: ${response.status} - ${errorText}`);
        throw new Error(`R2 API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.result || !Array.isArray(data.result)) {
        throw new Error('Invalid R2 response format');
      }

      // Process each file in this batch
      for (const file of data.result) {
        try {
          // Only process markdown files and common document types
          if (file.key.endsWith('.md') || 
              file.key.endsWith('.pdf') || 
              file.key.endsWith('.docx') || 
              file.key.endsWith('.xlsx')) {
            
            let content = '';
            
            // For markdown files, fetch content to extract metadata
            if (file.key.endsWith('.md')) {
              try {
                const fileResponse = await fetch(
                  `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${process.env.R2_BUCKET_NAME}/objects/${encodeURIComponent(file.key)}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
                    },
                  }
                );
                
                if (fileResponse.ok) {
                  content = await fileResponse.text();
                }
              } catch (contentError) {
                console.warn(`Failed to fetch content for ${file.key}:`, contentError);
              }
            }

            const document = file.key.endsWith('.md') 
              ? parseMarkdownMetadata(file.key, content, file)
              : parseGenericMetadata(file.key, content, file);
            
            documents.push(document);
          }
        } catch (fileError) {
          console.warn(`Failed to process file ${file.key}:`, fileError);
        }
      }

      // Check if there are more results
      // Balance between getting July 2025 files and avoiding timeouts
      const maxBatches = fetchAll ? 5 : (startCursor ? 1 : 2); // fetchAll: 5 batches, first load: 2 batches, pagination: 1 batch
      const currentBatch = Math.floor(documents.length / 100) + 1;
      hasMore = !!data.result_info?.cursor && currentBatch < maxBatches;
      cursor = data.result_info?.cursor;
      
      // Debug: log the response info
      console.log('R2 Response Info:', data.result_info);
      if (cursor) {
        console.log('More documents available, but limiting to first batch for performance');
      }
      
      // Debug logging
      console.log(`Fetched ${data.result.length} files in this batch. Total so far: ${documents.length}. HasMore: ${hasMore}`);
      if (data.result_info?.cursor) {
        console.log(`Cursor available: ${data.result_info.cursor}`);
      }
      
      // Safety check to prevent infinite loops
      if (documents.length > 5000) {
        console.warn('Reached maximum document limit (5000), stopping pagination');
        break;
      }
    }

    // Sort by most recent first - using document date for chronological order
    const sortedDocuments = documents.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA; // Most recent first
    });
    
    return {
      documents: sortedDocuments,
      nextCursor: cursor,
      hasMore: !!cursor
    };
    
  } catch (error) {
    console.error('Error fetching from R2:', error);
    throw error;
  }
}

function parseMarkdownMetadata(
  filename: string, 
  content: string, 
  r2Object: { key: string; size: number; lastModified?: string; etag?: string }
): DocumentMetadata {
  // Extract frontmatter if present
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter: Record<string, string> = {};
  
  if (frontmatterMatch) {
    try {
      // Parse YAML-like frontmatter
      const yamlContent = frontmatterMatch[1];
      yamlContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          frontmatter[key.trim()] = value;
        }
      });
    } catch (error) {
      console.warn('Failed to parse frontmatter:', error);
    }
  }

  // Extract title from content
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = frontmatter.title || titleMatch?.[1] || filename.replace('.md', '');
  
  // Extract meeting details for transcripts
  const meetingIdMatch = content.match(/Meeting ID:\s*(.+)/);
  const dateMatch = content.match(/Date:\s*(.+)/);
  const durationMatch = content.match(/Duration:\s*(.+)/);
  const participantsMatch = content.match(/Participants:\s*(.+)/);
  
  // Extract participants
  const participants = participantsMatch?.[1]
    ?.split(',')
    .map(p => p.trim())
    .filter(p => p.includes('@')) || [];

  // Generate intelligent summary from transcript content
  const summary = generateIntelligentSummary(content, title);

  // Determine document type
  const type = meetingIdMatch || participants.length > 0 
    ? 'meeting-transcript' 
    : content.includes('memo') || content.includes('Memo')
    ? 'memo'
    : 'business-document';

  // Extract project and category from filename or content
  const project = frontmatter.project || extractProjectFromFilename(filename);
  const category = frontmatter.category || 
    (type === 'meeting-transcript' ? 'Meeting' : 'Documentation');

  return {
    id: r2Object.etag || Math.random().toString(36),
    title,
    filename,
    type: type as any,
    category,
    summary: summary || 'No summary available',
    date: frontmatter.date || dateMatch?.[1] || extractDateFromFilename(filename),
    duration: durationMatch?.[1],
    participants: participants.length > 0 ? participants : undefined,
    project,
    department: frontmatter.department || 'general',
    priority: frontmatter.priority || 'medium',
    status: frontmatter.status || 'completed',
    tags: frontmatter.tags?.split(',').map((t: string) => t.trim()) || 
      generateTagsFromContent(title, content),
    fileSize: formatFileSize(r2Object.size || 0),
    lastModified: r2Object.lastModified || new Date().toISOString(),
    url: `https://${process.env.R2_BUCKET_NAME}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${r2Object.key}`
  };
}

function generateIntelligentSummary(content: string, title: string): string {
  // Extract main topics and themes from the content
  const topics = extractTopicsFromContent(content, title);
  
  // Identify the type of meeting from title and content
  const meetingType = identifyMeetingType(title, content);
  
  // Extract key business information
  const businessInfo = extractBusinessInformation(content);
  
  // Generate a business-focused summary
  let summary = '';
  
  // Start with meeting type and main focus
  if (meetingType.type === 'permit') {
    summary = `Permit coordination meeting focusing on ${businessInfo.permits.join(' and ')}`;
  } else if (meetingType.type === 'schedule') {
    summary = `Schedule planning meeting covering project timelines`;
    if (businessInfo.projects.length > 0) {
      summary += ` for ${businessInfo.projects.slice(0, 2).join(' and ')}`;
    }
  } else if (meetingType.type === 'operations') {
    summary = `Weekly operations meeting reviewing project status`;
    if (businessInfo.projects.length > 0) {
      summary += ` on ${businessInfo.projects.slice(0, 3).join(', ')}`;
    }
  } else if (meetingType.type === 'design') {
    summary = `Design coordination meeting discussing ${businessInfo.designAreas.join(' and ')} requirements`;
  } else if (meetingType.type === 'vendor') {
    summary = `Vendor coordination call addressing project needs and deliverables`;
  } else {
    // General meeting
    if (topics.length > 0) {
      summary = `Project meeting covering ${topics.slice(0, 3).join(', ')}`;
    } else {
      summary = `Team coordination meeting discussing project updates`;
    }
  }
  
  // Add key business details
  const keyDetails = [];
  
  if (businessInfo.issues.length > 0) {
    keyDetails.push(`addressing ${businessInfo.issues[0]}`);
  }
  
  if (businessInfo.decisions.length > 0) {
    keyDetails.push(`decisions on ${businessInfo.decisions[0]}`);
  }
  
  if (businessInfo.nextSteps.length > 0) {
    keyDetails.push(`next steps for ${businessInfo.nextSteps[0]}`);
  }
  
  if (keyDetails.length > 0) {
    summary += `. Key topics: ${keyDetails.slice(0, 2).join(' and ')}.`;
  } else {
    summary += '.';
  }
  
  // Ensure reasonable length
  if (summary.length > 200) {
    summary = summary.substring(0, 190) + '...';
  }
  
  return summary;
}

function identifyMeetingType(title: string, content: string) {
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();
  
  if (titleLower.includes('permit') || contentLower.includes('permit approval') || contentLower.includes('permit submission')) {
    return { type: 'permit', confidence: 'high' };
  }
  
  if (titleLower.includes('schedule') || titleLower.includes('oac') || contentLower.includes('schedule review')) {
    return { type: 'schedule', confidence: 'high' };
  }
  
  if (titleLower.includes('operations') || titleLower.includes('weekly') || titleLower.includes('status')) {
    return { type: 'operations', confidence: 'medium' };
  }
  
  if (titleLower.includes('design') || contentLower.includes('design review') || contentLower.includes('drawing')) {
    return { type: 'design', confidence: 'high' };
  }
  
  if (titleLower.includes('vendor') || titleLower.includes('supplier') || contentLower.includes('vendor call')) {
    return { type: 'vendor', confidence: 'high' };
  }
  
  return { type: 'general', confidence: 'low' };
}

function extractBusinessInformation(content: string) {
  const info = {
    projects: [] as string[],
    permits: [] as string[],
    issues: [] as string[],
    decisions: [] as string[],
    nextSteps: [] as string[],
    designAreas: [] as string[]
  };
  
  const contentLower = content.toLowerCase();
  
  // Extract project names
  const projectPatterns = [
    /goodwill\s+(\w+)/gi,
    /bart\s+(\w+)/gi,
    /alleato/gi,
    /collective/gi,
    /ulta\s+beauty/gi,
    /crate\s+escapes/gi
  ];
  
  projectPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleaned = match.replace(/\s+/g, ' ').trim();
        if (!info.projects.includes(cleaned)) {
          info.projects.push(cleaned);
        }
      });
    }
  });
  
  // Extract permit types
  if (contentLower.includes('state permit')) info.permits.push('state permits');
  if (contentLower.includes('county permit')) info.permits.push('county permits');
  if (contentLower.includes('electrical permit')) info.permits.push('electrical permits');
  if (contentLower.includes('building permit')) info.permits.push('building permits');
  
  // Extract design areas
  if (contentLower.includes('electrical')) info.designAreas.push('electrical');
  if (contentLower.includes('plumbing')) info.designAreas.push('plumbing');
  if (contentLower.includes('hvac')) info.designAreas.push('HVAC');
  if (contentLower.includes('exterior')) info.designAreas.push('exterior design');
  if (contentLower.includes('interior')) info.designAreas.push('interior design');
  
  // Extract key issues/topics
  const issuePatterns = [
    /problem\s+with\s+([^.]+)/gi,
    /issue\s+with\s+([^.]+)/gi,
    /delay\s+in\s+([^.]+)/gi,
    /concern\s+about\s+([^.]+)/gi
  ];
  
  issuePatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const issue = match.replace(pattern, '$1').trim();
        if (issue.length > 5 && issue.length < 50) {
          info.issues.push(issue);
        }
      });
    }
  });
  
  // Extract decisions
  if (contentLower.includes('decided to')) info.decisions.push('project approach');
  if (contentLower.includes('approved')) info.decisions.push('approvals');
  if (contentLower.includes('agreed')) info.decisions.push('agreements');
  
  // Extract next steps
  if (contentLower.includes('next week')) info.nextSteps.push('next week tasks');
  if (contentLower.includes('follow up')) info.nextSteps.push('follow-up actions');
  if (contentLower.includes('schedule')) info.nextSteps.push('scheduling');
  
  return info;
}

function extractTopicsFromContent(content: string, title: string): string[] {
  const topics: string[] = [];
  
  // Extract from title
  const titleTopics = extractKeywordsFromTitle(title);
  topics.push(...titleTopics);
  
  // Extract from content using keyword patterns
  const topicPatterns = [
    /\b(permit|permits|permitting)\b/gi,
    /\b(schedule|scheduling|timeline)\b/gi,
    /\b(design|designs|designing)\b/gi,
    /\b(construction|building|installation)\b/gi,
    /\b(budget|cost|pricing|price)\b/gi,
    /\b(electrical|plumbing|hvac|mechanical)\b/gi,
    /\b(contractor|vendor|supplier)\b/gi,
    /\b(review|approval|inspection)\b/gi,
    /\b(coordination|planning|meeting)\b/gi,
    /\b(project|projects)\b/gi
  ];
  
  topicPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      // Add the base form of the keyword
      const keyword = matches[0].toLowerCase().replace(/s$/, ''); // Remove plural 's'
      if (!topics.includes(keyword)) {
        topics.push(keyword);
      }
    }
  });
  
  return topics.slice(0, 5); // Limit to 5 topics
}

function extractKeywordsFromTitle(title: string): string[] {
  // const keywords: string[] = [];
  
  // Clean the title and extract meaningful words
  const cleanTitle = title
    .replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, '') // Remove date prefix
    .replace(/\b(meeting|call|review|update|weekly|daily|monthly)\b/gi, '') // Remove common meeting words
    .trim();
  
  // Split into words and filter meaningful ones
  const words = cleanTitle.split(/\s+/).filter(word => 
    word.length > 2 && 
    !word.match(/^(and|the|of|for|to|in|on|at|by|with)$/i)
  );
  
  // Group related words
  const groupedWords = words.map(word => {
    const lower = word.toLowerCase();
    if (lower.includes('goodwill')) return 'Goodwill project';
    if (lower.includes('collective')) return 'Collective project';
    if (lower.includes('electrical')) return 'electrical systems';
    if (lower.includes('permit')) return 'permit coordination';
    if (lower.includes('schedule')) return 'schedule planning';
    if (lower.includes('design')) return 'design coordination';
    if (lower.includes('oac')) return 'OAC coordination';
    if (lower.includes('operations')) return 'operations planning';
    return word;
  });
  
  return [...new Set(groupedWords)].slice(0, 4); // Remove duplicates and limit
}

function parseGenericMetadata(
  filename: string, 
  content: string, 
  r2Object: { key: string; size: number; lastModified?: string; etag?: string }
): DocumentMetadata {
  const title = filename.replace(/\.[^/.]+$/, ""); // Remove extension
  const date = extractDateFromFilename(filename);
  
  // Determine document type by extension
  let type: DocumentMetadata['type'] = 'business-document';
  if (filename.includes('report') || filename.includes('Report')) {
    type = 'report';
  } else if (filename.includes('memo') || filename.includes('Memo')) {
    type = 'memo';
  }

  // Generate better summary for non-markdown files
  let summary = `${type.replace('-', ' ')} document`;
  
  // Try to extract meaningful content from the beginning
  if (content && content.length > 100) {
    const cleanContent = content
      .replace(/[^\w\s.,!?]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    if (cleanContent.length > 50) {
      summary = cleanContent.substring(0, 200) + '...';
    }
  }
  
  // Enhance based on filename patterns
  if (filename.toLowerCase().includes('handbook')) {
    summary = 'Employee handbook containing company policies, procedures, and guidelines';
  } else if (filename.toLowerCase().includes('analysis')) {
    summary = 'Analytical report with data insights and performance metrics';
  } else if (filename.toLowerCase().includes('strategy')) {
    summary = 'Strategic planning document outlining objectives and initiatives';
  }

  return {
    id: r2Object.etag || Math.random().toString(36),
    title,
    filename,
    type,
    category: type === 'report' ? 'Analytics' : 'Documentation',
    summary,
    date,
    project: extractProjectFromFilename(filename),
    department: 'general',
    priority: 'medium' as const,
    status: 'completed' as const,
    tags: generateTagsFromContent(title, content),
    fileSize: formatFileSize(r2Object.size || 0),
    lastModified: r2Object.lastModified || new Date().toISOString(),
    url: `https://${process.env.R2_BUCKET_NAME}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${r2Object.key}`
  };
}

function extractDateFromFilename(filename: string): string {
  // Look for date patterns like 2025-07-15 or 2025_07_15
  const dateMatch = filename.match(/(\d{4}[-_]\d{2}[-_]\d{2})/);
  if (dateMatch) {
    return dateMatch[1].replace(/_/g, '-');
  }
  
  // Fallback to current date
  return new Date().toISOString().split('T')[0];
}

function extractProjectFromFilename(filename: string): string {
  // Look for project patterns in filename
  const projectPatterns = [
    /goodwill/i,
    /alleato/i,
    /collective/i,
    /bloomington/i,
    /strategic/i,
    /marketing/i,
    /security/i,
    /hr/i
  ];
  
  for (const pattern of projectPatterns) {
    if (pattern.test(filename)) {
      return pattern.source.replace(/[^a-zA-Z]/g, '').toLowerCase();
    }
  }
  
  return 'general';
}

function generateTagsFromContent(title: string, content: string): string[] {
  const tags: string[] = [];
  
  // Extract tags from title
  const titleWords = title.toLowerCase().split(/\s+/);
  titleWords.forEach(word => {
    if (word.length > 3 && !['meeting', 'transcript', 'document'].includes(word)) {
      tags.push(word);
    }
  });
  
  // Add common tags based on content
  if (content.includes('meeting') || content.includes('Meeting')) {
    tags.push('meeting');
  }
  
  if (content.includes('project') || content.includes('Project')) {
    tags.push('project');
  }
  
  if (content.includes('design') || content.includes('Design')) {
    tags.push('design');
  }
  
  return [...new Set(tags)].slice(0, 5); // Remove duplicates and limit to 5
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}