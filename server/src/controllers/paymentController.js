const { validationResult } = require("express-validator");
const stripeService = require("../services/stripeService.js");
const namecheapService = require("../services/namecheapService.js");
const supabase = require("../config/database.js");
// const emailService = require("../services/email.service.js");

// Create payment intent
const createPaymentIntent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { amount, currency, domain, metadata } = req.body;

    // Find existing domain record for this user
    const { data: existingDomain, error: findError } = await supabase
      .from("domains")
      .select("*")
      .eq("full_domain", domain.toLowerCase())
      .eq("owner_id", req.user.id)
      .single();

    if (findError && findError.code !== "PGRST116") {
      // PGRST116 is "not found" error, which is expected
      console.error("Error finding domain:", findError);
      return res.status(500).json({
        success: false,
        message: "Database error while checking domain",
      });
    }

    let domainRecord = existingDomain;

    if (!domainRecord) {
      // Parse domain name and extension
      const domainParts = domain.split(".");
      const domainName = domainParts[0];
      const extension = domainParts.slice(1).join(".");

      // Check if domain already exists in database for ANY user (any status)
      const { data: existingDomainAny, error: existingError } = await supabase
        .from("domains")
        .select("id, status, owner_id")
        .eq("full_domain", domain.toLowerCase())
        .single();

      if (existingError && existingError.code !== "PGRST116") {
        console.error("Error checking existing domain:", existingError);
        return res.status(500).json({
          success: false,
          message: "Database error while checking domain availability",
        });
      }

      if (existingDomainAny) {
        // Domain exists in database - not available regardless of status
        console.log(
          `Domain ${domain} found in database with status: ${existingDomainAny.status} - not available`
        );
        return res.status(400).json({
          success: false,
          message: "This domain is no longer available for purchase",
        });
      }

      // Create a clean domain record for this user
      const { data: newDomain, error: createError } = await supabase
        .from("domains")
        .insert([
          {
            name: domainName,
            extension: extension,
            full_domain: domain.toLowerCase(),
            owner_id: req.user.id,
            status: "pending",
            registrar: "namecheap",
            cost: amount / 100, // Convert from cents to dollars
            selling_price: amount / 100,
            currency: currency.toUpperCase(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error("Domain creation error:", createError);

        // Handle duplicate domain constraint
        if (
          createError.code === "23505" &&
          createError.details?.includes("full_domain")
        ) {
          return res.status(400).json({
            success: false,
            message: "This domain is no longer available for purchase",
          });
        }

        return res.status(500).json({
          success: false,
          message: "Failed to create domain record",
        });
      }

      domainRecord = newDomain;
    }

    // Get or create Stripe customer
    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeService.createCustomer({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
      });
      customerId = customer.id;

      // Update user with Stripe customer ID
      const { error: updateError } = await supabase
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", req.user.id);

      if (updateError) {
        console.error(
          "Failed to update user with Stripe customer ID:",
          updateError
        );
        // Continue with the process, just log the error
      }
    }

    // Create payment intent
    const paymentIntent = await stripeService.createPaymentIntent(
      amount,
      currency,
      customerId,
      {
        domainId: domainRecord.id.toString(),
        userId: req.user.id.toString(),
        domainName: domainRecord.full_domain,
        ...metadata,
      }
    );

    // Create or update transaction record
    const { data: existingTransaction, error: findTransactionError } =
      await supabase
        .from("transactions")
        .select("*")
        .eq("domain_id", domainRecord.id)
        .eq("user_id", req.user.id)
        .eq("status", "pending")
        .single();

    if (findTransactionError && findTransactionError.code !== "PGRST116") {
      console.error("Error finding transaction:", findTransactionError);
      return res.status(500).json({
        success: false,
        message: "Database error while checking transaction",
      });
    }

    let transaction;
    if (!existingTransaction) {
      const { data: newTransaction, error: createTransactionError } =
        await supabase
          .from("transactions")
          .insert([
            {
              user_id: req.user.id,
              domain_id: domainRecord.id,
              type: "purchase",
              amount: amount / 100, // Convert from cents to dollars
              currency: currency.toUpperCase(),
              status: "pending",
              payment_method: "stripe",
              stripe_payment_intent_id: paymentIntent.id,
              ip_address: req.ip,
              user_agent: req.get("User-Agent"),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

      if (createTransactionError) {
        console.error("Transaction creation error:", createTransactionError);
        return res.status(500).json({
          success: false,
          message: "Failed to create transaction record",
        });
      }
      transaction = newTransaction;
    } else {
      const { data: updatedTransaction, error: updateTransactionError } =
        await supabase
          .from("transactions")
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingTransaction.id)
          .select()
          .single();

      if (updateTransactionError) {
        console.error("Transaction update error:", updateTransactionError);
        return res.status(500).json({
          success: false,
          message: "Failed to update transaction record",
        });
      }
      transaction = updatedTransaction;
    }

    res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Confirm payment
const confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "Payment intent ID is required",
      });
    }

    console.log("🔄 Processing payment intent:", paymentIntentId);

    // Get payment intent from Stripe
    const paymentIntent = await stripeService.confirmPayment(paymentIntentId);

    // Debug: Log the payment intent structure
    console.log("PaymentIntent status:", paymentIntent.status);
    console.log("PaymentIntent charges:", paymentIntent.charges);
    console.log("PaymentIntent keys:", Object.keys(paymentIntent));

    if (paymentIntent.status === "succeeded") {
      // Extract charge information safely
      let charge = null;
      let paymentMethodDetails = null;

      // Try to get charge information from the payment intent
      if (paymentIntent.charges?.data?.length > 0) {
        charge = paymentIntent.charges.data[0];
        paymentMethodDetails = charge?.payment_method_details?.card;
      } else {
        // If charges are not expanded, get them separately
        console.log(
          "Charges not found in PaymentIntent, fetching separately..."
        );
        try {
          const charges = await stripeService.getPaymentIntentCharges(
            paymentIntentId
          );
          if (charges.length > 0) {
            charge = charges[0];
            paymentMethodDetails = charge?.payment_method_details?.card;
          }
        } catch (chargeError) {
          console.error(
            "Failed to fetch charges separately:",
            chargeError.message
          );
        }
      }

      // Find and update transaction
      const { data: transactions, error: findTransactionError } = await supabase
        .from("transactions")
        .select(
          `
          *,
          domains!transactions_domain_id_fkey(*)
        `
        )
        .eq("stripe_payment_intent_id", paymentIntentId)
        .single();

      if (findTransactionError) {
        console.error("Error finding transaction:", findTransactionError);
        return res.status(404).json({
          success: false,
          message: "Transaction not found",
        });
      }

      // Update transaction with payment details
      const { data: updatedTransaction, error: updateTransactionError } =
        await supabase
          .from("transactions")
          .update({
            status: "completed",
            stripe_charge_id: charge?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transactions.id)
          .select(
            `
          *,
          domains!transactions_domain_id_fkey(*)
        `
          )
          .single();

      if (updateTransactionError) {
        console.error("Error updating transaction:", updateTransactionError);
        return res.status(500).json({
          success: false,
          message: "Failed to update transaction",
        });
      }

      const transaction = updatedTransaction;
      const domain = transaction.domains;

      try {
        // Register domain with Namecheap
        if (transaction.type === "purchase") {
          const firstName = req.user.name.split(" ")[0] || "User";
          const registrationResult = await namecheapService.registerDomain(
            domain.full_domain,
            1,
            {
              firstName: firstName,
              lastName: req.user.name.split(" ")[1] || firstName,
              email: req.user.email,
              phone: req.user.phone || "+1.1234567890",
              address: req.user.street || "123 Main St",
              city: req.user.city || "City",
              state: req.user.state || "State",
              postalCode: req.user.zip_code || "12345",
              country: req.user.country || "US",
            }
          );

          if (registrationResult.success) {
            // Update domain status to registered
            await supabase
              .from("domains")
              .update({
                status: "registered",
                updated_at: new Date().toISOString(),
              })
              .eq("id", domain.id);

            // Send domain purchase confirmation email if available
            // emailService.sendDomainPurchaseConfirmation(...)
          }
        }
      } catch (registrationError) {
        console.error("Domain registration failed:", registrationError.message);
        // Payment succeeded but registration failed - handle this case
        await supabase
          .from("domains")
          .update({
            status: "payment_completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", domain.id);
      }

      res.status(200).json({
        success: true,
        data: {
          transaction,
          domain,
          paymentStatus: paymentIntent.status,
          message: "Payment completed successfully",
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Payment not completed",
        paymentStatus: paymentIntent.status,
      });
    }
  } catch (error) {
    next(error);
  }
};

// Get payment history
const getPaymentHistory = async (req, res, next) => {
  try {
    const { page, limit, status, type } = req.query;

    // Build query
    let query = supabase.from("transactions").select(`
      *,
      domains!transactions_domain_id_fkey(full_domain, status, cost, selling_price, currency)
    `);

    // Filter by user
    query = query.eq("user_id", req.user.id);

    // Filter by status if provided
    if (status) {
      query = query.eq("status", status);
    }

    // Filter by type if provided
    if (type) {
      query = query.eq("type", type);
    }

    // Apply sorting
    query = query.order("created_at", { ascending: false });

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error("Error fetching payment history:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch payment history",
      });
    }

    // Calculate pagination info
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        docs: transactions,
        totalDocs: count,
        limit: parseInt(limit),
        page: parseInt(page),
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? parseInt(page) + 1 : null,
        prevPage: hasPrevPage ? parseInt(page) - 1 : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Handle Stripe webhooks
const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: "Missing Stripe signature",
      });
    }

    const event = await stripeService.webhookHandler(req.body, signature);

    switch (event.type) {
      case "payment_intent.succeeded":
        console.log("Payment succeeded via webhook:", event.data.object.id);
        // Handle successful payment
        break;

      case "payment_intent.payment_failed":
        console.log("Payment failed via webhook:", event.data.object.id);
        // Update transaction status
        await supabase
          .from("transactions")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", event.data.object.id);
        break;

      case "customer.subscription.created":
        console.log("Subscription created:", event.data.object.id);
        break;

      case "customer.subscription.deleted":
        console.log("Subscription cancelled:", event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.status(400).json({
      success: false,
      message: "Webhook error",
      error: error.message,
    });
  }
};

// Create refund
const createRefund = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const { amount, reason } = req.body;

    const { data: transaction, error: findError } = await supabase
      .from("transactions")
      .select(
        `
        *,
        domains!transactions_domain_id_fkey(*)
      `
      )
      .eq("id", transactionId)
      .eq("user_id", req.user.id)
      .eq("status", "completed")
      .single();

    if (findError || !transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found or cannot be refunded",
      });
    }

    if (!transaction.stripe_charge_id) {
      return res.status(400).json({
        success: false,
        message: "No charge ID found for refund",
      });
    }

    // Create refund in Stripe
    const refund = await stripeService.createRefund(
      transaction.stripe_charge_id,
      amount
    );

    if (refund.status === "succeeded") {
      // Update transaction
      const { error: updateTransactionError } = await supabase
        .from("transactions")
        .update({
          status: "refunded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId);

      if (updateTransactionError) {
        console.error("Failed to update transaction:", updateTransactionError);
      }

      // Update domain status if full refund
      if (!amount || amount >= transaction.amount) {
        const { error: updateDomainError } = await supabase
          .from("domains")
          .update({
            status: "refunded",
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.domain_id);

        if (updateDomainError) {
          console.error("Failed to update domain:", updateDomainError);
        }
      }

      res.status(200).json({
        success: true,
        data: {
          refund,
          transaction,
          message: "Refund processed successfully",
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Refund failed",
        refundStatus: refund.status,
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  getPaymentHistory,
  handleWebhook,
  createRefund,
};
