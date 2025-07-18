// Enhanced Document Metadata Extraction for RAG System
// Designed for Cloudflare Workers with comprehensive metadata extraction

export interface DocumentMetadata {
  // Core identifiers
  id: string;
  title: string;
  filename: string;
  
  // Content classification
  type: 'meeting-transcript' | 'business-document' | 'project-plan' | 'report' | 'memo';
  category: string;
  subcategory?: string;
  
  // Project and organizational data
  project: string;
  department: string;
  client?: string;
  
  // Temporal information
  date: string;
  createdDate: string;
  lastModified: string;
  quarter: string;
  fiscal_year: string;
  
  // Meeting-specific metadata
  meetingId?: string;
  duration?: number; // in minutes
  participants?: string[];
  attendeeEmails?: string[];
  meetingType?: 'standup' | 'review' | 'planning' | 'client' | 'internal' | 'training';
  
  // Content insights
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'in-progress' | 'completed' | 'archived' | 'cancelled';
  confidentiality: 'public' | 'internal' | 'confidential' | 'restricted';
  
  // Searchable tags and keywords
  tags: string[];
  keywords: string[];
  topics: string[];
  actionItems?: string[];
  decisions?: string[];
  
  // Technical metadata
  wordCount: number;
  language: string;
  version: string;
  checksum: string;
  
  // Search enhancement
  searchableText: string;
  vectorEmbedding?: number[];
}

export class DocumentMetadataExtractor {
  private readonly patterns = {
    // Meeting ID patterns
    meetingId: /Meeting ID:\s*([A-Z0-9]{26})/i,
    
    // Date patterns (multiple formats)
    dateInContent: /Date:\s*(\d{4}-\d{2}-\d{2})/,
    dateInFilename: /(\d{4}-\d{2}-\d{2})/,
    dateVariations: /(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})|(\w+\s+\d{1,2},?\s+\d{4})/g,
    
    // Duration patterns
    duration: /Duration:\s*([\d.]+)\s*minutes?/i,
    
    // Participants pattern (handles multiple formats)
    participants: /Participants?:\s*(.+?)(?=\n\n|\n#|$)/s,
    participantEmails: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    
    // Project/Client extraction (enhanced)
    projectFromFilename: /\d{4}-\d{2}-\d{2}\s*-\s*(.+?)(?:\.md|$)/i,
    projectKeywords: /project\s+([a-zA-Z0-9_-]+)|([a-zA-Z0-9_-]+)\s+project/gi,
    
    // Action items and decisions
    actionItems: /(?:action item|todo|follow.?up|next step)s?:?\s*(.+?)(?=\n\n|\n[A-Z]|\n\*|\n-|$)/gis,
    decisions: /(?:decision|agreed|decided|concluded)s?:?\s*(.+?)(?=\n\n|\n[A-Z]|\n\*|\n-|$)/gis,
    
    // Meeting types
    meetingTypes: {
      'standup': /standup|daily|scrum|sync|morning.?meeting/i,
      'review': /review|retrospective|feedback|evaluation|assessment/i,
      'planning': /planning|roadmap|strategy|timeline|milestone|sprint/i,
      'client': /client|customer|stakeholder|external|prospect/i,
      'training': /training|onboarding|education|workshop|tutorial/i
    },
    
    // Category classification
    categories: {
      'design': /design|architect|visual|layout|ui|ux|mockup|wireframe|prototype/i,
      'development': /development|engineering|code|programming|implementation|technical/i,
      'marketing': /marketing|promotion|campaign|advertising|branding|social.?media/i,
      'sales': /sales|revenue|deal|proposal|contract|negotiation|pricing/i,
      'finance': /finance|budget|cost|expense|revenue|financial|accounting/i,
      'hr': /hr|human.?resources|hiring|recruitment|employee|personnel/i,
      'operations': /operations|process|workflow|efficiency|logistics/i,
      'legal': /legal|compliance|contract|terms|policy|regulation/i,
      'support': /support|help|assistance|troubleshooting|customer.?service/i
    },
    
    // Priority indicators
    priority: {
      'critical': /urgent|critical|emergency|asap|high.?priority|immediately/i,
      'high': /important|priority|soon|deadline|time.?sensitive/i,
      'medium': /moderate|standard|normal|regular/i,
      'low': /low.?priority|when.?possible|eventually|nice.?to.?have/i
    },
    
    // Status indicators
    status: {
      'completed': /completed?|finished|done|closed|resolved/i,
      'in-progress': /in.?progress|ongoing|working|active|current/i,
      'draft': /draft|preliminary|initial|rough|work.?in.?progress/i,
      'cancelled': /cancelled?|abandoned|postponed|delayed/i
    }
  };

  /**
   * Extract comprehensive metadata from document content
   */
  async extractMetadata(content: string, filename: string): Promise<DocumentMetadata> {
    const now = new Date();
    const contentHash = await this.generateChecksum(content);
    
    // Basic extraction
    const baseMetadata = this.extractBasicMetadata(content, filename);
    
    // Enhanced extraction
    const enhancedMetadata = {
      ...baseMetadata,
      
      // Temporal data
      createdDate: now.toISOString(),
      lastModified: now.toISOString(),
      quarter: this.getQuarter(new Date(baseMetadata.date)),
      fiscal_year: this.getFiscalYear(new Date(baseMetadata.date)),
      
      // Content analysis
      wordCount: this.getWordCount(content),
      language: 'en', // Could be enhanced with language detection
      version: '1.0',
      checksum: contentHash,
      
      // Smart categorization
      category: this.classifyCategory(content, filename),
      subcategory: this.classifySubcategory(content, filename),
      priority: this.determinePriority(content),
      status: this.determineStatus(content),
      confidentiality: this.determineConfidentiality(content, filename),
      
      // Meeting-specific enhancements
      meetingType: this.classifyMeetingType(content, filename),
      actionItems: this.extractActionItems(content),
      decisions: this.extractDecisions(content),
      
      // Enhanced searchability
      keywords: this.extractKeywords(content),
      topics: this.extractTopics(content),
      searchableText: this.createSearchableText(content, baseMetadata)
    };

    return enhancedMetadata;
  }

  /**
   * Extract basic metadata using existing patterns
   */
  private extractBasicMetadata(content: string, filename: string): Partial<DocumentMetadata> {
    const meetingIdMatch = content.match(this.patterns.meetingId);
    const dateMatch = content.match(this.patterns.dateInContent) || filename.match(this.patterns.dateInFilename);
    const durationMatch = content.match(this.patterns.duration);
    const participantsMatch = content.match(this.patterns.participants);
    const projectMatch = filename.match(this.patterns.projectFromFilename);
    
    // Extract participant data
    const participantEmails = participantsMatch 
      ? Array.from(participantsMatch[1].matchAll(this.patterns.participantEmails)).map(m => m[0])
      : [];
    
    const participants = participantEmails.map(email => {
      const name = email.split('@')[0].replace(/[._]/g, ' ');
      return this.toTitleCase(name);
    });

    // Extract title from content or filename
    const titleMatch = content.match(/^#\s*(.+?)$/m);
    const title = titleMatch ? titleMatch[1] : (projectMatch ? projectMatch[1] : filename.replace(/\.md$/, ''));

    return {
      id: meetingIdMatch?.[1] || this.generateId(),
      title: title.trim(),
      filename,
      type: meetingIdMatch ? 'meeting-transcript' : 'business-document',
      project: this.extractProject(content, filename),
      department: this.extractDepartment(content, filename),
      client: this.extractClient(content, filename),
      date: dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0],
      meetingId: meetingIdMatch?.[1],
      duration: durationMatch ? parseFloat(durationMatch[1]) : undefined,
      participants,
      attendeeEmails: participantEmails,
      tags: this.generateTags(content, filename)
    };
  }

  /**
   * Advanced project extraction with multiple heuristics
   */
  private extractProject(content: string, filename: string): string {
    // Try filename first
    const filenameMatch = filename.match(this.patterns.projectFromFilename);
    if (filenameMatch) {
      const project = filenameMatch[1].toLowerCase()
        .replace(/\s+(meeting|call|discussion|sync|standup).*$/i, '')
        .trim();
      if (project) return this.toTitleCase(project);
    }

    // Try content patterns
    const contentMatches = Array.from(content.matchAll(this.patterns.projectKeywords));
    if (contentMatches.length > 0) {
      return this.toTitleCase(contentMatches[0][1] || contentMatches[0][2]);
    }

    // Common project names in your domain
    const commonProjects = ['goodwill', 'bloomington', 'alleato', 'port collective'];
    for (const project of commonProjects) {
      if (content.toLowerCase().includes(project) || filename.toLowerCase().includes(project)) {
        return this.toTitleCase(project);
      }
    }

    return 'general';
  }

  /**
   * Extract department/team information
   */
  private extractDepartment(content: string, filename: string): string {
    const departments = {
      'operations': /operations?|ops|operational/i,
      'design': /design|creative|visual|ui\/ux/i,
      'development': /dev|development|engineering|tech/i,
      'marketing': /marketing|promotion|social/i,
      'sales': /sales|business.?development|bd/i,
      'executive': /executive|leadership|c-level|ceo|cto|cfo/i,
      'finance': /finance|accounting|budget/i,
      'hr': /hr|human.?resources|people/i
    };

    for (const [dept, pattern] of Object.entries(departments)) {
      if (pattern.test(content) || pattern.test(filename)) {
        return dept;
      }
    }

    return 'general';
  }

  /**
   * Extract client/external party information
   */
  private extractClient(content: string, filename: string): string | undefined {
    // Look for email domains that aren't internal
    const emails = Array.from(content.matchAll(this.patterns.participantEmails));
    const externalDomains = emails
      .map(match => match[0].split('@')[1])
      .filter(domain => !['goodwillindy.org', 'alleatogroup.com', 'bloomington.in.gov'].includes(domain));

    if (externalDomains.length > 0) {
      return externalDomains[0].split('.')[0];
    }

    // Look for client keywords
    const clientPatterns = /client[:\s]+([a-zA-Z0-9\s]+)/i;
    const clientMatch = content.match(clientPatterns);
    if (clientMatch) {
      return this.toTitleCase(clientMatch[1].trim());
    }

    return undefined;
  }

  /**
   * Classify document category using content analysis
   */
  private classifyCategory(content: string, filename: string): string {
    let maxScore = 0;
    let bestCategory = 'general';

    for (const [category, pattern] of Object.entries(this.patterns.categories)) {
      const matches = (content.match(pattern) || []).length + (filename.match(pattern) || []).length;
      if (matches > maxScore) {
        maxScore = matches;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  /**
   * Classify subcategory for more granular organization
   */
  private classifySubcategory(content: string, filename: string): string | undefined {
    const subcategories = {
      'wireframing': /wireframe|mockup|prototype|sketch/i,
      'code-review': /code.?review|pull.?request|pr.?review/i,
      'sprint-planning': /sprint|iteration|backlog|story.?points/i,
      'client-onboarding': /onboarding|introduction|kickoff/i,
      'status-update': /status|update|progress|report/i
    };

    for (const [subcat, pattern] of Object.entries(subcategories)) {
      if (pattern.test(content) || pattern.test(filename)) {
        return subcat;
      }
    }

    return undefined;
  }

  /**
   * Classify meeting type based on content and filename
   */
  private classifyMeetingType(content: string, filename: string): string | undefined {
    for (const [type, pattern] of Object.entries(this.patterns.meetingTypes)) {
      if (pattern.test(content) || pattern.test(filename)) {
        return type;
      }
    }
    return undefined;
  }

  /**
   * Determine document priority based on content cues
   */
  private determinePriority(content: string): 'low' | 'medium' | 'high' | 'critical' {
    for (const [priority, pattern] of Object.entries(this.patterns.priority)) {
      if (pattern.test(content)) {
        return priority as any;
      }
    }
    return 'medium';
  }

  /**
   * Determine document status
   */
  private determineStatus(content: string): 'draft' | 'in-progress' | 'completed' | 'archived' | 'cancelled' {
    for (const [status, pattern] of Object.entries(this.patterns.status)) {
      if (pattern.test(content)) {
        return status as any;
      }
    }
    return 'in-progress';
  }

  /**
   * Determine confidentiality level
   */
  private determineConfidentiality(content: string, filename: string): 'public' | 'internal' | 'confidential' | 'restricted' {
    if (/confidential|secret|restricted|private/i.test(content) || /confidential|secret|restricted|private/i.test(filename)) {
      return 'confidential';
    }
    if (/internal|employee.?only/i.test(content) || /internal/i.test(filename)) {
      return 'internal';
    }
    return 'internal'; // Default for business documents
  }

  /**
   * Extract action items from content
   */
  private extractActionItems(content: string): string[] {
    const matches = Array.from(content.matchAll(this.patterns.actionItems));
    return matches.map(match => match[1].trim().replace(/\n/g, ' ')).filter(item => item.length > 5);
  }

  /**
   * Extract decisions from content
   */
  private extractDecisions(content: string): string[] {
    const matches = Array.from(content.matchAll(this.patterns.decisions));
    return matches.map(match => match[1].trim().replace(/\n/g, ' ')).filter(decision => decision.length > 5);
  }

  /**
   * Extract keywords using frequency analysis
   */
  private extractKeywords(content: string): string[] {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !this.isStopWord(word));

    const frequency: Record<string, number> = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15)
      .map(([word]) => word);
  }

  /**
   * Extract topics using named entity recognition patterns
   */
  private extractTopics(content: string): string[] {
    const topicPatterns = [
      /(?:about|regarding|topic|discuss|cover)\s+([a-zA-Z\s]{3,20})/gi,
      /(?:focus|concentrate|center)\s+on\s+([a-zA-Z\s]{3,20})/gi,
      /([A-Z][a-zA-Z\s]{2,15})\s+(?:implementation|development|design|strategy)/gi
    ];

    const topics = new Set<string>();
    topicPatterns.forEach(pattern => {
      const matches = Array.from(content.matchAll(pattern));
      matches.forEach(match => {
        const topic = match[1].trim().toLowerCase();
        if (topic.length > 2 && topic.length < 25) {
          topics.add(this.toTitleCase(topic));
        }
      });
    });

    return Array.from(topics).slice(0, 10);
  }

  /**
   * Generate searchable text combining all relevant fields
   */
  private createSearchableText(content: string, metadata: Partial<DocumentMetadata>): string {
    const searchFields = [
      metadata.title,
      metadata.project,
      metadata.department,
      metadata.client,
      content.replace(/[#*\-]/g, '').trim()
    ].filter(Boolean);

    return searchFields.join(' ').toLowerCase();
  }

  /**
   * Generate smart tags based on content analysis
   */
  private generateTags(content: string, filename: string): string[] {
    const tags = new Set<string>();
    
    // Add type-based tags
    if (content.includes('Meeting ID:')) tags.add('meeting');
    if (filename.includes('standup')) tags.add('standup');
    if (filename.includes('review')) tags.add('review');
    
    // Add project-based tags
    const project = this.extractProject(content, filename);
    if (project !== 'general') tags.add(project.toLowerCase());
    
    // Add date-based tags
    const dateMatch = filename.match(this.patterns.dateInFilename);
    if (dateMatch) {
      const date = new Date(dateMatch[1]);
      tags.add(date.getFullYear().toString());
      tags.add(`q${this.getQuarter(date)}-${date.getFullYear()}`);
    }
    
    return Array.from(tags);
  }

  // Utility methods
  private generateId(): string {
    return 'DOC_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private async generateChecksum(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }

  private getWordCount(content: string): number {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }

  private getQuarter(date: Date): string {
    return `Q${Math.floor(date.getMonth() / 3) + 1}`;
  }

  private getFiscalYear(date: Date): string {
    // Assuming fiscal year starts in July
    const year = date.getMonth() >= 6 ? date.getFullYear() + 1 : date.getFullYear();
    return `FY${year}`;
  }

  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, txt => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'we', 'you', 'they', 'it', 'is', 'are', 'was', 'were',
      'will', 'would', 'could', 'should', 'have', 'has', 'had', 'been', 'being'
    ]);
    return stopWords.has(word);
  }
}

// Usage example for Cloudflare Worker integration
export async function processDocumentWithMetadata(
  content: string, 
  filename: string,
  r2Bucket: R2Bucket
): Promise<DocumentMetadata> {
  const extractor = new DocumentMetadataExtractor();
  const metadata = await extractor.extractMetadata(content, filename);
  
  // Store metadata separately for fast querying
  const metadataKey = `metadata/${metadata.id}.json`;
  await r2Bucket.put(metadataKey, JSON.stringify(metadata, null, 2), {
    httpMetadata: {
      contentType: 'application/json'
    },
    customMetadata: {
      documentId: metadata.id,
      type: metadata.type,
      project: metadata.project,
      category: metadata.category,
      date: metadata.date
    }
  });
  
  return metadata;
}

// Search interface for querying documents by metadata
export interface DocumentSearchQuery {
  project?: string;
  category?: string;
  type?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  participants?: string[];
  priority?: string;
  status?: string;
  tags?: string[];
  keywords?: string[];
}

export async function searchDocumentsByMetadata(
  query: DocumentSearchQuery,
  r2Bucket: R2Bucket
): Promise<DocumentMetadata[]> {
  // List all metadata files
  const metadataList = await r2Bucket.list({ prefix: 'metadata/' });
  const results: DocumentMetadata[] = [];
  
  for (const object of metadataList.objects) {
    const metadataObj = await r2Bucket.get(object.key);
    if (!metadataObj) continue;
    
    const metadata: DocumentMetadata = JSON.parse(await metadataObj.text());
    
    // Apply filters
    if (query.project && metadata.project !== query.project) continue;
    if (query.category && metadata.category !== query.category) continue;
    if (query.type && metadata.type !== query.type) continue;
    if (query.priority && metadata.priority !== query.priority) continue;
    if (query.status && metadata.status !== query.status) continue;
    
    // Date range filter
    if (query.dateRange) {
      const docDate = new Date(metadata.date);
      const startDate = new Date(query.dateRange.start);
      const endDate = new Date(query.dateRange.end);
      if (docDate < startDate || docDate > endDate) continue;
    }
    
    // Tags filter
    if (query.tags && query.tags.length > 0) {
      const hasMatchingTag = query.tags.some(tag => metadata.tags.includes(tag));
      if (!hasMatchingTag) continue;
    }
    
    // Keywords filter
    if (query.keywords && query.keywords.length > 0) {
      const hasMatchingKeyword = query.keywords.some(keyword => 
        metadata.searchableText.includes(keyword.toLowerCase())
      );
      if (!hasMatchingKeyword) continue;
    }
    
    results.push(metadata);
  }
  
  // Sort by date (most recent first)
  return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}