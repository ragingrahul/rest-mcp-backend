-- =====================================================
-- MCP Marketplace Database Schema
-- =====================================================
-- This schema creates the endpoints table with proper
-- Row Level Security (RLS) for multi-tenant isolation
-- =====================================================

-- Create endpoints table
CREATE TABLE IF NOT EXISTS public.endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
    description TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
    headers JSONB,
    timeout INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique endpoint names per user
    CONSTRAINT unique_user_endpoint_name UNIQUE (user_id, name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_endpoints_user_id ON public.endpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_endpoints_created_at ON public.endpoints(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.endpoints ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own endpoints" ON public.endpoints;
DROP POLICY IF EXISTS "Users can insert their own endpoints" ON public.endpoints;
DROP POLICY IF EXISTS "Users can update their own endpoints" ON public.endpoints;
DROP POLICY IF EXISTS "Users can delete their own endpoints" ON public.endpoints;

-- RLS Policies: Users can only access their own endpoints
CREATE POLICY "Users can view their own endpoints"
    ON public.endpoints
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own endpoints"
    ON public.endpoints
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own endpoints"
    ON public.endpoints
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own endpoints"
    ON public.endpoints
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at on row update
DROP TRIGGER IF EXISTS update_endpoints_updated_at ON public.endpoints;
CREATE TRIGGER update_endpoints_updated_at
    BEFORE UPDATE ON public.endpoints
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Optional: Create a view for endpoint statistics per user
CREATE OR REPLACE VIEW public.user_endpoint_stats AS
SELECT 
    user_id,
    COUNT(*) as total_endpoints,
    COUNT(CASE WHEN method = 'GET' THEN 1 END) as get_endpoints,
    COUNT(CASE WHEN method = 'POST' THEN 1 END) as post_endpoints,
    COUNT(CASE WHEN method = 'PUT' THEN 1 END) as put_endpoints,
    COUNT(CASE WHEN method = 'DELETE' THEN 1 END) as delete_endpoints,
    COUNT(CASE WHEN method = 'PATCH' THEN 1 END) as patch_endpoints,
    MAX(created_at) as last_endpoint_created
FROM public.endpoints
GROUP BY user_id;

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.endpoints TO authenticated;
GRANT SELECT ON public.user_endpoint_stats TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.endpoints IS 'Stores REST API endpoints that are converted to MCP tools';
COMMENT ON COLUMN public.endpoints.user_id IS 'The developer/user who created this endpoint';
COMMENT ON COLUMN public.endpoints.name IS 'Unique endpoint name (unique per user, becomes MCP tool name)';
COMMENT ON COLUMN public.endpoints.parameters IS 'JSON array of parameter definitions';
COMMENT ON COLUMN public.endpoints.headers IS 'Optional HTTP headers to include in requests';
COMMENT ON COLUMN public.endpoints.timeout IS 'Request timeout in seconds';

