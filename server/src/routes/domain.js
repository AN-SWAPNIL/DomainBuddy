const express = require("express");
const { body, query } = require("express-validator");
const {
  searchDomains,
  checkAvailability,
  purchaseDomain,
  getUserDomains,
} = require("../controllers/domainController.js");
const authMiddleware = require("../middleware/auth.js");

const router = express.Router();

// Public routes
router.get("/search", searchDomains);
router.get("/check/:domain", checkAvailability);

// Protected routes
router.use(authMiddleware);
router.post("/purchase", purchaseDomain);
router.get("/my-domains", getUserDomains);

module.exports = router;
