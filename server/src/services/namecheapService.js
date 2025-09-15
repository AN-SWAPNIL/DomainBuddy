const axios = require("axios");
const { parseString } = require("xml2js");
const supabase = require("../config/database.js");
const dns = require('dns').promises;

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
      const availabilityResponse = await axios.get(this.baseUrl, {
        params: availabilityParams,
      });

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
      const availabilityResult = await this.parseXmlResponse(
        availabilityResponse.data
      );
      const domainResult = this.extractDomainInfo(
        availabilityResult,
        domainName
      );
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
          const extension = domainName.split(".").pop().toLowerCase();

          console.log(`Getting pricing for extension: ${extension}`);

          const pricingParams = {
            ApiUser: this.apiUser,
            ApiKey: this.apiKey,
            UserName: this.apiUser,
            Command: "namecheap.users.getPricing",
            ClientIp: clientIp,
            ProductType: "DOMAIN",
            ProductName: extension.toUpperCase(),
            ActionName: "REGISTER",
          };

          const pricingResponse = await axios.get(this.baseUrl, {
            params: pricingParams,
          });
          console.log("Pricing API response:", pricingResponse.data);

          // Check for pricing API errors
          if (pricingResponse.data.includes('Status="ERROR"')) {
            console.warn("Pricing API returned error, using default price");
            finalPrice = this.getDefaultPrice(domainName);
          } else {
            // Parse pricing response
            const pricingResult = await this.parseXmlResponse(
              pricingResponse.data
            );
            const extractedPrice = this.extractPricingForOneYear(
              pricingResult,
              extension
            );

            if (extractedPrice !== null) {
              finalPrice = extractedPrice;
              console.log(
                `Got pricing from API: $${finalPrice} for ${extension}`
              );
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
      console.log("🚀 Starting domain registration process for:", domainName);

      // Validate contact information first
      const validationErrors = this.validateContactInfo(contactInfo);
      if (validationErrors.length > 0) {
        throw new Error(
          `Contact validation failed: ${validationErrors.join(", ")}`
        );
      }

      // Format phone number for Namecheap API
      const formattedPhone = this.formatPhoneForNamecheap(
        contactInfo.phone,
        contactInfo.country
      );

      console.log("📋 Registration details:", {
        domain: domainName,
        years: years,
        contact: {
          name: `${contactInfo.firstName} ${contactInfo.lastName}`,
          email: contactInfo.email,
          originalPhone: contactInfo.phone,
          formattedPhone: formattedPhone,
          country: contactInfo.country,
          address: `${contactInfo.address}, ${contactInfo.city}, ${contactInfo.state} ${contactInfo.postalCode}, ${contactInfo.country}`,
        },
      });

      // Use environment IP or detect current IP
      const clientIp = this.clientIp || (await this.getCurrentIP());
      console.log("🌐 Using client IP for registration:", clientIp);

      const params = {
        ApiUser: this.apiUser,
        ApiKey: this.apiKey,
        UserName: this.apiUser,
        Command: "namecheap.domains.create",
        ClientIp: clientIp,
        DomainName: domainName,
        Years: years,
        // Contact information parameters with formatted phone
        RegistrantFirstName: contactInfo.firstName,
        RegistrantLastName: contactInfo.lastName,
        RegistrantAddress1: contactInfo.address,
        RegistrantCity: contactInfo.city,
        RegistrantStateProvince: contactInfo.state,
        RegistrantPostalCode: contactInfo.postalCode,
        RegistrantCountry: contactInfo.country,
        RegistrantPhone: formattedPhone, // Use formatted phone
        RegistrantEmailAddress: contactInfo.email,
        // Copy registrant info to other contact types
        TechFirstName: contactInfo.firstName,
        TechLastName: contactInfo.lastName,
        TechAddress1: contactInfo.address,
        TechCity: contactInfo.city,
        TechStateProvince: contactInfo.state,
        TechPostalCode: contactInfo.postalCode,
        TechCountry: contactInfo.country,
        TechPhone: formattedPhone, // Use formatted phone
        TechEmailAddress: contactInfo.email,
        AdminFirstName: contactInfo.firstName,
        AdminLastName: contactInfo.lastName,
        AdminAddress1: contactInfo.address,
        AdminCity: contactInfo.city,
        AdminStateProvince: contactInfo.state,
        AdminPostalCode: contactInfo.postalCode,
        AdminCountry: contactInfo.country,
        AdminPhone: formattedPhone, // Use formatted phone
        AdminEmailAddress: contactInfo.email,
        AuxBillingFirstName: contactInfo.firstName,
        AuxBillingLastName: contactInfo.lastName,
        AuxBillingAddress1: contactInfo.address,
        AuxBillingCity: contactInfo.city,
        AuxBillingStateProvince: contactInfo.state,
        AuxBillingPostalCode: contactInfo.postalCode,
        AuxBillingCountry: contactInfo.country,
        AuxBillingPhone: formattedPhone, // Use formatted phone
        AuxBillingEmailAddress: contactInfo.email,
      };

      console.log("📤 Sending registration request to Namecheap API...");
      console.log("📞 Phone number being sent to API:", formattedPhone);
      const response = await axios.get(this.baseUrl, { params });

      console.log("📥 Received response from Namecheap API");
      console.log("Response data:", response.data);

      // Parse response for success/failure
      const success = response.data.includes('Status="OK"');

      if (success) {
        const registrationId = this.extractRegistrationId(response.data);
        console.log("✅ DOMAIN REGISTRATION SUCCESSFUL!");
        console.log("🎉 Registration details:", {
          domain: domainName,
          registrationId: registrationId,
          years: years,
          registrant: `${contactInfo.firstName} ${contactInfo.lastName}`,
          email: contactInfo.email,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          domain: domainName,
          registrationId: registrationId,
        };
      } else {
        // Extract detailed error information from XML response
        console.error("❌ Domain registration failed");
        console.error("Full API response:", response.data);

        // Try to extract specific error message
        const errorMatch = response.data.match(
          /<Error Number="(\d+)">([^<]+)<\/Error>/
        );
        if (errorMatch) {
          const errorNumber = errorMatch[1];
          const errorMessage = errorMatch[2];
          console.error(`🚫 Namecheap Error ${errorNumber}: ${errorMessage}`);

          // Provide specific guidance for common errors
          if (errorNumber === "2030280") {
            console.error(
              "💳 This error usually indicates insufficient account balance or payment issues"
            );
          } else if (errorNumber === "2011154") {
            console.error("🌐 Domain is not available for registration");
          } else if (errorNumber === "1011150") {
            console.error("🔒 IP address not whitelisted for API access");
          } else if (errorNumber === "2011166") {
            console.error("📧 Invalid contact information provided");
          }

          throw new Error(
            `Namecheap Registration Error ${errorNumber}: ${errorMessage}`
          );
        }

        throw new Error(
          "Domain registration failed - check Namecheap response above"
        );
      }
    } catch (error) {
      console.error("💥 DOMAIN REGISTRATION ERROR:");
      console.error("Domain:", domainName);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      // If it's an axios error, log more details
      if (error.response) {
        console.error("HTTP Status:", error.response.status);
        console.error("Response data:", error.response.data);
        console.error("Response headers:", error.response.headers);
      } else if (error.request) {
        console.error("No response received from Namecheap API");
        console.error("Request details:", error.request);
      }

      throw new Error(
        `Failed to register domain ${domainName}: ${error.message}`
      );
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
    // Comprehensive pricing based on TLD - similar to Namecheap pricing structure
    console.log("Getting default price for domain:", domainName);

    const tld = domainName.split(".").pop().toLowerCase();
    const defaultPrices = {
      // Popular extensions
      com: 12.99,
      net: 13.99,
      org: 13.99,
      io: 49.99,
      co: 24.99,
      
      // Business & professional
      biz: 13.99,
      info: 11.99,
      pro: 18.99,
      name: 9.99,
      mobi: 19.99,
      
      // Modern & tech extensions
      ai: 99.99,
      app: 18.99,
      dev: 12.99,
      tech: 49.99,
      online: 39.99,
      site: 29.99,
      store: 59.99,
      shop: 39.99,
      
      // Geographic & country codes
      us: 8.99,
      uk: 8.99,
      ca: 14.99,
      au: 13.99,
      de: 8.99,
      fr: 8.99,
      it: 29.99,
      es: 8.99,
      nl: 9.99,
      
      // Creative & media
      design: 49.99,
      art: 14.99,
      photo: 29.99,
      video: 24.99,
      music: 14.99,
      blog: 29.99,
      news: 24.99,
      
      // Industry specific
      agency: 24.99,
      consulting: 34.99,
      marketing: 34.99,
      finance: 54.99,
      legal: 54.99,
      health: 79.99,
      
      // Newer popular extensions
      xyz: 13.99,
      top: 9.99,
      click: 9.99,
      link: 9.99,
      download: 24.99,
      email: 54.99,
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
              console.log(
                `Found ${products.length} products in register category`
              );

              // Find the product matching our extension
              for (const product of products) {
                const productName = product.$.Name.toLowerCase();
                console.log(
                  `Checking product: ${productName} against ${extension.toLowerCase()}`
                );

                if (productName === extension.toLowerCase()) {
                  const prices = product.Price || [];
                  console.log(
                    `Found ${prices.length} price entries for ${extension}`
                  );

                  // Look for 1-year pricing
                  for (const price of prices) {
                    const duration = price.$.Duration;
                    const durationType = price.$.DurationType;
                    console.log(
                      `Checking price: Duration=${duration}, DurationType=${durationType}`
                    );

                    if (
                      duration === "1" &&
                      durationType.toLowerCase() === "year"
                    ) {
                      const priceValue = parseFloat(price.$.Price);
                      const additionalCost =
                        parseFloat(price.$.AdditionalCost) || 0;
                      const totalPrice = priceValue + additionalCost;

                      console.log(
                        `Found 1-year price for ${extension}: $${priceValue} + $${additionalCost} = $${totalPrice}`
                      );
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
    console.log("🔍 Extracting registration ID from response...");
    const match = xmlData.match(/DomainID="([^"]+)"/);
    if (match) {
      const registrationId = match[1];
      console.log("✅ Found registration ID:", registrationId);
      return registrationId;
    } else {
      console.warn("⚠️  Could not extract registration ID from response");
      console.log("XML data for debugging:", xmlData);
      return null;
    }
  }

  // Format phone number for Namecheap API requirements
  formatPhoneForNamecheap(phone, country) {
    if (!phone) {
      console.warn("⚠️ No phone number provided, using default");
      return "+1.1234567890"; // Default fallback
    }

    // Comprehensive country code mappings based on Profile page options
    const countryPhoneCodes = {
      US: "+1", // United States
      CA: "+1", // Canada
      GB: "+44", // United Kingdom
      AU: "+61", // Australia
      DE: "+49", // Germany
      FR: "+33", // France
      IN: "+91", // India
      JP: "+81", // Japan
      CN: "+86", // China
      BR: "+55", // Brazil
      MX: "+52", // Mexico
      IT: "+39", // Italy
      ES: "+34", // Spain
      NL: "+31", // Netherlands
      SE: "+46", // Sweden
      NO: "+47", // Norway
      DK: "+45", // Denmark
      FI: "+358", // Finland
    };

    // Remove all non-digit characters except +
    let cleanPhone = phone.replace(/[^\d+]/g, "");

    console.log("📞 Formatting phone:", {
      original: phone,
      cleaned: cleanPhone,
      country: country,
    });

    // If phone doesn't start with +, add country code
    if (!cleanPhone.startsWith("+")) {
      const countryCode = countryPhoneCodes[country?.toUpperCase()];
      if (countryCode) {
        cleanPhone = countryCode + cleanPhone;
        console.log(
          `📞 Added country code ${countryCode} for ${country}: ${cleanPhone}`
        );
      } else {
        console.warn(
          `⚠️ Unknown country code for ${country}, using +1 (US) as default`
        );
        cleanPhone = "+1" + cleanPhone;
      }
    }

    // Convert to Namecheap format: +CountryCode.PhoneNumber
    const match = cleanPhone.match(/^(\+\d{1,3})(\d+)$/);
    if (match) {
      const formattedPhone = `${match[1]}.${match[2]}`;
      console.log(
        `✅ Successfully formatted phone: ${phone} → ${formattedPhone} for country: ${country}`
      );
      return formattedPhone;
    }

    // Fallback if parsing fails
    console.warn("⚠️ Could not format phone number, using fallback:", phone);
    const fallbackCountryCode =
      countryPhoneCodes[country?.toUpperCase()] || "+1";
    return `${fallbackCountryCode}.1234567890`;
  }

  // Validate contact information before registration
  validateContactInfo(contactInfo) {
    const errors = [];

    console.log("🔍 Validating contact information:", contactInfo);

    // Validate phone number
    if (!contactInfo.phone || contactInfo.phone.length < 7) {
      errors.push("Phone number is required and must be at least 7 digits");
    }

    // Validate country code
    const supportedCountries = [
      "US",
      "CA",
      "GB",
      "AU",
      "DE",
      "FR",
      "IN",
      "JP",
      "CN",
      "BR",
      "MX",
      "IT",
      "ES",
      "NL",
      "SE",
      "NO",
      "DK",
      "FI",
    ];
    if (
      !contactInfo.country ||
      !supportedCountries.includes(contactInfo.country.toUpperCase())
    ) {
      errors.push(`Country must be one of: ${supportedCountries.join(", ")}`);
    }

    // Validate required fields
    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "address",
      "city",
      "state",
      "postalCode",
    ];
    for (const field of requiredFields) {
      if (!contactInfo[field] || contactInfo[field].trim() === "") {
        errors.push(`${field} is required`);
      }
    }

    if (errors.length > 0) {
      console.error("❌ Contact validation errors:", errors);
    } else {
      console.log("✅ Contact information validation passed");
    }

    return errors;
  }

  // DNS Management Methods for Subdomain Creation

  // Create a DNS record (A, CNAME, etc.)
  async createDnsRecord(domainName, host, recordType, value, ttl = 3600) {
    try {
      console.log(`🌐 Creating DNS record: ${host}.${domainName} (${recordType}) -> ${value}`);
      
      // Split domain into SLD and TLD
      const parts = domainName.split('.');
      const tld = parts.pop();
      const sld = parts.join('.');
      
      // Use environment IP or detect current IP
      const clientIp = this.clientIp || (await this.getCurrentIP());

      // First, get current host records
      const getHostsParams = {
        ApiUser: this.apiUser,
        ApiKey: this.apiKey,
        UserName: this.apiUser,
        Command: "namecheap.domains.dns.getHosts",
        ClientIp: clientIp,
        SLD: sld,
        TLD: tld
      };

      console.log(`📋 Getting current DNS records for ${sld}.${tld}`);
      const hostsResponse = await axios.get(this.baseUrl, {
        params: getHostsParams,
        timeout: 30000
      });

      // Parse the XML response
      const hostsResult = await this.parseXmlResponse(hostsResponse.data);
      
      // Check for errors in the response
      if (!hostsResult?.ApiResponse?.CommandResponse?.[0]?.DomainDNSGetHostsResult?.[0]) {
        console.error("❌ Failed to get current DNS records");
        return { success: false, message: "Failed to get current DNS records" };
      }

      const currentHosts = hostsResult.ApiResponse.CommandResponse[0].DomainDNSGetHostsResult[0].host || [];
      
      // Check if record already exists
      const existingRecord = currentHosts.find(record => 
        record.$.Name === host && record.$.Type === recordType
      );

      if (existingRecord) {
        console.log(`⚠️ DNS record ${host} already exists with type ${recordType}`);
        return { success: false, message: "DNS record already exists" };
      }

      // Prepare the new host record
      const newHost = {
        HostName: host,
        RecordType: recordType,
        Address: value,
        TTL: ttl,
        MXPref: recordType === 'MX' ? 10 : 0
      };

      // Add the new record to the current hosts
      const hosts = currentHosts.map(record => ({
        HostName: record.$.Name,
        RecordType: record.$.Type,
        Address: record.$.Address,
        TTL: record.$.TTL,
        MXPref: record.$.MXPref || 0
      }));

      hosts.push(newHost);

      // Build parameters for setHosts
      const setHostsParams = {
        ApiUser: this.apiUser,
        ApiKey: this.apiKey,
        UserName: this.apiUser,
        Command: "namecheap.domains.dns.setHosts",
        ClientIp: clientIp,
        SLD: sld,
        TLD: tld
      };

      // Add host records to params
      hosts.forEach((host, index) => {
        setHostsParams[`HostName${index+1}`] = host.HostName;
        setHostsParams[`RecordType${index+1}`] = host.RecordType;
        setHostsParams[`Address${index+1}`] = host.Address;
        setHostsParams[`TTL${index+1}`] = host.TTL;
        if (host.RecordType === 'MX') {
          setHostsParams[`MXPref${index+1}`] = host.MXPref;
        }
      });

      console.log(`📝 Setting DNS records for ${sld}.${tld}`);
      const setHostsResponse = await axios.get(this.baseUrl, {
        params: setHostsParams,
        timeout: 30000
      });

      // Parse the XML response
      const setHostsResult = await this.parseXmlResponse(setHostsResponse.data);
      
      // Check for success in the response
      if (setHostsResult?.ApiResponse?.$ && setHostsResult.ApiResponse.$.Status === "OK") {
        console.log(`✅ Successfully created DNS record: ${host}.${domainName}`);
        return { success: true };
      } else {
        console.error("❌ Failed to create DNS record");
        return { success: false, message: "Failed to create DNS record" };
      }
    } catch (error) {
      console.error("❌ Error creating DNS record:", error);
      return { 
        success: false, 
        message: error.message || "An error occurred while creating the DNS record" 
      };
    }
  }

  // Delete a DNS record
  async deleteDnsRecord(domainName, host, recordType) {
    try {
      console.log(`🗑️ Deleting DNS record: ${host}.${domainName} (${recordType})`);
      
      // Split domain into SLD and TLD
      const parts = domainName.split('.');
      const tld = parts.pop();
      const sld = parts.join('.');
      
      // Use environment IP or detect current IP
      const clientIp = this.clientIp || (await this.getCurrentIP());

      // First, get current host records
      const getHostsParams = {
        ApiUser: this.apiUser,
        ApiKey: this.apiKey,
        UserName: this.apiUser,
        Command: "namecheap.domains.dns.getHosts",
        ClientIp: clientIp,
        SLD: sld,
        TLD: tld
      };

      console.log(`📋 Getting current DNS records for ${sld}.${tld}`);
      const hostsResponse = await axios.get(this.baseUrl, {
        params: getHostsParams,
        timeout: 30000
      });

      // Parse the XML response
      const hostsResult = await this.parseXmlResponse(hostsResponse.data);
      
      // Check for errors in the response
      if (!hostsResult?.ApiResponse?.CommandResponse?.[0]?.DomainDNSGetHostsResult?.[0]) {
        console.error("❌ Failed to get current DNS records");
        return { success: false, message: "Failed to get current DNS records" };
      }

      const currentHosts = hostsResult.ApiResponse.CommandResponse[0].DomainDNSGetHostsResult[0].host || [];
      
      // Filter out the record we want to delete
      const filteredHosts = currentHosts.filter(record => 
        !(record.$.Name === host && record.$.Type === recordType)
      );
      
      // If no records were removed, the record didn't exist
      if (filteredHosts.length === currentHosts.length) {
        console.log(`⚠️ DNS record ${host} with type ${recordType} not found`);
        return { success: true, message: "DNS record not found" };
      }

      // Prepare hosts for setHosts call
      const hosts = filteredHosts.map(record => ({
        HostName: record.$.Name,
        RecordType: record.$.Type,
        Address: record.$.Address,
        TTL: record.$.TTL,
        MXPref: record.$.MXPref || 0
      }));

      // Build parameters for setHosts
      const setHostsParams = {
        ApiUser: this.apiUser,
        ApiKey: this.apiKey,
        UserName: this.apiUser,
        Command: "namecheap.domains.dns.setHosts",
        ClientIp: clientIp,
        SLD: sld,
        TLD: tld
      };

      // Add host records to params
      hosts.forEach((host, index) => {
        setHostsParams[`HostName${index+1}`] = host.HostName;
        setHostsParams[`RecordType${index+1}`] = host.RecordType;
        setHostsParams[`Address${index+1}`] = host.Address;
        setHostsParams[`TTL${index+1}`] = host.TTL;
        if (host.RecordType === 'MX') {
          setHostsParams[`MXPref${index+1}`] = host.MXPref;
        }
      });

      console.log(`📝 Updating DNS records for ${sld}.${tld} (removing ${host})`);
      const setHostsResponse = await axios.get(this.baseUrl, {
        params: setHostsParams,
        timeout: 30000
      });

      // Parse the XML response
      const setHostsResult = await this.parseXmlResponse(setHostsResponse.data);
      
      // Check for success in the response
      if (setHostsResult?.ApiResponse?.$ && setHostsResult.ApiResponse.$.Status === "OK") {
        console.log(`✅ Successfully deleted DNS record: ${host}.${domainName}`);
        return { success: true };
      } else {
        console.error("❌ Failed to delete DNS record");
        return { success: false, message: "Failed to delete DNS record" };
      }
    } catch (error) {
      console.error("❌ Error deleting DNS record:", error);
      return { 
        success: false, 
        message: error.message || "An error occurred while deleting the DNS record" 
      };
    }
  }

  // Update a DNS record (delete old and create new)
  async updateDnsRecord(domainName, host, recordType, newValue, newTtl, oldValue) {
    try {
      console.log(`✏️ Updating DNS record: ${host}.${domainName} (${recordType}) ${oldValue} -> ${newValue}`);
      
      // First delete the old record
      const deleteResult = await this.deleteDnsRecord(domainName, host, recordType);
      if (!deleteResult.success) {
        return deleteResult;
      }
      
      // Then create a new one with updated values
      return await this.createDnsRecord(domainName, host, recordType, newValue, newTtl);
    } catch (error) {
      console.error("❌ Error updating DNS record:", error);
      return { 
        success: false, 
        message: error.message || "An error occurred while updating the DNS record" 
      };
    }
  }

  // Get all DNS records for a domain
  async getDnsRecords(domainName) {
    try {
      console.log(`📋 Getting DNS records for: ${domainName}`);
      
      // Split domain into SLD and TLD
      const parts = domainName.split('.');
      const tld = parts.pop();
      const sld = parts.join('.');
      
      // Use environment IP or detect current IP
      const clientIp = this.clientIp || (await this.getCurrentIP());

      // Get current host records
      const getHostsParams = {
        ApiUser: this.apiUser,
        ApiKey: this.apiKey,
        UserName: this.apiUser,
        Command: "namecheap.domains.dns.getHosts",
        ClientIp: clientIp,
        SLD: sld,
        TLD: tld
      };

      const hostsResponse = await axios.get(this.baseUrl, {
        params: getHostsParams,
        timeout: 30000
      });

      // Parse the XML response
      const hostsResult = await this.parseXmlResponse(hostsResponse.data);
      
      // Check for errors in the response
      if (!hostsResult?.ApiResponse?.CommandResponse?.[0]?.DomainDNSGetHostsResult?.[0]) {
        console.error("❌ Failed to get DNS records");
        return { success: false, message: "Failed to get DNS records" };
      }

      const currentHosts = hostsResult.ApiResponse.CommandResponse[0].DomainDNSGetHostsResult[0].host || [];
      
      // Format the response
      const records = currentHosts.map(record => ({
        name: record.$.Name,
        type: record.$.Type,
        address: record.$.Address,
        ttl: parseInt(record.$.TTL),
        mxPref: record.$.MXPref ? parseInt(record.$.MXPref) : undefined
      }));

      console.log(`✅ Found ${records.length} DNS records for ${domainName}`);
      return { success: true, records };
    } catch (error) {
      console.error("❌ Error getting DNS records:", error);
      return { 
        success: false, 
        message: error.message || "An error occurred while getting DNS records" 
      };
    }
  }

  // Check DNS propagation for a specific record
  async checkDnsPropagation(subdomain, domainName, recordType, expectedValue) {
    try {
      const fullDomain = subdomain ? `${subdomain}.${domainName}` : domainName;
      console.log(`🔍 Checking DNS propagation for: ${fullDomain} (${recordType}) expecting: ${expectedValue}`);
      
      let actualValue = null;
      let propagated = false;

      try {
        switch (recordType.toUpperCase()) {
          case 'A':
            const aRecords = await dns.resolve4(fullDomain);
            actualValue = aRecords[0];
            propagated = aRecords.includes(expectedValue);
            break;
            
          case 'AAAA':
            const aaaaRecords = await dns.resolve6(fullDomain);
            actualValue = aaaaRecords[0];
            propagated = aaaaRecords.includes(expectedValue);
            break;
            
          case 'CNAME':
            const cnameRecords = await dns.resolveCname(fullDomain);
            actualValue = cnameRecords[0];
            // CNAME records might have trailing dots
            const expectedClean = expectedValue.endsWith('.') ? expectedValue.slice(0, -1) : expectedValue;
            const actualClean = actualValue.endsWith('.') ? actualValue.slice(0, -1) : actualValue;
            propagated = actualClean === expectedClean;
            break;
            
          case 'MX':
            const mxRecords = await dns.resolveMx(fullDomain);
            actualValue = mxRecords.map(mx => `${mx.priority} ${mx.exchange}`).join(', ');
            propagated = mxRecords.some(mx => mx.exchange === expectedValue || mx.exchange === expectedValue + '.');
            break;
            
          case 'TXT':
            const txtRecords = await dns.resolveTxt(fullDomain);
            actualValue = txtRecords.map(txt => txt.join(' ')).join('; ');
            propagated = txtRecords.some(txt => txt.join(' ') === expectedValue);
            break;
            
          case 'NS':
            const nsRecords = await dns.resolveNs(fullDomain);
            actualValue = nsRecords.join(', ');
            propagated = nsRecords.includes(expectedValue) || nsRecords.includes(expectedValue + '.');
            break;
            
          default:
            console.warn(`⚠️ Unsupported record type for propagation check: ${recordType}`);
            return { 
              success: false, 
              propagated: false, 
              message: `Unsupported record type: ${recordType}` 
            };
        }

        console.log(`🔍 DNS propagation check result:`, {
          domain: fullDomain,
          recordType,
          expected: expectedValue,
          actual: actualValue,
          propagated
        });

        return {
          success: true,
          propagated,
          actualValue,
          expectedValue,
          recordType,
          domain: fullDomain
        };

      } catch (dnsError) {
        // DNS lookup failed - record probably not propagated yet
        console.log(`⏳ DNS lookup failed for ${fullDomain} (${recordType}): ${dnsError.message}`);
        return {
          success: true,
          propagated: false,
          actualValue: null,
          expectedValue,
          recordType,
          domain: fullDomain,
          error: dnsError.message
        };
      }

    } catch (error) {
      console.error("❌ Error checking DNS propagation:", error);
      return { 
        success: false, 
        message: error.message || "An error occurred while checking DNS propagation" 
      };
    }
  }

  // Check propagation with retry logic
  async checkDnsPropagationWithRetry(subdomain, domainName, recordType, expectedValue, maxRetries = 10, delay = 30000) {
    console.log(`🔄 Starting DNS propagation check with retry for: ${subdomain}.${domainName}`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`⏱️ DNS propagation check attempt ${attempt}/${maxRetries}`);
      
      const result = await this.checkDnsPropagation(subdomain, domainName, recordType, expectedValue);
      
      if (result.success && result.propagated) {
        console.log(`✅ DNS propagated successfully on attempt ${attempt}`);
        return result;
      }
      
      if (attempt < maxRetries) {
        console.log(`⏳ DNS not propagated yet, waiting ${delay/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.log(`❌ DNS propagation failed after ${maxRetries} attempts`);
    return {
      success: true,
      propagated: false,
      attempts: maxRetries,
      message: `DNS propagation not confirmed after ${maxRetries} attempts`
    };
  }
}

module.exports = new NamecheapService();
