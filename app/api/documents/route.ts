// Replace the parseMarkdownMetadata function in app/api/documents/route.ts

function parseMarkdownMetadata(
  filename: string, 
  content: string, 
  r2Object: any
): DocumentMetadata {
  // Extract frontmatter if present
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let frontmatter: any = {};
  
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
    url: `https://r2.${process.env.CLOUDFLARE_ACCOUNT_ID}.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${r2Object.key}`
  };
}

// Add this new function to app/api/documents/route.ts
function generateIntelligentSummary(content: string, title: string): string {
  // Try to find the transcript section
  const transcriptSection = content.match(/## Transcript\s*\n([\s\S]*?)(?=\n---|\n##|\n$|$)/);
  
  if (transcriptSection) {
    const transcriptText = transcriptSection[1];
    
    // Extract meaningful dialogue, skipping timestamps and speaker labels
    const meaningfulLines = transcriptText
      .split('\n')
      .map(line => {
        // Remove timestamp patterns like [10:30] or **Speaker:**
        return line
          .replace(/^\[\d+:\d+\]\s*/, '')
          .replace(/^\*\*[^:]+:\*\*\s*/, '')
          .trim();
      })
      .filter(line => {
        // Keep lines that are actual content (not just metadata)
        return line.length > 30 && 
               !line.match(/^(Meeting ID|Date|Duration|Participants):/i) &&
               !line.includes('View Transcript') &&
               !line.startsWith('http') &&
               line.includes(' ') &&
               line.split(' ').length > 4; // At least 4 words
      })
      .slice(0, 4); // Take first 4 meaningful lines
    
    if (meaningfulLines.length > 0) {
      let summary = meaningfulLines.join(' ').substring(0, 280);
      
      // Try to end at a complete sentence
      const lastPeriod = summary.lastIndexOf('.');
      const lastQuestion = summary.lastIndexOf('?');
      const lastExclamation = summary.lastIndexOf('!');
      const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
      
      if (lastSentenceEnd > 200) {
        summary = summary.substring(0, lastSentenceEnd + 1);
      } else {
        summary += '...';
      }
      
      return summary;
    }
  }
  
  // Fallback to extracting from main content sections
  const sections = content.split(/^##?\s+/m);
  for (const section of sections) {
    if (section.length > 100 && 
        !section.includes('Meeting ID') && 
        !section.includes('Participants') &&
        !section.includes('---')) {
      
      const cleanSection = section
        .replace(/\*\*([^*]+):\*\*/g, '') // Remove speaker names
        .replace(/\[(.*?)\]/g, '') // Remove links
        .replace(/\n+/g, ' ') // Normalize whitespace
        .trim();
      
      if (cleanSection.length > 50) {
        return cleanSection.substring(0, 280) + '...';
      }
    }
  }
  
  // Final fallback based on title
  const cleanTitle = title.toLowerCase().replace(/meeting/i, '').trim();
  return `Meeting transcript discussing ${cleanTitle || 'team collaboration and project updates'}`;
}

// Also add this helper function to improve generic document summaries
function parseGenericMetadata(
  filename: string, 
  content: string, 
  r2Object: any
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
    url: `https://r2.${process.env.CLOUDFLARE_ACCOUNT_ID}.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${r2Object.key}`
  };
}