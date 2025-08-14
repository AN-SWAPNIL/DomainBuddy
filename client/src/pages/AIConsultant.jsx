import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PaperAirplaneIcon,
  SparklesIcon,
  UserIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  LightBulbIcon,
  ChartBarIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { aiService } from "../services/aiService";
import { domainService } from "../services/domainService";
import { useAuth } from "../contexts/AuthContext";

const AIConsultant = () => {
  const { isAuthenticated, user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "ai",
      content:
        "Hello! I'm your AI Domain Consultant. I can help you with:\n\n• Finding the perfect domain name for your business\n• Analyzing domain value and market trends\n• Suggesting domain investment opportunities\n• Providing SEO and branding advice\n\nWhat would you like to know about domains today?",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickSuggestions = [
    {
      icon: LightBulbIcon,
      text: "Suggest domain names for my tech startup",
      category: "Domain Suggestions",
    },
    {
      icon: ChartBarIcon,
      text: "Analyze domain investment opportunities",
      category: "Investment Analysis",
    },
    {
      icon: GlobeAltIcon,
      text: "Check domain availability and pricing",
      category: "Domain Search",
    },
    {
      icon: DocumentTextIcon,
      text: "Help me choose between .com, .net, .org",
      category: "Domain Extensions",
    },
  ];

  const handleSendMessage = async (messageText = inputMessage) => {
    if (!messageText.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await aiService.chatWithAI(messageText);

      const aiMessage = {
        id: Date.now() + 1,
        type: "ai",
        content: response.message,
        timestamp: new Date(),
        suggestions: response.suggestions || [],
        domains: response.domains || [],
      };

      setMessages((prev) => [...prev, aiMessage]);

      if (response.suggestions) {
        setSuggestions(response.suggestions);
      }
    } catch (error) {
      console.error("Chat error:", error);

      let errorContent =
        "I apologize, but I'm having trouble connecting right now. Please try again in a moment.";

      if (error.message.includes("log in")) {
        errorContent =
          "🔐 Please log in to continue using the AI consultant. You'll be redirected to the login page shortly.";
        // Redirect to login after showing the message
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else if (
        error.message.includes("network") ||
        error.message.includes("connect")
      ) {
        errorContent =
          "🌐 Unable to connect to the AI service. Please check your internet connection and try again.";
      }

      const errorMessage = {
        id: Date.now() + 1,
        type: "ai",
        content: errorContent,
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickSuggestion = (suggestion) => {
    handleSendMessage(suggestion.text);
  };

  const handleDomainAction = async (domain, action) => {
    try {
      if (action === "search") {
        const results = await domainService.searchDomains(domain.name);
        const message = `Here are the search results for "${
          domain.name
        }":\n\n${results
          .map(
            (d) =>
              `• ${d.name} - $${d.price}/year (${
                d.available ? "Available" : "Taken"
              })`
          )
          .join("\n")}`;

        const aiMessage = {
          id: Date.now(),
          type: "ai",
          content: message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);
      } else if (action === "purchase") {
        // Prepare purchase data in the same format as DomainSearch
        const purchaseData = {
          domain: domain.name,
          years: 1,
          contactInfo: {
            firstName: "John",
            lastName: "Doe",
            email: "user@example.com",
            phone: "+1.1234567890",
            address: "123 Main St",
            city: "Anytown",
            country: "US",
          },
        };

        const result = await domainService.purchaseDomain(purchaseData);
        if (result.success || result.domain) {
          // Redirect to payment page
          const domainData = result.domain || result.data?.domain;
          const amount =
            domainData?.pricing?.sellingPrice || domain.price || 12.99;
          const transactionId =
            result.transaction?.id || result.transaction?._id || "N/A";

          window.location.href = `/payment?domain=${encodeURIComponent(
            domain.name
          )}&amount=${amount}&transaction=${transactionId}`;
        } else {
          const errorMessage = {
            id: Date.now(),
            type: "ai",
            content:
              "I'm sorry, but there was an issue initiating the purchase for this domain. Please try again or contact support if the problem persists.",
            timestamp: new Date(),
            isError: true,
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      }
    } catch (error) {
      console.error("Domain action error:", error);
    }
  };

  const MessageBubble = ({ message }) => {
    const isUser = message.type === "user";

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      >
        <div
          className={`flex max-w-xs lg:max-w-2xl ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          <div className={`flex-shrink-0 ${isUser ? "ml-3" : "mr-3"}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isUser
                  ? "bg-primary-600"
                  : "bg-gradient-to-r from-purple-500 to-pink-500"
              }`}
            >
              {isUser ? (
                <UserIcon className="h-4 w-4 text-white" />
              ) : (
                <SparklesIcon className="h-4 w-4 text-white" />
              )}
            </div>
          </div>

          <div
            className={`px-4 py-2 rounded-2xl ${
              isUser
                ? "bg-primary-600 text-white"
                : message.isError
                ? "bg-red-100 text-red-800 border border-red-200"
                : "bg-white border border-gray-200 text-gray-800"
            }`}
          >
            <div className="whitespace-pre-wrap text-sm">{message.content}</div>

            {message.domains && message.domains.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.domains.map((domain, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3 border">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {domain.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          ${domain.price}/year
                        </p>
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={() => handleDomainAction(domain, "search")}
                          className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                        >
                          Check
                        </button>
                        {domain.available && (
                          <button
                            onClick={() =>
                              handleDomainAction(domain, "purchase")
                            }
                            className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-2 py-1 rounded"
                          >
                            Buy
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs opacity-70 mt-2">
              {message.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <SparklesIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  AI Domain Consultant
                </h1>
                <p className="text-purple-100 text-sm">
                  Your intelligent domain advisor
                </p>
              </div>
            </div>
          </div>

          {/* Debug Info (temporary) */}
          {import.meta.env.VITE_DEV_MODE === "true" && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="text-sm">
                <p>
                  <strong>Auth Status:</strong>{" "}
                  {isAuthenticated
                    ? "✅ Authenticated"
                    : "❌ Not Authenticated"}
                </p>
                <p>
                  <strong>User:</strong> {user?.email || "None"}
                </p>
                <p>
                  <strong>Token:</strong>{" "}
                  {localStorage.getItem("token") ? "✅ Present" : "❌ Missing"}
                </p>
                <p>
                  <strong>API URL:</strong>{" "}
                  {import.meta.env.VITE_NGROK_URL ||
                    import.meta.env.VITE_API_URL}
                </p>
                {!isAuthenticated && (
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        // For testing: Set the working token from the API tests
                        const testToken =
                          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NDVlZWU3ZWFlYTk5MGVhMzE5NWIyMyIsImlhdCI6MTc0OTQxNDU2MiwiZXhwIjoxNzUwMDE5MzYyfQ.m2ntrXQfbf4zWD_qPvV3hvRaYtSMw8otJD0h_sSLH2A";
                        localStorage.setItem("token", testToken);
                        window.location.reload();
                      }}
                      className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 mr-2"
                    >
                      Use Test Token
                    </button>
                    <button
                      onClick={() => (window.location.href = "/login")}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                    >
                      Go to Login
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Suggestions */}
          {messages.length === 1 && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Quick Start:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quickSuggestions.map((suggestion, index) => (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handleQuickSuggestion(suggestion)}
                    className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <suggestion.icon className="h-5 w-5 text-primary-600 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {suggestion.text}
                      </div>
                      <div className="text-xs text-gray-500">
                        {suggestion.category}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Container */}
          <div
            className="h-96 overflow-y-auto p-6"
            style={{ maxHeight: "500px" }}
          >
            <AnimatePresence>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start mb-4"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <SparklesIcon className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-white border border-gray-200 px-4 py-2 rounded-2xl">
                    <div className="loading-dots">
                      <div></div>
                      <div></div>
                      <div></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex space-x-4">
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about domains..."
                  rows={1}
                  className="w-full resize-none border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  style={{ minHeight: "44px", maxHeight: "120px" }}
                />
              </div>
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                className="btn-primary flex items-center justify-center w-12 h-12 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </div>

        {/* AI Suggestions Panel */}
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-white rounded-xl shadow-lg p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              AI Recommendations
            </h3>
            <div className="grid gap-4">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {suggestion.title}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {suggestion.description}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSendMessage(suggestion.action)}
                    className="btn-outline text-sm"
                  >
                    Explore
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Debug Info */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Debug Information
          </h4>
          <div className="text-xs text-gray-500">
            <div>
              <strong>Authenticated:</strong> {isAuthenticated ? "Yes" : "No"}
            </div>
            {isAuthenticated && user && (
              <div>
                <strong>User:</strong> {user.email}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConsultant;
