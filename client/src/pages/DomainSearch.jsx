import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { domainService } from "../services/domainService";
import { useProfileCheck } from "../utils/profileValidation";

const DomainSearch = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { checkProfileAndProceed } = useProfileCheck(user, navigate);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState(new Set());

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      // Check if search term contains a dot (extension)
      const hasExtension = searchTerm.includes(".");

      if (hasExtension) {
        // Use checkAvailability for domains with extensions
        console.log(
          "🔍 Checking availability for domain with extension:",
          searchTerm
        );
        const result = await domainService.checkAvailability(searchTerm);
        console.log("🔍 Domain availability result:", result);

        // Convert single domain result to expected format
        const singleDomain = [
          {
            name: result.domain || searchTerm,
            available: result.available,
            price: result.price || 12.99,
            premium: false,
            registrar: "Namecheap",
            description: `Availability check for ${searchTerm}`,
          },
        ];

        setSearchResults(singleDomain);
        console.log("✅ Processed single domain result:", singleDomain);
      } else {
        // Use searchDomains for search terms without extensions
        console.log(
          "🔍 Searching domains for term without extension:",
          searchTerm
        );
        const results = await domainService.searchDomains(searchTerm);
        console.log("🔍 Domain search results:", results);

        // The API returns {query: 'searchTerm', results: []}
        // Convert results to the expected format
        const allDomains = [];

        if (results.results && Array.isArray(results.results)) {
          // Convert results to the expected format
          const domainList = results.results.map((result) => {
            console.log("🔄 Processing domain result:", result);
            return {
              name: result.domain,
              available: result.available,
              price: result.available ? result.price || 12.99 : 0,
              premium: result.isPremium || false,
              registrar: "Namecheap",
              description: result.available
                ? `Available for $${result.price || 12.99}`
                : result.reason || "Not available",
            };
          });
          console.log("🔄 Mapped domain list:", domainList);
          allDomains.push(...domainList);
        }

        setSearchResults(allDomains);
        console.log("✅ Processed search results:", allDomains);
      }
    } catch (error) {
      console.error("Search error:", error);
      // Show user-friendly error message
      alert(
        "Search failed. Please try again or check your internet connection."
      );
    } finally {
      setLoading(false);
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
    // Check if profile is complete before proceeding
    const canProceed = checkProfileAndProceed(() => {
      proceedWithPurchase(domainName);
    }, domainName);

    if (!canProceed) {
      return; // Profile is incomplete, user will be redirected
    }

    // If we reach here, profile is complete, proceed with purchase
    proceedWithPurchase(domainName);
  };

  const proceedWithPurchase = async (domainName) => {
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
      };

      const result = await domainService.purchaseDomain(purchaseData);
      console.log("✅ Purchase result:", result);

      if (result.success) {
        // Add to purchased domains set to prevent re-purchasing
        setPurchasedDomains((prev) => new Set([...prev, domainName]));

        // Handle successful purchase initiation
        const transactionId = result.data.transaction?.id || "N/A";
        const domain = result.data.domain;
        const amount = domain?.selling_price || 12.99;

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
          <p className="text-gray-600">Search for available domains</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSearch} className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter domain name (e.g., mysite or mysite.com)"
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
      </div>
    </div>
  );
};

export default DomainSearch;
