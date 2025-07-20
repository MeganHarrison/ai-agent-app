-- Create the meetings table for document metadata
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    duration REAL,
    participants TEXT,
    fireflies_id TEXT,
    summary TEXT,
    project TEXT,
    category TEXT,
    priority TEXT,
    status TEXT,
    meeting_type TEXT,
    action_items TEXT,
    decisions TEXT,
    keywords TEXT,
    tags TEXT,
    department TEXT,
    client TEXT,
    word_count INTEGER,
    searchable_text TEXT,
    created_at TEXT NOT NULL
);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project);
CREATE INDEX IF NOT EXISTS idx_meetings_searchable ON meetings(searchable_text);

-- Create sync analytics table
CREATE TABLE IF NOT EXISTS sync_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_date TEXT NOT NULL,
    documents_processed INTEGER NOT NULL,
    successful_syncs INTEGER NOT NULL,
    failed_syncs INTEGER NOT NULL,
    sync_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);