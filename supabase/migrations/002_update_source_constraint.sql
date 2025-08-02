-- Drop the existing check constraint
ALTER TABLE reviews DROP CONSTRAINT reviews_source_check;

-- Add new check constraint with additional source types
ALTER TABLE reviews ADD CONSTRAINT reviews_source_check 
CHECK (source IN ('csv', 'google_url', 'serpapi', 'google_api', 'web_scraping', 'outscraper_api')); 