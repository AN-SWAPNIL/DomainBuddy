import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeftIcon,
  GlobeAltIcon,
  CalendarIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { domainService } from '../services/domainService';
import SubdomainManager from '../components/domains/SubdomainManager';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const DomainDetails = () => {
  const [domain, setDomain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchDomainDetails();
    }
  }, [id]);

  const fetchDomainDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 DomainDetails - Fetching domain with ID:', id);
      const response = await domainService.getDomainById(id);
      console.log('🔍 DomainDetails - Raw response:', response);
      const domainData = response.data || response;
      console.log('🔍 DomainDetails - Domain data:', domainData);
      setDomain(domainData);
    } catch (err) {
      console.error('Failed to fetch domain details:', err);
      setError('Could not load domain details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'expiring':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
      case 'expired':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-blue-600" />;
      default:
        return <GlobeAltIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'expiring':
        return 'text-yellow-600 bg-yellow-100';
      case 'expired':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Domain</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/my-domains')}
            className="btn-primary"
          >
            Back to My Domains
          </button>
        </div>
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <GlobeAltIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Domain Not Found</h2>
          <p className="text-gray-600 mb-4">The requested domain could not be found.</p>
          <button
            onClick={() => navigate('/my-domains')}
            className="btn-primary"
          >
            Back to My Domains
          </button>
        </div>
      </div>
    );
  }

  const daysUntilExpiry = getDaysUntilExpiry(domain.expiry_date || domain.expiryDate);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/my-domains')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to My Domains
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {domain.full_domain || domain.name}
              </h1>
              <div className="flex items-center mt-2">
                {getStatusIcon(domain.status)}
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(domain.status)}`}>
                  {domain.status.charAt(0).toUpperCase() + domain.status.slice(1)}
                </span>
              </div>
            </div>
            
            {(domain.status === 'expiring' || domain.status === 'expired') && (
              <button className="btn-primary">
                Renew Domain
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Domain Information */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <GlobeAltIcon className="h-5 w-5 mr-2 text-blue-600" />
                  Domain Information
                </h2>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Status</span>
                  <div className="flex items-center">
                    {getStatusIcon(domain.status)}
                    <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(domain.status)}`}>
                      {domain.status.charAt(0).toUpperCase() + domain.status.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Registration Date</span>
                  <span className="text-sm text-gray-900">
                    {formatDate(domain.registration_date || domain.registrationDate)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Expiry Date</span>
                  <div className="text-right">
                    <span className="text-sm text-gray-900">
                      {formatDate(domain.expiry_date || domain.expiryDate)}
                    </span>
                    {daysUntilExpiry !== null && (
                      <div className={`text-xs mt-1 ${
                        daysUntilExpiry <= 30 ? 'text-red-600' : 
                        daysUntilExpiry <= 60 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {daysUntilExpiry > 0 
                          ? `${daysUntilExpiry} days remaining`
                          : 'Expired'
                        }
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Auto Renew</span>
                  <span className="text-sm text-gray-900">
                    {domain.auto_renew ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Registrar</span>
                  <span className="text-sm text-gray-900">
                    {domain.registrar || 'Namecheap'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">WHOIS Privacy</span>
                  <div className="flex items-center">
                    <ShieldCheckIcon className="h-4 w-4 text-green-600 mr-1" />
                    <span className="text-sm text-gray-900">
                      {domain.whois_privacy !== false ? 'Protected' : 'Not Protected'}
                    </span>
                  </div>
                </div>

                {(domain.cost || domain.selling_price) && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Purchase Price</span>
                      <div className="flex items-center">
                        <CurrencyDollarIcon className="h-4 w-4 text-green-600 mr-1" />
                        <span className="text-sm font-semibold text-gray-900">
                          ${domain.cost || domain.selling_price}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden mt-6">
              <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
              </div>
              
              <div className="p-6 space-y-3">
                <button className="w-full btn-outline text-sm">
                  Configure DNS Settings
                </button>
                <button className="w-full btn-outline text-sm">
                  Transfer Domain
                </button>
                <button className="w-full btn-outline text-sm">
                  Domain Parking
                </button>
                {(domain.status === 'expiring' || domain.status === 'expired') && (
                  <button className="w-full btn-primary text-sm">
                    Renew Domain
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Subdomain Management */}
          <div className="lg:col-span-2">
            <SubdomainManager domain={domain} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DomainDetails;
