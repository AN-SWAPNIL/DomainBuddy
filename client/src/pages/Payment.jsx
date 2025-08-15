import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { motion } from "framer-motion";
import {
  CreditCardIcon,
  LockClosedIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { paymentService } from "../services/paymentService";
import LoadingSpinner from "../components/ui/LoadingSpinner";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const PaymentForm = ({ domain, amount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [cardholderName, setCardholderName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [country, setCountry] = useState("US");
  const [postalCode, setPostalCode] = useState("");

  useEffect(() => {
    // Create payment intent when component mounts
    const createPaymentIntent = async () => {
      try {
        const intent = await paymentService.createPaymentIntent(
          domain,
          Math.round(amount * 100), // Convert to cents
          "usd"
        );
        setPaymentIntent(intent);
      } catch (error) {
        console.error("Error creating payment intent:", error);
        onError("Failed to initialize payment. Please try again.");
      }
    };

    if (domain && amount) {
      createPaymentIntent();
    }
  }, [domain, amount, onError]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || !paymentIntent) {
      return;
    }

    if (!cardholderName.trim()) {
      onError("Please enter the cardholder name");
      return;
    }

    if (!postalCode.trim()) {
      onError("Please enter a postal code");
      return;
    }

    setProcessing(true);

    const cardNumberElement = elements.getElement(CardNumberElement);

    try {
      // Confirm payment with Stripe
      const { error, paymentIntent: confirmedPayment } =
        await stripe.confirmCardPayment(paymentIntent.clientSecret, {
          payment_method: {
            card: cardNumberElement,
            billing_details: {
              name: cardholderName,
              email: billingEmail,
              address: {
                country: country,
                postal_code: postalCode,
              },
            },
          },
        });

      if (error) {
        console.error("Payment error:", error);
        onError(error.message);
      } else if (confirmedPayment.status === "succeeded") {
        // Confirm payment with our backend
        await paymentService.confirmPayment(confirmedPayment.id);
        onSuccess(confirmedPayment);
      }
    } catch (error) {
      console.error("Payment confirmation error:", error);
      onError("Payment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: "16px",
        color: "#424770",
        fontFamily: "system-ui, -apple-system, sans-serif",
        "::placeholder": {
          color: "#aab7c4",
        },
      },
      invalid: {
        color: "#fa755a",
        iconColor: "#fa755a",
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Summary */}
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Order Summary
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Domain Registration</span>
            <span className="font-medium">{domain}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Registration Period</span>
            <span className="font-medium">1 Year</span>
          </div>
          <hr className="my-3" />
          <div className="flex justify-between items-center text-lg">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-primary-600">
              ${amount.toFixed(2)} USD
            </span>
          </div>
        </div>
      </div>

      {/* Billing Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">
          Billing Information
        </h3>

        {/* Cardholder Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cardholder Name *
          </label>
          <input
            type="text"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>

        {/* Email Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
            placeholder="john@example.com"
            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Country/Region and Postal Code */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Country or Region *
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              required
            >
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="ES">Spain</option>
              <option value="IT">Italy</option>
              <option value="NL">Netherlands</option>
              <option value="SE">Sweden</option>
              <option value="NO">Norway</option>
              <option value="DK">Denmark</option>
              <option value="FI">Finland</option>
              <option value="CH">Switzerland</option>
              <option value="AT">Austria</option>
              <option value="BE">Belgium</option>
              <option value="IE">Ireland</option>
              <option value="PT">Portugal</option>
              <option value="LU">Luxembourg</option>
              <option value="JP">Japan</option>
              <option value="SG">Singapore</option>
              <option value="HK">Hong Kong</option>
              <option value="IN">India</option>
              <option value="CN">China</option>
              <option value="BR">Brazil</option>
              <option value="MX">Mexico</option>
              <option value="AR">Argentina</option>
              <option value="CL">Chile</option>
              <option value="CO">Colombia</option>
              <option value="PE">Peru</option>
              <option value="UY">Uruguay</option>
              <option value="ZA">South Africa</option>
              <option value="EG">Egypt</option>
              <option value="MA">Morocco</option>
              <option value="NG">Nigeria</option>
              <option value="KE">Kenya</option>
              <option value="TZ">Tanzania</option>
              <option value="UG">Uganda</option>
              <option value="GH">Ghana</option>
              <option value="RW">Rwanda</option>
              <option value="ET">Ethiopia</option>
              <option value="ZW">Zimbabwe</option>
              <option value="BW">Botswana</option>
              <option value="NA">Namibia</option>
              <option value="ZM">Zambia</option>
              <option value="MW">Malawi</option>
              <option value="MZ">Mozambique</option>
              <option value="AO">Angola</option>
              <option value="CD">Democratic Republic of Congo</option>
              <option value="CM">Cameroon</option>
              <option value="CI">Côte d'Ivoire</option>
              <option value="SN">Senegal</option>
              <option value="ML">Mali</option>
              <option value="BF">Burkina Faso</option>
              <option value="NE">Niger</option>
              <option value="TD">Chad</option>
              <option value="CF">Central African Republic</option>
              <option value="CG">Republic of the Congo</option>
              <option value="GA">Gabon</option>
              <option value="GQ">Equatorial Guinea</option>
              <option value="ST">São Tomé and Príncipe</option>
              <option value="CV">Cape Verde</option>
              <option value="GW">Guinea-Bissau</option>
              <option value="GN">Guinea</option>
              <option value="SL">Sierra Leone</option>
              <option value="LR">Liberia</option>
              <option value="GM">Gambia</option>
              <option value="MR">Mauritania</option>
              <option value="DZ">Algeria</option>
              <option value="TN">Tunisia</option>
              <option value="LY">Libya</option>
              <option value="SD">Sudan</option>
              <option value="SS">South Sudan</option>
              <option value="ER">Eritrea</option>
              <option value="DJ">Djibouti</option>
              <option value="SO">Somalia</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Postal Code *
            </label>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder={country === "US" ? "12345" : "Postal Code"}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>
        </div>
      </div>

      {/* Card Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Card Information</h3>

        {/* Card Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Number *
          </label>
          <div className="border border-gray-300 rounded-lg p-3 bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
            <CardNumberElement options={cardElementOptions} />
          </div>
        </div>

        {/* Expiry and CVC */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiry Date *
            </label>
            <div className="border border-gray-300 rounded-lg p-3 bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
              <CardExpiryElement options={cardElementOptions} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CVC *
            </label>
            <div className="border border-gray-300 rounded-lg p-3 bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
              <CardCvcElement options={cardElementOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Test Card Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">
          Test Mode - Use Test Cards
        </h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div>
            <strong>Success:</strong> 4242 4242 4242 4242
          </div>
          <div>
            <strong>Decline:</strong> 4000 0000 0000 0002
          </div>
          <div>
            <strong>Expiry:</strong> Any future date (e.g., 12/25)
          </div>
          <div>
            <strong>CVC:</strong> Any 3 digits (e.g., 123)
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <LockClosedIcon className="h-4 w-4" />
        <span>Your payment information is secure and encrypted</span>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={
          !stripe ||
          processing ||
          !paymentIntent ||
          !cardholderName.trim() ||
          !postalCode.trim()
        }
        className="w-full flex justify-center items-center space-x-2 py-4 px-6 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? (
          <>
            <LoadingSpinner size="sm" className="text-white" />
            <span>Processing Payment...</span>
          </>
        ) : (
          <>
            <CreditCardIcon className="h-5 w-5" />
            <span>Pay ${amount.toFixed(2)} Now</span>
          </>
        )}
      </button>
    </form>
  );
};

const Payment = () => {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [domain, setDomain] = useState("");
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);

  useEffect(() => {
    // For now, we'll get domain and amount from URL params or localStorage
    // In a real implementation, you'd fetch transaction details from the backend
    const urlParams = new URLSearchParams(window.location.search);
    const domainParam = urlParams.get("domain");
    const amountParam = urlParams.get("amount");

    if (domainParam && amountParam) {
      setDomain(domainParam);
      setAmount(parseFloat(amountParam));
      setLoading(false);
    } else {
      // Fallback: try to get from previous page or redirect
      setError("Invalid payment link. Please start from domain search.");
      setTimeout(() => navigate("/search"), 3000);
    }
  }, [transactionId, navigate]);

  const handlePaymentSuccess = (paymentIntent) => {
    setPaymentDetails(paymentIntent);
    setSuccess(true);

    // Redirect to success page after a delay
    setTimeout(() => {
      navigate("/my-domains");
    }, 3000);
  };

  const handlePaymentError = (errorMessage) => {
    setError(errorMessage);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center"
        >
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Successful!
          </h2>
          <p className="text-gray-600 mb-4">
            Your domain <strong>{domain}</strong> has been successfully
            purchased.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-600">Transaction ID</div>
            <div className="font-mono text-sm">
              {paymentDetails?.id || "Processing..."}
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            You'll receive a confirmation email shortly. Redirecting to your
            domains...
          </p>
          <button
            onClick={() => navigate("/my-domains")}
            className="btn-primary w-full"
          >
            View My Domains
          </button>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center"
        >
          <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Error
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate("/search")}
            className="btn-primary w-full"
          >
            Back to Search
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Complete Your Purchase
          </h1>
          <p className="text-gray-600">Secure payment powered by Stripe</p>
        </motion.div>

        {/* Payment Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-lg p-8"
        >
          <Elements stripe={stripePromise}>
            <PaymentForm
              domain={domain}
              amount={amount}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </Elements>
        </motion.div>

        {/* Security Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-center text-sm text-gray-600"
        >
          <p>🔒 Your payment is protected by 256-bit SSL encryption</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Payment;
