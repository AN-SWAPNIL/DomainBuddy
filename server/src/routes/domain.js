const express = require("express");
const { body, query } = require("express-validator");
const {
  searchDomains,
  checkAvailability,
} = require("../controllers/domainController.js");
const { verifyToken } = require("../utils/jwt.js");  

const router = express.Router();


// Public routes
router.get("/search", searchDomains);
router.get("/check/:domain", checkAvailability);

module.exports = router;
