-- Add missing DNS tracking fields to subdomains table
-- This script adds fields needed for DNS management and background sync

-- Add DNS creation tracking field
ALTER TABLE subdomains ADD COLUMN IF NOT EXISTS dns_created BOOLEAN DEFAULT false;

-- Add DNS error tracking field  
ALTER TABLE subdomains ADD COLUMN IF NOT EXISTS dns_error TEXT;

-- Add retry count for failed operations
ALTER TABLE subdomains ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Update existing records to set dns_created = true for active records
UPDATE subdomains 
SET dns_created = true 
WHERE status = 'active' AND dns_created IS NULL;

-- Update status values to include 'failed' status
ALTER TABLE subdomains DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE subdomains ADD CONSTRAINT valid_status 
CHECK (status IN ('active', 'inactive', 'pending', 'failed'));

-- Add index for better performance on DNS tracking queries
CREATE INDEX IF NOT EXISTS idx_subdomains_dns_propagated ON subdomains(dns_propagated);
CREATE INDEX IF NOT EXISTS idx_subdomains_dns_created ON subdomains(dns_created);
CREATE INDEX IF NOT EXISTS idx_subdomains_retry_count ON subdomains(retry_count);

-- Add comments for new fields
COMMENT ON COLUMN subdomains.dns_created IS 'Whether DNS record has been created with the provider';
COMMENT ON COLUMN subdomains.dns_error IS 'Last DNS error message if any';
COMMENT ON COLUMN subdomains.retry_count IS 'Number of retry attempts for failed operations';

-- Verification: Show table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_name = 'subdomains' 
    AND table_schema = 'public'
ORDER BY 
    ordinal_position;
