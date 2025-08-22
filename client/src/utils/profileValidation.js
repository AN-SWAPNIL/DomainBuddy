// Profile validation utilities
export const validateProfileCompleteness = (user) => {
  if (!user) {
    return {
      isComplete: false,
      missingFields: ["User data not available"],
      message: "Please log in to continue",
    };
  }

  const requiredFields = [
    { field: "first_name", label: "First Name", value: user.first_name },
    { field: "last_name", label: "Last Name", value: user.last_name },
    { field: "email", label: "Email", value: user.email },
    { field: "phone", label: "Phone Number", value: user.phone },
    { field: "street", label: "Street Address", value: user.street },
    { field: "city", label: "City", value: user.city },
    { field: "state", label: "State/Province", value: user.state },
    { field: "country", label: "Country", value: user.country },
    { field: "zip_code", label: "ZIP/Postal Code", value: user.zip_code },
  ];

  const missingFields = [];

  requiredFields.forEach(({ field, label, value }) => {
    if (!value || value.trim() === "") {
      missingFields.push(label);
    }
  });

  const isComplete = missingFields.length === 0;

  console.log("🔍 Profile validation result:", {
    isComplete,
    missingFields,
    userFields: {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      street: user.street,
      city: user.city,
      state: user.state,
      country: user.country,
      zip_code: user.zip_code,
    }
  });

  return {
    isComplete,
    missingFields,
    message: isComplete
      ? "Profile is complete"
      : `Please complete your profile. Missing: ${missingFields.join(", ")}`,
  };
};

// Profile completeness hook for React components
export const useProfileCheck = (user, navigate) => {
  const checkProfileAndProceed = async (onSuccess, domain = "") => {
    try {
      // First, try to get fresh user data from the AuthContext if available
      let currentUser = user;
      
      // Check if we're in a React component with access to AuthContext
      try {
        const { useAuth } = await import("../contexts/AuthContext");
        const authContext = useAuth();
        
        if (authContext && authContext.refreshUser) {
          console.log("🔄 Using AuthContext.refreshUser to get latest user data...");
          currentUser = await authContext.refreshUser();
        } else {
          // Fallback to API call
          console.log("🔄 Fallback: Refreshing user data via API call...");
          const { authService } = await import("../services/authService");
          const currentUserResponse = await authService.getCurrentUser();
          currentUser = currentUserResponse.success ? currentUserResponse.data.user : currentUserResponse.user;
        }
      } catch (contextError) {
        console.log("� AuthContext not available, using direct API call...");
        // Fallback to direct API call
        const { authService } = await import("../services/authService");
        const currentUserResponse = await authService.getCurrentUser();
        currentUser = currentUserResponse.success ? currentUserResponse.data.user : currentUserResponse.user;
      }
      
      console.log("📋 Current user data for validation:", currentUser);
      
      // Use the refreshed user data for validation
      const validation = validateProfileCompleteness(currentUser);
      
      if (!validation.isComplete) {
        // Show more user-friendly notification about incomplete profile
        const domainText = domain ? ` for "${domain}"` : "";
        const message = `Complete Your Profile Required\n\nTo proceed with your domain purchase${domainText}, please complete your profile first.\n\nMissing information: ${validation.missingFields.join(
          ", "
        )}\n\nClick OK to go to your profile page, or Cancel to stay here.`;

        if (window.confirm(message)) {
          // Redirect to profile page
          navigate("/profile");
          return false;
        }
        return false;
      }

      // Profile is complete, proceed with the action
      console.log("✅ Profile is complete, proceeding with action");
      if (onSuccess) {
        onSuccess();
      }
      return true;
    } catch (error) {
      console.error("❌ Error refreshing user data:", error);
      
      // Fallback to existing user data if API call fails
      const validation = validateProfileCompleteness(user);
      
      if (!validation.isComplete) {
        const domainText = domain ? ` for "${domain}"` : "";
        const message = `Complete Your Profile Required\n\nTo proceed with your domain purchase${domainText}, please complete your profile first.\n\nMissing information: ${validation.missingFields.join(
          ", "
        )}\n\nClick OK to go to your profile page, or Cancel to stay here.`;

        if (window.confirm(message)) {
          navigate("/profile");
          return false;
        }
        return false;
      }

      if (onSuccess) {
        onSuccess();
      }
      return true;
    }
  };

  return { checkProfileAndProceed, validateProfileCompleteness };
};

export default { validateProfileCompleteness, useProfileCheck };
