const axios = require("axios");

class NamecheapService {
  constructor() {
    this.apiUser = process.env.NAMECHEAP_API_USER;
    this.apiKey = process.env.NAMECHEAP_API_KEY;
    this.clientIp = process.env.NAMECHEAP_CLIENT_IP;
    this.sandbox = process.env.NAMECHEAP_SANDBOX === "true";
    this.baseUrl = this.sandbox
      ? "https://api.sandbox.namecheap.com/xml.response"
      : "https://api.namecheap.com/xml.response";
  }

  // Method to get current public IP if not set in environment
  async getCurrentIP() {
    try {
      const response = await axios.get('https://ipinfo.io/ip');
      return response.data.trim();
    } catch (error) {
      console.error('Failed to get current IP:', error.message);
      return this.clientIp || '127.0.0.1';
    }
  }

  async checkDomainAvailability(domainName) {
    try {
      // Use environment IP or detect current IP
      const clientIp = this.clientIp || await this.getCurrentIP();
      
      const params = {
        ApiUser: this.apiUser,
        ApiKey: this.apiKey,
        UserName: this.apiUser,
        Command: "namecheap.domains.check",
        ClientIp: clientIp,
        DomainList: domainName,
      };

      console.log("Using IP address:", clientIp);
      const response = await axios.get(this.baseUrl, { params });
      console.log("Namecheap API Response:", response.data);

      // Check for API errors in the XML response
      if (response.data.includes('Status="ERROR"')) {
        console.error("Namecheap API returned an error");
        
        // Extract error message for better debugging
        const errorMatch = response.data.match(/<Error Number="(\d+)">([^<]+)<\/Error>/);
        if (errorMatch) {
          const errorNumber = errorMatch[1];
          const errorMessage = errorMatch[2];
          console.error(`Error ${errorNumber}: ${errorMessage}`);
          
          // Handle specific errors
          if (errorNumber === "1011150") {
            console.error("⚠️  IP Address not whitelisted with Namecheap API");
            console.error("Current IP being used:", clientIp);
            console.error("Please whitelist this IP in your Namecheap account");
            console.error("Visit: https://ap.www.namecheap.com/settings/tools/apiaccess/");
          }
          
          // Throw specific error instead of fallback
          throw new Error(`Namecheap API Error ${errorNumber}: ${errorMessage}`);
        }
        
        throw new Error("Namecheap API returned an error response");
      }

      // Parse XML response (simplified - in production, use proper XML parser)
      const available = response.data.includes('Available="true"');
      const price = this.extractPriceFromResponse(response.data);
      
      if (price === null) {
        console.warn("Could not extract price from Namecheap response");
      }
      
      return {
        domain: domainName,
        available,
        price: price || this.getDefaultPrice(domainName), // Only fallback for price, not availability
        currency: "USD",
      };
    } catch (error) {
      console.error("Namecheap API Error:", error.message);
      
      // Re-throw the error instead of providing fallback data
      throw new Error(`Failed to check domain availability: ${error.message}`);
    }
  }

  // Helper methods for parsing XML responses
  extractPriceFromResponse(xmlData) {
    // Simplified price extraction - implement proper XML parsing
    const match = xmlData.match(/price="([^"]+)"/);
    return match ? parseFloat(match[1]) : null;
  }

  getDefaultPrice(domainName) {
    // Extract extension from domain name
    const extension = domainName.substring(domainName.lastIndexOf("."));

    // Default pricing based on extension
    const defaultPrices = {
      ".com": 12.99,
      ".net": 14.99,
      ".org": 13.99,
      ".io": 59.99,
      ".co": 34.99,
      ".ai": 99.99,
      ".app": 19.99,
      ".dev": 12.99,
      ".tech": 49.99,
      ".co.uk": 8.99,
      ".me": 24.99,
      ".info": 12.99,
      ".biz": 19.99,
    };

    return defaultPrices[extension] || 15.99; // Default fallback price
  }
}

module.exports = new NamecheapService();
