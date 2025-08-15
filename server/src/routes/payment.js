const express = require("express");
const { body } = require("express-validator");
const {
  createPaymentIntent,
  confirmPayment,
  getPaymentHistory,
  handleWebhook,
  createRefund,
} = require("../controllers/paymentController.js");
const authMiddleware = require("../middleware/auth.js");

const router = express.Router();

// Validation rules
const paymentIntentValidation = [
  body("amount")
    .isNumeric()
    .isFloat({ min: 1 })
    .withMessage("Amount must be a positive number"),
  body("currency")
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be 3 characters"),
  body("domain").isString().notEmpty().withMessage("Domain name is required"),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
];

// Webhook route (must be before other middleware)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// Protected routes
router.use(authMiddleware);
router.post("/create-intent", paymentIntentValidation, createPaymentIntent);
router.post("/confirm-payment", confirmPayment);
router.get("/history", getPaymentHistory);
router.post("/refund/:transactionId", createRefund);

module.exports = router;
