import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon,
  GlobeAltIcon,
  ServerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import subdomainService from '../../services/subdomainService';
import LoadingSpinner from '../ui/LoadingSpinner';
import SubdomainForm from './SubdomainForm';

const SubdomainManager = ({ domain }) => {
  const [subdomains, setSubdomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSubdomain, setEditingSubdomain] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (domain?.id) {
      fetchSubdomains();
    }
  }, [domain]);

  const fetchSubdomains = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subdomainService.getSubdomains(domain.id);
      setSubdomains(response.data?.subdomains || []);
    } catch (err) {
      console.error('Failed to fetch subdomains:', err);
      setError(err.response?.data?.message || 'Failed to load subdomains. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubdomain = async (subdomainData) => {
    try {
      setLoading(true);
      await subdomainService.createSubdomain(domain.id, subdomainData);
      setShowForm(false);
      await fetchSubdomains();
      setError(null);
    } catch (err) {
      console.error('Failed to create subdomain:', err);
      setError(err.response?.data?.message || 'Failed to create subdomain. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubdomain = async (subdomainData) => {
    try {
      setLoading(true);
      await subdomainService.updateSubdomain(
        domain.id,
        editingSubdomain.id,
        subdomainData
      );
      setShowForm(false);
      setEditingSubdomain(null);
      await fetchSubdomains();
      setError(null);
    } catch (err) {
      console.error('Failed to update subdomain:', err);
      setError(err.response?.data?.message || 'Failed to update subdomain. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubdomain = async (subdomainId) => {
    if (!window.confirm('Are you sure you want to delete this subdomain? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(subdomainId);
      await subdomainService.deleteSubdomain(domain.id, subdomainId);
      await fetchSubdomains();
      setError(null);
    } catch (err) {
      console.error('Failed to delete subdomain:', err);
      setError(err.response?.data?.message || 'Failed to delete subdomain. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handleEditClick = (subdomain) => {
    setEditingSubdomain(subdomain);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingSubdomain(null);
  };

  const getRecordTypeIcon = (type) => {
    switch (type) {
      case 'A':
      case 'AAAA':
        return <ServerIcon className="h-4 w-4" />;
      case 'CNAME':
        return <GlobeAltIcon className="h-4 w-4" />;
      default:
        return <ServerIcon className="h-4 w-4" />;
    }
  };

  const getRecordTypeBadgeColor = (type) => {
    switch (type) {
      case 'A':
        return 'bg-blue-100 text-blue-800';
      case 'CNAME':
        return 'bg-green-100 text-green-800';
      case 'AAAA':
        return 'bg-purple-100 text-purple-800';
      case 'MX':
        return 'bg-orange-100 text-orange-800';
      case 'TXT':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <GlobeAltIcon className="h-6 w-6 mr-2 text-blue-600" />
              Subdomains
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage subdomains for {domain?.full_domain}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingSubdomain(null);
              setShowForm(!showForm);
            }}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            {showForm ? 'Cancel' : 'Add Subdomain'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-l-4 border-red-400 bg-red-50 p-4 mx-6 mt-4 rounded"
          >
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-gray-200"
          >
            <div className="p-6">
              <SubdomainForm
                domain={domain}
                initialData={editingSubdomain}
                onSubmit={editingSubdomain ? handleUpdateSubdomain : handleCreateSubdomain}
                onCancel={handleCancelForm}
                loading={loading}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="p-6">
        {loading && !showForm && (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        )}

        {!loading && subdomains.length === 0 && !showForm && (
          <div className="text-center py-12">
            <GlobeAltIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No subdomains</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first subdomain.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Subdomain
              </button>
            </div>
          </div>
        )}

        {!loading && subdomains.length > 0 && (
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subdomain
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TTL
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <AnimatePresence>
                  {subdomains.map((subdomain) => (
                    <motion.tr
                      key={subdomain.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                              {getRecordTypeIcon(subdomain.record_type)}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {subdomain.subdomain_name}.{domain.full_domain}
                            </div>
                            <div className="text-sm text-gray-500">
                              Created {new Date(subdomain.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRecordTypeBadgeColor(subdomain.record_type)}`}>
                          {subdomain.record_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {subdomain.target_value}
                        </code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {subdomain.ttl}s
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircleIcon className="h-3 w-3 mr-1" />
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditClick(subdomain)}
                            disabled={loading || deleting === subdomain.id}
                            className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Edit subdomain"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubdomain(subdomain.id)}
                            disabled={loading || deleting === subdomain.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Delete subdomain"
                          >
                            {deleting === subdomain.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <TrashIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* DNS Propagation Info */}
        {subdomains.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  DNS Propagation Information
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    After creating or updating subdomains, it may take 15 minutes to 48 hours for changes to propagate globally. 
                    Lower TTL values will result in faster propagation but may increase DNS query load.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubdomainManager;
