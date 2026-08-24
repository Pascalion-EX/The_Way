import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { AppContent } from "../Context/AppContext.jsx";
import Navbar from "../Components/Navbar";
import Waves from "../Components/Waves.jsx";

const Profile = () => {
  const { userData, backendUrl, getUserData } = useContext(AppContent);

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [editData, setEditData] = useState({
    name: "",
    email: "",
    phone: "",
    class: "",
  });

  useEffect(() => {
    if (userData) {
      setEditData({
        name: userData.name || "",
        email: userData.email || "",
        phone: userData.phone || "",
        class: userData.class || "",
      });
    }
  }, [userData]);

  const getRoleBadgeStyle = (role) => {
    const normalizedRole = Array.isArray(role) ? role[0] : role;

    switch (normalizedRole) {
      case "admin":
        return "bg-red-100 text-red-700 border-red-200";
      case "leader":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "pascal":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "parent":
        return "bg-green-100 text-green-700 border-green-200";
      case "child":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatRole = (role) => {
    if (!role) return "User";
    if (Array.isArray(role)) return role.join(", ");
    return role;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setEditData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCancel = () => {
    setEditData({
      name: userData?.name || "",
      email: userData?.email || "",
      phone: userData?.phone || "",
      class: userData?.class || "",
    });

    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const { data } = await axios.put(
        `${backendUrl}/api/user/update-profile`,
        editData,
        {
          withCredentials: true,
        }
      );

      if (data.success) {
        if (getUserData) {
          await getUserData();
        }

        setIsEditing(false);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Waves
          lineColor="#e4b54f7e"
          backgroundColor="rgba(255, 255, 255, 0)"
          waveSpeedX={0.08}
          waveSpeedY={0.03}
          waveAmpX={40}
          waveAmpY={20}
          friction={0.9}
          tension={0.01}
          maxCursorMove={320}
          xGap={10}
          yGap={20}
        />
      </div>

      <div className="relative z-10">
        <Navbar />

        <main className="relative z-10 px-4 sm:px-6 lg:px-8 pt-28 pb-10 max-w-6xl mx-auto">
          <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Profile Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
                <div className="w-28 h-28 mx-auto rounded-full bg-blue-50 flex items-center justify-center overflow-hidden border border-blue-100">
                  {userData?.profilePicture ? (
                    <img
                      src={`${backendUrl}${userData.profilePicture}`}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="flex h-24 w-24 items-center justify-center rounded-full bg-black text-4xl font-bold text-white transition hover:bg-gray-800">
                      {userData?.name?.[0]?.toUpperCase() || "U"}
                    </span>
                  )}
                </div>

                <h1 className="mt-5 text-2xl font-semibold text-gray-900">
                  {userData?.name || "Servant"}
                </h1>

                <p className="mt-1 text-sm text-gray-500 break-all">
                  {userData?.email || "No email available"}
                </p>

                <div
                  className={`inline-flex items-center px-4 py-1.5 mt-4 rounded-full border text-sm font-medium capitalize ${getRoleBadgeStyle(
                    userData?.role
                  )}`}
                >
                  {formatRole(userData?.role)}
                </div>
              </div>
            </div>

            {/* Right Details Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Account Information */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-5">
                  Account Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Full Name */}
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>

                    {isEditing ? (
                      <input
                        type="text"
                        name="name"
                        value={editData.name}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="mt-1 font-medium text-gray-900">
                        {userData?.name || "Not provided"}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <p className="text-sm text-gray-500">Email</p>

                    {isEditing ? (
                      <input
                        type="email"
                        name="email"
                        value={editData.email}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="mt-1 font-medium text-gray-900 break-all">
                        {userData?.email || "Not provided"}
                      </p>
                    )}
                  </div>

                  {/* Role - Not Editable */}
                  <div>
                    <p className="text-sm text-gray-500">Role</p>
                    <p className="mt-1 font-medium text-gray-900 capitalize">
                      {formatRole(userData?.role)}
                    </p>
                  </div>

                  {/* Account Status */}
                  <div>
                    <p className="text-sm text-gray-500">Account Status</p>
                    <p
                      className={`mt-1 font-medium ${
                        userData?.isAccountVerified
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    >
                      {userData?.isAccountVerified
                        ? "Verified"
                        : "Not verified"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Profile Details */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-5">
                  Profile Details
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Phone */}
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>

                    {isEditing ? (
                      <input
                        type="text"
                        name="phone"
                        value={editData.phone}
                        onChange={handleChange}
                        placeholder="Enter phone number"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="mt-1 font-medium text-gray-900">
                        {userData?.phone || "Not provided"}
                      </p>
                    )}
                  </div>

                  {/* Class */}
                  <div>
                    <p className="text-sm text-gray-500">Class</p>

                    {isEditing ? (
                      <input
                        type="number"
                        name="class"
                        value={editData.class}
                        onChange={handleChange}
                        placeholder="Enter class"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="mt-1 font-medium text-gray-900">
                        {userData?.class || "Not assigned"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Actions
                </h2>

                <div className="flex flex-col sm:flex-row gap-3">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition disabled:opacity-60"
                      >
                        {loading ? "Saving..." : "Save Changes"}
                      </button>

                      <button
                        onClick={handleCancel}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                    >
                      Edit Profile
                    </button>
                  )}

                  {!userData?.isAccountVerified && !isEditing && (
                    <button className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition">
                      Verify Email
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Profile;