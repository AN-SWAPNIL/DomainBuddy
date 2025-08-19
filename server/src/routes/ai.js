const express = require("express");
const { body } = require("express-validator");
const {
  chatWithAI,
  getDomainSuggestions,
  analyzeDomain,
  getConversationHistory,
  getUserConversations,
  deleteConversation,
  getDomainIdeas,
  checkBrandability,
  getSEOAnalysis,
  generateBusinessNames,
} = require("../controllers/aiController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// All AI routes require authentication
router.use(authMiddleware);

// Chat with AI agent
router.post(
  "/chat",
  [
    body("message")
      .notEmpty()
      .trim()
      .withMessage("Message is required")
      .isLength({ min: 1, max: 2000 })
      .withMessage("Message must be between 1 and 2000 characters"),
    body("conversationId")
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty string
        }
        if (typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
          return true; // Valid UUID
        }
        throw new Error('Invalid conversation ID format');
      }),
  ],
  chatWithAI
);

// Get domain suggestions
router.post(
  "/suggest-domains",
  [
    body("business")
      .notEmpty()
      .trim()
      .withMessage("Business description is required")
      .isLength({ min: 10, max: 1000 })
      .withMessage("Business description must be between 10 and 1000 characters"),
    body("industry")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Industry must be less than 100 characters"),
    body("keywords")
      .optional()
      .isArray()
      .withMessage("Keywords must be an array"),
    body("extensions")
      .optional()
      .isArray()
      .withMessage("Extensions must be an array"),
  ],
  getDomainSuggestions
);

// Analyze domain
router.post(
  "/analyze-domain",
  [
    body("domain")
      .notEmpty()
      .trim()
      .withMessage("Domain is required")
      .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/)
      .withMessage("Invalid domain format"),
  ],
  analyzeDomain
);

// Get domain ideas
router.post(
  "/domain-ideas",
  [
    body("keywords")
      .isArray({ min: 1 })
      .withMessage("At least one keyword is required"),
    body("industry")
      .notEmpty()
      .trim()
      .withMessage("Industry is required"),
    body("targetAudience")
      .notEmpty()
      .trim()
      .withMessage("Target audience is required"),
  ],
  getDomainIdeas
);

// Check brandability
router.post(
  "/brandability",
  [
    body("domain")
      .notEmpty()
      .trim()
      .withMessage("Domain is required")
      .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/)
      .withMessage("Invalid domain format"),
  ],
  checkBrandability
);

// Get SEO analysis
router.post(
  "/seo-analysis",
  [
    body("domain")
      .notEmpty()
      .trim()
      .withMessage("Domain is required")
      .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/)
      .withMessage("Invalid domain format"),
  ],
  getSEOAnalysis
);

// Generate business names
router.post(
  "/business-names",
  [
    body("description")
      .notEmpty()
      .trim()
      .withMessage("Business description is required")
      .isLength({ min: 10, max: 500 })
      .withMessage("Description must be between 10 and 500 characters"),
    body("industry")
      .notEmpty()
      .trim()
      .withMessage("Industry is required"),
  ],
  generateBusinessNames
);

// Conversation management
router.get("/conversations", getUserConversations);
router.get("/conversations/:conversationId", getConversationHistory);
router.delete("/conversations/:conversationId", deleteConversation);

module.exports = router;
