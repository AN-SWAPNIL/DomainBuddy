import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  Search,
  Bot,
  TrendingUp,
  DollarSign,
  Clock,
  ArrowRight,
  Plus,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import { domainService } from "../services/domainService";

const Dashboard = () => {
  const { user } = useAuth();
  const [recentDomains, setRecentDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentDomains = async () => {
      try {
        setLoading(true);
        const domains = await domainService.recentDomains();
        setRecentDomains(domains || []);
      } catch (error) {
        console.error("Error fetching recent domains:", error);
        setRecentDomains([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentDomains();
  }, []);

  const stats = [];

  const quickActions = [
    {
      title: "Search Domains",
      description: "Find your perfect domain name",
      icon: Search,
      to: "/search",
      color: "bg-blue-50 text-blue-600 border-blue-200",
    },
    {
      title: "AI Consultant",
      description: "Get AI-powered domain suggestions",
      icon: Bot,
      to: "/ai-consultant",
      color: "bg-purple-50 text-purple-600 border-purple-200",
    },
    {
      title: "My Domains",
      description: "Manage your domain portfolio",
      icon: Globe,
      to: "/my-domains",
      color: "bg-green-50 text-green-600 border-green-200",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-xl p-8 text-white"
      >
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {user?.first_name || "User"}! 👋
        </h1>
        <p className="text-blue-100 text-lg">
          Ready to discover your next perfect domain? Let's get started!
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="bg-white rounded-xl p-6 shadow-lg"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <TrendingUp className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {stat.value}
              </h3>
              <p className="text-gray-600 text-sm mb-1">{stat.title}</p>
              <p className="text-sm text-green-600">{stat.change}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="bg-white rounded-xl p-6 shadow-lg"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                to={action.to}
                className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${action.color}`}
              >
                <Icon className="w-8 h-8 mb-3" />
                <h3 className="font-semibold mb-1">{action.title}</h3>
                <p className="text-sm opacity-75">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </motion.div>

      {/* Recent Domains */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="bg-white rounded-xl p-6 shadow-lg"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Recent Domains</h2>
          <Link
            to="/my-domains"
            className="flex items-center text-primary-600 hover:text-primary-700 font-medium"
          >
            View All
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading recent domains...</p>
            </div>
          ) : recentDomains.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No domains found</p>
              <Link
                to="/search"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium inline-flex items-center mt-2"
              >
                Search for domains
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          ) : (
            recentDomains.map((domain, index) => (
              <div
                key={domain.id || index}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Globe className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {domain.full_domain || domain.domain_name || domain.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {domain.expiry_date 
                        ? `Expires: ${new Date(domain.expiry_date).toLocaleDateString()}`
                        : `Added: ${new Date(domain.created_at).toLocaleDateString()}`
                      }
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        (domain.status || 'active').toLowerCase() === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {domain.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {domain.value}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/search"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Domain
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
