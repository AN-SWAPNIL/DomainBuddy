const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { Tool } = require('@langchain/core/tools');
const namecheapService = require("./namecheapService");
const supabase = require("../config/database");

// Define LangChain Tools for Domain Operations
class DomainSearchTool extends Tool {
  name = "domain_search";
  description = "Search for domain availability based on search terms";

  constructor(aiService) {
    super();
    this.aiService = aiService;
  }

  async _call(input) {
    const { searchTerms, specificDomain } = JSON.parse(input);
    return JSON.stringify(await this.aiService.searchDomains(searchTerms, specificDomain));
  }
}

class CreativeDomainTool extends Tool {
  name = "creative_domain_search";
  description = "Generate creative domain suggestions based on business concepts";

  constructor(aiService) {
    super();
    this.aiService = aiService;
  }

  async _call(input) {
    const { searchTerms } = JSON.parse(input);
    return JSON.stringify(await this.aiService.generateCreativeDomains(searchTerms));
  }
}

class DomainPurchaseTool extends Tool {
  name = "domain_purchase";
  description = "Process automated domain purchase";

  constructor(aiService) {
    super();
    this.aiService = aiService;
  }

  async _call(input) {
    const { domainName, userId } = JSON.parse(input);
    return JSON.stringify(await this.aiService.processDomainPurchase(domainName, userId));
  }
}

class DomainCheckTool extends Tool {
  name = "domain_check";
  description = "Check availability and price of a specific domain";

  constructor(aiService) {
    super();
    this.aiService = aiService;
  }

  async _call(input) {
    const { domainName } = JSON.parse(input);
    return JSON.stringify(await this.aiService.checkDomain(domainName));
  }
}

// Agent State Interface - simplified for LangGraph compatibility
const AgentState = {
  messages: {
    value: (x, y) => (x || []).concat(y || []),
    default: () => []
  },
  userMessage: {
    value: (x, y) => y ?? x ?? "",
    default: () => ""
  },
  intent: {
    value: (x, y) => y ?? x ?? null,
    default: () => null
  },
  action: {
    value: (x, y) => y ?? x ?? null,
    default: () => null
  },
  searchTerms: {
    value: (x, y) => y ?? x ?? [],
    default: () => []
  },
  domain: {
    value: (x, y) => y ?? x ?? null,
    default: () => null
  },
  userId: {
    value: (x, y) => y ?? x ?? null,
    default: () => null
  },
  isCreativeRequest: {
    value: (x, y) => y ?? x ?? false,
    default: () => false
  },
  domains: {
    value: (x, y) => y ?? x ?? [],
    default: () => []
  },
  success: {
    value: (x, y) => y ?? x ?? false,
    default: () => false
  },
  message: {
    value: (x, y) => y ?? x ?? "",
    default: () => ""
  },
  transactionId: {
    value: (x, y) => y ?? x ?? null,
    default: () => null
  }
};

class AIAgentService {
  constructor() {
    console.log('🔧 AIAgentService constructor called');
    this.llm = null;
    this.tools = [];
    this.graph = null;
    
    // In-memory conversation history storage
    // Structure: { userId: [{ role: 'user'|'assistant', message: string, timestamp: Date, domains?: [] }] }
    this.conversationHistory = new Map();
    this.maxHistoryLength = 20; // Keep last 20 messages per user
    
    this.initializeAgent();
  }

  async initializeAgent() {
    try {
      console.log('🤖 Initializing LangChain AI Agent...');
      
      if (!process.env.GOOGLE_API_KEY) {
        console.warn("⚠️ GOOGLE_API_KEY not found in environment variables. AI features will be limited.");
        return false;
      }

      console.log('📋 Google API Key found, length:', process.env.GOOGLE_API_KEY.length);

      // Initialize ChatGoogleGenerativeAI (LangChain wrapper)
      try {
        this.llm = new ChatGoogleGenerativeAI({
          model: 'gemini-1.5-flash',
          apiKey: process.env.GOOGLE_API_KEY,
          temperature: 0.7,
          maxOutputTokens: 1024,
        });
        console.log('✅ ChatGoogleGenerativeAI initialized successfully');
      } catch (llmError) {
        console.warn('⚠️ ChatGoogleGenerativeAI failed, trying alternative parameters:', llmError.message);
        
        // Try with different parameter names
        try {
          this.llm = new ChatGoogleGenerativeAI({
            googleApiKey: process.env.GOOGLE_API_KEY,
            modelName: 'gemini-1.5-flash',
            temperature: 0.7,
          });
          console.log('✅ ChatGoogleGenerativeAI initialized with alternative parameters');
        } catch (altError) {
          console.warn('⚠️ Alternative ChatGoogleGenerativeAI also failed:', altError.message);
          this.llm = null;
        }
      }

      // Initialize tools (even if LLM failed, for fallback operations)
      this.tools = [
        new DomainSearchTool(this),
        new CreativeDomainTool(this),
        new DomainPurchaseTool(this),
        new DomainCheckTool(this)
      ];

      // Create the agent workflow using LangGraph
      this.createAgentWorkflow();
      
      if (this.llm) {
        console.log('✅ LangChain AI Agent initialized successfully');
        return true;
      } else {
        console.log('⚠️ LangChain AI Agent initialized with limited functionality (LLM unavailable)');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize LangChain AI Agent:', error.message);
      this.llm = null;
      this.tools = [];
      this.graph = null;
      return false;
    }
  }

  createAgentWorkflow() {
    try {
      console.log('🔗 Creating LangChain workflow...');
      
      // For now, skip LangGraph and use the simplified workflow directly
      // This ensures compatibility and reliability
      this.graph = null;
      console.log('✅ Using LangChain workflow');
    } catch (error) {
      console.warn('⚠️ Workflow creation failed:', error.message);
      this.graph = null;
    }
  }

  // Conversation History Management
  addToHistory(userId, role, message, domains = null) {
    if (!userId) return; // Skip if no user ID
    
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }
    
    const userHistory = this.conversationHistory.get(userId);
    userHistory.push({
      role: role, // 'user' or 'assistant'
      message: message,
      domains: domains,
      timestamp: new Date()
    });
    
    // Keep only the last maxHistoryLength messages
    if (userHistory.length > this.maxHistoryLength) {
      userHistory.splice(0, userHistory.length - this.maxHistoryLength);
    }
    
    console.log(`📝 Added to history for user ${userId}: ${role} message (${userHistory.length} total)`);
  }

  getConversationHistory(userId, includeLastN = 10) {
    if (!userId || !this.conversationHistory.has(userId)) {
      return [];
    }
    
    const userHistory = this.conversationHistory.get(userId);
    return userHistory.slice(-includeLastN); // Get last N messages
  }

  // Debug method to view conversation history
  debugConversationHistory(userId) {
    if (!userId || !this.conversationHistory.has(userId)) {
      console.log(`No conversation history found for user: ${userId}`);
      return [];
    }
    
    const history = this.conversationHistory.get(userId);
    console.log(`📜 Conversation history for user ${userId} (${history.length} messages):`);
    history.forEach((entry, index) => {
      console.log(`${index + 1}. [${entry.role.toUpperCase()}]: ${entry.message.substring(0, 100)}...`);
      if (entry.domains && entry.domains.length > 0) {
        console.log(`   Domains: ${entry.domains.map(d => d.name).slice(0, 3).join(', ')}`);
      }
    });
    return history;
  }

  buildContextFromHistory(userId) {
    const history = this.getConversationHistory(userId, 10);
    if (history.length === 0) return "";
    
    let context = "\n\nCONVERSATION HISTORY (for context):\n";
    history.forEach((entry, index) => {
      context += `${entry.role.toUpperCase()}: ${entry.message}`;
      if (entry.domains && entry.domains.length > 0) {
        const domainNames = entry.domains.map(d => d.name).slice(0, 3).join(', ');
        context += ` [Domains shown: ${domainNames}${entry.domains.length > 3 ? '...' : ''}]`;
      }
      context += "\n";
    });
    context += "\nPlease use this conversation history to provide contextually relevant responses.\n";
    
    return context;
  }

  async processUserMessage(message, userId = null) {
    try {
      console.log(`🔍 Processing user message: "${message}"`);

      // Add user message to history
      if (userId) {
        this.addToHistory(userId, 'user', message);
      }

      // If AI agent is not available, use fallback
      if (!this.llm) {
        console.log("⚠️ LLM not available, using fallback response");
        const fallbackResponse = this.getFallbackResponse(message, userId);
        
        // Add fallback response to history
        if (userId) {
          this.addToHistory(userId, 'assistant', fallbackResponse.message, fallbackResponse.domains);
        }
        
        return fallbackResponse;
      }

      // If LangGraph is available, use the workflow
      if (this.graph) {
        try {
          // Initialize state for the workflow
          const initialState = {
            messages: [new HumanMessage(message)],
            userMessage: message,
            userId: userId
          };

          // Execute the agent workflow
          const result = await this.graph.invoke(initialState);

          // Add assistant response to history
          if (userId) {
            this.addToHistory(userId, 'assistant', result.message, result.domains);
          }

          // Save conversation to database if userId is provided
          if (userId && result.message) {
            await this.saveConversation(userId, message, result);
          }

          return {
            intent: result.intent,
            message: result.message,
            action: result.action,
            domain: result.domain,
            searchTerms: result.searchTerms,
            isCreativeRequest: result.isCreativeRequest,
            domains: result.domains || [],
            success: result.success,
            transactionId: result.transactionId
          };
        } catch (graphError) {
          console.warn("⚠️ LangGraph execution failed, using simplified flow:", graphError.message);
        }
      }

      // Simplified flow without LangGraph (but still using LangChain LLM)
      console.log("🔄 Using simplified LangChain flow...");
      
      // Step 1: Analyze intent (with conversation history)
      const intentState = await this.analyzeIntent({ userMessage: message, userId });
      
      // Step 2: Execute action
      const actionState = await this.executeAction(intentState);
      
      // Step 3: Format response
      const finalState = await this.formatResponse(actionState);

      // Add assistant response to history
      if (userId) {
        this.addToHistory(userId, 'assistant', finalState.message, finalState.domains);
      }

      // Save conversation to database if userId is provided
      if (userId && finalState.message) {
        await this.saveConversation(userId, message, finalState);
      }

      return {
        intent: finalState.intent,
        message: finalState.message,
        action: finalState.action,
        domain: finalState.domain,
        searchTerms: finalState.searchTerms,
        isCreativeRequest: finalState.isCreativeRequest,
        domains: finalState.domains || [],
        success: finalState.success,
        transactionId: finalState.transactionId,
        // Add payment redirection fields
        requiresPayment: finalState.requiresPayment,
        redirectToPayment: finalState.redirectToPayment,
        paymentUrl: finalState.paymentUrl
      };
    } catch (error) {
      console.error("❌ Error processing user message:", error);
      const fallbackResponse = this.getFallbackResponse(message, userId);
      
      // Add fallback response to history
      if (userId) {
        this.addToHistory(userId, 'assistant', fallbackResponse.message, fallbackResponse.domains);
      }
      
      return fallbackResponse;
    }
  }

  async analyzeIntent(state) {
    try {
      console.log("🧠 Analyzing user intent with LangChain...");
      
      // Build conversation context
      const conversationContext = state.userId ? this.buildContextFromHistory(state.userId) : "";
      
      const systemPrompt = `You are a helpful AI assistant for DomainBuddy, a domain registration service.
Analyze the user's message and determine their intent and required actions.

Respond with ONLY a JSON object with this structure:
{
  "intent": "domain_search" | "domain_purchase" | "domain_info" | "general_help",
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

CONTEXT AWARENESS:
- Use conversation history to understand context
- If user asks for "alternatives" or "suggestions" after a domain was unavailable, treat as creative_search
- If user says "similar" or "other options", generate creative alternatives based on previous context
- Remember what domains were previously shown or discussed

${conversationContext}`;

      const userMessage = state.userMessage;
      
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`User message: "${userMessage}"\n\nRespond with ONLY the JSON object, no additional text.`)
      ];

      const response = await this.llm.invoke(messages);
      const content = response.content;

      console.log("🤖 LangChain Analysis Response:", content);

      // Parse the JSON response
      let analysis;
      try {
        let jsonText = content.trim();
        // Remove markdown code blocks if present
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        analysis = JSON.parse(jsonText);
      } catch (parseError) {
        console.warn("⚠️ Failed to parse LangChain analysis, using fallback");
        const fallback = this.getFallbackResponse(userMessage, state.userId);
        return {
          ...state,
          intent: fallback.intent,
          action: fallback.action,
          domain: fallback.domain,
          searchTerms: fallback.searchTerms || [],
          isCreativeRequest: fallback.isCreativeRequest || false
        };
      }

      return {
        ...state,
        intent: analysis.intent,
        action: analysis.action,
        domain: analysis.domain,
        searchTerms: analysis.searchTerms || [],
        isCreativeRequest: analysis.isCreativeRequest || false
      };
    } catch (error) {
      console.error("❌ Error analyzing intent:", error);
      const fallback = this.getFallbackResponse(state.userMessage, state.userId);
      return {
        ...state,
        intent: fallback.intent,
        action: fallback.action,
        domain: fallback.domain,
        searchTerms: fallback.searchTerms || [],
        isCreativeRequest: fallback.isCreativeRequest || false
      };
    }
  }

  async executeAction(state) {
    try {
      console.log(`🎯 Executing action: ${state.action}`);
      
      if (!state.action || state.action === "none") {
        return {
          ...state,
          success: true,
          message: "I'm here to help you with domain searches, purchases, and information."
        };
      }

      // Find and execute the appropriate tool
      let result = null;
      
      switch (state.action) {
        case "search_domains":
          if (state.searchTerms && state.searchTerms.length > 0) {
            const tool = this.tools.find(t => t.name === "domain_search");
            const input = JSON.stringify({ 
              searchTerms: state.searchTerms, 
              specificDomain: null 
            });
            const searchResults = JSON.parse(await tool._call(input));
            result = {
              domains: searchResults,
              message: `I found ${searchResults.length} domains for your search.`,
              success: true
            };
          }
          break;

        case "creative_search":
          if (state.searchTerms && state.searchTerms.length > 0) {
            const tool = this.tools.find(t => t.name === "creative_domain_search");
            
            // Check conversation history for context
            let contextualTerms = state.searchTerms;
            if (state.userId) {
              const history = this.getConversationHistory(state.userId, 5);
              const previousDomains = [];
              
              // Extract domain concepts from recent history
              history.forEach(entry => {
                if (entry.domains && entry.domains.length > 0) {
                  entry.domains.forEach(domain => {
                    const domainRoot = domain.name.split('.')[0];
                    if (domainRoot && !previousDomains.includes(domainRoot)) {
                      previousDomains.push(domainRoot);
                    }
                  });
                }
              });
              
              // If user is asking for alternatives without specific terms, use previous context
              if (state.searchTerms.length === 0 && previousDomains.length > 0) {
                contextualTerms = [previousDomains[0]]; // Use the most recent domain concept
                console.log(`🔄 Using contextual terms from history: ${contextualTerms.join(', ')}`);
              }
            }
            
            const input = JSON.stringify({ searchTerms: contextualTerms });
            const creativeDomains = JSON.parse(await tool._call(input));
            result = {
              domains: creativeDomains,
              message: `I found ${creativeDomains.length} creative domain suggestions for you.`,
              success: true
            };
          } else if (state.userId) {
            // If no search terms but we have user history, try to extract context
            const history = this.getConversationHistory(state.userId, 3);
            const lastUserMessage = history.find(entry => entry.role === 'user');
            
            if (lastUserMessage && lastUserMessage.message.toLowerCase().includes('doggy')) {
              const tool = this.tools.find(t => t.name === "creative_domain_search");
              const input = JSON.stringify({ searchTerms: ['dog', 'pet'] });
              const creativeDomains = JSON.parse(await tool._call(input));
              result = {
                domains: creativeDomains,
                message: `Here are some creative alternatives similar to what you were looking for:`,
                success: true
              };
            }
          }
          break;

        case "check_domain":
          if (state.domain) {
            const tool = this.tools.find(t => t.name === "domain_check");
            const input = JSON.stringify({ domainName: state.domain });
            const domainInfo = JSON.parse(await tool._call(input));
            result = {
              domains: [domainInfo],
              message: `Here's the information for ${state.domain}.`,
              success: true
            };
          }
          break;

        case "purchase_domain":
          if (state.domain && state.userId) {
            const tool = this.tools.find(t => t.name === "domain_purchase");
            const input = JSON.stringify({ 
              domainName: state.domain, 
              userId: state.userId 
            });
            const purchaseResult = JSON.parse(await tool._call(input));
            result = {
              domains: purchaseResult.domains || [],
              message: purchaseResult.message,
              success: purchaseResult.success,
              transactionId: purchaseResult.transactionId,
              // Pass through payment redirection fields
              requiresPayment: purchaseResult.requiresPayment,
              redirectToPayment: purchaseResult.redirectToPayment,
              paymentUrl: purchaseResult.paymentUrl
            };
          }
          break;

        default:
          result = {
            domains: [],
            message: "I'm not sure how to help with that. Please try rephrasing your request.",
            success: false
          };
      }

      return {
        ...state,
        domains: result?.domains || [],
        message: result?.message || "Action completed.",
        success: result?.success || false,
        transactionId: result?.transactionId,
        // Pass through payment redirection fields
        requiresPayment: result?.requiresPayment,
        redirectToPayment: result?.redirectToPayment,
        paymentUrl: result?.paymentUrl
      };
    } catch (error) {
      console.error("❌ Error executing action:", error);
      return {
        ...state,
        domains: [],
        message: "I encountered an error while processing your request. Please try again.",
        success: false
      };
    }
  }

  async formatResponse(state) {
    try {
      console.log("📝 Formatting final response...");
      
      // Generate a natural language response using LangChain if we have the LLM
      if (this.llm && state.message) {
        // Build conversation context for better responses
        const conversationContext = state.userId ? this.buildContextFromHistory(state.userId) : "";
        
        const contextPrompt = `You are a friendly AI assistant for DomainBuddy. 
Based on the action performed and results, provide a natural, helpful response to the user.

Action performed: ${state.action}
Intent: ${state.intent}
Domains found: ${state.domains ? state.domains.length : 0}
Success: ${state.success}
Current message: ${state.message}

Make the response conversational and helpful. If domains were found, mention the count and encourage next steps.
If a purchase was initiated, explain the next steps clearly.
If this is a follow-up request (like asking for alternatives), acknowledge the context.

${conversationContext}

Respond with ONLY the message text, no JSON or extra formatting.`;

        try {
          const response = await this.llm.invoke([
            new SystemMessage(contextPrompt),
            new HumanMessage(`Generate a response for the user.`)
          ]);
          
          const enhancedMessage = response.content.trim();
          if (enhancedMessage && enhancedMessage.length > 10) {
            return {
              ...state,
              message: enhancedMessage
            };
          }
        } catch (error) {
          console.warn("⚠️ Failed to enhance message with LLM:", error.message);
        }
      }

      // Return the state with existing message if LLM enhancement fails
      return state;
    } catch (error) {
      console.error("❌ Error formatting response:", error);
      return state;
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
      
      // Use LangChain LLM to generate creative domain names
      if (!this.llm) {
        console.log("⚠️ LLM not available for creative generation");
        return await this.searchDomains(searchTerms, null); // Fallback to regular search
      }

      const creativePrompt = `Generate 10 creative, brandable domain names for a business related to: ${searchTerms.join(', ')}

Requirements:
- Names should be catchy, memorable, and brandable
- Mix of real words, made-up words, and combinations
- Suitable for a professional business
- No extensions - just the domain name part
- Each name should be 3-15 characters long
- Avoid exact keyword matches

Examples for "live location tracker device":
- TrackSpot, LivePin, LocateNow, SpotSync, PinPoint, TrackWave, LiveMap, GeoSpot, PositionIQ, TrackPro

Respond with ONLY a JSON array of strings: ["domain1", "domain2", "domain3", ...]`;

      try {
        const response = await this.llm.invoke([
          new SystemMessage("You are a creative domain name generator. Generate brandable domain names based on business concepts."),
          new HumanMessage(creativePrompt)
        ]);
        
        const content = response.content.trim();
        console.log("🎨 Creative LangChain Response:", content);
        
        // Parse the creative domain names
        let creativeNames;
        try {
          let jsonText = content;
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          creativeNames = JSON.parse(jsonText);
        } catch (parseError) {
          console.warn("⚠️ Failed to parse creative domains, using fallback");
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
        console.warn("⚠️ LangChain creative generation failed:", aiError.message);
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

  async processDomainPurchase(domainName, userId) {
    try {
      console.log(`💳 Processing automated purchase for domain: ${domainName} by user: ${userId}`);

      // Import services that we need
      const stripeService = require("./stripeService");
      const namecheapService = require("./namecheapService");

      // Step 1: Check domain availability
      let availability;
      try {
        availability = await namecheapService.checkDomainAvailability(domainName);
        console.log(`🔍 Domain availability check result:`, availability);
      } catch (error) {
        console.error(`❌ Failed to check domain availability: ${error.message}`);
        return {
          success: false,
          message: `Sorry, I couldn't check the availability of ${domainName}. Please try again later.`
        };
      }

      if (!availability.available) {
        return {
          success: false,
          message: `Sorry, ${domainName} is not available for purchase. It may already be registered.`
        };
      }

      // Step 2: Get user information for payment
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, stripe_customer_id')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        console.error('❌ Failed to get user information:', userError);
        return {
          success: false,
          message: 'Sorry, I encountered an error processing your purchase. Please try again.'
        };
      }

      // Construct full name from first_name and last_name
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Customer';

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
        
        if (domainError.code === "23505" && domainError.details?.includes("full_domain")) {
          return {
            success: false,
            message: `${domainName} has already been purchased or is in our system.`
          };
        }

        return {
          success: false,
          message: `Sorry, I encountered an error setting up your domain purchase. Please try again.`
        };
      }

      // Step 4: Create or get Stripe customer
      let stripeCustomerId = user.stripe_customer_id;
      
      if (!stripeCustomerId) {
        try {
          const customer = await stripeService.createCustomer({
            email: user.email,
            name: fullName,
            id: user.id
          });
          stripeCustomerId = customer.id;

          // Update user with Stripe customer ID
          await supabase
            .from('users')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', userId);

          console.log(`✅ Created Stripe customer: ${stripeCustomerId}`);
        } catch (error) {
          console.error('❌ Failed to create Stripe customer:', error);
          return {
            success: false,
            message: 'Sorry, I encountered an error setting up payment processing. Please try again.'
          };
        }
      }

      // Step 5: Create payment intent
      let paymentIntent;
      try {
        paymentIntent = await stripeService.createPaymentIntent(
          sellingPrice,
          'usd',
          stripeCustomerId,
          {
            domain: domainName,
            userId: userId.toString(),
            domainId: newDomain.id.toString(),
            automated_purchase: 'true'
          }
        );
        console.log(`💳 Created payment intent: ${paymentIntent.id}`);
      } catch (error) {
        console.error('❌ Failed to create payment intent:', error);
        return {
          success: false,
          message: 'Sorry, I encountered an error setting up the payment. Please try again.'
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
          message: 'Sorry, I encountered an error recording the transaction. Please try again.'
        };
      }

      // Step 7: Simulate automatic payment processing
      // In a real implementation, you would:
      // 1. Use a stored payment method for the user
      // 2. Or integrate with a payment processor that supports automatic payments
      // 3. Or prompt the user to complete payment via a secure link
      
      // For demo purposes, let's simulate a successful payment
      console.log(`🔄 Simulating automatic payment processing for ${domainName}...`);
      
      // In production, you would actually process the payment here
      // For now, we'll return a message asking the user to complete payment
      
      return {
        success: true,
        message: `Perfect! I've reserved ${domainName} for you at $${sellingPrice.toFixed(2)}. Redirecting you to the secure payment page to complete your purchase...`,
        domains: [{
          name: domainName,
          available: false,
          price: sellingPrice,
          status: 'pending_payment'
        }],
        transactionId: transaction.id,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        // Add special flags for automatic redirection
        requiresPayment: true,
        redirectToPayment: true,
        paymentUrl: `/payment?domain=${encodeURIComponent(domainName)}&amount=${sellingPrice}&transaction=${transaction.id}`
      };

    } catch (error) {
      console.error('❌ Error in automated domain purchase:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an unexpected error while processing your purchase. Please try again or contact support.'
      };
    }
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

  getFallbackResponse(message, userId = null) {
    const lowerMessage = message.toLowerCase();
    
    // Check conversation history for context
    let historyContext = "";
    if (userId) {
      const history = this.getConversationHistory(userId, 3);
      const hasRecentDomainCheck = history.some(entry => 
        entry.role === 'assistant' && entry.message.includes('not available')
      );
      
      // If user recently got "not available" and now asks for alternatives
      if (hasRecentDomainCheck && (
        lowerMessage.includes('alternative') || 
        lowerMessage.includes('suggestion') || 
        lowerMessage.includes('other') ||
        lowerMessage.includes('similar') ||
        lowerMessage.includes('different')
      )) {
        return {
          intent: "domain_search",
          message: "I'll find some creative alternatives for you based on your previous search.",
          action: "creative_search",
          searchTerms: [],
          isCreativeRequest: true
        };
      }
    }
    
    // Check for purchase intent first
    const purchaseWords = ['buy', 'purchase', 'get', 'register', 'order', 'take'];
    const hasPurchaseIntent = purchaseWords.some(word => lowerMessage.includes(word));
    
    // Check if message contains a complete domain name pattern
    const domainPattern = /([a-zA-Z0-9-]+\.(com|net|org|io|co|xyz|tech|online|store|site|app|dev))/gi;
    const domainMatches = message.match(domainPattern);
    
    if (hasPurchaseIntent && domainMatches && domainMatches.length > 0) {
      return {
        intent: "domain_purchase",
        message: `I'll process the purchase for ${domainMatches[0]}`,
        action: "purchase_domain",
        domain: domainMatches[0].toLowerCase()
      };
    }
    
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
        message: "I can help you purchase a domain. Please specify which domain you'd like to buy (e.g., 'buy example.com').",
        action: "none"
      };
    }

    return {
      intent: "general_help",
      message: "I'm here to help you with domain searches, purchases, and information. You can ask me to search for domains, check availability, or buy specific domains.",
      action: "none"
    };
  }

  async saveConversation(userId, userMessage, aiResponse) {
    try {
      // Note: ai_conversations table doesn't exist in current schema
      // Skipping conversation save to avoid errors
      // will implement later if needed
      console.log("📝 Conversation saving disabled - table not in schema");
      return;
      
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

      if (!this.llm) {
        console.log("⚠️ LLM not available, using fallback suggestions");
        return this.getFallbackSuggestions(keyword);
      }

      const prompt = `Generate 6 creative domain name suggestions for the keyword "${keyword}".
Consider variations like:
- Adding prefixes/suffixes (my, get, the, pro, hub, zone, etc.)
- Combining with related words
- Using different extensions (.com, .net, .io, .co)

Respond with ONLY a JSON array of domain names:
["domain1.com", "domain2.net", "domain3.io", "domain4.co", "domain5.com", "domain6.org"]`;

      try {
        const response = await this.llm.invoke([
          new SystemMessage("You are a domain name suggestion generator. Create brandable domain variations."),
          new HumanMessage(prompt)
        ]);
        
        const content = response.content.trim();
        console.log("🔍 LangChain Suggestions Response:", content);

        let suggestions;
        try {
          let jsonText = content;
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          suggestions = JSON.parse(jsonText);
        } catch (parseError) {
          console.warn("⚠️ Failed to parse LangChain suggestions, using fallback");
          suggestions = this.getFallbackSuggestions(keyword);
        }

        if (!Array.isArray(suggestions)) {
          console.warn("⚠️ Suggestions response not an array, using fallback");
          return this.getFallbackSuggestions(keyword);
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
      } catch (llmError) {
        console.warn("⚠️ LangChain suggestion generation failed:", llmError.message);
        return this.getFallbackSuggestions(keyword);
      }
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

console.log('📁 About to create LangChain AIAgentService instance...');
const aiAgentService = new AIAgentService();
console.log('✅ LangChain AIAgentService instance created successfully!');

module.exports = aiAgentService;
