import api from "./api";

export const otpService = {
  // Generate and send OTP for payment verification
  generateOTP: async (email, paymentData, domainName) => {
    try {
      const response = await api.post("/otp/generate", {
        email,
        paymentData,
        domainName,
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || "Failed to send verification code"
      );
    }
  },

  // Verify OTP code
  verifyOTP: async (email, otpCode) => {
    try {
      const response = await api.post("/otp/verify", {
        email,
        otpCode,
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || "Verification failed"
      );
    }
  },

  // Resend OTP code
  resendOTP: async (email) => {
    try {
      const response = await api.post("/otp/resend", {
        email,
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || "Failed to resend verification code"
      );
    }
  },

  // Get OTP session status
  getOTPStatus: async (email) => {
    try {
      const response = await api.get("/otp/status", {
        params: { email },
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || "Failed to get verification status"
      );
    }
  },
};

export default otpService;
