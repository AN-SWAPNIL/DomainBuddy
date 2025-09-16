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
import ProfileCompleteModal from "../components/ui/ProfileCompleteModal";

const DomainSearch = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Profile modal state
  const [profileModalState, setProfileModalState] = useState({
    isOpen: false,
    domain: null,
    missingFields: [],
    onConfirm: null,
  });

  const showProfileModal = ({ domain, missingFields, onConfirm }) => {
    setProfileModalState({
      isOpen: true,
      domain,
      missingFields,
      onConfirm,
    });
  };

  const hideProfileModal = () => {
    setProfileModalState({
      isOpen: false,
      domain: null,
      missingFields: [],
      onConfirm: null,
    });
  };

  const { checkProfileAndProceed } = useProfileCheck(user, navigate, showProfileModal);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState(new Set());
  const [purchaseError, setPurchaseError] = useState(null);

  // Debug: Log user data when component mounts or user changes
  useEffect(() => {
    console.log("🧑‍💻 DomainSearch - Current user state:", user);
  }, [user]);

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

        // Check if result contains error information
        if (result.error) {
          setSearchResults([{
            name: searchTerm,
            available: false,
            price: 0,
            premium: false,
            error: true,
            errorMessage: result.message,
            registrar: "System",
            description: `Error: ${result.message}`,
          }]);
          return;
        }

        // Convert single domain result to expected format
        const singleDomain = [
          {
            name: result.domain || searchTerm,
            available: result.available,
            price: result.price,
            premium: false,
            registrar: "Namecheap",
            description: result.message || `Availability check for ${searchTerm}`,
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

        // Check if results contain error information
        if (results.error) {
          setSearchResults([{
            name: searchTerm,
            available: false,
            price: 0,
            premium: false,
            error: true,
            errorMessage: results.message,
            registrar: "System",
            description: `Error: ${results.message}`,
          }]);
          return;
        }

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
              price: result.price ,
              premium: result.isPremium,
              registrar: "Namecheap",
              description: result.available
                ? `Available for $${result.price}`
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
      // Show error in results instead of alert
      setSearchResults([{
        name: searchTerm || "search",
        available: false,
        price: 0,
        premium: false,
        error: true,
        errorMessage: "Service temporarily unavailable. Please try again later.",
        registrar: "System",
        description: "Error: Service temporarily unavailable. Please try again later.",
      }]);
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
    const canProceed = await checkProfileAndProceed(() => {
      proceedWithPurchase(domainName);
    }, domainName);

    if (!canProceed) {
      return; // Profile is incomplete, user will be redirected
    }

    // If we reach here, profile is complete, proceed with purchase
    // proceedWithPurchase(domainName);
  };

  const proceedWithPurchase = async (domainName) => {
    // Clear any previous purchase errors
    setPurchaseError(null);
    
    // Prevent multiple purchases of the same domain
    if (purchasedDomains.has(domainName)) {
      setPurchaseError(`${domainName} has already been added to your cart!`);
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
        setPurchaseError("Purchase failed. Please try again.");
      }
    } catch (error) {
      console.error("Purchase error:", error);

      // Handle specific error messages
      let errorMessage = `Purchase failed: ${error.message || 'Unknown error. Please try again.'}`;
      if (error.message?.includes("not available")) {
        errorMessage = `❌ ${domainName} is no longer available for registration. It may have been purchased by another user or already exists in our system.`;
      } else if (error.message?.includes("auth")) {
        errorMessage = "Please log in to purchase domains.";
      }

      setPurchaseError(errorMessage);
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
              {domain.price ? '$' + domain.price : ''}
            </div>
            <div className="text-sm text-gray-500">{domain.available ? '/year' : '' }</div>
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
            {/* Purchase Error Messages Section */}
            {purchaseError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-red-800">Purchase Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                      {purchaseError}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <button
                      onClick={() => setPurchaseError(null)}
                      className="inline-flex text-red-400 hover:text-red-500"
                    >
                      <span className="sr-only">Dismiss</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search Error Messages Section */}
            {searchResults.some(domain => domain.error) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Search Error
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      {searchResults.find(domain => domain.error)?.errorMessage}
                    </div>
                    <div className="mt-3">
                      <button
                        onClick={() => handleSearch()}
                        className="bg-red-100 px-3 py-1 rounded text-sm text-red-800 hover:bg-red-200 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Normal Results */}
            {!searchResults.some(domain => domain.error) && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Search Results ({searchResults.length} domains found)
                  </h2>
                  {searchResults.length > 10 && (
                    <div className="text-sm text-gray-500">
                      Showing comprehensive results like Namecheap for "{searchTerm}"
                    </div>
                  )}
                </div>
              </>
            )}
            
            {/* Results Grid - organized by availability and price */}
            <div className="space-y-6">
              {/* Available Domains Section */}
              {searchResults.filter(domain => !domain.error && domain.available).length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-green-700 mb-3">
                    Available Domains ({searchResults.filter(domain => !domain.error && domain.available).length})
                  </h3>
                  <div className="grid gap-4">
                    {searchResults
                      .filter(domain => !domain.error && domain.available)
                      .sort((a, b) => a.price - b.price) // Sort by price
                      .map((domain, index) => (
                        <DomainCard
                          key={`available-${domain.name}-${index}`}
                          domain={domain}
                          onPurchase={handlePurchase}
                        />
                      ))}
                  </div>
                </div>
              )}
              
              {/* Unavailable Domains Section */}
              {searchResults.filter(domain => !domain.error && !domain.available).length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-600 mb-3">
                    Unavailable Domains ({searchResults.filter(domain => !domain.error && !domain.available).length})
                  </h3>
                  <div className="grid gap-4">
                    {searchResults
                      .filter(domain => !domain.error && !domain.available)
                      .map((domain, index) => (
                        <DomainCard
                          key={`unavailable-${domain.name}-${index}`}
                          domain={domain}
                          onPurchase={handlePurchase}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Profile Complete Modal */}
      <ProfileCompleteModal
        isOpen={profileModalState.isOpen}
        onClose={hideProfileModal}
        onGoToProfile={() => {
          if (profileModalState.onConfirm) {
            profileModalState.onConfirm();
          }
          hideProfileModal();
        }}
        missingFields={profileModalState.missingFields}
        domainName={profileModalState.domain}
      />
    </div>
  );
};

export default DomainSearch;
