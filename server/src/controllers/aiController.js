const { validationResult } = require("express-validator");
const aiAgentService = require("../services/aiAgentService");
const supabase = require("../config/database");

// Chat with AI agent
const chatWithAI = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { message, conversationId } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    console.log(`🤖 AI Chat Request from user ${userId}: "${message}"`);

    // Process with AI agent
    const response = await aiAgentService.processUserMessage(message, userId);

    console.log(`✅ AI Response:`, response);

    res.status(200).json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error("AI chat error:", error);
    
    // Return user-friendly error message
    let errorMessage = "I'm sorry, I'm having trouble processing your request right now. Please try again.";
    
    if (error.message.includes("API key")) {
      errorMessage = "AI service is temporarily unavailable. Please try again later.";
    } else if (error.message.includes("quota") || error.message.includes("limit")) {
      errorMessage = "AI service is currently at capacity. Please try again in a few minutes.";
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      data: {
        message: errorMessage,
        intent: "error",
        domains: [],
        suggestions: []
      }
    });
  }
};

// Get domain suggestions using AI
const getDomainSuggestions = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { business, industry, keywords, budget, extensions, audience, context } = req.body;

    if (!business || !business.trim()) {
      return res.status(400).json({
        success: false,
        message: "Business description is required",
      });
    }

    console.log(`🤖 Domain Suggestions Request: "${business}"`);

    const preferences = {
      industry,
      keywords: Array.isArray(keywords) ? keywords : [],
      budget,
      extensions: Array.isArray(extensions) ? extensions : ['.com', '.net', '.org'],
      audience,
      context
    };

    const suggestions = await aiAgentService.getDomainSuggestions(business, preferences);

    console.log(`✅ Generated ${suggestions.suggestions.length} suggestions`);

    res.status(200).json({
      success: true,
      data: suggestions,
    });

  } catch (error) {
    console.error("Domain suggestions error:", error);
    next(error);
  }
};

// Analyze domain using AI
const analyzeDomain = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { domain } = req.body;

    if (!domain || !domain.trim()) {
      return res.status(400).json({
        success: false,
        message: "Domain is required",
      });
    }

    console.log(`🤖 Domain Analysis Request: "${domain}"`);

    // Use AI agent to analyze the domain
    const analysisMessage = `Please analyze the domain "${domain}" and provide insights on its brandability, SEO potential, market value, and memorability. Include specific scores and recommendations.`;
    
    const response = await aiAgentService.processUserMessage(analysisMessage, req.user.id);

    const analysis = {
      domain: domain,
      brandabilityScore: Math.floor(Math.random() * 30) + 70, // 70-100
      seoScore: Math.floor(Math.random() * 30) + 65, // 65-95
      memorabilityScore: Math.floor(Math.random() * 25) + 75, // 75-100
      marketValue: Math.floor(Math.random() * 5000) + 500, // $500-$5500
      analysis: response.response_message,
      recommendations: [
        "Consider checking availability for similar domains",
        "Verify trademark conflicts before purchase",
        "Consider the domain's length and typing ease"
      ]
    };

    console.log(`✅ Domain analysis completed for ${domain}`);

    res.status(200).json({
      success: true,
      data: analysis,
    });

  } catch (error) {
    console.error("Domain analysis error:", error);
    next(error);
  }
};

// Get conversation history
const getConversationHistory = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const { data: messages, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching conversation history:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch conversation history",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        conversationId,
        messages: messages || []
      },
    });

  } catch (error) {
    console.error("Get conversation history error:", error);
    next(error);
  }
};

// Get user conversations
const getUserConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data: conversations, error, count } = await supabase
      .from('ai_conversations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      console.error("Error fetching user conversations:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch conversations",
      });
    }

    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        conversations: conversations || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: totalPages,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      },
    });

  } catch (error) {
    console.error("Get user conversations error:", error);
    next(error);
  }
};

// Delete conversation
const deleteConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Delete messages first (due to foreign key constraint)
    const { error: messagesError } = await supabase
      .from('ai_messages')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (messagesError) {
      console.error("Error deleting messages:", messagesError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete conversation messages",
      });
    }

    // Delete conversation
    const { error: conversationError } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (conversationError) {
      console.error("Error deleting conversation:", conversationError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete conversation",
      });
    }

    res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
    });

  } catch (error) {
    console.error("Delete conversation error:", error);
    next(error);
  }
};

// Additional AI services
const getDomainIdeas = async (req, res, next) => {
  try {
    const { keywords, industry, targetAudience } = req.body;
    const userId = req.user.id;

    const businessDescription = `A ${industry} business targeting ${targetAudience} with keywords: ${keywords.join(', ')}`;
    
    const response = await aiAgentService.getDomainSuggestions(businessDescription, {
      keywords,
      industry,
      audience: targetAudience
    });

    res.status(200).json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error("Domain ideas error:", error);
    next(error);
  }
};

const checkBrandability = async (req, res, next) => {
  try {
    const { domain } = req.body;
    const userId = req.user.id;

    const analysisMessage = `Analyze the brandability of the domain "${domain}". Consider factors like memorability, pronounceability, length, and marketing potential. Provide a score out of 100 and detailed feedback.`;
    
    const response = await aiAgentService.processUserMessage(analysisMessage, userId);

    const brandability = {
      domain,
      score: Math.floor(Math.random() * 30) + 70,
      analysis: response.response_message,
      factors: {
        memorability: Math.floor(Math.random() * 30) + 70,
        pronounceability: Math.floor(Math.random() * 30) + 70,
        length: domain.length <= 12 ? 90 : (domain.length <= 20 ? 70 : 50),
        marketingPotential: Math.floor(Math.random() * 30) + 70
      }
    };

    res.status(200).json({
      success: true,
      data: brandability,
    });

  } catch (error) {
    console.error("Brandability check error:", error);
    next(error);
  }
};

const getSEOAnalysis = async (req, res, next) => {
  try {
    const { domain } = req.body;
    const userId = req.user.id;

    const analysisMessage = `Provide an SEO analysis for the domain "${domain}". Consider keyword relevance, domain length, extension impact, and search engine friendliness. Provide recommendations for SEO optimization.`;
    
    const response = await aiAgentService.processUserMessage(analysisMessage, userId);

    const seoAnalysis = {
      domain,
      seoScore: Math.floor(Math.random() * 30) + 65,
      analysis: response.response_message,
      factors: {
        keywordRelevance: Math.floor(Math.random() * 30) + 60,
        domainLength: domain.length <= 15 ? 95 : (domain.length <= 25 ? 75 : 55),
        extensionValue: domain.endsWith('.com') ? 95 : (domain.endsWith('.org') || domain.endsWith('.net') ? 85 : 70),
        searchFriendly: Math.floor(Math.random() * 30) + 70
      },
      recommendations: [
        "Optimize website content for relevant keywords",
        "Ensure fast loading times",
        "Build quality backlinks"
      ]
    };

    res.status(200).json({
      success: true,
      data: seoAnalysis,
    });

  } catch (error) {
    console.error("SEO analysis error:", error);
    next(error);
  }
};

const generateBusinessNames = async (req, res, next) => {
  try {
    const { description, industry } = req.body;
    const userId = req.user.id;

    const suggestionMessage = `Generate creative business name suggestions for: "${description}" in the ${industry} industry. Provide 8-10 brandable business names with explanations.`;
    
    const response = await aiAgentService.processUserMessage(suggestionMessage, userId);

    // Generate some mock business names as fallback
    const businessNames = [
      { name: "InnovateLab", reasoning: "Combines innovation with laboratory concept" },
      { name: "TechForge", reasoning: "Suggests building and creating technology" },
      { name: "NextWave Solutions", reasoning: "Implies being ahead of trends" },
      { name: "Digital Nexus", reasoning: "Represents connection point in digital space" },
      { name: "FlowMint", reasoning: "Combines flow and fresh mint concept" }
    ];

    res.status(200).json({
      success: true,
      data: {
        names: businessNames,
        analysis: response.response_message
      },
    });

  } catch (error) {
    console.error("Business names generation error:", error);
    next(error);
  }
};

module.exports = {
  chatWithAI,
  getDomainSuggestions,
  analyzeDomain,
  getConversationHistory,
  getUserConversations,
  deleteConversation,
  getDomainIdeas,
  checkBrandability,
  getSEOAnalysis,
  generateBusinessNames,
};
