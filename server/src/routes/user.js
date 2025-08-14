const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Profile update validation
const profileUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
    
  body('email')
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
];

// @route   GET /api/user/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authMiddleware, userController.getProfile);

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authMiddleware, profileUpdateValidation, validate, userController.updateProfile);

// @route   DELETE /api/user/account
// @desc    Delete user account
// @access  Private
router.delete('/account', authMiddleware, userController.deleteAccount);

module.exports = router;
