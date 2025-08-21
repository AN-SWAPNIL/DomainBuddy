import api from "./api";

export const userService = {
  // Get user profile
  getProfile: async () => {
    const response = await api.get("/user/profile");
    return response.data.success ? response.data.data.user : response.data;
  },

  // Update user profile
  updateProfile: async (profileData) => {
    const response = await api.put("/user/profile", profileData);
    return response.data.success ? response.data.data.user : response.data;
  },

  // Change password
  changePassword: async (passwordData) => {
    const response = await api.put("/auth/password", passwordData);
    return response.data.success ? response.data.data : response.data;
  },

  // Get user profile (legacy method name)
  getUserProfile: async () => {
    const response = await api.get("/user/profile");
    return response.data.success ? response.data.data.user : response.data;
  },

  // Update user profile (legacy method name)
  updateUserProfile: async (profileData) => {
    const response = await api.put("/user/profile", profileData);
    return response.data.success ? response.data.data.user : response.data;
  },

  // Delete user account
  deleteUserAccount: async (confirmDelete) => {
    const response = await api.delete("/user/account", {
      data: { confirmDelete },
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Get user stats
  getUserStats: async () => {
    const response = await api.get("/user/stats");
    return response.data.success ? response.data.data : response.data;
  },

  // Update user preferences
  updateUserPreferences: async (preferences) => {
    const response = await api.put("/user/preferences", preferences);
    return response.data.success ? response.data.data : response.data;
  },
};

export default userService;
