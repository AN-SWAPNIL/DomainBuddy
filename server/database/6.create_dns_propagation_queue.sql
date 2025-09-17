-- Create table for DNS propagation background monitoring
-- This table tracks DNS records that need long-term propagation checking

CREATE TABLE IF NOT EXISTS dns_propagation_queue (
  id BIGSERIAL PRIMARY KEY,
  domain VARCHAR(255) NOT NULL,
  subdomain VARCHAR(255) NOT NULL,
  record_type VARCHAR(10) NOT NULL CHECK (record_type IN ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS')),
  expected_value TEXT NOT NULL,
  subdomain_id BIGINT REFERENCES subdomains(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_check_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ DEFAULT NOW(),
  check_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 100, -- Allow up to 100 checks over ~10 days
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'expired')),
  last_error TEXT,
  
  -- Ensure uniqueness per subdomain record
  UNIQUE(domain, subdomain, record_type, expected_value)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_dns_propagation_queue_status_next_check 
ON dns_propagation_queue(status, next_check_at) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dns_propagation_queue_subdomain_id 
ON dns_propagation_queue(subdomain_id);

CREATE INDEX IF NOT EXISTS idx_dns_propagation_queue_created_at 
ON dns_propagation_queue(created_at);

-- Partial index for active pending records
CREATE INDEX IF NOT EXISTS idx_dns_propagation_queue_active_pending 
ON dns_propagation_queue(next_check_at, check_count) 
WHERE status = 'pending' AND check_count < 100;

COMMENT ON TABLE dns_propagation_queue IS 'Queue for long-term DNS propagation monitoring';
COMMENT ON COLUMN dns_propagation_queue.check_count IS 'Number of propagation checks performed';
COMMENT ON COLUMN dns_propagation_queue.max_retries IS 'Maximum number of checks before giving up';
COMMENT ON COLUMN dns_propagation_queue.next_check_at IS 'When to perform the next propagation check';
COMMENT ON COLUMN dns_propagation_queue.expected_value IS 'The DNS value we expect to see when propagated';
