-- Enhanced Database Schema for Integrated Project Management & RAG
-- Optimized for lightning-fast queries and comprehensive project insights

-- =======================
-- CORE BUSINESS ENTITIES
-- =======================

-- Enhanced Projects Table (your command center)
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    client_id TEXT,
    project_manager_id TEXT,
    superintendent_id TEXT,
    estimator_id TEXT,
    
    -- Financial tracking
    estimated_value REAL,
    actual_cost REAL,
    budget REAL,
    profit_margin REAL,
    
    -- Timeline management
    start_date DATE,
    estimated_completion DATE,
    actual_completion DATE,
    
    -- Project classification
    status TEXT CHECK (status IN ('planning', 'active', 'on-hold', 'completed', 'cancelled')),
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    project_type TEXT,
    project_address TEXT,
    
    -- RAG integration
    autorag_project_tag TEXT,
    document_count INTEGER DEFAULT 0,
    last_meeting_date DATE,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (project_manager_id) REFERENCES employees(id),
    FOREIGN KEY (superintendent_id) REFERENCES employees(id),
    FOREIGN KEY (estimator_id) REFERENCES employees(id)
);

-- Enhanced Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    client_type TEXT CHECK (client_type IN ('commercial', 'residential', 'government', 'non-profit')),
    credit_rating TEXT,
    total_project_value REAL DEFAULT 0,
    active_projects_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('project-manager', 'superintendent', 'estimator', 'foreman', 'admin', 'executive')),
    department TEXT,
    hire_date DATE,
    active_projects_count INTEGER DEFAULT 0,
    hourly_rate REAL,
    salary REAL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Meetings Table (integrated with RAG)
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project_id TEXT,
    client_id TEXT,
    meeting_type TEXT CHECK (meeting_type IN ('kickoff', 'progress', 'review', 'client', 'internal', 'standup')),
    
    -- Meeting details
    date TEXT NOT NULL,
    duration INTEGER, -- minutes
    location TEXT,
    meeting_link TEXT,
    
    -- Content metadata
    participants TEXT, -- JSON array of employee/contact IDs
    attendee_emails TEXT,
    summary TEXT,
    action_items TEXT, -- JSON array
    decisions TEXT, -- JSON array
    follow_up_required BOOLEAN DEFAULT FALSE,
    
    -- RAG integration
    fireflies_id TEXT UNIQUE,
    autorag_doc_ids TEXT, -- JSON array of document IDs
    r2_document_key TEXT,
    
    -- Classification
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    department TEXT,
    
    -- Search optimization
    keywords TEXT,
    tags TEXT,
    searchable_text TEXT,
    word_count INTEGER,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Enhanced Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    project_id TEXT,
    assigned_to TEXT, -- employee_id
    created_by TEXT, -- employee_id
    
    -- Task management
    status TEXT CHECK (status IN ('todo', 'in-progress', 'review', 'completed', 'blocked')),
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    category TEXT,
    
    -- Timeline
    due_date DATE,
    estimated_hours REAL,
    actual_hours REAL,
    start_date DATE,
    completed_date DATE,
    
    -- Dependencies
    depends_on TEXT, -- JSON array of task IDs
    blocks TEXT, -- JSON array of task IDs
    
    -- Context
    related_meeting_id TEXT,
    source_document TEXT, -- R2 key or document reference
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (assigned_to) REFERENCES employees(id),
    FOREIGN KEY (created_by) REFERENCES employees(id),
    FOREIGN KEY (related_meeting_id) REFERENCES meetings(id)
);

-- Enhanced Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    title TEXT,
    client_id TEXT,
    contact_type TEXT CHECK (contact_type IN ('primary', 'billing', 'technical', 'executive')),
    is_decision_maker BOOLEAN DEFAULT FALSE,
    preferred_communication TEXT CHECK (preferred_communication IN ('email', 'phone', 'text')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Sales/Estimates Table
CREATE TABLE IF NOT EXISTS estimates (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    client_id TEXT,
    estimator_id TEXT,
    
    -- Estimate details
    estimate_number TEXT UNIQUE,
    description TEXT,
    total_amount REAL NOT NULL,
    labor_cost REAL,
    material_cost REAL,
    equipment_cost REAL,
    markup_percentage REAL,
    
    -- Status tracking
    status TEXT CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired')),
    sent_date DATE,
    expiration_date DATE,
    approved_date DATE,
    
    -- Documents
    estimate_document_path TEXT, -- R2 key
    supporting_documents TEXT, -- JSON array of R2 keys
    
    -- Notes
    notes TEXT,
    rejection_reason TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (estimator_id) REFERENCES employees(id)
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    employee_id TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    
    -- Expense details
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    vendor TEXT,
    receipt_number TEXT,
    
    -- Approval workflow
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
    submitted_by TEXT, -- employee_id
    approved_by TEXT, -- employee_id
    approved_date DATE,
    
    -- Documentation
    receipt_document_path TEXT, -- R2 key
    expense_date DATE NOT NULL,
    
    -- Billing
    billable BOOLEAN DEFAULT FALSE,
    client_id TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (submitted_by) REFERENCES employees(id),
    FOREIGN KEY (approved_by) REFERENCES employees(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Subcontractors Table
CREATE TABLE IF NOT EXISTS subcontractors (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    specialty TEXT NOT NULL,
    license_number TEXT,
    insurance_expiry DATE,
    
    -- Performance tracking
    rating REAL CHECK (rating >= 1 AND rating <= 5),
    total_projects INTEGER DEFAULT 0,
    on_time_completion_rate REAL,
    
    -- Financial
    preferred_payment_terms TEXT,
    tax_id TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_preferred BOOLEAN DEFAULT FALSE,
    
    -- Documentation
    contract_template_path TEXT, -- R2 key
    insurance_document_path TEXT, -- R2 key
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Project-Subcontractor Assignment Table
CREATE TABLE IF NOT EXISTS project_subcontractors (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    subcontractor_id TEXT NOT NULL,
    work_description TEXT,
    contract_amount REAL,
    start_date DATE,
    completion_date DATE,
    status TEXT CHECK (status IN ('proposed', 'contracted', 'active', 'completed', 'terminated')),
    performance_rating REAL CHECK (performance_rating >= 1 AND performance_rating <= 5),
    notes TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (subcontractor_id) REFERENCES subcontractors(id),
    UNIQUE(project_id, subcontractor_id)
);

-- =======================
-- RAG & ANALYTICS TABLES
-- =======================

-- Document Metadata Table (enhanced for RAG)
CREATE TABLE IF NOT EXISTS document_metadata (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('meeting-transcript', 'contract', 'estimate', 'report', 'photo', 'drawing', 'email')),
    
    -- Content classification
    project_id TEXT,
    client_id TEXT,
    category TEXT,
    subcategory TEXT,
    
    -- RAG optimization
    r2_key TEXT NOT NULL,
    vector_embedding_id TEXT, -- Vectorize index ID
    content_hash TEXT,
    word_count INTEGER,
    searchable_text TEXT,
    
    -- Extracted insights
    summary TEXT,
    keywords TEXT, -- comma-separated
    tags TEXT, -- comma-separated
    action_items TEXT, -- JSON array
    decisions TEXT, -- JSON array
    mentioned_people TEXT, -- JSON array
    mentioned_companies TEXT, -- JSON array
    
    -- Metadata
    file_size INTEGER,
    mime_type TEXT,
    created_date DATE,
    modified_date DATE,
    indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Project Insights Table (AI-generated summaries)
CREATE TABLE IF NOT EXISTS project_insights (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    insight_type TEXT CHECK (insight_type IN ('weekly-summary', 'risk-analysis', 'progress-report', 'budget-alert')),
    
    -- Generated content
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    key_points TEXT, -- JSON array
    action_items TEXT, -- JSON array
    risks TEXT, -- JSON array
    recommendations TEXT, -- JSON array
    
    -- Data sources
    source_documents TEXT, -- JSON array of document IDs
    source_meetings TEXT, -- JSON array of meeting IDs
    data_range_start DATE,
    data_range_end DATE,
    
    -- Metadata
    confidence_score REAL,
    generated_by TEXT DEFAULT 'AI',
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Analytics Tables
CREATE TABLE IF NOT EXISTS sync_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_date DATE NOT NULL,
    sync_type TEXT NOT NULL,
    documents_processed INTEGER,
    successful_syncs INTEGER,
    failed_syncs INTEGER,
    processing_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Query Performance Analytics
CREATE TABLE IF NOT EXISTS query_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_type TEXT NOT NULL,
    execution_time_ms INTEGER,
    result_count INTEGER,
    user_id TEXT,
    query_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =======================
-- VIEWS FOR RAPID INSIGHTS
-- =======================

-- Active Projects Dashboard View
CREATE VIEW IF NOT EXISTS active_projects_dashboard AS
SELECT 
    p.id,
    p.title,
    p.status,
    p.priority,
    c.company_name as client_name,
    emp.first_name || ' ' || emp.last_name as project_manager,
    p.estimated_value,
    p.budget,
    p.estimated_completion,
    (SELECT COUNT(*) FROM meetings m WHERE m.project_id = p.id) as meeting_count,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'completed') as open_tasks,
    (SELECT COUNT(*) FROM document_metadata dm WHERE dm.project_id = p.id) as document_count
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN employees emp ON p.project_manager_id = emp.id
WHERE p.status IN ('planning', 'active');

-- Recent Activity View
CREATE VIEW IF NOT EXISTS recent_activity AS
SELECT 
    'meeting' as activity_type,
    m.title as activity_title,
    m.project_id,
    p.title as project_title,
    m.date as activity_date,
    m.summary as details
FROM meetings m
LEFT JOIN projects p ON m.project_id = p.id
WHERE m.date >= date('now', '-30 days')

UNION ALL

SELECT 
    'task' as activity_type,
    t.title as activity_title,
    t.project_id,
    p.title as project_title,
    t.updated_at as activity_date,
    t.description as details
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
WHERE t.updated_at >= datetime('now', '-30 days')

ORDER BY activity_date DESC;

-- Client Performance View
CREATE VIEW IF NOT EXISTS client_performance AS
SELECT 
    c.id,
    c.company_name,
    COUNT(p.id) as total_projects,
    SUM(p.estimated_value) as total_value,
    AVG(JULIANDAY(p.actual_completion) - JULIANDAY(p.start_date)) as avg_project_duration,
    COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_projects,
    COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_projects
FROM clients c
LEFT JOIN projects p ON c.id = p.client_id
GROUP BY c.id, c.company_name;

-- =======================
-- INDEXES FOR PERFORMANCE
-- =======================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_pm ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, estimated_completion);

-- Meetings indexes
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
CREATE INDEX IF NOT EXISTS idx_meetings_fireflies ON meetings(fireflies_id);
CREATE INDEX IF NOT EXISTS idx_meetings_search ON meetings(searchable_text);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

-- Document metadata indexes
CREATE INDEX IF NOT EXISTS idx_docs_project ON document_metadata(project_id);
CREATE INDEX IF NOT EXISTS idx_docs_type ON document_metadata(document_type);
CREATE INDEX IF NOT EXISTS idx_docs_r2_key ON document_metadata(r2_key);
CREATE INDEX IF NOT EXISTS idx_docs_search ON document_metadata(searchable_text);

-- =======================
-- TRIGGERS FOR DATA CONSISTENCY
-- =======================

-- Update project document count when documents are added/removed
CREATE TRIGGER IF NOT EXISTS update_project_document_count
AFTER INSERT ON document_metadata
FOR EACH ROW
WHEN NEW.project_id IS NOT NULL
BEGIN
    UPDATE projects 
    SET document_count = (
        SELECT COUNT(*) 
        FROM document_metadata 
        WHERE project_id = NEW.project_id
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.project_id;
END;

-- Update client project count and value when projects are added
CREATE TRIGGER IF NOT EXISTS update_client_stats
AFTER INSERT ON projects
FOR EACH ROW
WHEN NEW.client_id IS NOT NULL
BEGIN
    UPDATE clients 
    SET active_projects_count = (
        SELECT COUNT(*) 
        FROM projects 
        WHERE client_id = NEW.client_id AND status IN ('planning', 'active')
    ),
    total_project_value = (
        SELECT COALESCE(SUM(estimated_value), 0)
        FROM projects 
        WHERE client_id = NEW.client_id
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.client_id;
END;

-- Update last meeting date on projects
CREATE TRIGGER IF NOT EXISTS update_project_last_meeting
AFTER INSERT ON meetings
FOR EACH ROW
WHEN NEW.project_id IS NOT NULL
BEGIN
    UPDATE projects 
    SET last_meeting_date = NEW.date,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.project_id 
    AND (last_meeting_date IS NULL OR NEW.date > last_meeting_date);
END;