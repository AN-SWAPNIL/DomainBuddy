import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GlobeAltIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { domainService } from "../services/domainService";

const MyDomains = () => {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedDomain, setSelectedDomain] = useState(null); // Will store { id, name }
  const [showDNSModal, setShowDNSModal] = useState(false);
  const [dnsRecords, setDnsRecords] = useState([]);

  const statusFilters = [
    { value: "all", label: "All Domains" },
    { value: "active", label: "Active" },
    { value: "expiring", label: "Expiring Soon" },
    { value: "expired", label: "Expired" },
  ];

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const response = await domainService.getUserDomains();
      console.log("Domains response:", response); // Debug log
      // Handle paginated response structure
      if (response.docs) {
        setDomains(response.docs);
      } else if (response.domains) {
        setDomains(response.domains);
      } else if (Array.isArray(response)) {
        setDomains(response);
      } else {
        setDomains([]);
      }
    } catch (error) {
      console.error("Error fetching domains:", error);
      setDomains([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRenewDomain = async (domainName) => {
    try {
      await domainService.renewDomain(domainName);
      fetchDomains(); // Refresh the list
      alert(`${domainName} has been renewed successfully!`);
    } catch (error) {
      console.error("Renewal error:", error);
      alert("Failed to renew domain. Please try again.");
    }
  };

  const handleManageDNS = async (domainId, domainName) => {
    try {
      const records = await domainService.getDNSRecords(domainId);
      setDnsRecords(records);
      setSelectedDomain({ id: domainId, name: domainName });
      setShowDNSModal(true);
    } catch (error) {
      console.error("DNS error:", error);
      alert("Failed to load DNS records.");
    }
  };

  const filteredDomains = domains.filter((domain) => {
    const matchesSearch = domain.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterStatus === "all" || domain.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getDomainStatusColor = (status) => {
    switch (status) {
      case "active":
        return "text-green-600 bg-green-100";
      case "expiring":
        return "text-yellow-600 bg-yellow-100";
      case "expired":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getDomainStatusIcon = (status) => {
    switch (status) {
      case "active":
        return CheckCircleIcon;
      case "expiring":
      case "expired":
        return ExclamationTriangleIcon;
      default:
        return GlobeAltIcon;
    }
  };

  const DomainCard = ({ domain }) => {
    const StatusIcon = getDomainStatusIcon(domain.status);
    const expiryDate = new Date(domain.expiryDate);
    const daysUntilExpiry = Math.ceil(
      (expiryDate - new Date()) / (1000 * 60 * 60 * 24)
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <GlobeAltIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {domain.name}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <StatusIcon className="h-4 w-4" />
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${getDomainStatusColor(
                    domain.status
                  )}`}
                >
                  {domain.status.charAt(0).toUpperCase() +
                    domain.status.slice(1)}
                </span>
              </div>
              <div className="flex items-center space-x-4 mt-3 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="h-4 w-4" />
                  <span>Expires: {expiryDate.toLocaleDateString()}</span>
                </div>
                {daysUntilExpiry <= 30 && (
                  <div className="text-red-600 font-medium">
                    {daysUntilExpiry > 0
                      ? `${daysUntilExpiry} days left`
                      : "Expired"}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <button
              onClick={() => handleManageDNS(domain._id, domain.fullDomain)}
              className="btn-outline text-sm flex items-center space-x-1"
            >
              <Cog6ToothIcon className="h-4 w-4" />
              <span>Manage DNS</span>
            </button>
            {(domain.status === "expiring" || domain.status === "expired") && (
              <button
                onClick={() => handleRenewDomain(domain.name)}
                className="btn-primary text-sm"
              >
                Renew Domain
              </button>
            )}
          </div>
        </div>

        {/* Domain Stats */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {domain.traffic || 0}
              </div>
              <div className="text-xs text-gray-500">Monthly Visits</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                ${domain.estimatedValue || 0}
              </div>
              <div className="text-xs text-gray-500">Est. Value</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {domain.age || 0}y
              </div>
              <div className="text-xs text-gray-500">Domain Age</div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const DNSModal = () => {
    const [newRecord, setNewRecord] = useState({
      type: "A",
      name: "",
      value: "",
      ttl: 3600,
    });

    const handleAddRecord = async () => {
      try {
        await domainService.addDNSRecord(selectedDomain.name, newRecord);
        const updatedRecords = await domainService.getDNSRecords(
          selectedDomain.id
        );
        setDnsRecords(updatedRecords);
        setNewRecord({ type: "A", name: "", value: "", ttl: 3600 });
        alert("DNS record added successfully!");
      } catch (error) {
        console.error("Add DNS record error:", error);
        alert("Failed to add DNS record.");
      }
    };

    const handleDeleteRecord = async (recordId) => {
      try {
        await domainService.deleteDNSRecord(selectedDomain.name, recordId);
        const updatedRecords = await domainService.getDNSRecords(
          selectedDomain.id
        );
        setDnsRecords(updatedRecords);
        alert("DNS record deleted successfully!");
      } catch (error) {
        console.error("Delete DNS record error:", error);
        alert("Failed to delete DNS record.");
      }
    };

    if (!showDNSModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                DNS Management - {selectedDomain?.name}
              </h2>
              <button
                onClick={() => setShowDNSModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Add New Record */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Add DNS Record
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <select
                  value={newRecord.type}
                  onChange={(e) =>
                    setNewRecord({ ...newRecord, type: e.target.value })
                  }
                  className="input"
                >
                  <option value="A">A</option>
                  <option value="AAAA">AAAA</option>
                  <option value="CNAME">CNAME</option>
                  <option value="MX">MX</option>
                  <option value="TXT">TXT</option>
                </select>
                <input
                  type="text"
                  placeholder="Name"
                  value={newRecord.name}
                  onChange={(e) =>
                    setNewRecord({ ...newRecord, name: e.target.value })
                  }
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={newRecord.value}
                  onChange={(e) =>
                    setNewRecord({ ...newRecord, value: e.target.value })
                  }
                  className="input"
                />
                <input
                  type="number"
                  placeholder="TTL"
                  value={newRecord.ttl}
                  onChange={(e) =>
                    setNewRecord({
                      ...newRecord,
                      ttl: parseInt(e.target.value),
                    })
                  }
                  className="input"
                />
                <button
                  onClick={handleAddRecord}
                  className="btn-primary flex items-center justify-center"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* DNS Records List */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-900">
                Current Records
              </h3>
              {dnsRecords.map((record, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <div className="grid grid-cols-4 gap-4 flex-1">
                    <div>
                      <span className="text-xs font-medium text-gray-500">
                        Type
                      </span>
                      <div className="font-medium">{record.type}</div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">
                        Name
                      </span>
                      <div className="font-medium">{record.name || "@"}</div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">
                        Value
                      </span>
                      <div className="font-medium truncate">{record.value}</div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">
                        TTL
                      </span>
                      <div className="font-medium">{record.ttl}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteRecord(record.id)}
                    className="text-red-600 hover:text-red-800 ml-4"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {dnsRecords.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No DNS records found for this domain.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="loading-dots text-primary-600">
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Domains</h1>
            <p className="text-gray-600 mt-1">Manage your domain portfolio</p>
          </div>
          <button className="btn-primary flex items-center space-x-2">
            <PlusIcon className="h-4 w-4" />
            <span>Add Domain</span>
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search domains..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-4 w-4 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input"
              >
                {statusFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Domain Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <GlobeAltIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {domains.length}
                </div>
                <div className="text-sm text-gray-600">Total Domains</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {domains.filter((d) => d.status === "active").length}
                </div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {domains.filter((d) => d.status === "expiring").length}
                </div>
                <div className="text-sm text-gray-600">Expiring Soon</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <ChartBarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  $
                  {domains
                    .reduce((sum, d) => sum + (d.estimatedValue || 0), 0)
                    .toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Portfolio Value</div>
              </div>
            </div>
          </div>
        </div>

        {/* Domains Grid */}
        {filteredDomains.length > 0 ? (
          <div className="grid gap-6">
            <AnimatePresence>
              {filteredDomains.map((domain, index) => (
                <DomainCard key={domain.id || index} domain={domain} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-12">
            <GlobeAltIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No domains found
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterStatus !== "all"
                ? "Try adjusting your search or filter criteria."
                : "Get started by purchasing your first domain."}
            </p>
            <button className="btn-primary">Search Domains</button>
          </div>
        )}

        <DNSModal />
      </div>
    </div>
  );
};

export default MyDomains;
