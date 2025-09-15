import api from './api';

const subdomainService = {
  // Get all subdomains for a domain
  getSubdomains: async (domainId) => {
    try {
      console.log(`🔍 Fetching subdomains for domain: ${domainId}`);
      const response = await api.get(`/domains/${domainId}/subdomains`);
      console.log(`✅ Fetched subdomains:`, response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching subdomains:', error);
      throw error;
    }
  },

  // Get specific subdomain details
  getSubdomainDetails: async (domainId, subdomainId) => {
    try {
      console.log(`🔍 Fetching subdomain details: ${subdomainId} for domain: ${domainId}`);
      const response = await api.get(`/domains/${domainId}/subdomains/${subdomainId}`);
      console.log(`✅ Fetched subdomain details:`, response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching subdomain details:', error);
      throw error;
    }
  },

  // Create a new subdomain
  createSubdomain: async (domainId, subdomainData) => {
    try {
      console.log(`🚀 Creating subdomain for domain: ${domainId}`, subdomainData);
      const response = await api.post(`/domains/${domainId}/subdomains`, subdomainData);
      console.log(`✅ Created subdomain:`, response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error creating subdomain:', error);
      throw error;
    }
  },

  // Update an existing subdomain
  updateSubdomain: async (domainId, subdomainId, subdomainData) => {
    try {
      console.log(`✏️ Updating subdomain: ${subdomainId} for domain: ${domainId}`, subdomainData);
      const response = await api.put(`/domains/${domainId}/subdomains/${subdomainId}`, subdomainData);
      console.log(`✅ Updated subdomain:`, response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error updating subdomain:', error);
      throw error;
    }
  },

  // Delete a subdomain
  deleteSubdomain: async (domainId, subdomainId) => {
    try {
      console.log(`🗑️ Deleting subdomain: ${subdomainId} for domain: ${domainId}`);
      const response = await api.delete(`/domains/${domainId}/subdomains/${subdomainId}`);
      console.log(`✅ Deleted subdomain:`, response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error deleting subdomain:', error);
      throw error;
    }
  },

  // Validate subdomain name format
  validateSubdomainName: (name) => {
    const subdomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    return subdomainRegex.test(name);
  },

  // Validate target value based on record type
  validateTargetValue: (recordType, value) => {
    switch (recordType) {
      case 'A':
        // IPv4 validation
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        return ipv4Regex.test(value);
      case 'CNAME':
        // Domain name validation
        return value.includes('.') && !value.endsWith('.');
      case 'AAAA':
        // IPv6 validation (basic)
        return value.includes(':');
      case 'MX':
        // Domain name validation for MX
        return value.includes('.') && !value.endsWith('.');
      case 'TXT':
        // TXT records can contain any text
        return value.length > 0;
      default:
        return false;
    }
  },

  // Get validation error message
  getValidationErrorMessage: (recordType) => {
    switch (recordType) {
      case 'A':
        return 'Please enter a valid IPv4 address (e.g., 192.168.1.1)';
      case 'CNAME':
        return 'Please enter a valid domain name (e.g., example.com)';
      case 'AAAA':
        return 'Please enter a valid IPv6 address';
      case 'MX':
        return 'Please enter a valid mail server domain name';
      case 'TXT':
        return 'Please enter the text content for the TXT record';
      default:
        return 'Please enter a valid value for this record type';
    }
  },

  // Get record type descriptions
  getRecordTypeDescription: (recordType) => {
    switch (recordType) {
      case 'A':
        return 'Points to an IPv4 address';
      case 'CNAME':
        return 'Points to another domain name (alias)';
      case 'AAAA':
        return 'Points to an IPv6 address';
      case 'MX':
        return 'Mail exchange server for email routing';
      case 'TXT':
        return 'Text record for various purposes (SPF, DKIM, etc.)';
      default:
        return 'DNS record';
    }
  },

  // Get TTL options
  getTTLOptions: () => [
    { value: 60, label: '1 minute' },
    { value: 300, label: '5 minutes' },
    { value: 600, label: '10 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 hour' },
    { value: 14400, label: '4 hours' },
    { value: 43200, label: '12 hours' },
    { value: 86400, label: '24 hours' }
  ],

  // Get record type options
  getRecordTypeOptions: () => [
    { value: 'A', label: 'A (IPv4 Address)' },
    { value: 'CNAME', label: 'CNAME (Domain Alias)' },
    { value: 'AAAA', label: 'AAAA (IPv6 Address)' },
    { value: 'MX', label: 'MX (Mail Exchange)' },
    { value: 'TXT', label: 'TXT (Text Record)' }
  ]
};

export default subdomainService;
