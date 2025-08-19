import axios from "axios";

// Simple static configuration - no more dynamic URL detection!
const API_URL =
  import.meta.env.VITE_NGROK_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5001/api";  // Updated to use port 5001
const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 30000; // Increased to 30 seconds

console.log("🌐 Using API URL:", API_URL);

// Create axios instance with static URL
const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
