-- schema.sql
-- Database schema for enhanced metadata storage and analytics

-- Main metadata table for complex queries
CREATE TABLE IF NOT EXISTS document_metadata (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('meeting-transcript', 'business-document', 'project-plan', 'report', 'memo')),
  category TEXT NOT NULL,
  subcategory TEXT,
  
  -- Organizational data
  project TEXT NOT NULL,
  department TEXT NOT NULL,
  client TEXT,
  
  -- Temporal data
  date TEXT NOT NULL,
  created_date TEXT NOT NULL,
  last_modified TEXT NOT NULL,
  quarter TEXT,
  fiscal_year TEXT,
  
  -- Meeting-specific
  meeting_id TEXT,
  duration REAL, -- in minutes
  participants TEXT, -- comma-separated
  attendee_emails TEXT, -- comma-separated
  meeting_type TEXT,
  
  -- Content metadata
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT CHECK (status IN ('draft', 'in-progress', 'completed', 'archived', 'cancelled')),
  confidentiality TEXT CHECK (confidentiality IN ('public', 'internal', 'confidential', 'restricted')),
  
  -- Content analysis
  word_count INTEGER,
  language TEXT DEFAULT 'en',
  version TEXT DEFAULT '1.0',
  checksum TEXT,
  
  -- Searchable fields
  tags TEXT, -- comma-separated
  keywords TEXT, -- comma-separated
  topics TEXT, -- comma-separated
  action_items TEXT, -- JSON array
  decisions TEXT, -- JSON array
  
  -- Unique constraint
  UNIQUE(filename)
);

-- Interactions table for analytics
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  response_length INTEGER,
  document_count INTEGER,
  timestamp TEXT NOT NULL,
  context TEXT, -- JSON
  user_id TEXT,
  session_id TEXT
);

-- Analytics aggregation table
CREATE TABLE IF NOT EXISTS analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  documents_processed INTEGER DEFAULT 0,
  queries_processed INTEGER DEFAULT 0,
  avg_word_count REAL,
  avg_response_time REAL,
  unique_users INTEGER DEFAULT 0,
  timestamp TEXT NOT NULL,
  
  UNIQUE(date)
);

-- Document relationships table (for linking related documents)
CREATE TABLE IF NOT EXISTS document_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_document_id TEXT NOT NULL,
  target_document_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('follow-up', 'related', 'supersedes', 'references')),
  confidence REAL DEFAULT 1.0,
  created_date TEXT NOT NULL,
  
  FOREIGN KEY (source_document_id) REFERENCES document_metadata(id),
  FOREIGN KEY (target_document_id) REFERENCES document_metadata(id),
  UNIQUE(source_document_id, target_document_id, relationship_type)
);

-- Search queries log for improving search results
CREATE TABLE IF NOT EXISTS search_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  results_count INTEGER,
  clicked_documents TEXT, -- JSON array of document IDs
  user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5),
  timestamp TEXT NOT NULL
);

-- Views for common queries

-- Recent documents view
CREATE VIEW IF NOT EXISTS recent_documents AS
SELECT 
  id, title, project, category, type, date, priority,
  participants, word_count
FROM document_metadata 
ORDER BY date DESC;

-- Project summary view
CREATE VIEW IF NOT EXISTS project_summary AS
SELECT 
  project,
  COUNT(*) as document_count,
  COUNT(DISTINCT type) as document_types,
  AVG(word_count) as avg_word_count,
  MAX(date) as latest_activity,
  COUNT(CASE WHEN type = 'meeting-transcript' THEN 1 END) as meeting_count
FROM document_metadata 
GROUP BY project;

-- Monthly activity view
CREATE VIEW IF NOT EXISTS monthly_activity AS
SELECT 
  strftime('%Y-%m', date) as month,
  COUNT(*) as documents_created,
  COUNT(DISTINCT project) as active_projects,
  AVG(word_count) as avg_document_length
FROM document_metadata 
GROUP BY strftime('%Y-%m', date)
ORDER BY month DESC;

-- High priority items view
CREATE VIEW IF NOT EXISTS high_priority_items AS
SELECT 
  id, title, project, category, priority, status, date,
  json_extract(action_items, '$') as actions
FROM document_metadata 
WHERE priority IN ('high', 'critical')
  AND status NOT IN ('completed', 'cancelled')
ORDER BY 
  CASE priority 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
  END, date DESC;

-- Triggers for maintaining data consistency

-- Update last_modified when metadata changes
CREATE TRIGGER IF NOT EXISTS update_last_modified
AFTER UPDATE ON document_metadata
BEGIN
  UPDATE document_metadata 
  SET last_modified = datetime('now')
  WHERE id = NEW.id;
END;

-- Auto-calculate quarter and fiscal year
CREATE TRIGGER IF NOT EXISTS calculate_temporal_fields
AFTER INSERT ON document_metadata
BEGIN
  UPDATE document_metadata 
  SET 
    quarter = 'Q' || ((CAST(strftime('%m', date) AS INTEGER) - 1) / 3 + 1),
    fiscal_year = 'FY' || 
      CASE 
        WHEN CAST(strftime('%m', date) AS INTEGER) >= 7 
        THEN CAST(strftime('%Y', date) AS INTEGER) + 1
        ELSE CAST(strftime('%Y', date) AS INTEGER)
      END
  WHERE id = NEW.id;
END;

-- Sample data for testing
INSERT OR IGNORE INTO document_metadata (
  id, title, filename, type, category, project, department, date, created_date, last_modified,
  priority, status, word_count, participants, tags, keywords
) VALUES 
('TEST001', 'Goodwill Bloomington Morning Meeting', '2025-07-15-goodwill-bloomington-morning-meeting.md', 
 'meeting-transcript', 'operations', 'goodwill', 'operations', '2025-07-15', datetime('now'), datetime('now'),
 'medium', 'completed', 1250, 'Alice Johnson,Bob Smith,Carol Davis', 'meeting,standup,goodwill', 'progress,updates,blockers'),
 
('TEST002', 'Q3 Design Review', '2025-07-10-q3-design-review.md',
 'meeting-transcript', 'design', 'alleato', 'design', '2025-07-10', datetime('now'), datetime('now'),
 'high', 'completed', 2100, 'Design Team,Product Manager', 'design,review,q3', 'wireframes,feedback,iterations');

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_metadata_type ON document_metadata(type);
CREATE INDEX IF NOT EXISTS idx_metadata_project ON document_metadata(project);
CREATE INDEX IF NOT EXISTS idx_metadata_category ON document_metadata(category);
CREATE INDEX IF NOT EXISTS idx_metadata_date ON document_metadata(date);
CREATE INDEX IF NOT EXISTS idx_metadata_priority ON document_metadata(priority);
CREATE INDEX IF NOT EXISTS idx_metadata_status ON document_metadata(status);
CREATE INDEX IF NOT EXISTS idx_metadata_department ON document_metadata(department);
CREATE INDEX IF NOT EXISTS idx_metadata_search ON document_metadata(project, category, type, date);
CREATE INDEX IF NOT EXISTS idx_metadata_text_search ON document_metadata(title, keywords, tags);

CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_analytics ON interactions(timestamp, document_count);

CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);

CREATE INDEX IF NOT EXISTS idx_relationships_source ON document_relationships(source_document_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON document_relationships(target_document_id);

CREATE INDEX IF NOT EXISTS idx_queries_timestamp ON search_queries(timestamp);
CREATE INDEX IF NOT EXISTS idx_queries_query ON search_queries(query);

-- Full-text search setup (if SQLite supports FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(
  id, title, content, keywords, tags, project, category,
  content='document_metadata',
  content_rowid='rowid'
);

-- Trigger to keep FTS index updated
CREATE TRIGGER IF NOT EXISTS document_fts_insert AFTER INSERT ON document_metadata BEGIN
  INSERT INTO document_fts(id, title, keywords, tags, project, category)
  VALUES (new.id, new.title, new.keywords, new.tags, new.project, new.category);
END;

CREATE TRIGGER IF NOT EXISTS document_fts_delete AFTER DELETE ON document_metadata BEGIN
  DELETE FROM document_fts WHERE id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS document_fts_update AFTER UPDATE ON document_metadata BEGIN
  DELETE FROM document_fts WHERE id = old.id;
  INSERT INTO document_fts(id, title, keywords, tags, project, category)
  VALUES (new.id, new.title, new.keywords, new.tags, new.project, new.category);
END;