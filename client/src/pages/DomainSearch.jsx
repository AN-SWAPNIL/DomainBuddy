import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlassIcon,
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { domainService } from "../services/domainService";
import { aiService } from "../services/aiService";

const DomainSearch = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState(new Set());
  const [businessDescription, setBusinessDescription] = useState("");
  const [activeTab, setActiveTab] = useState("search");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const results = await domainService.searchDomains(searchTerm);
      console.log("🔍 Domain search results:", results);

      // The API returns {directMatches: [], aiSuggestions: []}
      // Combine both arrays for display
      const allDomains = [];

      if (results.directMatches) {
        // Convert directMatches to the expected format
        const directDomains = results.directMatches.map((match) => ({
          name: match.domain.includes(".")
            ? match.domain
            : `${match.domain}.com`,
          available: match.available,
          price: match.price || 12.99,
          premium: false,
          registrar: "Namecheap",
          description: `Direct match for ${searchTerm}`,
        }));
        allDomains.push(...directDomains);
      }

      if (results.aiSuggestions) {
        // Convert aiSuggestions to the expected format
        const aiDomains = results.aiSuggestions.map((suggestion) => ({
          name: suggestion.domain,
          available: true, // AI suggestions are typically available
          price: 12.99,
          premium: suggestion.brandabilityScore > 8,
          registrar: "Namecheap",
          description: suggestion.reasoning,
        }));
        allDomains.push(...aiDomains);
      }

      setSearchResults(allDomains);
      console.log("✅ Processed search results:", allDomains);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAISuggestions = async () => {
    if (!businessDescription.trim()) return;

    setLoadingAI(true);
    try {
      const response = await aiService.getDomainSuggestions(
        businessDescription
      );
      console.log("🔍 AI suggestions response:", response);

      // The API returns {suggestions: [...]}
      const suggestions = response.suggestions || [];

      // Convert suggestions to the expected format
      const formattedSuggestions = suggestions.map((suggestion, index) => ({
        name: suggestion.domain || suggestion.name || `suggestion-${index}.com`,
        available: true, // AI suggestions are typically available
        price: suggestion.price || 12.99,
        premium: suggestion.brandabilityScore > 8,
        registrar: "Namecheap",
        description:
          suggestion.reasoning ||
          suggestion.description ||
          "AI generated domain suggestion",
      }));

      setAiSuggestions(formattedSuggestions);
      console.log("✅ Processed AI suggestions:", formattedSuggestions);
    } catch (error) {
      console.error("AI suggestions error:", error);
    } finally {
      setLoadingAI(false);
    }
  };

  const toggleDomainSelection = (domain) => {
    const newSelected = new Set(selectedDomains);
    if (newSelected.has(domain)) {
      newSelected.delete(domain);
    } else {
      newSelected.add(domain);
    }
    setSelectedDomains(newSelected);
  };

  const [purchasedDomains, setPurchasedDomains] = useState(new Set());

  const handlePurchase = async (domainName) => {
    // Prevent multiple purchases of the same domain
    if (purchasedDomains.has(domainName)) {
      alert(`${domainName} has already been added to your cart!`);
      return;
    }

    try {
      console.log("🛒 Attempting to purchase domain:", domainName);

      // Prepare the request data as expected by the backend
      const purchaseData = {
        domain: domainName,
        years: 1, // Default to 1 year
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
      console.log("✅ Purchase result:", result);

      if (result.success || result.domain) {
        // Add to purchased domains set to prevent re-purchasing
        setPurchasedDomains((prev) => new Set([...prev, domainName]));

        // Handle successful purchase initiation
        const transactionId =
          result.transaction?.id || result.transaction?._id || "N/A";

        // Redirect to payment page with domain and amount
        const domain = result.domain || result.data?.domain;
        const amount = domain?.pricing?.sellingPrice || 12.99;

        // Navigate to payment page with URL parameters
        window.location.href = `/payment?domain=${encodeURIComponent(
          domainName
        )}&amount=${amount}&transaction=${transactionId}`;
      } else {
        alert("Purchase failed. Please try again.");
      }
    } catch (error) {
      console.error("Purchase error:", error);

      // Handle specific error messages
      let errorMessage = "Purchase failed. Please try again.";
      if (error.message?.includes("not available")) {
        errorMessage = `❌ ${domainName} is no longer available for registration.\n\nIt may have been purchased by another user or already exists in our system.`;
      } else if (error.message?.includes("auth")) {
        errorMessage = "Please log in to purchase domains.";
      }

      alert(errorMessage);
    }
  };

  const getDomainStatus = (domain) => {
    if (domain.available) {
      return {
        status: "available",
        color: "text-green-600",
        icon: CheckCircleIcon,
      };
    } else if (domain.premium) {
      return { status: "premium", color: "text-yellow-600", icon: ClockIcon };
    } else {
      return { status: "taken", color: "text-red-600", icon: XCircleIcon };
    }
  };

  const DomainCard = ({
    domain,
    onPurchase,
    onToggleSelect,
    isSelected,
    showSelect = false,
  }) => {
    const { status, color, icon: Icon } = getDomainStatus(domain);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {showSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(domain.name)}
                className="h-4 w-4 text-primary-600 rounded border-gray-300"
              />
            )}
            <div>
              <h3 className="font-semibold text-lg">{domain.name}</h3>
              <div className="flex items-center space-x-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className={`text-sm font-medium ${color} capitalize`}>
                  {status}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              ${domain.price}
            </div>
            <div className="text-sm text-gray-500">/year</div>
            {domain.available && (
              <button
                onClick={() => onPurchase(domain.name)}
                className="mt-2 btn-primary text-sm"
              >
                Purchase
              </button>
            )}
          </div>
        </div>
        {domain.description && (
          <p className="mt-3 text-sm text-gray-600">{domain.description}</p>
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Find Your Perfect Domain
          </h1>
          <p className="text-gray-600">
            Search for domains or get AI-powered suggestions for your business
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            <button
              onClick={() => setActiveTab("search")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "search"
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <MagnifyingGlassIcon className="h-4 w-4 inline mr-2" />
              Search Domains
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "ai"
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <SparklesIcon className="h-4 w-4 inline mr-2" />
              AI Suggestions
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "search" && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Search Form */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <form onSubmit={handleSearch} className="flex space-x-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Enter domain name (e.g., myawesomesite)"
                      className="input"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex items-center space-x-2"
                  >
                    {loading ? (
                      <div className="loading-dots">
                        <div></div>
                        <div></div>
                        <div></div>
                      </div>
                    ) : (
                      <>
                        <MagnifyingGlassIcon className="h-4 w-4" />
                        <span>Search</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Search Results
                  </h2>
                  <div className="grid gap-4">
                    {searchResults.map((domain, index) => (
                      <DomainCard
                        key={index}
                        domain={domain}
                        onPurchase={handlePurchase}
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "ai" && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* AI Input Form */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Describe Your Business
                </h2>
                <div className="space-y-4">
                  <textarea
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    placeholder="Tell us about your business, target audience, industry, or keywords..."
                    rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    onClick={handleAISuggestions}
                    disabled={loadingAI || !businessDescription.trim()}
                    className="btn-primary flex items-center space-x-2"
                  >
                    {loadingAI ? (
                      <div className="loading-dots">
                        <div></div>
                        <div></div>
                        <div></div>
                      </div>
                    ) : (
                      <>
                        <SparklesIcon className="h-4 w-4" />
                        <span>Get AI Suggestions</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* AI Suggestions */}
              {aiSuggestions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">
                      AI Suggestions
                    </h2>
                    {selectedDomains.size > 0 && (
                      <div className="text-sm text-gray-600">
                        {selectedDomains.size} selected
                      </div>
                    )}
                  </div>
                  <div className="grid gap-4">
                    {aiSuggestions.map((domain, index) => (
                      <DomainCard
                        key={index}
                        domain={domain}
                        onPurchase={handlePurchase}
                        onToggleSelect={toggleDomainSelection}
                        isSelected={selectedDomains.has(domain.name)}
                        showSelect={true}
                      />
                    ))}
                  </div>
                  {selectedDomains.size > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            Bulk Actions
                          </h3>
                          <p className="text-sm text-gray-600">
                            {selectedDomains.size} domains selected
                          </p>
                        </div>
                        <div className="space-x-2">
                          <button className="btn-outline">
                            Compare Selected
                          </button>
                          <button className="btn-primary">Purchase All</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DomainSearch;
