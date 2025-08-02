-- Migration to add user authentication support
-- This migration adds user_id to projects table and handles existing data

-- Add user_id column to projects table
ALTER TABLE projects ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create index for better performance on user-based queries
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- For existing projects without users, we'll assign them to a default user
-- You can either:
-- 1. Create a default user and assign all existing projects to them
-- 2. Set user_id to NULL and handle orphaned projects in your app
-- 3. Delete existing projects (if they're just test data)

-- Option 1: Assign to first user (uncomment if you want this)
-- UPDATE projects SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;

-- Option 2: Leave as NULL for now (recommended for development)
-- Projects with NULL user_id can be handled in your application logic

-- Add constraint to make user_id required for new projects (optional)
-- ALTER TABLE projects ALTER COLUMN user_id SET NOT NULL; 