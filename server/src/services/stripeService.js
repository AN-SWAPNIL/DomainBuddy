const Stripe = require("stripe");
const dotenv = require("dotenv");
dotenv.config();

class StripeService {
  constructor() {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.warn(
        "⚠️ STRIPE_SECRET_KEY not configured. Payment functionality will be limited."
      );
      this.stripe = null;
    } else {
      this.stripe = new Stripe(stripeKey);
      console.log("✅ Stripe service initialized successfully");
    }
  }

  async createCustomer(userData) {
    try {
      if (!this.stripe) {
        throw new Error(
          "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable."
        );
      }

      const customer = await this.stripe.customers.create({
        email: userData.email,
        name: userData.name,
        metadata: {
          userId: userData.id.toString(),
        },
      });

      return customer;
    } catch (error) {
      console.error("Stripe Create Customer Error:", error.message);
      throw new Error("Failed to create Stripe customer");
    }
  }

  async createPaymentIntent(
    amount,
    currency = "usd",
    customerId,
    metadata = {}
  ) {
    try {
      if (!this.stripe) {
        throw new Error(
          "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable."
        );
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: customerId,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error) {
      console.error("Stripe Payment Intent Error:", error.message);
      throw new Error("Failed to create payment intent");
    }
  }

  async confirmPayment(paymentIntentId) {
    try {
      console.log("Retrieving PaymentIntent with ID:", paymentIntentId);

      // Get payment intent first
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        paymentIntentId
      );
      console.log("Retrieved PaymentIntent. Status:", paymentIntent.status);

      // Always fetch charges separately for reliability
      const charges = await this.stripe.charges.list({
        payment_intent: paymentIntentId,
        expand: ["data.payment_method_details"],
      });

      console.log("Charges retrieved separately:", charges.data.length);

      // Attach charges to payment intent for consistency
      paymentIntent.charges = {
        data: charges.data,
      };

      return paymentIntent;
    } catch (error) {
      console.error("Stripe Confirm Payment Error:", error.message);
      throw new Error("Failed to confirm payment");
    }
  }

  async getPaymentIntentCharges(paymentIntentId) {
    try {
      const charges = await this.stripe.charges.list({
        payment_intent: paymentIntentId,
        expand: ["data.payment_method_details"],
      });
      return charges.data;
    } catch (error) {
      console.error("Stripe Get Charges Error:", error.message);
      throw new Error("Failed to get charges");
    }
  }

  async createRefund(chargeId, amount = null) {
    try {
      const refund = await this.stripe.refunds.create({
        charge: chargeId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      return refund;
    } catch (error) {
      console.error("Stripe Refund Error:", error.message);
      throw new Error("Failed to create refund");
    }
  }

  async getCustomerPaymentMethods(customerId) {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      return paymentMethods.data;
    } catch (error) {
      console.error("Stripe Get Payment Methods Error:", error.message);
      throw new Error("Failed to get payment methods");
    }
  }

  async webhookHandler(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      return event;
    } catch (error) {
      console.error("Stripe Webhook Error:", error.message);
      throw new Error("Webhook signature verification failed");
    }
  }

  async createSubscription(customerId, priceId, metadata = {}) {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [
          {
            price: priceId,
          },
        ],
        metadata,
      });

      return subscription;
    } catch (error) {
      console.error("Stripe Subscription Error:", error.message);
      throw new Error("Failed to create subscription");
    }
  }

  async cancelSubscription(subscriptionId) {
    try {
      const subscription = await this.stripe.subscriptions.del(subscriptionId);
      return subscription;
    } catch (error) {
      console.error("Stripe Cancel Subscription Error:", error.message);
      throw new Error("Failed to cancel subscription");
    }
  }

  formatAmount(amount, currency = "usd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  }
}

module.exports = new StripeService();
