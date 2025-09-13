const { validationResult } = require('express-validator');
const otpService = require('../services/otpService');

// Generate and send OTP for payment verification
const generateOTP = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email, paymentData, domainName } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!email || !paymentData || !domainName) {
      return res.status(400).json({
        success: false,
        message: 'Email, payment data, and domain name are required',
      });
    }

    // Check if user already has an active OTP session
    const hasActiveSession = await otpService.hasActiveOTPSession(userId, email);
    if (hasActiveSession) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active verification session. Please check your email or request a new code.',
      });
    }

    // Generate and send OTP
    const result = await otpService.generateAndSendOTP(
      userId,
      email,
      paymentData,
      domainName
    );

    res.status(200).json({
      success: true,
      data: {
        otpId: result.otpId,
        expiresAt: result.expiresAt,
        message: result.message,
        email: email,
      },
    });
  } catch (error) {
    console.error('Error in generateOTP:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send verification code',
    });
  }
};

// Verify OTP code
const verifyOTP = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email, otpCode } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!email || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP code are required',
      });
    }

    // Verify OTP
    const result = await otpService.verifyOTP(userId, email, otpCode);

    res.status(200).json({
      success: true,
      data: {
        verified: true,
        paymentData: result.paymentData,
        message: result.message,
      },
    });
  } catch (error) {
    console.error('Error in verifyOTP:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Verification failed',
    });
  }
};

// Resend OTP code
const resendOTP = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Resend OTP
    const result = await otpService.resendOTP(userId, email);

    res.status(200).json({
      success: true,
      data: {
        expiresAt: result.expiresAt,
        message: result.message,
        email: email,
      },
    });
  } catch (error) {
    console.error('Error in resendOTP:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to resend verification code',
    });
  }
};

// Get OTP session status
const getOTPStatus = async (req, res, next) => {
  try {
    const { email } = req.query;
    const userId = req.user.id;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const status = await otpService.getOTPSessionStatus(userId, email);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error in getOTPStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get verification status',
    });
  }
};

module.exports = {
  generateOTP,
  verifyOTP,
  resendOTP,
  getOTPStatus,
};
