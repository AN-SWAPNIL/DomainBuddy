import api from "./api";

export const userService = {
  // Get user profile
  getUserProfile: async () => {
    const response = await api.get("/users/profile");
    return response.data.success ? response.data.data : response.data;
  },

  // Update user profile
  updateUserProfile: async (profileData) => {
    const response = await api.put("/users/profile", profileData);
    return response.data.success ? response.data.data : response.data;
  },

  // Delete user account
  deleteUserAccount: async (confirmDelete) => {
    const response = await api.delete("/users/account", {
      data: { confirmDelete },
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Get user stats
  getUserStats: async () => {
    const response = await api.get("/users/stats");
    return response.data.success ? response.data.data : response.data;
  },

  // Update user preferences
  updateUserPreferences: async (preferences) => {
    const response = await api.put("/users/preferences", preferences);
    return response.data.success ? response.data.data : response.data;
  },
};

export default userService;
