-- Fixed subdomains table for bigint domain IDs
-- Run this INSTEAD of the original subdomains_table.sql

-- First, let's check if the subdomains table already exists and drop it if it does
DROP TABLE IF EXISTS subdomains CASCADE;

-- Create subdomains table with bigint foreign key
CREATE TABLE subdomains (
    id BIGSERIAL PRIMARY KEY,
    domain_id BIGINT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    subdomain_name VARCHAR(63) NOT NULL, -- Max 63 chars per DNS label
    record_type VARCHAR(10) NOT NULL DEFAULT 'A',
    target_value VARCHAR(255) NOT NULL,
    ttl INTEGER NOT NULL DEFAULT 3600, -- Time to live in seconds
    priority INTEGER, -- For MX records
    port INTEGER, -- For SRV records
    weight INTEGER, -- For SRV records
    status VARCHAR(20) DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    namecheap_record_id VARCHAR(100), -- For tracking Namecheap DNS record ID
    dns_propagated BOOLEAN DEFAULT false,
    last_checked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_subdomain_per_domain UNIQUE(domain_id, subdomain_name),
    CONSTRAINT valid_record_type CHECK (record_type IN ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS')),
    CONSTRAINT valid_ttl CHECK (ttl >= 60 AND ttl <= 86400), -- 1 minute to 24 hours
    CONSTRAINT valid_subdomain_name CHECK (
        subdomain_name ~ '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$' AND
        subdomain_name NOT LIKE '-%' AND 
        subdomain_name NOT LIKE '%-'
    ),
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'pending', 'error'))
);

-- Create indexes for better performance
CREATE INDEX idx_subdomains_domain_id ON subdomains(domain_id);
CREATE INDEX idx_subdomains_subdomain_name ON subdomains(subdomain_name);
CREATE INDEX idx_subdomains_record_type ON subdomains(record_type);
CREATE INDEX idx_subdomains_status ON subdomains(status);
CREATE INDEX idx_subdomains_is_active ON subdomains(is_active);
CREATE INDEX idx_subdomains_created_at ON subdomains(created_at);

-- Create trigger for automatic updated_at timestamp
-- Note: This assumes the update_updated_at_column() function exists from your main schema
CREATE TRIGGER update_subdomains_updated_at BEFORE UPDATE ON subdomains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some helpful functions

-- Function to get full subdomain name
CREATE OR REPLACE FUNCTION get_full_subdomain_name(subdomain_row subdomains)
RETURNS VARCHAR AS $$
DECLARE
    domain_name VARCHAR;
BEGIN
    SELECT full_domain INTO domain_name 
    FROM domains 
    WHERE id = subdomain_row.domain_id;
    
    RETURN subdomain_row.subdomain_name || '.' || domain_name;
END;
$$ LANGUAGE plpgsql;

-- Function to validate IP address for A records
CREATE OR REPLACE FUNCTION is_valid_ipv4(ip_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN ip_address ~ '^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$';
END;
$$ LANGUAGE plpgsql;

-- Function to validate IPv6 address for AAAA records
CREATE OR REPLACE FUNCTION is_valid_ipv6(ip_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic IPv6 validation - can be enhanced
    RETURN ip_address ~ '^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$|^::$';
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup inactive subdomains (optional)
CREATE OR REPLACE FUNCTION cleanup_inactive_subdomains()
RETURNS void AS $$
BEGIN
    UPDATE subdomains 
    SET is_active = false 
    WHERE status = 'error' 
    AND updated_at < NOW() - INTERVAL '7 days';
END;
$$ language 'plpgsql';

-- Add comments to table and columns
COMMENT ON TABLE subdomains IS 'Stores subdomain DNS records for user domains';
COMMENT ON COLUMN subdomains.subdomain_name IS 'The subdomain prefix (e.g., "www" for www.example.com)';
COMMENT ON COLUMN subdomains.record_type IS 'DNS record type: A, AAAA, CNAME, MX, TXT, SRV, NS';
COMMENT ON COLUMN subdomains.target_value IS 'The target IP address, domain name, or text content';
COMMENT ON COLUMN subdomains.ttl IS 'Time to live in seconds (60-86400)';
COMMENT ON COLUMN subdomains.priority IS 'Priority for MX and SRV records';
COMMENT ON COLUMN subdomains.namecheap_record_id IS 'External DNS provider record ID for syncing';

-- Verification query to check the table was created correctly
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
