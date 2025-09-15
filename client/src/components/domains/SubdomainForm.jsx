import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import subdomainService from '../../services/subdomainService';

const SubdomainForm = ({ domain, initialData, onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    subdomainName: '',
    recordType: 'A',
    targetValue: '',
    ttl: 3600
  });
  const [errors, setErrors] = useState({});
  const [isValidating, setIsValidating] = useState(false);

  const recordTypeOptions = subdomainService.getRecordTypeOptions();
  const ttlOptions = subdomainService.getTTLOptions();

  useEffect(() => {
    if (initialData) {
      setFormData({
        targetValue: initialData.target_value || '',
        ttl: initialData.ttl || 3600,
        subdomainName: initialData.subdomain_name || '',
        recordType: initialData.record_type || 'A'
      });
    } else {
      setFormData({
        subdomainName: '',
        recordType: 'A',
        targetValue: '',
        ttl: 3600
      });
    }
    setErrors({});
  }, [initialData]);

  const validateForm = () => {
    const newErrors = {};
    
    // Validate subdomain name (only for new subdomains)
    if (!initialData) {
      if (!formData.subdomainName.trim()) {
        newErrors.subdomainName = 'Subdomain name is required';
      } else if (!subdomainService.validateSubdomainName(formData.subdomainName)) {
        newErrors.subdomainName = 'Invalid format. Use letters, numbers, and hyphens. Cannot start or end with hyphen.';
      }
    }

    // Validate target value
    if (!formData.targetValue.trim()) {
      newErrors.targetValue = 'Target value is required';
    } else if (!subdomainService.validateTargetValue(formData.recordType, formData.targetValue)) {
      newErrors.targetValue = subdomainService.getValidationErrorMessage(formData.recordType);
    }

    // Validate TTL
    if (formData.ttl < 60 || formData.ttl > 86400) {
      newErrors.ttl = 'TTL must be between 60 and 86400 seconds';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleRecordTypeChange = (e) => {
    const newRecordType = e.target.value;
    setFormData(prev => ({ 
      ...prev, 
      recordType: newRecordType,
      targetValue: '' // Clear target value when changing record type
    }));
    
    // Clear target value error
    if (errors.targetValue) {
      setErrors(prev => ({ ...prev, targetValue: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsValidating(true);
    
    try {
      // For updates, we only need to send target and ttl
      const submitData = initialData 
        ? { 
            target_value: formData.targetValue.trim(), 
            ttl: parseInt(formData.ttl) 
          }
        : {
            subdomain_name: formData.subdomainName.trim(),
            record_type: formData.recordType,
            target_value: formData.targetValue.trim(),
            ttl: parseInt(formData.ttl)
          };
      
      await onSubmit(submitData);
    } catch (error) {
      // Error is handled by parent component
    } finally {
      setIsValidating(false);
    }
  };

  const getTargetValuePlaceholder = () => {
    switch (formData.recordType) {
      case 'A':
        return '192.168.1.1';
      case 'CNAME':
        return 'example.com';
      case 'AAAA':
        return '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      case 'MX':
        return 'mail.example.com';
      case 'TXT':
        return 'v=spf1 include:_spf.google.com ~all';
      default:
        return '';
    }
  };

  const getHelpText = () => {
    switch (formData.recordType) {
      case 'A':
        return 'Enter the IPv4 address where this subdomain should point to';
      case 'CNAME':
        return 'Enter the domain name where this subdomain should point to (without trailing dot)';
      case 'AAAA':
        return 'Enter the IPv6 address where this subdomain should point to';
      case 'MX':
        return 'Enter the mail server domain name for email routing';
      case 'TXT':
        return 'Enter text content for verification, SPF, DKIM, or other purposes';
      default:
        return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gray-50 border border-gray-200 rounded-lg p-6"
    >
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          {initialData ? (
            <>
              <CheckCircleIcon className="h-5 w-5 text-blue-600 mr-2" />
              Update Subdomain
            </>
          ) : (
            <>
              <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
              Create New Subdomain
            </>
          )}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {initialData 
            ? `Update the configuration for ${initialData.subdomain_name}.${domain?.full_domain}`
            : `Create a new subdomain for ${domain?.full_domain}`
          }
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Subdomain Name - Only show for new subdomains */}
        {!initialData && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subdomain Name *
            </label>
            <div className="flex items-center">
              <input
                type="text"
                name="subdomainName"
                value={formData.subdomainName}
                onChange={handleChange}
                className={`flex-grow px-3 py-2 border rounded-l-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.subdomainName ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="blog"
                disabled={loading || isValidating}
              />
              <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md text-gray-600 text-sm whitespace-nowrap">
                .{domain?.full_domain}
              </span>
            </div>
            {errors.subdomainName && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                {errors.subdomainName}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Use only letters, numbers, and hyphens. Maximum 63 characters.
            </p>
          </div>
        )}

        {/* Record Type - Only show for new subdomains */}
        {!initialData && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Record Type *
            </label>
            <select
              name="recordType"
              value={formData.recordType}
              onChange={handleRecordTypeChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading || isValidating}
            >
              {recordTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {subdomainService.getRecordTypeDescription(formData.recordType)}
            </p>
          </div>
        )}

        {/* Target Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Value *
          </label>
          <input
            type="text"
            name="targetValue"
            value={formData.targetValue}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.targetValue ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder={getTargetValuePlaceholder()}
            disabled={loading || isValidating}
          />
          {errors.targetValue && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
              {errors.targetValue}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 flex items-start">
            <InformationCircleIcon className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
            {getHelpText()}
          </p>
        </div>

        {/* TTL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            TTL (Time to Live) *
          </label>
          <select
            name="ttl"
            value={formData.ttl}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading || isValidating}
          >
            {ttlOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.ttl && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
              {errors.ttl}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 flex items-start">
            <InformationCircleIcon className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
            How long DNS servers should cache this record. Lower values mean faster updates but more DNS queries.
          </p>
        </div>

        {/* Warning for CNAME records */}
        {formData.recordType === 'CNAME' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  CNAME Record Notice
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    CNAME records cannot coexist with other record types for the same name. 
                    If you have other DNS records for this subdomain, they may be affected.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading || isValidating}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || isValidating}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {(loading || isValidating) && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            {initialData ? 'Update Subdomain' : 'Create Subdomain'}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default SubdomainForm;
