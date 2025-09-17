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
      
      console.log(`🌐 Creating DNS record for ${hostname}.${domain}:`, {
        hostname,
        recordType: record_type,
        address: target_value,
        ttl: ttl || 3600,
        priority: priority
      });

      // Use actual Namecheap API to create DNS record
      const result = await this.dnsProvider.createDnsRecord(
        domain, 
        hostname, 
        record_type, 
        target_value, 
        ttl || 3600
      );

      if (result.success) {
        console.log(`✅ DNS record created successfully for ${hostname}.${domain}`);
        return {
          success: true,
          recordId: `${hostname}_${record_type}_${Date.now()}`, // Generate unique ID
          message: `DNS record created for ${hostname}.${domain}`,
          data: {
            hostname,
            recordtype: record_type,
            address: target_value,
            ttl: ttl || 3600,
            priority: priority
          }
        };
      } else {
        console.error(`❌ Failed to create DNS record: ${result.message}`);
        throw new Error(result.message || 'Failed to create DNS record');
      }

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
      const { subdomain_name, record_type, target_value, ttl, old_target_value } = updateData;
      
      console.log(`🔄 Updating DNS record ${recordId} for domain ${domain}:`, updateData);

      // Use actual Namecheap API to update DNS record
      const result = await this.dnsProvider.updateDnsRecord(
        domain, 
        subdomain_name, 
        record_type, 
        target_value, 
        ttl || 3600, 
        old_target_value
      );

      if (result.success) {
        console.log(`✅ DNS record updated successfully for ${subdomain_name}.${domain}`);
        return {
          success: true,
          recordId,
          message: `DNS record updated for ${subdomain_name}.${domain}`,
          data: updateData
        };
      } else {
        console.error(`❌ Failed to update DNS record: ${result.message}`);
        throw new Error(result.message || 'Failed to update DNS record');
      }

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
      // Extract subdomain name and record type from recordId
      // Expected format: "subdomain_recordtype_timestamp"
      const parts = recordId.split('_');
      const subdomainName = parts[0];
      const recordType = parts[1];
      
      console.log(`🗑️ Deleting DNS record ${recordId} for domain ${domain} (${subdomainName}, ${recordType})`);

      // Use actual Namecheap API to delete DNS record
      const result = await this.dnsProvider.deleteDnsRecord(
        domain, 
        subdomainName, 
        recordType
      );

      if (result.success) {
        console.log(`✅ DNS record deleted successfully for ${subdomainName}.${domain}`);
        return {
          success: true,
          recordId,
          message: `DNS record deleted for ${subdomainName}.${domain}`
        };
      } else {
        console.error(`❌ Failed to delete DNS record: ${result.message}`);
        throw new Error(result.message || 'Failed to delete DNS record');
      }

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

      // Use actual Namecheap API to get DNS records
      const result = await this.dnsProvider.getDnsRecords(domain);

      if (result.success) {
        const records = result.records.map(record => ({
          recordId: `${record.name}_${record.type}_${Date.now()}`, // Generate unique ID
          hostname: record.name,
          recordType: record.type,
          address: record.address,
          ttl: record.ttl,
          priority: record.mxPref
        }));

        console.log(`✅ Found ${records.length} DNS records for ${domain}`);
        return records;
      } else {
        console.error(`❌ Failed to fetch DNS records: ${result.message}`);
        throw new Error(result.message || 'Failed to fetch DNS records');
      }

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
   * @param {string} expectedValue - Expected DNS value
   * @returns {Promise<Object>} Propagation status
   */
  async checkDNSPropagation(fullDomain, recordType, expectedValue) {
    try {
      console.log(`🔍 Checking DNS propagation for ${fullDomain} (${recordType}) expecting: ${expectedValue}`);

      // Split domain to get subdomain and main domain
      const parts = fullDomain.split('.');
      const subdomain = parts[0];
      const domain = parts.slice(1).join('.');

      // Use actual Namecheap API to check DNS propagation
      const result = await this.dnsProvider.checkDnsPropagation(
        subdomain, 
        domain, 
        recordType, 
        expectedValue
      );

      if (result.success) {
        const propagationResult = {
          domain: fullDomain,
          recordType,
          propagated: result.propagated,
          actualValue: result.actualValue,
          expectedValue: expectedValue,
          checkedAt: new Date().toISOString(),
          message: result.propagated ? 'DNS changes have propagated' : 'DNS changes still propagating'
        };

        console.log(`${result.propagated ? '✅' : '⏳'} DNS propagation check result:`, propagationResult);
        return propagationResult;
      } else {
        console.error(`❌ Failed to check DNS propagation: ${result.message}`);
        throw new Error(result.message || 'Failed to check DNS propagation');
      }

    } catch (error) {
      console.error(`❌ Error checking DNS propagation:`, error);
      throw new Error(`Failed to check DNS propagation: ${error.message}`);
    }
  }
}

module.exports = new SubdomainService();
