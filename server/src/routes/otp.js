const express = require('express');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const otpController = require('../controllers/otpController');

const router = express.Router();

// Validation rules
const generateOTPValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('paymentData')
    .isObject()
    .withMessage('Payment data is required'),
  body('domainName')
    .notEmpty()
    .trim()
    .withMessage('Domain name is required'),
];

const verifyOTPValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('otpCode')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP code must be a 6-digit number'),
];

const resendOTPValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
];

// Routes
router.post('/generate', authMiddleware, generateOTPValidation, otpController.generateOTP);
router.post('/verify', authMiddleware, verifyOTPValidation, otpController.verifyOTP);
router.post('/resend', authMiddleware, resendOTPValidation, otpController.resendOTP);
router.get('/status', authMiddleware, otpController.getOTPStatus);

module.exports = router;
