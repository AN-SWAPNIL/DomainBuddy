const express = require("express");
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/auth");
const {
  validate,
  profileUpdateValidation,
} = require("../middleware/validation");

const router = express.Router();

// @route   GET /api/user/profile
// @desc    Get user profile
// @access  Private
router.get("/profile", authMiddleware, userController.getProfile);

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put(
  "/profile",
  authMiddleware,
  profileUpdateValidation,
  validate,
  userController.updateProfile
);

// @route   DELETE /api/user/account
// @desc    Delete user account
// @access  Private
router.delete("/account", authMiddleware, userController.deleteAccount);

module.exports = router;
