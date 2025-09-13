import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';

const OTPModal = ({
  isOpen,
  onClose,
  onVerify,
  onResend,
  email,
  domainName,
  loading = false,
  error = null,
  timeRemaining = 0,
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const inputRefs = useRef([]);

  // Timer effect for OTP expiration
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        const remaining = timeRemaining - Date.now();
        if (remaining <= 0) {
          setMinutes(0);
          setSeconds(0);
          clearInterval(timer);
        } else {
          setMinutes(Math.floor(remaining / 60000));
          setSeconds(Math.floor((remaining % 60000) / 1000));
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-focus first input when modal opens
  useEffect(() => {
    if (isOpen && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setOtp(['', '', '', '', '', '']);
      setResendLoading(false);
      setResendCooldown(0);
    }
  }, [isOpen]);

  const handleOtpChange = (index, value) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Auto-focus next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    
    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, '').slice(0, 6);
        const newOtp = [...otp];
        for (let i = 0; i < digits.length && i < 6; i++) {
          newOtp[i] = digits[i];
        }
        setOtp(newOtp);
        
        // Focus the next empty input or the last input
        const nextIndex = Math.min(digits.length, 5);
        inputRefs.current[nextIndex]?.focus();
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length === 6) {
      onVerify(otpCode);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      await onResend();
      setResendCooldown(30); // 30-second cooldown
      setOtp(['', '', '', '', '', '']); // Clear current OTP
      inputRefs.current[0]?.focus();
    } finally {
      setResendLoading(false);
    }
  };

  const isOtpComplete = otp.every(digit => digit !== '');
  const isExpired = minutes === 0 && seconds === 0 && timeRemaining > 0;

  if (!isOpen) return null;

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
                <div className="rounded-full bg-primary-100 p-2">
                  <ShieldCheckIcon className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Verify Your Purchase
                  </h3>
                  <p className="text-sm text-gray-500">
                    Enter the verification code sent to your email
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              {/* Email info */}
              <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-center space-x-2">
                  <EnvelopeIcon className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    Code sent to: <strong>{email}</strong>
                  </span>
                </div>
                {domainName && (
                  <div className="mt-2 text-sm text-blue-700">
                    Domain: <strong>{domainName}</strong>
                  </div>
                )}
              </div>

              {/* Timer */}
              {!isExpired && timeRemaining > 0 && (
                <div className="mb-4 flex items-center justify-center space-x-2 text-sm text-gray-600">
                  <ClockIcon className="h-4 w-4" />
                  <span>
                    Code expires in: <strong>{minutes}:{seconds.toString().padStart(2, '0')}</strong>
                  </span>
                </div>
              )}

              {/* Expired warning */}
              {isExpired && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
                  <div className="flex items-center space-x-2">
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-800">
                      Verification code has expired. Please request a new one.
                    </span>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
                  <div className="flex items-center space-x-2">
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-800">{error}</span>
                  </div>
                </div>
              )}

              {/* OTP Input Form */}
              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Enter 6-digit verification code
                  </label>
                  <div className="flex justify-center space-x-3">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-12 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                        disabled={loading || isExpired}
                      />
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={!isOtpComplete || loading || isExpired}
                    className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <>
                        <LoadingSpinner size="sm" className="text-white" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify & Complete Payment</span>
                    )}
                  </button>

                  {/* Resend button */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendLoading || resendCooldown > 0}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {resendLoading ? (
                        <span className="flex items-center justify-center space-x-1">
                          <LoadingSpinner size="xs" />
                          <span>Sending...</span>
                        </span>
                      ) : resendCooldown > 0 ? (
                        `Resend code in ${resendCooldown}s`
                      ) : (
                        "Didn't receive the code? Resend"
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Help text */}
              <div className="mt-6 text-xs text-gray-500 text-center">
                <p>Check your spam folder if you don't see the email.</p>
                <p>The verification code is valid for 10 minutes.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default OTPModal;
