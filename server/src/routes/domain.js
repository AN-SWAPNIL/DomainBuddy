const express = require("express");
const { body, query, param } = require("express-validator");
const {
  searchDomains,
  checkAvailability,
  purchaseDomain,
  getUserDomains,
  getDomainById,
  getDomainDnsRecords,
  updateDomainDnsRecords,
} = require("../controllers/domainController.js");
const {
  getSubdomains,
  getSubdomainDetails,
  createSubdomain,
  updateSubdomain,
  deleteSubdomain,
} = require("../controllers/subdomainController.js");
const authMiddleware = require("../middleware/auth.js");

const router = express.Router();

// Public routes
router.get("/search", searchDomains);
router.get("/check/:domain", checkAvailability);

// Protected routes
router.use(authMiddleware);
router.post("/purchase", purchaseDomain);
router.get("/my-domains", getUserDomains);
router.get("/:id", 
  param('id').isInt().withMessage('Domain ID must be a valid integer'),
  getDomainById
);

// DNS management routes
router.get("/:id/dns", 
  param('id').isInt().withMessage('Domain ID must be a valid integer'),
  getDomainDnsRecords
);

router.put("/:id/dns", 
  param('id').isInt().withMessage('Domain ID must be a valid integer'),
  body('dnsRecords').isArray().withMessage('dnsRecords must be an array'),
  updateDomainDnsRecords
);

// Subdomain routes - nested under domains
router.get("/:domainId/subdomains", 
  param('domainId').isInt().withMessage('Domain ID must be a valid integer'),
  getSubdomains
);

router.get("/:domainId/subdomains/:subdomainId", 
  param('domainId').isInt().withMessage('Domain ID must be a valid integer'),
  param('subdomainId').isInt().withMessage('Subdomain ID must be a valid integer'),
  getSubdomainDetails
);

router.post("/:domainId/subdomains", 
  param('domainId').isInt().withMessage('Domain ID must be a valid integer'),
  [
    body('subdomain_name')
      .trim()
      .isLength({ min: 1, max: 63 })
      .withMessage('Subdomain name must be 1-63 characters')
      .matches(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/)
      .withMessage('Invalid subdomain name format')
      .custom((value) => {
        if (value.startsWith('-') || value.endsWith('-')) {
          throw new Error('Subdomain cannot start or end with hyphen');
        }
        return true;
      }),
    body('record_type')
      .isIn(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS'])
      .withMessage('Invalid record type'),
    body('target_value')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Target value is required and must be under 255 characters'),
    body('ttl')
      .optional()
      .isInt({ min: 60, max: 86400 })
      .withMessage('TTL must be between 60 and 86400 seconds'),
    body('priority')
      .optional()
      .isInt({ min: 0, max: 65535 })
      .withMessage('Priority must be between 0 and 65535'),
  ],
  createSubdomain
);

router.put("/:domainId/subdomains/:subdomainId", 
  param('domainId').isInt().withMessage('Domain ID must be a valid integer'),
  param('subdomainId').isInt().withMessage('Subdomain ID must be a valid integer'),
  [
    body('subdomain_name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 63 })
      .withMessage('Subdomain name must be 1-63 characters')
      .matches(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/)
      .withMessage('Invalid subdomain name format'),
    body('record_type')
      .optional()
      .isIn(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS'])
      .withMessage('Invalid record type'),
    body('target_value')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Target value must be under 255 characters'),
    body('ttl')
      .optional()
      .isInt({ min: 60, max: 86400 })
      .withMessage('TTL must be between 60 and 86400 seconds'),
    body('priority')
      .optional()
      .isInt({ min: 0, max: 65535 })
      .withMessage('Priority must be between 0 and 65535'),
  ],
  updateSubdomain
);

router.delete("/:domainId/subdomains/:subdomainId", 
  param('domainId').isInt().withMessage('Domain ID must be a valid integer'),
  param('subdomainId').isInt().withMessage('Subdomain ID must be a valid integer'),
  deleteSubdomain
);

module.exports = router;
