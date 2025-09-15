import React, { useState, useContext } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CreditCardIcon,
  BellIcon,
  ShieldCheckIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { AuthContext } from "../contexts/AuthContext";
import { authService } from "../services/authService";
import { paymentService } from "../services/paymentService";

const profileSchema = yup.object({
  first_name: yup.string().required("First name is required"),
  last_name: yup.string().required("Last name is required"),
  email: yup.string().email("Invalid email").required("Email is required"),
  phone: yup
    .string()
    .test(
      "no-country-code",
      "Please do not include country code (+ prefix). The country code will be automatically added based on your selected country.",
      function (value) {
        if (!value) return true; // Allow empty values
        return !value.trim().startsWith("+");
      }
    ),
  street: yup.string(),
  city: yup.string(),
  state: yup.string(),
  country: yup.string(),
  zip_code: yup.string(),
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required("Current password is required"),
  newPassword: yup
    .string()
    .min(6, "Password must be at least 6 characters")
    .required("New password is required"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("newPassword")], "Passwords must match")
    .required("Confirm password is required"),
});

const Settings = () => {
  const { user, updateUser, refreshUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("profile");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const profileForm = useForm({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      street: user?.street || "",
      city: user?.city || "",
      state: user?.state || "",
      country: user?.country || "",
      zip_code: user?.zip_code || "",
    },
  });

  const passwordForm = useForm({
    resolver: yupResolver(passwordSchema),
  });

  const handleProfileUpdate = async (data) => {
    try {
      console.log("🔄 Updating profile with data:", data);
      const response = await authService.updateProfile(data);
      console.log("✅ Profile update response:", response);
      
      // Extract user data from response
      const updatedUser = response.success ? response.data.user : response.user || response;
      console.log("📋 Updated user data:", updatedUser);
      
      // Update the context with the new user data
      updateUser(updatedUser);
      
      // Also refresh from server to ensure consistency
      try {
        await refreshUser();
        console.log("✅ User data refreshed from server after profile update");
      } catch (refreshError) {
        console.warn("⚠️ Failed to refresh user data from server, but profile was updated:", refreshError);
      }
      
      // Reset form with the updated data to reflect changes
      profileForm.reset({
        first_name: updatedUser.first_name || "",
        last_name: updatedUser.last_name || "",
        email: updatedUser.email || "",
        phone: updatedUser.phone || "",
        street: updatedUser.street || "",
        city: updatedUser.city || "",
        state: updatedUser.state || "",
        country: updatedUser.country || "",
        zip_code: updatedUser.zip_code || "",
      });
      
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile. Please try again.");
    }
  };

  const handlePasswordChange = async (data) => {
    try {
      await authService.changePassword(data);
      passwordForm.reset();
      toast.success("Password changed successfully!");
    } catch (error) {
      console.error("Password change error:", error);
      toast.error("Failed to change password. Please check your current password.");
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: UserIcon },
    { id: "security", label: "Security", icon: ShieldCheckIcon },
    { id: "billing", label: "Billing", icon: CreditCardIcon },
  ];

  const ProfileTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Personal Information
        </h3>
        <form
          onSubmit={profileForm.handleSubmit(handleProfileUpdate)}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  {...profileForm.register("first_name")}
                  className="input pl-10"
                  placeholder="Enter your first name"
                />
              </div>
              {profileForm.formState.errors.first_name && (
                <p className="text-red-600 text-sm mt-1">
                  {profileForm.formState.errors.first_name.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  {...profileForm.register("last_name")}
                  className="input pl-10"
                  placeholder="Enter your last name"
                />
              </div>
              {profileForm.formState.errors.last_name && (
                <p className="text-red-600 text-sm mt-1">
                  {profileForm.formState.errors.last_name.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  {...profileForm.register("email")}
                  type="email"
                  className="input pl-10"
                  placeholder="Enter your email"
                />
              </div>
              {profileForm.formState.errors.email && (
                <p className="text-red-600 text-sm mt-1">
                  {profileForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  {...profileForm.register("phone")}
                  type="tel"
                  className="input pl-10"
                  placeholder="e.g., (555) 123-4567 or 5551234567"
                />
              </div>
              <p className="text-xs text-blue-600 mt-1">
                💡 Don't include country code (e.g., +1, +44). It will be
                automatically added based on your selected country.
              </p>
              {profileForm.formState.errors.phone && (
                <p className="text-red-600 text-sm mt-1">
                  {profileForm.formState.errors.phone.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address
              </label>
              <div className="relative">
                <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  {...profileForm.register("street")}
                  className="input pl-10"
                  placeholder="Enter your street address"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <div className="relative">
                <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  {...profileForm.register("city")}
                  className="input pl-10"
                  placeholder="Enter your city"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State/Province
              </label>
              <div className="relative">
                <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  {...profileForm.register("state")}
                  className="input pl-10"
                  placeholder="Enter your state/province"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP/Postal Code
              </label>
              <div className="relative">
                <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  {...profileForm.register("zip_code")}
                  className="input pl-10"
                  placeholder="Enter your ZIP/postal code"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <select {...profileForm.register("country")} className="input">
              <option value="">Select Country</option>
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="IN">India</option>
              <option value="JP">Japan</option>
              <option value="CN">China</option>
              <option value="BR">Brazil</option>
              <option value="MX">Mexico</option>
              <option value="IT">Italy</option>
              <option value="ES">Spain</option>
              <option value="NL">Netherlands</option>
              <option value="SE">Sweden</option>
              <option value="NO">Norway</option>
              <option value="DK">Denmark</option>
              <option value="FI">Finland</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              Update Profile
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );

  const SecurityTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Change Password
        </h3>
        <form
          onSubmit={passwordForm.handleSubmit(handlePasswordChange)}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <div className="relative">
              <KeyIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                {...passwordForm.register("currentPassword")}
                type={showCurrentPassword ? "text" : "password"}
                className="input pl-10 pr-10"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? (
                  <EyeSlashIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            {passwordForm.formState.errors.currentPassword && (
              <p className="text-red-600 text-sm mt-1">
                {passwordForm.formState.errors.currentPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <KeyIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                {...passwordForm.register("newPassword")}
                type={showNewPassword ? "text" : "password"}
                className="input pl-10 pr-10"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? (
                  <EyeSlashIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            {passwordForm.formState.errors.newPassword && (
              <p className="text-red-600 text-sm mt-1">
                {passwordForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <KeyIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                {...passwordForm.register("confirmPassword")}
                type={showConfirmPassword ? "text" : "password"}
                className="input pl-10 pr-10"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <EyeSlashIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            {passwordForm.formState.errors.confirmPassword && (
              <p className="text-red-600 text-sm mt-1">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              Change Password
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Two-Factor Authentication
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">Secure your account with 2FA</p>
            <p className="text-sm text-gray-500">
              Add an extra layer of security to your account
            </p>
          </div>
          <button className="btn-outline">Enable 2FA</button>
        </div>
      </div>
    </motion.div>
  );

  const BillingTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Payment Methods</h3>
          <button className="btn-primary">Add Payment Method</button>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <CreditCardIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No payment methods
            </h4>
            <p className="text-gray-600 mb-4">
              Add a payment method to purchase domains
            </p>
            <button className="btn-primary">Add Payment Method</button>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <CreditCardIcon className="h-6 w-6 text-gray-400" />
                  <div>
                    <div className="font-medium">
                      **** **** **** {method.last4}
                    </div>
                    <div className="text-sm text-gray-600">
                      {method.brand} • Expires {method.expiry}
                    </div>
                  </div>
                </div>
                <div className="space-x-2">
                  <button className="btn-outline text-sm">Edit</button>
                  <button className="text-red-600 text-sm">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Billing History
        </h3>
        <div className="text-center py-8 text-gray-500">
          No billing history available
        </div>
      </div>
    </motion.div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileTab />;
      case "security":
        return <SecurityTab />;
      case "billing":
        return <BillingTab />;
      default:
        return <ProfileTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage your account preferences and settings
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">{renderTabContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
