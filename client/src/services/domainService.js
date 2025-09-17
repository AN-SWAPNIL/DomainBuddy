import api from "./api";

export const domainService = {
  // Search for domains
  searchDomains: async (q, extensions = []) => {
    try {
      console.log(`🔍 Searching domains for term without extension: ${q}`);
      
      const params = { q };
      if (extensions.length > 0) {
        params.extensions = extensions;
      }
      
      // Create a timeout for the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
      
      const response = await api.get("/domains/search", { 
        params,
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      const data = response.data.success ? response.data.data : response.data;
      console.log(`✅ Domain search API response:`, data);
      
      return data;
    } catch (error) {
      console.error("❌ Domain search API error:", error.message);
      console.warn("Returning empty results with error message");
      return {
        query: q,
        results: [],
        directMatches: [],
        error: true,
        message: error.message || "Search service temporarily unavailable"
      };
    }
  },

  // Check domain availability
  checkAvailability: async (domain) => {
    try {
      const response = await api.get(`/domains/check/${domain}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("❌ Error checking domain availability:", error.message);
      return {
        domain,
        available: false,
        price: 0,
        premium: false,
        error: true,
        message: error.message || "Unable to check availability - please try again later"
      };
    }
  },

  // Get domain details by domain name
  getDomainDetails: async (domain) => {
    try {
      const response = await api.get(`/domains/details/${domain}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("❌ Error fetching domain details:", error.message);
      throw error;
    }
  },

  recentDomains: async () => {
    try {
      const response = await api.get("/domains/recent");
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("❌ Error fetching recent domains:", error.message);
      return {
        error: true,
        message: error.message || "Unable to load recent domains",
        data: []
      };
    }
  },

  // Get domain suggestions
  getSuggestions: async (keyword) => {
    try {
      const response = await api.get("/domains/suggestions", {
        params: { keyword },
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("❌ Error fetching domain suggestions:", error.message);
      return {
        error: true,
        message: error.message || "Unable to load domain suggestions",
        data: []
      };
    }
  },

  // Purchase domain
  purchaseDomain: async (domainData) => {
    try {
      console.log("Hello there");
      const response = await api.post("/domains/purchase", domainData);
      
      console.log("API response:", response);
      return response.data;
    } catch (error) {
      console.error("❌ Error purchasing domain:", error.message);
      throw error;
    }
  },

  // Get user's domains
  getUserDomains: async (page = 1, limit = 10) => {
    try {
      const response = await api.get("/domains/my-domains", {
        params: { page, limit },
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("❌ Error fetching user domains:", error.message);
      return {
        domains: [],
        total: 0,
        page: 1,
        limit: 10,
        error: true,
        message: error.message || "Unable to load your domains"
      };
    }
  },

  // Get domain details by ID
  getDomainById: async (domainId) => {
    try {
      const response = await api.get(`/domains/${domainId}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("❌ Error fetching domain details:", error);
      throw error;
    }
  },

  // Update domain DNS
  updateDNS: async (domainId, dnsRecords) => {
    try {
      const response = await api.put(`/domains/${domainId}/dns`, {
        dnsRecords,
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("❌ Error updating DNS records:", error.message);
      throw error;
    }
  },

  // Get DNS records
  getDNSRecords: async (domainId) => {
    try {
      const response = await api.get(`/domains/${domainId}/dns`);
      const data = response.data.success ? response.data.data : response.data;
      const records = data.records || data;
      
      // Transform records to match frontend expectations
      return records.map((record, index) => ({
        id: index + 1, // Add ID for frontend
        name: record.name,
        type: record.type,
        value: record.address || record.value, // Map "address" to "value"
        ttl: record.ttl,
        priority: record.mxPref || record.priority
      }));
    } catch (error) {
      console.error("❌ Error fetching DNS records:", error.message);
      return {
        error: true,
        message: error.message || "Unable to load DNS records",
        data: []
      };
    }
  },

  // Add DNS record (creates a subdomain)
  addDNSRecord: async (domainId, record) => {
    try {
      // Create subdomain using our subdomain API
      const subdomainData = {
        subdomain_name: record.name === '@' ? 'root' : record.name,
        record_type: record.type,
        target_value: record.value,
        ttl: record.ttl || 3600,
        priority: record.priority
      };

      const response = await api.post(`/domains/${domainId}/subdomains`, subdomainData);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn("Add DNS record failed:", error.message);
      throw error;
    }
  },

  // Delete DNS record (deletes a subdomain)
  deleteDNSRecord: async (domainId, recordId) => {
    try {
      // Get subdomains to find the one to delete
      const subdomains = await api.get(`/domains/${domainId}/subdomains`);
      const subdomainList = subdomains.data.data.subdomains || [];
      
      // Find subdomain by index (recordId is the array index)
      const subdomainToDelete = subdomainList[recordId - 1]; // recordId is 1-based
      
      if (!subdomainToDelete) {
        throw new Error('DNS record not found');
      }

      const response = await api.delete(`/domains/${domainId}/subdomains/${subdomainToDelete.id}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn("Delete DNS record failed:", error.message);
      throw error;
    }
  },

  // Transfer domain
  transferDomain: async (domain, authCode) => {
    try {
      const response = await api.post("/domains/transfer", {
        domain,
        authCode,
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("❌ Error transferring domain:", error.message);
      throw error;
    }
  },

  // Renew domain
  renewDomain: async (domainId, years = 1) => {
    try {
      const response = await api.post(`/domains/${domainId}/renew`, { years });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("❌ Error renewing domain:", error.message);
      throw error;
    }
  },

  // Get domain pricing
  getDomainPricing: async (tld) => {
    try {
      const response = await api.get(`/domains/pricing/${tld}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("❌ Error fetching domain pricing:", error.message);
      throw error;
    }
  },

  // Bulk search domains
  bulkSearch: async (domains) => {
    try {
      const response = await api.post("/domains/bulk-search", { domains });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("❌ Error bulk searching domains:", error.message);
      return {
        error: true,
        message: error.message || "Unable to search domains",
        data: []
      };
    }
  },
};

export default domainService;
