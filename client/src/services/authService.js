import api from "./api";

export const authService = {
  // Login user
  login: async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    console.log("🔍 Login response:", response.data);

    // The token is nested in response.data.data.token
    if (response.data.success && response.data.data.token) {
      localStorage.setItem("token", response.data.data.token);
      console.log(
        "✅ Token saved to localStorage:",
        response.data.data.token.substring(0, 20) + "..."
      );
    } else {
      console.error("❌ No token found in login response");
    }
    return response.data;
  },

  // Register user
  register: async (userData) => {
    const response = await api.post("/auth/register", userData);
    console.log("🔍 Register response:", response.data);

    // The token is nested in response.data.data.token
    if (response.data.success && response.data.data.token) {
      localStorage.setItem("token", response.data.data.token);
      console.log(
        "✅ Token saved to localStorage:",
        response.data.data.token.substring(0, 20) + "..."
      );
    } else {
      console.error("❌ No token found in register response");
    }
    return response.data;
  },

  // Logout user
  logout: () => {
    localStorage.removeItem("token");
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await api.get("/auth/me");
    console.log("🔍 Get user response:", response.data);

    // The user data is nested in response.data.data.user
    return response.data;
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem("token");
  },

  // Get stored token
  getToken: () => {
    return localStorage.getItem("token");
  },

  // Forgot password
  forgotPassword: async (email) => {
    const response = await api.post("/auth/forgot-password", { email });
    return response.data.success ? response.data.data : response.data;
  },

  // Reset password
  resetPassword: async (token, password) => {
    const response = await api.post("/auth/reset-password", {
      token,
      password,
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Update password
  updatePassword: async (currentPassword, newPassword) => {
    const response = await api.put("/auth/password", {
      currentPassword,
      newPassword,
    });
    return response.data.success ? response.data.data : response.data;
  },
};

export default authService;
