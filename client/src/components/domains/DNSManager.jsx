import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ServerIcon,
  GlobeAltIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { domainService } from '../../services/domainService';
import LoadingSpinner from '../ui/LoadingSpinner';

const DNSManager = ({ domain }) => {
  const [dnsRecords, setDnsRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (domain?.id) {
      fetchDNSRecords();
    }
  }, [domain?.id]);

  const fetchDNSRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 DNSManager - Fetching DNS records for domain:', domain.full_domain);
      const records = await domainService.getDNSRecords(domain.id);
      console.log('✅ DNSManager - Fetched DNS records:', records);
      setDnsRecords(Array.isArray(records) ? records : []);
    } catch (err) {
      console.error('❌ DNSManager - Error fetching DNS records:', err);
      setError(err.response?.data?.message || 'Failed to load DNS records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDNSRecords();
    setRefreshing(false);
  };

  const getRecordTypeIcon = (type) => {
    switch (type) {
      case 'A':
      case 'AAAA':
        return <ServerIcon className="h-4 w-4" />;
      case 'CNAME':
        return <GlobeAltIcon className="h-4 w-4" />;
      case 'MX':
        return <InformationCircleIcon className="h-4 w-4" />;
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
      case 'NS':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRecordValue = (record) => {
    // Handle different record value formats from Namecheap
    return record.value || record.address || record.Address || 'N/A';
  };

  const formatRecordName = (record) => {
    // Handle different record name formats from Namecheap
    const name = record.name || record.Name || record.host || record.Host;
    return name === '@' ? `${domain.full_domain} (root)` : `${name}.${domain.full_domain}`;
  };

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <ServerIcon className="h-6 w-6 mr-2 text-green-600" />
              DNS Records
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              View and manage DNS records for {domain?.full_domain}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
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

      {/* Content */}
      <div className="p-6">
        {loading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        )}

        {!loading && dnsRecords.length === 0 && (
          <div className="text-center py-12">
            <ServerIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No DNS records found</h3>
            <p className="mt-1 text-sm text-gray-500">
              This domain doesn't have any DNS records configured yet.
            </p>
          </div>
        )}

        {!loading && dnsRecords.length > 0 && (
          <>
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      TTL
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <AnimatePresence>
                    {dnsRecords.map((record, index) => (
                      <motion.tr
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                {getRecordTypeIcon(record.type || record.Type)}
                              </div>
                            </div>
                            <div className="ml-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRecordTypeBadgeColor(record.type || record.Type)}`}>
                                {record.type || record.Type}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatRecordName(record)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all">
                            {formatRecordValue(record)}
                          </code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.ttl || record.TTL || 'Default'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.priority || record.Priority || record.mxPref || '-'}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Information Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <InformationCircleIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    About DNS Records
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>A Records:</strong> Point your domain to IPv4 addresses</li>
                      <li><strong>CNAME Records:</strong> Create aliases pointing to other domains</li>
                      <li><strong>MX Records:</strong> Configure email servers for your domain</li>
                      <li><strong>TXT Records:</strong> Store text information (SPF, DKIM, verification)</li>
                      <li><strong>NS Records:</strong> Define nameservers for your domain</li>
                    </ul>
                    <p className="mt-2">
                      Changes to DNS records can take 15 minutes to 48 hours to propagate globally.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DNSManager;
