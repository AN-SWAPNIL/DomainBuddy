import React, { useState, useEffect } from "react";
import {
  UserIcon,
  LockClosedIcon,
  BellIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { userService } from "../services/userService";

const Settings = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      country: "US",
      zipCode: "",
    },
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    domainExpiry: true,
    paymentReminders: true,
    marketingEmails: false,
  });

  const tabs = [
    { id: "profile", label: "Profile", icon: UserIcon },
    { id: "security", label: "Security", icon: LockClosedIcon },
    { id: "notifications", label: "Notifications", icon: BellIcon },
    { id: "billing", label: "Billing", icon: CreditCardIcon },
    { id: "api", label: "API Keys", icon: KeyIcon },
  ];

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const userData = await userService.getProfile();
      setUser(userData);
      setProfileData({
        name: userData.name || "",
        email: userData.email || "",
        phone: userData.profile?.phone || "",
        address: {
          street: userData.profile?.address?.street || "",
          city: userData.profile?.address?.city || "",
          state: userData.profile?.address?.state || "",
          country: userData.profile?.address?.country || "US",
          zipCode: userData.profile?.address?.zipCode || "",
        },
      });
    } catch (error) {
      console.error("Failed to load user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await userService.updateProfile(profileData);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("New passwords don't match!");
      return;
    }
    try {
      setLoading(true);
      await userService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      alert("Password changed successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Failed to change password:", error);
      alert("Failed to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await userService.updateNotifications(notifications);
      alert("Notification preferences updated!");
    } catch (error) {
      console.error("Failed to update notifications:", error);
      alert("Failed to update notification preferences. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderProfileTab = () => (
    <form onSubmit={handleProfileSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={profileData.name}
            onChange={(e) =>
              setProfileData({ ...profileData, name: e.target.value })
            }
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={profileData.email}
            onChange={(e) =>
              setProfileData({ ...profileData, email: e.target.value })
            }
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={profileData.phone}
            onChange={(e) =>
              setProfileData({ ...profileData, phone: e.target.value })
            }
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Street Address
          </label>
          <input
            type="text"
            value={profileData.address.street}
            onChange={(e) =>
              setProfileData({
                ...profileData,
                address: { ...profileData.address, street: e.target.value },
              })
            }
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            City
          </label>
          <input
            type="text"
            value={profileData.address.city}
            onChange={(e) =>
              setProfileData({
                ...profileData,
                address: { ...profileData.address, city: e.target.value },
              })
            }
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            State/Province
          </label>
          <input
            type="text"
            value={profileData.address.state}
            onChange={(e) =>
              setProfileData({
                ...profileData,
                address: { ...profileData.address, state: e.target.value },
              })
            }
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Country
          </label>
          <select
            value={profileData.address.country}
            onChange={(e) =>
              setProfileData({
                ...profileData,
                address: { ...profileData.address, country: e.target.value },
              })
            }
            className="input-field"
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="IN">India</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ZIP/Postal Code
          </label>
          <input
            type="text"
            value={profileData.address.zipCode}
            onChange={(e) =>
              setProfileData({
                ...profileData,
                address: { ...profileData.address, zipCode: e.target.value },
              })
            }
            className="input-field"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Updating..." : "Update Profile"}
        </button>
      </div>
    </form>
  );

  const renderSecurityTab = () => (
    <form onSubmit={handlePasswordSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Password
          </label>
          <input
            type="password"
            value={passwordData.currentPassword}
            onChange={(e) =>
              setPasswordData({
                ...passwordData,
                currentPassword: e.target.value,
              })
            }
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New Password
          </label>
          <input
            type="password"
            value={passwordData.newPassword}
            onChange={(e) =>
              setPasswordData({ ...passwordData, newPassword: e.target.value })
            }
            className="input-field"
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirm New Password
          </label>
          <input
            type="password"
            value={passwordData.confirmPassword}
            onChange={(e) =>
              setPasswordData({
                ...passwordData,
                confirmPassword: e.target.value,
              })
            }
            className="input-field"
            required
            minLength={8}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Changing..." : "Change Password"}
        </button>
      </div>
    </form>
  );

  const renderNotificationsTab = () => (
    <form onSubmit={handleNotificationSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Email Notifications
            </h3>
            <p className="text-sm text-gray-500">
              Receive notifications via email
            </p>
          </div>
          <input
            type="checkbox"
            checked={notifications.emailNotifications}
            onChange={(e) =>
              setNotifications({
                ...notifications,
                emailNotifications: e.target.checked,
              })
            }
            className="toggle"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Domain Expiry Alerts
            </h3>
            <p className="text-sm text-gray-500">
              Get notified when domains are about to expire
            </p>
          </div>
          <input
            type="checkbox"
            checked={notifications.domainExpiry}
            onChange={(e) =>
              setNotifications({
                ...notifications,
                domainExpiry: e.target.checked,
              })
            }
            className="toggle"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Payment Reminders
            </h3>
            <p className="text-sm text-gray-500">
              Get notified about upcoming payments
            </p>
          </div>
          <input
            type="checkbox"
            checked={notifications.paymentReminders}
            onChange={(e) =>
              setNotifications({
                ...notifications,
                paymentReminders: e.target.checked,
              })
            }
            className="toggle"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Marketing Emails
            </h3>
            <p className="text-sm text-gray-500">
              Receive updates about new features and promotions
            </p>
          </div>
          <input
            type="checkbox"
            checked={notifications.marketingEmails}
            onChange={(e) =>
              setNotifications({
                ...notifications,
                marketingEmails: e.target.checked,
              })
            }
            className="toggle"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Updating..." : "Update Preferences"}
        </button>
      </div>
    </form>
  );

  const renderBillingTab = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Payment Methods
        </h3>
        <p className="text-gray-600 mb-4">
          Manage your payment methods for domain purchases
        </p>
        <button className="btn-outline">
          <CreditCardIcon className="h-5 w-5 mr-2" />
          Add Payment Method
        </button>
      </div>
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Billing History
        </h3>
        <p className="text-gray-600 mb-4">
          View your past transactions and invoices
        </p>
        <button className="btn-outline">View Billing History</button>
      </div>
    </div>
  );

  const renderAPITab = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">API Keys</h3>
        <p className="text-gray-600 mb-4">
          Generate API keys to integrate with your applications
        </p>
        <button className="btn-primary">
          <KeyIcon className="h-5 w-5 mr-2" />
          Generate API Key
        </button>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <p className="text-yellow-800 text-sm">
          <strong>Note:</strong> Keep your API keys secure and never share them
          publicly. API keys provide full access to your account.
        </p>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return renderProfileTab();
      case "security":
        return renderSecurityTab();
      case "notifications":
        return renderNotificationsTab();
      case "billing":
        return renderBillingTab();
      case "api":
        return renderAPITab();
      default:
        return renderProfileTab();
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Cog6ToothIcon className="h-12 w-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <div className="px-6 py-4">
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600 mt-1">
                Manage your account settings and preferences
              </p>
            </div>
            <div className="px-6">
              <nav className="flex space-x-8">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                        activeTab === tab.id
                          ? "border-primary-500 text-primary-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <IconComponent className="h-5 w-5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
          <div className="px-6 py-8">{renderTabContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
