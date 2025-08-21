const { GoogleGenerativeAI } = require("@google/generative-ai");
const namecheapService = require("./namecheapService");
const supabase = require("../config/database");
const dotenv = require("dotenv");

dotenv.config();

class AIAgentService {
  constructor() {
    console.log("🔧 AIAgentService constructor called");
    this.genAI = null;
    this.model = null;
    this.initializeModel();
  }

  async initializeModel() {
    try {
      console.log("🤖 Initializing Gemini AI model...");

      if (!process.env.GOOGLE_API_KEY) {
        console.warn(
          "⚠️ GOOGLE_API_KEY not found in environment variables. AI features will be limited."
        );
        return false;
      }

      console.log(
        "📋 Google API Key found, length:",
        process.env.GOOGLE_API_KEY.length
      );

      // Initialize Google Generative AI
      this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      console.log("✅ Gemini AI model initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize Gemini AI model:", error.message);
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
4. If user wants to BUY/PURCHASE a specific domain, use "purchase_domain" action and put the full domain in "domain" field
5. Never add extensions to search terms - extract only the root keywords
6. For search actions, we will check multiple extensions (.com, .net, .org, .io, .co)

PURCHASE DETECTION:
- Look for words like: "buy", "purchase", "get", "register", "order", "take"
- Combined with domain names: "buy trackspot.com", "purchase the first domain", "I want to get livepin.com"
- Extract the specific domain name mentioned

CREATIVE vs SPECIFIC SEARCH:
- Creative: "suggest domains for live location tracker device", "domains for my restaurant", "creative names for tech startup"
- Specific: "search for domainbuddy", "check availability of google", "find exact domain bitcoin"

Examples:
- "Check doggy.com" → action: "check_domain", domain: "doggy.com"
- "Search for domainbuddy" → action: "search_domains", searchTerms: ["domainbuddy"], isCreativeRequest: false
- "Suggest domains for live location tracker device" → action: "creative_search", searchTerms: ["live", "location", "tracker", "device"], isCreativeRequest: true
- "Creative domains for my restaurant" → action: "creative_search", searchTerms: ["restaurant"], isCreativeRequest: true
- "Buy trackspot.com" → action: "purchase_domain", domain: "trackspot.com"
- "I want to purchase livepin.com" → action: "purchase_domain", domain: "livepin.com"

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
        if (jsonText.startsWith("```json")) {
          jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
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
            const searchResults = await this.searchDomains(
              aiResponse.searchTerms,
              null,
              false
            );
            return {
              domains: searchResults,
              message: `I found ${searchResults.length} domains for your search.`,
            };
          }
          break;

        case "creative_search":
          if (aiResponse.searchTerms && aiResponse.searchTerms.length > 0) {
            const creativeDomains = await this.generateCreativeDomains(
              aiResponse.searchTerms
            );
            return {
              domains: creativeDomains,
              message: `I found ${creativeDomains.length} creative domain suggestions for you.`,
            };
          }
          break;

        case "check_domain":
          if (aiResponse.domain) {
            // Use specific domain search for exact domain checks
            const searchResults = await this.searchDomains(
              null,
              aiResponse.domain
            );
            return {
              domains: searchResults,
              message: `Here's the information for ${aiResponse.domain}.`,
            };
          }
          break;

        case "purchase_domain":
          if (aiResponse.domain && userId) {
            const purchaseResult = await this.processDomainPurchase(
              aiResponse.domain,
              userId
            );
            return {
              domains: purchaseResult.domains || [],
              message: purchaseResult.message,
              success: purchaseResult.success,
              transactionId: purchaseResult.transactionId,
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
          const availability = await namecheapService.checkDomainAvailability(
            specificDomain
          );
          domains.push({
            name: specificDomain,
            available: availability.available,
            price: availability.price || 12.99,
          });
        } catch (error) {
          console.warn(
            `⚠️ Failed to check domain ${specificDomain}:`,
            error.message
          );
          domains.push({
            name: specificDomain,
            available: false,
            price: 12.99,
          });
        }
        return domains;
      }

      // Generate domain variations for search terms
      const extensions = [".com", ".net", ".org", ".io", ".co"]; // Include .org

      for (const term of searchTerms.slice(0, 2)) {
        // Limit to 2 terms to avoid too many requests
        for (const ext of extensions) {
          // Use all extensions, not just first 2
          const domainName = `${term.toLowerCase()}${ext}`;
          try {
            const availability = await namecheapService.checkDomainAvailability(
              domainName
            );
            domains.push({
              name: domainName,
              available: availability.available,
              price: availability.price || 12.99,
            });
          } catch (error) {
            console.warn(
              `⚠️ Failed to check domain ${domainName}:`,
              error.message
            );
            // Add domain with fallback data
            domains.push({
              name: domainName,
              available: Math.random() > 0.5, // Random for demo
              price: 12.99,
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
      console.log(
        `🎨 Generating creative domains for: ${searchTerms.join(", ")}`
      );

      // Use AI to generate creative domain names
      if (!this.model) {
        console.log("⚠️ AI model not available for creative generation");
        return await this.searchDomains(searchTerms, null, false); // Fallback to regular search
      }

      const creativePrompt = `
Generate 10 creative, brandable domain names for a business related to: ${searchTerms.join(
        ", "
      )}

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
          if (jsonText.startsWith("```json")) {
            jsonText = jsonText
              .replace(/^```json\s*/, "")
              .replace(/\s*```$/, "");
          } else if (jsonText.startsWith("```")) {
            jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
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
        const extensions = [".com", ".net", ".org", ".io", ".co"];

        // Limit to first 8 creative names to avoid too many API calls
        for (const creativeName of creativeNames.slice(0, 8)) {
          if (typeof creativeName === "string" && creativeName.length > 0) {
            for (const ext of extensions.slice(0, 3)) {
              // Check first 3 extensions for each creative name
              const domainName = `${creativeName.toLowerCase()}${ext}`;
              try {
                const availability =
                  await namecheapService.checkDomainAvailability(domainName);
                domains.push({
                  name: domainName,
                  available: availability.available,
                  price: availability.price || 12.99,
                });

                // If we have enough domains, break early
                if (domains.length >= 10) break;
              } catch (error) {
                console.warn(
                  `⚠️ Failed to check creative domain ${domainName}:`,
                  error.message
                );
                domains.push({
                  name: domainName,
                  available: Math.random() > 0.5,
                  price: 12.99,
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
    const creativeSuffixes = [
      "spot",
      "hub",
      "pro",
      "zone",
      "lab",
      "wave",
      "sync",
      "now",
      "go",
      "kit",
    ];
    const creativePrefixes = [
      "my",
      "get",
      "smart",
      "quick",
      "easy",
      "super",
      "prime",
      "next",
      "live",
      "auto",
    ];

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

  async processDomainPurchase(domainName, userId) {
    try {
      console.log(
        `💳 Processing automated purchase for domain: ${domainName} by user: ${userId}`
      );

      // Import services that we need
      const stripeService = require("./stripeService");
      const namecheapService = require("./namecheapService");

      // Step 1: Check domain availability
      let availability;
      try {
        availability = await namecheapService.checkDomainAvailability(
          domainName
        );
        console.log(`🔍 Domain availability check result:`, availability);
      } catch (error) {
        console.error(
          `❌ Failed to check domain availability: ${error.message}`
        );
        return {
          success: false,
          message: `Sorry, I couldn't check the availability of ${domainName}. Please try again later.`,
        };
      }

      if (!availability.available) {
        return {
          success: false,
          message: `Sorry, ${domainName} is not available for purchase. It may already be registered.`,
        };
      }

      // Step 2: Get user information for payment
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, email, name, stripe_customer_id")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        console.error("❌ Failed to get user information:", userError);
        return {
          success: false,
          message:
            "Sorry, I encountered an error processing your purchase. Please try again.",
        };
      }

      // Step 3: Create domain record in database
      const domainParts = domainName.split(".");
      const name = domainParts[0];
      const extension = domainParts.slice(1).join(".");
      const cost = availability.price || 12.99;
      const sellingPrice = cost * 1.1; // 10% markup

      const { data: newDomain, error: domainError } = await supabase
        .from("domains")
        .insert([
          {
            name: name,
            extension: extension,
            full_domain: domainName.toLowerCase(),
            owner_id: userId,
            status: "pending",
            registrar: "namecheap",
            cost: cost,
            selling_price: sellingPrice,
            currency: "USD",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (domainError) {
        console.error("❌ Domain creation error:", domainError);

        if (
          domainError.code === "23505" &&
          domainError.details?.includes("full_domain")
        ) {
          return {
            success: false,
            message: `${domainName} has already been purchased or is in our system.`,
          };
        }

        return {
          success: false,
          message: `Sorry, I encountered an error setting up your domain purchase. Please try again.`,
        };
      }

      // Step 4: Create or get Stripe customer
      let stripeCustomerId = user.stripe_customer_id;

      if (!stripeCustomerId) {
        try {
          const customer = await stripeService.createCustomer({
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            id: user.id,
          });
          stripeCustomerId = customer.id;

          // Update user with Stripe customer ID
          await supabase
            .from("users")
            .update({ stripe_customer_id: stripeCustomerId })
            .eq("id", userId);

          console.log(`✅ Created Stripe customer: ${stripeCustomerId}`);
        } catch (error) {
          console.error("❌ Failed to create Stripe customer:", error);
          return {
            success: false,
            message:
              "Sorry, I encountered an error setting up payment processing. Please try again.",
          };
        }
      }

      // Step 5: Create payment intent
      let paymentIntent;
      try {
        paymentIntent = await stripeService.createPaymentIntent(
          sellingPrice,
          "usd",
          stripeCustomerId,
          {
            domain: domainName,
            userId: userId.toString(),
            domainId: newDomain.id.toString(),
            automated_purchase: "true",
          }
        );
        console.log(`💳 Created payment intent: ${paymentIntent.id}`);
      } catch (error) {
        console.error("❌ Failed to create payment intent:", error);
        return {
          success: false,
          message:
            "Sorry, I encountered an error setting up the payment. Please try again.",
        };
      }

      // Step 6: Create transaction record
      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .insert([
          {
            user_id: userId,
            domain_id: newDomain.id,
            type: "purchase",
            status: "pending",
            amount: sellingPrice,
            currency: "USD",
            payment_method: "stripe",
            stripe_payment_intent_id: paymentIntent.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (transactionError) {
        console.error("❌ Transaction creation error:", transactionError);
        return {
          success: false,
          message:
            "Sorry, I encountered an error recording the transaction. Please try again.",
        };
      }

      // Step 7: Simulate automatic payment processing
      // In a real implementation, you would:
      // 1. Use a stored payment method for the user
      // 2. Or integrate with a payment processor that supports automatic payments
      // 3. Or prompt the user to complete payment via a secure link

      // For demo purposes, let's simulate a successful payment
      console.log(
        `🔄 Simulating automatic payment processing for ${domainName}...`
      );

      // In production, you would actually process the payment here
      // For now, we'll return a message asking the user to complete payment

      return {
        success: true,
        message: `I've initiated the purchase process for ${domainName} at $${sellingPrice.toFixed(
          2
        )}. To complete the purchase, you'll need to provide payment details. The domain has been reserved for you temporarily.`,
        domains: [
          {
            name: domainName,
            available: false,
            price: sellingPrice,
            status: "pending_payment",
          },
        ],
        transactionId: transaction.id,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      console.error("❌ Error in automated domain purchase:", error);
      return {
        success: false,
        message:
          "Sorry, I encountered an unexpected error while processing your purchase. Please try again or contact support.",
      };
    }
  }

  async checkDomain(domainName) {
    try {
      const availability = await namecheapService.checkDomainAvailability(
        domainName
      );
      return {
        name: domainName,
        available: availability.available,
        price: availability.price || 12.99,
      };
    } catch (error) {
      console.warn(`⚠️ Failed to check domain ${domainName}:`, error.message);
      return {
        name: domainName,
        available: false,
        price: 12.99,
      };
    }
  }

  getFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();

    // Check for purchase intent first
    const purchaseWords = [
      "buy",
      "purchase",
      "get",
      "register",
      "order",
      "take",
    ];
    const hasPurchaseIntent = purchaseWords.some((word) =>
      lowerMessage.includes(word)
    );

    // Check if message contains a complete domain name pattern
    const domainPattern =
      /([a-zA-Z0-9-]+\.(com|net|org|io|co|xyz|tech|online|store|site|app|dev))/gi;
    const domainMatches = message.match(domainPattern);

    if (hasPurchaseIntent && domainMatches && domainMatches.length > 0) {
      return {
        intent: "domain_purchase",
        message: `I'll process the purchase for ${domainMatches[0]}`,
        action: "purchase_domain",
        domain: domainMatches[0].toLowerCase(),
      };
    }

    if (domainMatches && domainMatches.length > 0) {
      return {
        intent: "domain_info",
        message: `I'll check the availability of ${domainMatches[0]}`,
        action: "check_domain",
        domain: domainMatches[0].toLowerCase(),
      };
    }

    if (
      lowerMessage.includes("domain") &&
      (lowerMessage.includes("search") || lowerMessage.includes("find"))
    ) {
      // Extract potential domain names or keywords (remove common words and extensions)
      const words = message.split(" ").filter((word) => {
        const cleanWord = word.replace(/[.,!?]/g, "").toLowerCase();
        return (
          cleanWord.length > 2 &&
          ![
            "the",
            "and",
            "for",
            "search",
            "find",
            "domain",
            "want",
            "need",
            "domains",
            "com",
            "net",
            "org",
            "io",
            "co",
          ].includes(cleanWord) &&
          !cleanWord.startsWith(".")
        ); // Remove extensions like .com
      });

      return {
        intent: "domain_search",
        message: `I'll search for domains related to: ${words.join(", ")}`,
        action: "search_domains",
        searchTerms: words.slice(0, 3), // Limit to 3 terms
      };
    }

    if (lowerMessage.includes("buy") || lowerMessage.includes("purchase")) {
      return {
        intent: "domain_purchase",
        message:
          "I can help you purchase a domain. Please specify which domain you'd like to buy (e.g., 'buy example.com').",
        action: "none",
      };
    }

    return {
      intent: "general_help",
      message:
        "I'm here to help you with domain searches, purchases, and information. You can ask me to search for domains, check availability, or buy specific domains.",
      action: "none",
    };
  }

  async saveConversation(userId, userMessage, aiResponse) {
    try {
      // Note: ai_conversations table doesn't exist in current schema
      // Skipping conversation save to avoid errors
      console.log("📝 Conversation saving disabled - table not in schema");
      return;

      const { error } = await supabase.from("ai_conversations").insert({
        user_id: userId,
        user_message: userMessage,
        ai_response: JSON.stringify(aiResponse),
        intent: aiResponse.intent,
        created_at: new Date().toISOString(),
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
          const availability = await namecheapService.checkDomainAvailability(
            domain
          );
          checkedSuggestions.push({
            name: domain,
            available: availability.available,
            price: availability.price || 12.99,
          });
        } catch (error) {
          console.warn(`⚠️ Failed to check ${domain}:`, error.message);
          checkedSuggestions.push({
            name: domain,
            available: Math.random() > 0.5,
            price: 12.99,
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
    const prefixes = ["my", "get", "the", "pro", "best"];
    const suffixes = ["hub", "zone", "pro", "online", "store"];
    const extensions = [".com", ".net", ".io", ".co", ".org", ".online"];

    const suggestions = [];

    // Add direct keyword with different extensions
    extensions.slice(0, 2).forEach((ext) => {
      suggestions.push(`${keyword}${ext}`);
    });

    // Add prefix combinations
    prefixes.slice(0, 2).forEach((prefix) => {
      suggestions.push(`${prefix}${keyword}.com`);
    });

    // Add suffix combinations
    suffixes.slice(0, 2).forEach((suffix) => {
      suggestions.push(`${keyword}${suffix}.com`);
    });

    return suggestions.map((domain) => ({
      name: domain,
      available: Math.random() > 0.5, // Random for demo
      price: 12.99,
    }));
  }
}

console.log("📁 About to create AIAgentService instance...");
const aiAgentService = new AIAgentService();
console.log("✅ AIAgentService instance created");

module.exports = aiAgentService;
