import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  UserCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

const ProfileCompleteModal = ({
  isOpen,
  onClose,
  onGoToProfile,
  missingFields = [],
  domainName = null,
}) => {
  if (!isOpen) return null;

  const handleGoToProfile = () => {
    onGoToProfile();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative border-b border-gray-200 px-6 py-4">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="rounded-full bg-orange-100 p-2">
                  <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Complete Your Profile
                  </h3>
                  <p className="text-sm text-gray-500">
                    Profile completion required to proceed
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              {/* Domain info */}
              {domainName && (
                <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
                  <div className="flex items-center space-x-2">
                    <UserCircleIcon className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-800">
                      Domain to purchase: <strong>{domainName}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Main message */}
              <div className="mb-6">
                <p className="text-gray-700 text-sm leading-relaxed">
                  To complete your domain purchase, we need some additional information. 
                  Please update your profile with the following required details:
                </p>
              </div>

              {/* Missing fields */}
              {missingFields.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Missing Information:
                  </h4>
                  <div className="space-y-2">
                    {missingFields.map((field, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">{field}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Benefits */}
              <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-start space-x-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium mb-1">Why we need this information:</p>
                    <ul className="text-xs space-y-1">
                      <li>• Required for domain registration with ICANN</li>
                      <li>• Ensures secure domain ownership</li>
                      <li>• Enables billing and support communications</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleGoToProfile}
                  className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  <UserCircleIcon className="h-4 w-4" />
                  <span>Complete Profile Now</span>
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  Maybe Later
                </button>
              </div>

              {/* Help text */}
              <div className="mt-6 text-xs text-gray-500 text-center">
                <p>Your domain will remain available while you complete your profile.</p>
                <p>This process takes less than 2 minutes.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default ProfileCompleteModal;
