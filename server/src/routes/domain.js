const express = require("express");
const { body, query } = require("express-validator");
const {
  purchaseDomain,
  getUserDomains,
} = require("../controllers/domainController.js");
const authMiddleware = require("../middleware/auth.js");

const router = express.Router();

// Protected routes
router.use(authMiddleware);
router.post("/purchase", purchaseDomain);
// router.get("/", getUserDomains);
router.get("/my-domains", getUserDomains); // Add explicit route for my-domains

module.exports = router;
