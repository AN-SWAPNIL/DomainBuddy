const axios = require("axios");
const { parseString } = require("xml2js");
const supabase = require("../config/database.js");

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
      const response = await axios.get("https://ipinfo.io/ip");
      return response.data.trim();
    } catch (error) {
      console.error("Failed to get current IP:", error.message);
      return this.clientIp || "127.0.0.1";
    }
  }

  async checkDomainAvailability(domainName) {
    try {
      // First, check if domain exists in our database
      const { data: existingDomain, error: dbError } = await supabase
        .from("domains")
        .select("id, full_domain, status")
        .eq("full_domain", domainName.toLowerCase())
        .single();

      if (dbError && dbError.code !== "PGRST116") {
        console.error("Database check error:", dbError);
        // Continue with API check if database check fails
      }

      // If domain exists in our database, it's not available
      if (existingDomain) {
        console.log(`Domain ${domainName} found in database - not available`);
        return {
          domain: domainName,
          available: false,
          price: 0,
          currency: "USD",
          isPremium: false,
          premiumPrices: null,
          reason: "Domain already registered in our system",
        };
      }

      // If not in database, check with Namecheap API
      console.log(
        `Domain ${domainName} not in database - checking with Namecheap`
      );

      // Use environment IP or detect current IP
      const clientIp = this.clientIp || (await this.getCurrentIP());

      // Step 1: Check domain availability
      const availabilityParams = {
        ApiUser: this.apiUser,
        ApiKey: this.apiKey,
        UserName: this.apiUser,
        Command: "namecheap.domains.check",
        ClientIp: clientIp,
        DomainList: domainName,
      };

      console.log("Checking availability for:", domainName);
      console.log("Using IP address:", clientIp);
      const availabilityResponse = await axios.get(this.baseUrl, { params: availabilityParams });

      // Check for API errors in the XML response first
      if (availabilityResponse.data.includes('Status="ERROR"')) {
        console.error("Namecheap API returned an error");

        // Extract error message for better debugging
        const errorMatch = availabilityResponse.data.match(
          /<Error Number="(\d+)">([^<]+)<\/Error>/
        );
        if (errorMatch) {
          const errorNumber = errorMatch[1];
          const errorMessage = errorMatch[2];
          console.error(`Error ${errorNumber}: ${errorMessage}`);

          // Handle specific errors
          if (errorNumber === "1011150") {
            console.error("⚠️  IP Address not whitelisted with Namecheap API");
            console.error("Current IP being used:", clientIp);
            console.error("Please whitelist this IP in your Namecheap account");
            console.error(
              "Visit: https://ap.www.namecheap.com/settings/tools/apiaccess/"
            );
          }

          // Throw specific error instead of fallback
          throw new Error(
            `Namecheap API Error ${errorNumber}: ${errorMessage}`
          );
        }

        throw new Error("Namecheap API returned an error response");
      }

      // Parse availability response
      const availabilityResult = await this.parseXmlResponse(availabilityResponse.data);
      const domainResult = this.extractDomainInfo(availabilityResult, domainName);
      console.log("Domain availability result:", domainResult);

      // If there was an API error, throw it instead of using fallback
      if (domainResult.error) {
        throw new Error(`Namecheap API Error: ${domainResult.error}`);
      }

      let finalPrice = null;
      let isPremium = domainResult.isPremium;
      let premiumPrices = domainResult.premiumPrices;

      // Step 2: If domain is available, get pricing information
      if (domainResult.available) {
        try {
          // Extract extension from domain name (e.g., "com" from "example.com")
          const extension = domainName.split('.').pop().toLowerCase();
          
          console.log(`Getting pricing for extension: ${extension}`);
          
          const pricingParams = {
            ApiUser: this.apiUser,
            ApiKey: this.apiKey,
            UserName: this.apiUser,
            Command: "namecheap.users.getPricing",
            ClientIp: clientIp,
            ProductType: "DOMAIN",
            ProductName: extension.toUpperCase(),
            ActionName: "REGISTER"
          };

          const pricingResponse = await axios.get(this.baseUrl, { params: pricingParams });
          console.log("Pricing API response:", pricingResponse.data);
          
          // Check for pricing API errors
          if (pricingResponse.data.includes('Status="ERROR"')) {
            console.warn("Pricing API returned error, using default price");
            finalPrice = this.getDefaultPrice(domainName);
          } else {
            // Parse pricing response
            const pricingResult = await this.parseXmlResponse(pricingResponse.data);
            const extractedPrice = this.extractPricingForOneYear(pricingResult, extension);
            
            if (extractedPrice !== null) {
              finalPrice = extractedPrice;
              console.log(`Got pricing from API: $${finalPrice} for ${extension}`);
            } else {
              console.warn("Could not extract pricing from API, using default");
              finalPrice = this.getDefaultPrice(domainName);
            }
          }
        } catch (pricingError) {
          console.warn("Error getting pricing from API:", pricingError.message);
          finalPrice = this.getDefaultPrice(domainName);
        }
      } else {
        // Domain not available, set price to 0
        finalPrice = 0;
      }

      return {
        domain: domainName,
        available: domainResult.available,
        price: finalPrice,
        currency: "USD",
        isPremium: isPremium,
        premiumPrices: premiumPrices,
      };
    } catch (error) {
      console.error("Namecheap API Error:", error.message);

      // Re-throw the error instead of providing fallback data for critical errors
      if (
        error.message.includes("1011150") ||
        error.message.includes("API Error")
      ) {
        throw error;
      }

      // Fallback to mock data for development/testing only for network errors
      console.log("Using fallback pricing for domain:", domainName);
      return {
        domain: domainName,
        available: true, // Assume available for testing
        price: this.getDefaultPrice(domainName),
        currency: "USD",
        isPremium: false,
      };
    }
  }

  async registerDomain(domainName, years = 1, contactInfo) {
    try {
      // Use environment IP or detect current IP
      const clientIp = this.clientIp || (await this.getCurrentIP());

      const params = {
        ApiUser: this.apiUser,
        ApiKey: this.apiKey,
        UserName: this.apiUser,
        Command: "namecheap.domains.create",
        ClientIp: clientIp,
        DomainName: domainName,
        Years: years,
        // Contact information parameters
        RegistrantFirstName: contactInfo.firstName,
        RegistrantLastName: contactInfo.lastName,
        RegistrantAddress1: contactInfo.address,
        RegistrantCity: contactInfo.city,
        RegistrantStateProvince: contactInfo.state,
        RegistrantPostalCode: contactInfo.postalCode,
        RegistrantCountry: contactInfo.country,
        RegistrantPhone: contactInfo.phone,
        RegistrantEmailAddress: contactInfo.email,
        // Copy registrant info to other contact types
        TechFirstName: contactInfo.firstName,
        TechLastName: contactInfo.lastName,
        TechAddress1: contactInfo.address,
        TechCity: contactInfo.city,
        TechStateProvince: contactInfo.state,
        TechPostalCode: contactInfo.postalCode,
        TechCountry: contactInfo.country,
        TechPhone: contactInfo.phone,
        TechEmailAddress: contactInfo.email,
        AdminFirstName: contactInfo.firstName,
        AdminLastName: contactInfo.lastName,
        AdminAddress1: contactInfo.address,
        AdminCity: contactInfo.city,
        AdminStateProvince: contactInfo.state,
        AdminPostalCode: contactInfo.postalCode,
        AdminCountry: contactInfo.country,
        AdminPhone: contactInfo.phone,
        AdminEmailAddress: contactInfo.email,
        AuxBillingFirstName: contactInfo.firstName,
        AuxBillingLastName: contactInfo.lastName,
        AuxBillingAddress1: contactInfo.address,
        AuxBillingCity: contactInfo.city,
        AuxBillingStateProvince: contactInfo.state,
        AuxBillingPostalCode: contactInfo.postalCode,
        AuxBillingCountry: contactInfo.country,
        AuxBillingPhone: contactInfo.phone,
        AuxBillingEmailAddress: contactInfo.email,
      };

      const response = await axios.get(this.baseUrl, { params });

      // Parse response for success/failure
      const success = response.data.includes('Status="OK"');

      if (success) {
        return {
          success: true,
          domain: domainName,
          registrationId: this.extractRegistrationId(response.data),
        };
      } else {
        throw new Error("Domain registration failed");
      }
    } catch (error) {
      console.error("Domain Registration Error:", error.message);
      throw new Error("Failed to register domain");
    }
  }

  async parseXmlResponse(xmlData) {
    return new Promise((resolve, reject) => {
      parseString(xmlData, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  extractDomainInfo(xmlResult, domainName) {
    try {
      // Navigate the XML structure based on Namecheap API response
      const apiResponse = xmlResult?.ApiResponse;
      if (!apiResponse) {
        throw new Error("No ApiResponse found in XML");
      }

      // Check if the API returned an error
      if (apiResponse.$ && apiResponse.$.Status === "ERROR") {
        const errors = apiResponse.Errors?.[0]?.Error || [];
        const errorMessages = errors.map((err) => err._).join(", ");

        // Return error instead of fallback data
        return {
          available: false,
          isPremium: false,
          price: null,
          premiumPrices: null,
          error: errorMessages,
        };
      }

      const commandResponse = apiResponse.CommandResponse?.[0];
      if (!commandResponse) {
        throw new Error("No CommandResponse found in XML");
      }

      const domainCheckResult = commandResponse.DomainCheckResult?.[0];
      if (!domainCheckResult || !domainCheckResult.$) {
        throw new Error("No DomainCheckResult found in XML");
      }

      const attrs = domainCheckResult.$;
      const available = attrs.Available === "true";
      const isPremium = attrs.IsPremiumName === "true";

      let price = null;
      let premiumPrices = {};

      if (isPremium) {
        // Extract premium pricing
        price = parseFloat(attrs.PremiumRegistrationPrice) || null;
        premiumPrices = {
          registration: parseFloat(attrs.PremiumRegistrationPrice) || null,
          renewal: parseFloat(attrs.PremiumRenewalPrice) || null,
          restore: parseFloat(attrs.PremiumRestorePrice) || null,
          transfer: parseFloat(attrs.PremiumTransferPrice) || null,
          icannFee: parseFloat(attrs.IcannFee) || null,
        };
      } else if (available) {
        // For regular domains, get pricing from getPricing API
        price = this.getDefaultPrice(domainName);
      }

      return {
        available,
        isPremium,
        price,
        premiumPrices: isPremium ? premiumPrices : null,
      };
    } catch (error) {
      console.error("Error extracting domain info:", error);
      return {
        available: false,
        isPremium: false,
        price: null,
        premiumPrices: null,
        error: "Failed to parse domain information",
      };
    }
  }

  getDefaultPrice(domainName) {
    // Default pricing based on TLD
    console.log("Getting default price for domain:", domainName);

    const tld = domainName.split(".").pop().toLowerCase();
    const defaultPrices = {
      com: 12.99,
      net: 13.99,
      org: 13.99,
      info: 11.99,
      biz: 13.99,
      io: 49.99,
      co: 24.99,
      ai: 99.99,
      app: 18.99,
      dev: 12.99,
      tech: 49.99,
      online: 39.99,
      store: 59.99,
      website: 24.99,
    };

    return defaultPrices[tld] || 15.99; // Default fallback price
  }

  async getPricing(tld = null) {
    try {
      const params = {
        ApiUser: this.apiUser,
        ApiKey: this.apiKey,
        UserName: this.apiUser,
        Command: "namecheap.users.getPricing",
        ClientIp: this.clientIp,
        ProductType: "DOMAIN",
      };

      if (tld) {
        params.ProductName = tld.toUpperCase();
      }

      const response = await axios.get(this.baseUrl, { params });
      const result = await this.parseXmlResponse(response.data);

      return this.extractPricingInfo(result);
    } catch (error) {
      console.error("Error getting pricing:", error.message);
      return null;
    }
  }

  extractPricingInfo(xmlResult) {
    try {
      const commandResponse = xmlResult?.ApiResponse?.CommandResponse?.[0];
      const userGetPricingResult = commandResponse?.UserGetPricingResult?.[0];
      const productTypes = userGetPricingResult?.ProductType || [];

      const pricing = {};

      productTypes.forEach((productType) => {
        const products = productType.Product || [];
        products.forEach((product) => {
          const productName = product.$.Name;
          const prices = product.Price || [];

          pricing[productName] = {};
          prices.forEach((price) => {
            const duration = price.$.Duration;
            const priceValue = parseFloat(price.$.Price);
            pricing[productName][duration] = priceValue;
          });
        });
      });

      return pricing;
    } catch (error) {
      console.error("Error extracting pricing info:", error);
      return {};
    }
  }

  extractPricingForOneYear(xmlResult, extension) {
    try {
      console.log(`Extracting pricing for extension: ${extension}`);
      
      const commandResponse = xmlResult?.ApiResponse?.CommandResponse?.[0];
      const userGetPricingResult = commandResponse?.UserGetPricingResult?.[0];
      const productTypes = userGetPricingResult?.ProductType || [];

      console.log(`Found ${productTypes.length} product types`);

      // Look for the product type (it's "domains" not "DOMAIN" in the response)
      for (const productType of productTypes) {
        const productTypeName = productType.$.Name;
        console.log(`Checking product type: ${productTypeName}`);
        
        if (productTypeName.toLowerCase() === "domains") {
          const productCategories = productType.ProductCategory || [];
          console.log(`Found ${productCategories.length} product categories`);
          
          // Look for "register" category
          for (const category of productCategories) {
            const categoryName = category.$.Name;
            console.log(`Checking category: ${categoryName}`);
            
            if (categoryName.toLowerCase() === "register") {
              const products = category.Product || [];
              console.log(`Found ${products.length} products in register category`);
              
              // Find the product matching our extension
              for (const product of products) {
                const productName = product.$.Name.toLowerCase();
                console.log(`Checking product: ${productName} against ${extension.toLowerCase()}`);
                
                if (productName === extension.toLowerCase()) {
                  const prices = product.Price || [];
                  console.log(`Found ${prices.length} price entries for ${extension}`);
                  
                  // Look for 1-year pricing
                  for (const price of prices) {
                    const duration = price.$.Duration;
                    const durationType = price.$.DurationType;
                    console.log(`Checking price: Duration=${duration}, DurationType=${durationType}`);
                    
                    if (duration === "1" && durationType.toLowerCase() === "year") {
                      const priceValue = parseFloat(price.$.Price);
                      const additionalCost = parseFloat(price.$.AdditionalCost) || 0;
                      const totalPrice = priceValue + additionalCost;
                      
                      console.log(`Found 1-year price for ${extension}: $${priceValue} + $${additionalCost} = $${totalPrice}`);
                      return totalPrice;
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      console.warn(`No 1-year pricing found for extension: ${extension}`);
      return null;
    } catch (error) {
      console.error("Error extracting 1-year pricing:", error);
      return null;
    }
  }

  extractRegistrationId(xmlData) {
    const match = xmlData.match(/DomainID="([^"]+)"/);
    return match ? match[1] : null;
  }
}

module.exports = new NamecheapService();
