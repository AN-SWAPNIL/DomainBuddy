import React, { createContext, useContext, useReducer, useEffect } from "react";
import authService from "../services/authService";

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Action types
const AuthActionTypes = {
  SET_LOADING: "SET_LOADING",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  LOGOUT: "LOGOUT",
  SET_USER: "SET_USER",
  CLEAR_ERROR: "CLEAR_ERROR",
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AuthActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
    case AuthActionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case AuthActionTypes.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case AuthActionTypes.LOGOUT:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case AuthActionTypes.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case AuthActionTypes.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Export AuthContext for direct access if needed
export { AuthContext };

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        if (authService.isAuthenticated()) {
          try {
            const userData = await authService.getCurrentUser();
            console.log("🔍 getCurrentUser response:", userData);

            // Extract user from nested response structure
            const user = userData.success ? userData.data.user : userData.user;

            dispatch({
              type: AuthActionTypes.SET_USER,
              payload: user,
            });
          } catch (apiError) {
            // If getCurrentUser fails, the token might be invalid/expired
            console.log("Token validation failed:", apiError.message);
            authService.logout();
            dispatch({ type: AuthActionTypes.LOGOUT });
          }
        } else {
          dispatch({ type: AuthActionTypes.SET_LOADING, payload: false });
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        authService.logout();
        dispatch({ type: AuthActionTypes.LOGOUT });
      }
    };

    checkAuthStatus();

    // Listen for auth-failed events from the API interceptor
    const handleAuthFailed = () => {
      dispatch({ type: AuthActionTypes.LOGOUT });
    };

    window.addEventListener("auth-failed", handleAuthFailed);

    return () => {
      window.removeEventListener("auth-failed", handleAuthFailed);
    };
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      dispatch({ type: AuthActionTypes.SET_LOADING, payload: true });
      const response = await authService.login(credentials);
      console.log("🔍 AuthContext login response:", response);

      // Extract user from nested response structure
      const userData = response.success ? response.data : response;

      dispatch({
        type: AuthActionTypes.LOGIN_SUCCESS,
        payload: userData, // This contains both user and token
      });
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Login failed";
      dispatch({
        type: AuthActionTypes.LOGIN_FAILURE,
        payload: errorMessage,
      });
      throw error;
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      dispatch({ type: AuthActionTypes.SET_LOADING, payload: true });
      const response = await authService.register(userData);
      console.log("🔍 AuthContext register response:", response);

      // Extract user from nested response structure
      const userResponse = response.success ? response.data : response;

      dispatch({
        type: AuthActionTypes.LOGIN_SUCCESS,
        payload: userResponse, // This contains both user and token
      });
      return response;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Registration failed";
      dispatch({
        type: AuthActionTypes.LOGIN_FAILURE,
        payload: errorMessage,
      });
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    authService.logout();
    dispatch({ type: AuthActionTypes.LOGOUT });
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: AuthActionTypes.CLEAR_ERROR });
  };

  // Update user function
  const updateUser = (userData) => {
    dispatch({
      type: AuthActionTypes.SET_USER,
      payload: userData,
    });
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    clearError,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
