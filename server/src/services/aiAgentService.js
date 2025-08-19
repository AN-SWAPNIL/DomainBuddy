const { GoogleGenerativeAI } = require('@google/generative-ai');
const namecheapService = require("./namecheapService");
const supabase = require("../config/database");

class AIAgentService {
  constructor() {
    console.log('🔧 AIAgentService constructor called');
    this.genAI = null;
    this.model = null;
    this.initializeModel();
  }

  async initializeModel() {
    try {
      console.log('🤖 Initializing Gemini AI model...');
      
      if (!process.env.GOOGLE_API_KEY) {
        console.warn("⚠️ GOOGLE_API_KEY not found in environment variables. AI features will be limited.");
        return false;
      }

      console.log('📋 Google API Key found, length:', process.env.GOOGLE_API_KEY.length);

      // Initialize Google Generative AI
      this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      console.log('✅ Gemini AI model initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI model:', error.message);
      this.genAI = null;
      this.model = null;
      return false;
    }
  }

  async processUserMessage(message, userId = null) {
    try {
      console.log(`🔍 Processing user message: "${message}"`);

      // If AI model is not available, use fallback
      if (!this.model) {
        console.log("⚠️ AI model not available, using fallback response");
        return this.getFallbackResponse(message);
      }

      // Create a prompt for the AI
      const prompt = `
You are a helpful AI assistant for DomainBuddy, a domain registration service.
Analyze the user's message and provide a JSON response with the following structure:

{
  "intent": "domain_search" | "domain_purchase" | "domain_info" | "general_help",
  "message": "A helpful response to the user",
  "action": "search_domains" | "creative_search" | "purchase_domain" | "check_domain" | "none",
  "domain": "specific domain name if mentioned (only if user specifies full domain with extension)",
  "searchTerms": ["array", "of", "search", "terms", "without", "extensions"],
  "isCreativeRequest": true | false
}

IMPORTANT RULES:
1. If user mentions a COMPLETE domain name with extension (like "doggy.com", "example.net"), use "check_domain" action and put the full domain in "domain" field
2. If user asks for CREATIVE domain suggestions or mentions a business idea/concept, use "creative_search" action and set "isCreativeRequest": true
3. If user asks to search for SPECIFIC terms (like "domainbuddy", "google"), use "search_domains" action with "isCreativeRequest": false
4. Never add extensions to search terms - extract only the root keywords
5. For both actions, we will check multiple extensions (.com, .net, .org, .io, .co)

CREATIVE vs SPECIFIC SEARCH:
- Creative: "suggest domains for live location tracker device", "domains for my restaurant", "creative names for tech startup"
- Specific: "search for domainbuddy", "check availability of google", "find exact domain bitcoin"

Examples:
- "Check doggy.com" → action: "check_domain", domain: "doggy.com"
- "Search for domainbuddy" → action: "search_domains", searchTerms: ["domainbuddy"], isCreativeRequest: false
- "Suggest domains for live location tracker device" → action: "creative_search", searchTerms: ["live", "location", "tracker", "device"], isCreativeRequest: true
- "Creative domains for my restaurant" → action: "creative_search", searchTerms: ["restaurant"], isCreativeRequest: true

User message: "${message}"

Respond with ONLY the JSON object, no additional text.
`;

      // Generate response using Gemini
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log("🤖 AI Response:", text);

      // Parse the JSON response (remove markdown code blocks if present)
      let aiResponse;
      try {
        let jsonText = text.trim();
        // Remove markdown code blocks
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        aiResponse = JSON.parse(jsonText);
      } catch (parseError) {
        console.warn("⚠️ Failed to parse AI response, using fallback");
        return this.getFallbackResponse(message);
      }

      // Execute the action if needed
      if (aiResponse.action && aiResponse.action !== "none") {
        const actionResult = await this.executeAction(aiResponse, userId);
        if (actionResult) {
          aiResponse.domains = actionResult.domains;
          aiResponse.message = actionResult.message || aiResponse.message;
        }
      }

      // Save conversation to database if userId is provided
      if (userId) {
        await this.saveConversation(userId, message, aiResponse);
      }

      return aiResponse;
    } catch (error) {
      console.error("❌ Error processing user message:", error);
      return this.getFallbackResponse(message);
    }
  }

  async executeAction(aiResponse, userId) {
    try {
      switch (aiResponse.action) {
        case "search_domains":
          if (aiResponse.searchTerms && aiResponse.searchTerms.length > 0) {
            const searchResults = await this.searchDomains(aiResponse.searchTerms, null, false);
            return {
              domains: searchResults,
              message: `I found ${searchResults.length} domains for your search.`
            };
          }
          break;

        case "creative_search":
          if (aiResponse.searchTerms && aiResponse.searchTerms.length > 0) {
            const creativeDomains = await this.generateCreativeDomains(aiResponse.searchTerms);
            return {
              domains: creativeDomains,
              message: `I found ${creativeDomains.length} creative domain suggestions for you.`
            };
          }
          break;

        case "check_domain":
          if (aiResponse.domain) {
            // Use specific domain search for exact domain checks
            const searchResults = await this.searchDomains(null, aiResponse.domain);
            return {
              domains: searchResults,
              message: `Here's the information for ${aiResponse.domain}.`
            };
          }
          break;

        case "purchase_domain":
          if (aiResponse.domain && userId) {
            // This would require payment processing
            return {
              message: `To purchase ${aiResponse.domain}, please proceed to the payment page.`
            };
          }
          break;

        default:
          return null;
      }
    } catch (error) {
      console.error("❌ Error executing action:", error);
      return null;
    }
  }

  async searchDomains(searchTerms, specificDomain = null) {
    try {
      const domains = [];
      
      // If a specific domain is provided (e.g., "doggy.com"), check only that domain
      if (specificDomain) {
        console.log(`🎯 Checking specific domain: ${specificDomain}`);
        try {
          const availability = await namecheapService.checkDomainAvailability(specificDomain);
          domains.push({
            name: specificDomain,
            available: availability.available,
            price: availability.price || 12.99
          });
        } catch (error) {
          console.warn(`⚠️ Failed to check domain ${specificDomain}:`, error.message);
          domains.push({
            name: specificDomain,
            available: false,
            price: 12.99
          });
        }
        return domains;
      }
      
      // Generate domain variations for search terms
      const extensions = ['.com', '.net', '.org', '.io', '.co']; // Include .org
      
      for (const term of searchTerms.slice(0, 2)) { // Limit to 2 terms to avoid too many requests
        for (const ext of extensions) { // Use all extensions, not just first 2
          const domainName = `${term.toLowerCase()}${ext}`;
          try {
            const availability = await namecheapService.checkDomainAvailability(domainName);
            domains.push({
              name: domainName,
              available: availability.available,
              price: availability.price || 12.99
            });
          } catch (error) {
            console.warn(`⚠️ Failed to check domain ${domainName}:`, error.message);
            // Add domain with fallback data
            domains.push({
              name: domainName,
              available: Math.random() > 0.5, // Random for demo
              price: 12.99
            });
          }
        }
      }

      return domains;
    } catch (error) {
      console.error("❌ Error searching domains:", error);
      return [];
    }
  }

  async generateCreativeDomains(searchTerms) {
    try {
      console.log(`🎨 Generating creative domains for: ${searchTerms.join(', ')}`);
      
      // Use AI to generate creative domain names
      if (!this.model) {
        console.log("⚠️ AI model not available for creative generation");
        return await this.searchDomains(searchTerms, null, false); // Fallback to regular search
      }

      const creativePrompt = `
Generate 10 creative, brandable domain names for a business related to: ${searchTerms.join(', ')}

Requirements:
- Names should be catchy, memorable, and brandable
- Mix of real words, made-up words, and combinations
- Suitable for a professional business
- No extensions - just the domain name part
- Each name should be 3-15 characters long
- Avoid exact keyword matches

Examples for "live location tracker device":
- TrackSpot, LivePin, LocateNow, SpotSync, PinPoint, TrackWave, LiveMap, GeoSpot, PositionIQ, TrackPro

Respond with ONLY a JSON array of strings: ["domain1", "domain2", "domain3", ...]
`;

      try {
        const result = await this.model.generateContent(creativePrompt);
        const response = await result.response;
        const text = response.text().trim();
        
        console.log("🎨 Creative AI Response:", text);
        
        // Parse the creative domain names
        let creativeNames;
        try {
          let jsonText = text;
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          creativeNames = JSON.parse(jsonText);
        } catch (parseError) {
          console.warn("⚠️ Failed to parse creative domains, using fallback");
          // Generate some basic creative combinations as fallback
          creativeNames = this.generateFallbackCreativeNames(searchTerms);
        }

        if (!Array.isArray(creativeNames)) {
          console.warn("⚠️ Creative response not an array, using fallback");
          creativeNames = this.generateFallbackCreativeNames(searchTerms);
        }

        // Check availability for creative domain names
        const domains = [];
        const extensions = ['.com', '.net', '.org', '.io', '.co'];
        
        // Limit to first 8 creative names to avoid too many API calls
        for (const creativeName of creativeNames.slice(0, 8)) {
          if (typeof creativeName === 'string' && creativeName.length > 0) {
            for (const ext of extensions.slice(0, 3)) { // Check first 3 extensions for each creative name
              const domainName = `${creativeName.toLowerCase()}${ext}`;
              try {
                const availability = await namecheapService.checkDomainAvailability(domainName);
                domains.push({
                  name: domainName,
                  available: availability.available,
                  price: availability.price || 12.99
                });
                
                // If we have enough domains, break early
                if (domains.length >= 10) break;
              } catch (error) {
                console.warn(`⚠️ Failed to check creative domain ${domainName}:`, error.message);
                domains.push({
                  name: domainName,
                  available: Math.random() > 0.5,
                  price: 12.99
                });
              }
            }
            if (domains.length >= 10) break;
          }
        }

        return domains.slice(0, 10); // Return max 10 domains
        
      } catch (aiError) {
        console.warn("⚠️ AI creative generation failed:", aiError.message);
        return this.generateFallbackCreativeNames(searchTerms);
      }

    } catch (error) {
      console.error("❌ Error generating creative domains:", error);
      return this.generateFallbackCreativeNames(searchTerms);
    }
  }

  generateFallbackCreativeNames(searchTerms) {
    console.log("🔄 Using fallback creative domain generation");
    
    // Simple fallback: combine terms and add creative suffixes
    const creativeSuffixes = ['spot', 'hub', 'pro', 'zone', 'lab', 'wave', 'sync', 'now', 'go', 'kit'];
    const creativePrefixes = ['my', 'get', 'smart', 'quick', 'easy', 'super', 'prime', 'next', 'live', 'auto'];
    
    const creativeNames = [];
    const baseTerms = searchTerms.slice(0, 2); // Use first 2 terms
    
    // Combine base terms with suffixes
    for (const term of baseTerms) {
      for (const suffix of creativeSuffixes.slice(0, 3)) {
        creativeNames.push(`${term.toLowerCase()}${suffix}`);
      }
    }
    
    // Combine prefixes with base terms
    for (const term of baseTerms) {
      for (const prefix of creativePrefixes.slice(0, 2)) {
        creativeNames.push(`${prefix}${term.toLowerCase()}`);
      }
    }
    
    return creativeNames.slice(0, 8); // Return max 8 fallback names
  }

  async checkDomain(domainName) {
    try {
      const availability = await namecheapService.checkDomainAvailability(domainName);
      return {
        name: domainName,
        available: availability.available,
        price: availability.price || 12.99
      };
    } catch (error) {
      console.warn(`⚠️ Failed to check domain ${domainName}:`, error.message);
      return {
        name: domainName,
        available: false,
        price: 12.99
      };
    }
  }

  getFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Check if message contains a complete domain name pattern first
    const domainPattern = /([a-zA-Z0-9-]+\.(com|net|org|io|co|xyz|tech|online|store|site|app|dev))/gi;
    const domainMatches = message.match(domainPattern);
    
    if (domainMatches && domainMatches.length > 0) {
      return {
        intent: "domain_info",
        message: `I'll check the availability of ${domainMatches[0]}`,
        action: "check_domain",
        domain: domainMatches[0].toLowerCase()
      };
    }
    
    if (lowerMessage.includes('domain') && (lowerMessage.includes('search') || lowerMessage.includes('find'))) {
      // Extract potential domain names or keywords (remove common words and extensions)
      const words = message.split(' ').filter(word => {
        const cleanWord = word.replace(/[.,!?]/g, '').toLowerCase();
        return cleanWord.length > 2 && 
               !['the', 'and', 'for', 'search', 'find', 'domain', 'want', 'need', 'domains', 'com', 'net', 'org', 'io', 'co'].includes(cleanWord) &&
               !cleanWord.startsWith('.'); // Remove extensions like .com
      });

      return {
        intent: "domain_search",
        message: `I'll search for domains related to: ${words.join(', ')}`,
        action: "search_domains",
        searchTerms: words.slice(0, 3) // Limit to 3 terms
      };
    }

    if (lowerMessage.includes('buy') || lowerMessage.includes('purchase')) {
      return {
        intent: "domain_purchase",
        message: "I can help you purchase a domain. Please specify which domain you'd like to buy.",
        action: "none"
      };
    }

    return {
      intent: "general_help",
      message: "I'm here to help you with domain searches, purchases, and information. You can ask me to search for domains, check availability, or help with purchasing.",
      action: "none"
    };
  }

  async saveConversation(userId, userMessage, aiResponse) {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: userId,
          user_message: userMessage,
          ai_response: JSON.stringify(aiResponse),
          intent: aiResponse.intent,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.warn("⚠️ Failed to save conversation:", error.message);
      }
    } catch (error) {
      console.warn("⚠️ Error saving conversation:", error.message);
    }
  }

  async getDomainSuggestions(keyword, userId = null) {
    try {
      console.log(`🔍 Generating domain suggestions for: "${keyword}"`);

      if (!this.model) {
        console.log("⚠️ AI model not available, using fallback suggestions");
        return this.getFallbackSuggestions(keyword);
      }

      const prompt = `
Generate 6 creative domain name suggestions for the keyword "${keyword}".
Consider variations like:
- Adding prefixes/suffixes (my, get, the, pro, hub, zone, etc.)
- Combining with related words
- Using different extensions (.com, .net, .io, .co)

Respond with ONLY a JSON array of domain names:
["domain1.com", "domain2.net", "domain3.io", "domain4.co", "domain5.com", "domain6.org"]
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      let suggestions;
      try {
        suggestions = JSON.parse(text);
      } catch (parseError) {
        console.warn("⚠️ Failed to parse AI suggestions, using fallback");
        suggestions = this.getFallbackSuggestions(keyword);
      }

      // Check availability for each suggestion
      const checkedSuggestions = [];
      for (const domain of suggestions) {
        try {
          const availability = await namecheapService.checkDomainAvailability(domain);
          checkedSuggestions.push({
            name: domain,
            available: availability.available,
            price: availability.price || 12.99
          });
        } catch (error) {
          console.warn(`⚠️ Failed to check ${domain}:`, error.message);
          checkedSuggestions.push({
            name: domain,
            available: Math.random() > 0.5,
            price: 12.99
          });
        }
      }

      return checkedSuggestions;
    } catch (error) {
      console.error("❌ Error generating domain suggestions:", error);
      return this.getFallbackSuggestions(keyword);
    }
  }

  getFallbackSuggestions(keyword) {
    const prefixes = ['my', 'get', 'the', 'pro', 'best'];
    const suffixes = ['hub', 'zone', 'pro', 'online', 'store'];
    const extensions = ['.com', '.net', '.io', '.co', '.org', '.online'];

    const suggestions = [];
    
    // Add direct keyword with different extensions
    extensions.slice(0, 2).forEach(ext => {
      suggestions.push(`${keyword}${ext}`);
    });

    // Add prefix combinations
    prefixes.slice(0, 2).forEach(prefix => {
      suggestions.push(`${prefix}${keyword}.com`);
    });

    // Add suffix combinations
    suffixes.slice(0, 2).forEach(suffix => {
      suggestions.push(`${keyword}${suffix}.com`);
    });

    return suggestions.map(domain => ({
      name: domain,
      available: Math.random() > 0.5, // Random for demo
      price: 12.99
    }));
  }
}

console.log('📁 About to create AIAgentService instance...');
const aiAgentService = new AIAgentService();
console.log('✅ AIAgentService instance created');

module.exports = aiAgentService;
