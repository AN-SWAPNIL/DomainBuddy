import api from "./api";

export const aiService = {
  // Get domain suggestions from AI
  getDomainSuggestions: async (businessDescription, preferences = {}) => {
    try {
      const response = await api.post("/ai/suggest-domains", {
        business: businessDescription,
        industry: preferences.industry || "technology",
        keywords: preferences.keywords || [],
        budget: preferences.budget || 1000,
        extensions: preferences.extensions || [".com", ".net", ".org"],
        audience: preferences.audience || "general",
        context: preferences.context || businessDescription,
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("AI service error:", error);
      throw new Error(
        error.response?.data?.message || "Failed to get domain suggestions"
      );
    }
  },

  // Analyze domain value
  analyzeDomain: async (domain) => {
    try {
      const response = await api.post("/ai/analyze-domain", { domain });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("AI service error:", error);
      throw new Error(
        error.response?.data?.message || "Failed to analyze domain"
      );
    }
  },

  // Chat with AI consultant
  chatWithAI: async (message, conversationId = null) => {
    try {
      console.log("🚀 Attempting AI chat with message:", message);
      console.log(
        "🔑 Token in localStorage:",
        localStorage.getItem("token") ? "Present" : "Missing"
      );

      const response = await api.post("/ai/chat", {
        message,
        conversationId,
      });

      console.log("✅ AI chat raw response:", response.data);

      // Extract data from nested response structure
      const data = response.data.success ? response.data.data : response.data;
      console.log("✅ AI chat extracted data:", data);

      return data;
    } catch (error) {
      console.error("AI chat error:", error);

      // Enhanced error logging
      console.error("❌ Error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        },
      });

      // Check if it's an authentication error
      if (error.response?.status === 401) {
        throw new Error("Please log in to continue using the AI consultant.");
      }

      // Check if it's a network error
      if (!error.response) {
        throw new Error(
          "Unable to connect to AI service. Please check your internet connection."
        );
      }

      // For other errors, throw the server's error message
      throw new Error(
        error.response?.data?.message || "Failed to process your message"
      );
    }
  },

  // Get conversation history
  getConversationHistory: async (conversationId) => {
    try {
      const response = await api.get(`/ai/conversations/${conversationId}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("Failed to get conversation history:", error);
      throw new Error(
        error.response?.data?.message || "Failed to get conversation history"
      );
    }
  },

  // Get all user conversations
  getUserConversations: async (page = 1, limit = 10) => {
    try {
      const response = await api.get("/ai/conversations", {
        params: { page, limit },
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("Failed to get user conversations:", error);
      throw new Error(
        error.response?.data?.message || "Failed to get conversations"
      );
    }
  },

  // Delete conversation
  deleteConversation: async (conversationId) => {
    try {
      const response = await api.delete(`/ai/conversations/${conversationId}`);
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      throw new Error(
        error.response?.data?.message || "Failed to delete conversation"
      );
    }
  },

  // Get domain name ideas
  getDomainIdeas: async (keywords, industry, targetAudience) => {
    try {
      const response = await api.post("/ai/domain-ideas", {
        keywords,
        industry,
        targetAudience,
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("Failed to get domain ideas:", error);
      throw new Error(
        error.response?.data?.message || "Failed to generate domain ideas"
      );
    }
  },

  // Check domain brandability
  checkBrandability: async (domain) => {
    try {
      const response = await api.post("/ai/brandability", { domain });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("Failed to check brandability:", error);
      throw new Error(
        error.response?.data?.message || "Failed to analyze brandability"
      );
    }
  },

  // Get SEO analysis
  getSEOAnalysis: async (domain) => {
    try {
      const response = await api.post("/ai/seo-analysis", { domain });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("Failed to get SEO analysis:", error);
      throw new Error(error.response?.data?.message || "Failed to analyze SEO");
    }
  },

  // Generate business name suggestions
  generateBusinessNames: async (description, industry) => {
    try {
      const response = await api.post("/ai/business-names", {
        description,
        industry,
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error("Failed to generate business names:", error);
      throw new Error(
        error.response?.data?.message || "Failed to generate business names"
      );
    }
  },
};

export default aiService;
