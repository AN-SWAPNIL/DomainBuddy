import axios from "axios";

// Simple static configuration - no more dynamic URL detection!
const API_URL =
  import.meta.env.VITE_NGROK_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";
const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 10000;

console.log("🌐 Using API URL:", API_URL);

// Create axios instance with static URL
const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "1",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("🔑 Adding auth token to request:", config.url);
    } else {
      console.log("⚠️ No auth token found for request:", config.url);
    }
    return config;
  },
  (error) => {
    console.error("❌ Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log("✅ API Response:", response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error("❌ API Error:", {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data,
    });

    if (error.response?.status === 401) {
      // Only redirect to login if we're not already on the login page
      // and if we actually had a token (meaning the user was logged in)
      const hadToken = !!localStorage.getItem("token");
      localStorage.removeItem("token");

      // Don't redirect if we're already on login/register pages
      const currentPath = window.location.pathname;
      const isAuthPage =
        currentPath === "/login" || currentPath === "/register";

      if (hadToken && !isAuthPage) {
        console.log("🔄 Redirecting to login due to 401 error");
        // Dispatch a custom event instead of direct redirect
        // This allows components to handle the auth failure more gracefully
        window.dispatchEvent(
          new CustomEvent("auth-failed", {
            detail: { error: error.response?.data },
          })
        );

        // Only redirect after a short delay to allow components to handle the event
        setTimeout(() => {
          window.location.href = "/login";
        }, 100);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
