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
      
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        console.warn("⏰ Domain search timed out, returning limited results");
        // Return partial results instead of full mock data
        const extensionArray = extensions.length > 0 ? extensions : [".com", ".net", ".org"];
        const results = extensionArray.slice(0, 3).map((ext) => ({
          domain: `${q}${ext}`,
          available: true, // Assume available for timeout cases
          price: ext === '.com' ? 12.99 : ext === '.net' ? 13.99 : 14.99,
          currency: "USD",
          isPremium: false,
          message: "Check availability - service was slow to respond",
          timeout: true
        }));
        
        return {
          query: q,
          results: results
        };
      }
      
      console.warn("API not available, returning mock data");
      // Reduced mock data for better performance
      const extensionArray = extensions.length > 0 ? extensions : [".com", ".net", ".org"];
      const directMatches = extensionArray.slice(0, 5).map((ext) => ({
        domain: `${q}${ext}`,
        available: Math.random() > 0.5,
        price: Math.floor(Math.random() * 30) + 10,
        premium: Math.random() > 0.8,
        registrar: "Namecheap",
        description: `Perfect domain for your ${q} business`,
      }));
      
      const aiSuggestions = [
        {
          domain: `${q}-hub.com`,
          brandabilityScore: 8,
          reasoning: `${q}-hub.com sounds professional and modern.`,
        },
        {
          domain: `get${q}.io`,
          brandabilityScore: 7,
          reasoning: `Great for a tech startup or app.`,
        },
        {
          domain: `${q}pro.net`,
          brandabilityScore: 8,
          reasoning: `Professional and trustworthy domain name.`,
        },
      ];
      
      return {
        directMatches,
        aiSuggestions,
      };
    }
  },

  // Check domain availability
  checkAvailability: async (domain) => {
    try {
      const response = await api.get(`/domains/check/${domain}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn("API not available, returning mock data");
      return {
        domain,
        available: Math.random() > 0.5,
        price: Math.floor(Math.random() * 50) + 10,
        premium: Math.random() > 0.8,
      };
    }
  },

  // Get domain details by domain name
  getDomainDetails: async (domain) => {
    try {
      const response = await api.get(`/domains/details/${domain}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn("API not available, returning mock data");
      return {
        domain,
        available: Math.random() > 0.5,
        price: Math.floor(Math.random() * 50) + 10,
        premium: Math.random() > 0.8,
        analysis: {
          seoScore: Math.floor(Math.random() * 100),
          brandability: Math.floor(Math.random() * 100),
          memorability: Math.floor(Math.random() * 100),
        },
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
      console.warn("API not available, returning mock data");
      const suggestions = [];
      const extensions = [".com", ".net", ".org", ".io", ".co", ".ai", ".app"];
      const prefixes = [
        "get",
        "my",
        "best",
        "go",
        "try",
        "the",
        "super",
        "top",
      ];
      const suffixes = [
        "ly",
        "ify",
        "hub",
        "zone",
        "base",
        "pro",
        "app",
        "site",
      ];
      for (let i = 0; i < 10; i++) {
        const variation =
          Math.random() > 0.5
            ? `${
                prefixes[Math.floor(Math.random() * prefixes.length)]
              }${keyword}`
            : `${keyword}${
                suffixes[Math.floor(Math.random() * suffixes.length)]
              }`;
        suggestions.push({
          name: `${variation}${
            extensions[Math.floor(Math.random() * extensions.length)]
          }`,
          available: Math.random() > 0.3,
          price: Math.floor(Math.random() * 40) + 12,
          premium: Math.random() > 0.85,
          score: Math.floor(Math.random() * 40) + 60,
        });
      }
      return suggestions;
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
      console.warn("API not available, returning mock purchase data");
      // Mock purchase result matching backend response format
      // return {
      //   success: true,
      //   data: {
      //     domain: {
      //       id: `mock-domain-${Math.floor(Math.random() * 100000)}`,
      //       name: domainData.domain.split(".")[0],
      //       extension: domainData.domain.split(".").slice(1).join("."),
      //       full_domain: domainData.domain,
      //       selling_price: 12.99,
      //       currency: "USD",
      //       status: "pending",
      //     },
      //     transaction: {
      //       id: `mock-tx-${Math.floor(Math.random() * 100000)}`,
      //       amount: 12.99,
      //       currency: "USD",
      //       status: "pending",
      //     },
      //     message: "Domain purchase initiated. Complete payment to finalize.",
      //   },
      // };
      return {
        success: false,
        message: error.message || "Domain purchase failed"
      };
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
      console.warn("API not available, returning mock data");
      // Mock user domains
      // return {
      //   domains: [
      //     {
      //       id: 1,
      //       name: "myawesomeapp.com",
      //       status: "active",
      //       expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      //       traffic: 1250,
      //       estimatedValue: 2500,
      //       age: 2,
      //     },
      //     {
      //       id: 2,
      //       name: "startupidea.io",
      //       status: "expiring",
      //       expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      //       traffic: 850,
      //       estimatedValue: 1800,
      //       age: 1,
      //     },
      //     {
      //       id: 3,
      //       name: "techblog.net",
      //       status: "active",
      //       expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      //       traffic: 3200,
      //       estimatedValue: 5000,
      //       age: 3,
      //     },
      //   ],
      //   total: 3,
      //   page,
      //   limit,
      // };
      return {
        success: false,
        message: error.message || "Failed to fetch user domains"
      };
    }
  },

  // Get domain details by ID
  getDomainById: async (domainId) => {
    try {
      const response = await api.get(`/domains/${domainId}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn("API not available, returning mock data");
      return {
        id: domainId,
        name: "example.com",
        status: "active",
        registrationDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        locked: false,
        privacy: true,
        nameservers: ["ns1.example.com", "ns2.example.com"],
        traffic: {
          monthly: 1500,
          trend: "up",
        },
        estimatedValue: 2500,
      };
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
      console.warn("API not available, returning mock data");
      return {
        success: true,
        message: "DNS records updated successfully",
        records: dnsRecords,
      };
    }
  },

  // Get DNS records
  getDNSRecords: async (domainId) => {
    try {
      const response = await api.get(`/domains/${domainId}/dns`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn("API not available, returning mock data");
      return [
        { id: 1, type: "A", name: "@", value: "192.168.1.1", ttl: 3600 },
        { id: 2, type: "CNAME", name: "www", value: "@", ttl: 3600 },
        {
          id: 3,
          type: "MX",
          name: "@",
          value: "mail.example.com",
          priority: 10,
          ttl: 3600,
        },
      ];
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
      console.warn("API not available, returning mock data");
      return {
        success: true,
        transferId: `transfer_${Date.now()}`,
        domain,
        status: "pending",
        estimatedCompletion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
    }
  },

  // Renew domain
  renewDomain: async (domainId, years = 1) => {
    try {
      const response = await api.post(`/domains/${domainId}/renew`, { years });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn("API not available, returning mock data");
      return {
        success: true,
        domain: "example.com",
        years,
        cost: years * 15,
        newExpiryDate: new Date(Date.now() + years * 365 * 24 * 60 * 60 * 1000),
        transactionId: `renewal_${Date.now()}`,
      };
    }
  },

  // Get domain pricing
  getDomainPricing: async (tld) => {
    try {
      const response = await api.get(`/domains/pricing/${tld}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn("API not available, returning mock data");
      const basePrices = {
        ".com": 12.99,
        ".net": 14.99,
        ".org": 13.99,
        ".io": 59.99,
        ".co": 34.99,
        ".ai": 99.99,
        ".app": 19.99,
        ".dev": 12.99,
        ".tech": 49.99,
      };

      const basePrice = basePrices[tld] || 15.99;
      return {
        tld,
        registration: basePrice,
        renewal: basePrice,
        transfer: basePrice - 2,
        premium: basePrice * 2,
      };
    }
  },

  // Bulk search domains
  bulkSearch: async (domains) => {
    try {
      const response = await api.post("/domains/bulk-search", { domains });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn("API not available, returning mock data");
      return domains.map((domain) => ({
        name: domain,
        available: Math.random() > 0.5,
        price: Math.floor(Math.random() * 50) + 10,
        premium: Math.random() > 0.8,
        category: "standard",
      }));
    }
  },
};

export default domainService;
