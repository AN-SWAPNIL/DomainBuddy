import api from "./api";

export const domainService = {
  // Search for domains
  searchDomains: async (q, extensions = []) => {
    try {
      const params = { q };
      if (extensions.length > 0) {
        params.extensions = extensions;
      }
      const response = await api.get("/domains/search", { params });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn("API not available, returning mock data");
      // Mock data for demonstration
      const extensionArray =
        extensions.length > 0
          ? extensions
          : [".com", ".net", ".org", ".io", ".co", ".ai", ".app"];
      return extensionArray.map((ext) => ({
        name: `${q}${ext}`,
        available: Math.random() > 0.5,
        price: Math.floor(Math.random() * 50) + 10,
        premium: Math.random() > 0.8,
        registrar: "Namecheap",
        description: `Perfect domain for your ${q} business`,
      }));
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
      const extensions = [
        ".com",
        ".net",
        ".org",
        ".io",
        ".co",
        ".ai",
        ".app",
        ".dev",
        ".tech",
      ];
      const prefixes = ["my", "get", "the", "best", "smart", "pro", "super"];
      const suffixes = [
        "hub",
        "zone",
        "spot",
        "place",
        "world",
        "land",
        "space",
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
      const response = await api.post("/domains/purchase", domainData);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn("API not available, returning mock data");
      return {
        success: true,
        transactionId: `txn_${Date.now()}`,
        domain: domainData.domain || domainData.name,
        message: "Domain purchase initiated successfully",
        paymentUrl: "#",
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
      return {
        domains: [
          {
            id: 1,
            name: "myawesomeapp.com",
            status: "active",
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            traffic: 1250,
            estimatedValue: 2500,
            age: 2,
          },
          {
            id: 2,
            name: "startupidea.io",
            status: "expiring",
            expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            traffic: 850,
            estimatedValue: 1800,
            age: 1,
          },
          {
            id: 3,
            name: "techblog.net",
            status: "active",
            expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
            traffic: 3200,
            estimatedValue: 5000,
            age: 3,
          },
        ],
        total: 3,
        page,
        limit,
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
