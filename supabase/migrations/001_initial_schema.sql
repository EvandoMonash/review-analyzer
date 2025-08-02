-- Enable the pgcrypto extension to generate random UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Projects table
CREATE TABLE projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_reviews INTEGER DEFAULT 0,
    analyzed_reviews INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews table
CREATE TABLE reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    author_name VARCHAR(255),
    review_date DATE,
    source VARCHAR(20) NOT NULL CHECK (source IN ('csv', 'google_url')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Review analyses table
CREATE TABLE review_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    primary_category VARCHAR(20) NOT NULL CHECK (primary_category IN ('positive', 'negative', 'neutral')),
    primary_confidence DECIMAL(3,2) CHECK (primary_confidence >= 0 AND primary_confidence <= 1),
    secondary_categories TEXT[], -- Array of secondary category strings
    themes TEXT[], -- Array of identified themes
    sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
    key_phrases TEXT[], -- Array of key phrases
    summary TEXT,
    analysis_metadata JSONB, -- Store model info, processing time, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_reviews_project_id ON reviews(project_id);
CREATE INDEX idx_reviews_source ON reviews(source);
CREATE INDEX idx_review_analyses_review_id ON review_analyses(review_id);
CREATE INDEX idx_review_analyses_primary_category ON review_analyses(primary_category);

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to update updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_review_analyses_updated_at BEFORE UPDATE ON review_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 