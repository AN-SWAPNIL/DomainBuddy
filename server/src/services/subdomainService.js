const namecheapService = require('./namecheapService');

/**
 * Service for managing subdomains with DNS providers
 * This service acts as an abstraction layer for DNS operations
 */
class SubdomainService {
  constructor() {
    this.dnsProvider = namecheapService; // Use Namecheap as default DNS provider
  }

  /**
   * Create a DNS record for a subdomain
   * @param {string} domain - The main domain (e.g., 'example.com')
   * @param {Object} subdomainData - Subdomain configuration
   * @returns {Promise<Object>} DNS provider response
   */
  async createDNSRecord(domain, subdomainData) {
    try {
      const { subdomain_name, record_type, target_value, ttl, priority } = subdomainData;

      // Format the hostname for DNS record
      const hostname = subdomain_name; // Just the subdomain part
      
      // Prepare DNS record data based on type
      const dnsRecordData = {
        hostname,
        recordtype: record_type,
        address: target_value,
        ttl: ttl || 3600,
      };

      // Add priority for MX records
      if (record_type === 'MX' && priority) {
        dnsRecordData.mxpref = priority;
      }

      console.log(`🌐 Creating DNS record for ${hostname}.${domain}:`, dnsRecordData);

      // Note: This would call the actual Namecheap API
      // For now, we'll simulate the response
      const response = {
        success: true,
        recordId: `dns_${Date.now()}`, // Simulated record ID
        message: `DNS record created for ${hostname}.${domain}`,
        data: dnsRecordData
      };

      console.log(`✅ DNS record created successfully:`, response);
      return response;

    } catch (error) {
      console.error(`❌ Error creating DNS record:`, error);
      throw new Error(`Failed to create DNS record: ${error.message}`);
    }
  }

  /**
   * Update a DNS record for a subdomain
   * @param {string} domain - The main domain
   * @param {string} recordId - DNS provider record ID
   * @param {Object} updateData - Updated subdomain configuration
   * @returns {Promise<Object>} DNS provider response
   */
  async updateDNSRecord(domain, recordId, updateData) {
    try {
      console.log(`🔄 Updating DNS record ${recordId} for domain ${domain}:`, updateData);

      // Note: This would call the actual Namecheap API
      // For now, we'll simulate the response
      const response = {
        success: true,
        recordId,
        message: `DNS record updated for ${domain}`,
        data: updateData
      };

      console.log(`✅ DNS record updated successfully:`, response);
      return response;

    } catch (error) {
      console.error(`❌ Error updating DNS record:`, error);
      throw new Error(`Failed to update DNS record: ${error.message}`);
    }
  }

  /**
   * Delete a DNS record for a subdomain
   * @param {string} domain - The main domain
   * @param {string} recordId - DNS provider record ID
   * @returns {Promise<Object>} DNS provider response
   */
  async deleteDNSRecord(domain, recordId) {
    try {
      console.log(`🗑️ Deleting DNS record ${recordId} for domain ${domain}`);

      // Note: This would call the actual Namecheap API
      // For now, we'll simulate the response
      const response = {
        success: true,
        recordId,
        message: `DNS record deleted for ${domain}`
      };

      console.log(`✅ DNS record deleted successfully:`, response);
      return response;

    } catch (error) {
      console.error(`❌ Error deleting DNS record:`, error);
      throw new Error(`Failed to delete DNS record: ${error.message}`);
    }
  }

  /**
   * Get all DNS records for a domain
   * @param {string} domain - The main domain
   * @returns {Promise<Array>} List of DNS records
   */
  async getDNSRecords(domain) {
    try {
      console.log(`📋 Fetching DNS records for domain ${domain}`);

      // Note: This would call the actual Namecheap API
      // For now, we'll simulate the response
      const records = [
        {
          recordId: 'dns_123',
          hostname: 'www',
          recordType: 'A',
          address: '192.168.1.1',
          ttl: 3600
        },
        {
          recordId: 'dns_124',
          hostname: 'mail',
          recordType: 'MX',
          address: 'mail.example.com',
          ttl: 3600,
          priority: 10
        }
      ];

      console.log(`✅ Found ${records.length} DNS records for ${domain}`);
      return records;

    } catch (error) {
      console.error(`❌ Error fetching DNS records:`, error);
      throw new Error(`Failed to fetch DNS records: ${error.message}`);
    }
  }

  /**
   * Validate subdomain name format
   * @param {string} subdomainName - The subdomain to validate
   * @returns {boolean} Whether the subdomain name is valid
   */
  validateSubdomainName(subdomainName) {
    // DNS label validation rules:
    // - 1-63 characters
    // - Can contain letters, numbers, and hyphens
    // - Cannot start or end with hyphen
    // - Cannot be empty
    const subdomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    return subdomainRegex.test(subdomainName);
  }

  /**
   * Validate target value based on record type
   * @param {string} recordType - DNS record type
   * @param {string} targetValue - The target value to validate
   * @returns {Object} Validation result
   */
  validateTargetValue(recordType, targetValue) {
    const result = { valid: false, message: '' };

    switch (recordType) {
      case 'A':
        const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        result.valid = ipv4Regex.test(targetValue);
        result.message = result.valid ? 'Valid IPv4 address' : 'Invalid IPv4 address format';
        break;

      case 'AAAA':
        // Basic IPv6 validation
        result.valid = targetValue.includes(':') && targetValue.length >= 3;
        result.message = result.valid ? 'Valid IPv6 address' : 'Invalid IPv6 address format';
        break;

      case 'CNAME':
        result.valid = targetValue.includes('.') && !targetValue.endsWith('.');
        result.message = result.valid ? 'Valid domain name' : 'Invalid domain name format';
        break;

      case 'MX':
        result.valid = targetValue.includes('.') && !targetValue.endsWith('.');
        result.message = result.valid ? 'Valid mail server domain' : 'Invalid mail server domain format';
        break;

      case 'TXT':
        result.valid = targetValue.trim().length > 0;
        result.message = result.valid ? 'Valid text record' : 'Text record cannot be empty';
        break;

      default:
        result.valid = targetValue.trim().length > 0;
        result.message = result.valid ? 'Valid value' : 'Value cannot be empty';
    }

    return result;
  }

  /**
   * Get default TTL values for different record types
   * @returns {Object} Default TTL values
   */
  getDefaultTTLs() {
    return {
      A: 3600,      // 1 hour
      AAAA: 3600,   // 1 hour
      CNAME: 3600,  // 1 hour
      MX: 3600,     // 1 hour
      TXT: 3600,    // 1 hour
      SRV: 3600,    // 1 hour
      NS: 86400     // 24 hours
    };
  }

  /**
   * Check if DNS changes have propagated
   * @param {string} fullDomain - The full subdomain (e.g., 'www.example.com')
   * @param {string} recordType - DNS record type
   * @returns {Promise<Object>} Propagation status
   */
  async checkDNSPropagation(fullDomain, recordType) {
    try {
      console.log(`🔍 Checking DNS propagation for ${fullDomain} (${recordType})`);

      // Note: In a real implementation, you would use DNS lookup tools
      // or third-party services to check propagation status
      
      // Simulate propagation check
      const isPropagated = Math.random() > 0.3; // 70% chance of being propagated
      
      const result = {
        domain: fullDomain,
        recordType,
        propagated: isPropagated,
        checkedAt: new Date().toISOString(),
        message: isPropagated ? 'DNS changes have propagated' : 'DNS changes still propagating'
      };

      console.log(`${isPropagated ? '✅' : '⏳'} DNS propagation check result:`, result);
      return result;

    } catch (error) {
      console.error(`❌ Error checking DNS propagation:`, error);
      throw new Error(`Failed to check DNS propagation: ${error.message}`);
    }
  }
}

module.exports = new SubdomainService();
