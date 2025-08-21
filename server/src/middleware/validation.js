const { body, validationResult } = require("express-validator");

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log("🔍 Validation errors:", errors.array());
    console.log("🔍 Request body:", req.body);
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }

  next();
};

// Registration validation rules
const registerValidation = [
  body("first_name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "First name can only contain letters, spaces, hyphens, and apostrophes"
    ),

  body("last_name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "Last name can only contain letters, spaces, hyphens, and apostrophes"
    ),

  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
];

// Login validation rules
const loginValidation = [
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),

  body("password").notEmpty().withMessage("Password is required"),
];

// Password update validation rules
const passwordUpdateValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "New password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
];

// Email validation for forgot password
const emailValidation = [
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
];

// Reset password validation
const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Reset token is required"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
];

// Profile update validation rules
const profileUpdateValidation = [
  body("first_name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "First name can only contain letters, spaces, hyphens, and apostrophes"
    ),

  body("last_name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "Last name can only contain letters, spaces, hyphens, and apostrophes"
    ),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),

  body("phone")
    .optional()
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)\.]{7,20}$/)
    .withMessage("Please provide a valid phone number"),

  body("street")
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Street address must be less than 255 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City must be less than 100 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "City can only contain letters, spaces, hyphens, and apostrophes"
    ),

  body("state")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("State must be less than 100 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "State can only contain letters, spaces, hyphens, and apostrophes"
    ),

  body("country")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Country must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "Country can only contain letters, spaces, hyphens, and apostrophes"
    ),

  body("zip_code")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("ZIP code must be less than 20 characters")
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage(
      "ZIP code can only contain letters, numbers, spaces, and hyphens"
    ),
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  passwordUpdateValidation,
  emailValidation,
  resetPasswordValidation,
  profileUpdateValidation,
};
