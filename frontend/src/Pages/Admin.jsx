import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { AppContent } from "../Context/AppContext.jsx";
import Navbar from "../Components/Navbar";
import Waves from "../Components/Waves.jsx";
import { toast } from "react-toastify";
import { assets } from "../assets/assets";

const Admin = () => {
  const { backendUrl, userData } = useContext(AppContent);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);

  const allowedAdminRoles = ["admin", "pamela", "pascal"];

  const isAdmin = userData
    ? Array.isArray(userData.role)
      ? userData.role.some((role) => allowedAdminRoles.includes(role))
      : allowedAdminRoles.includes(userData.role)
    : false;

  const getRoleBadgeStyle = (role) => {
    const normalizedRole = Array.isArray(role) ? role[0] : role;

    switch (normalizedRole) {
      case "admin":
        return "bg-red-100 text-red-700 border-red-200";
      case "leader":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "pascal":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "pamela":
        return "bg-pink-100 text-pink-700 border-pink-200";
      case "parent":
        return "bg-green-100 text-green-700 border-green-200";
      case "child":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatRole = (role) => {
    if (!role) return "No Role";
    if (Array.isArray(role)) return role.join(", ");
    return role;
  };

  const fetchAdminDashboard = async () => {
    try {
      setLoading(true);

      const { data } = await axios.get(`${backendUrl}/api/admin/dashboard`, {
        withCredentials: true,
      });

      if (data.success) {
        setStats(data.stats);
        setUsers(data.users);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load admin page");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this user?"
    );

    if (!confirmDelete) return;

    try {
      const { data } = await axios.delete(
        `${backendUrl}/api/admin/users/${id}`,
        {
          withCredentials: true,
        }
      );

      if (data.success) {
        toast.success(data.message);
        setUsers((prev) => prev.filter((user) => user._id !== id));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete user");
    }
  };

  useEffect(() => {
    fetchAdminDashboard();
  }, []);

  if (!isAdmin && !loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900">
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

        <Navbar />

        <div className="relative z-10 flex min-h-[80vh] items-center justify-center px-6">
          <div className="max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
            <h1 className="text-3xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-3 text-sm text-gray-600">
              This page is available only for admin users.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900">
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

      <Navbar />

      <main className="px-4 pb-10 pt-40 sm:px-8 sm:pt-38 lg:px-16 lg:pt-38 lg:pb-28 relative z-10 mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
        <section className="mb-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-500">
                  Admin Dashboard
                </p>

                <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
                  Church App Management
                </h1>

                <p className="mt-3 max-w-2xl text-sm text-gray-600 sm:text-base">
                  Manage users, check roles, and view basic application
                  statistics.
                </p>
              </div>

            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
            <p className="text-gray-600">Loading admin dashboard...</p>
          </div>
        ) : (
          <>
            <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Users" value={stats?.totalUsers || 0} />
              <StatCard title="Leaders" value={stats?.leaderCount || 0} />
              <StatCard title="Parents" value={stats?.parentCount || 0} />
              <StatCard title="Children" value={stats?.childCount || 0} />
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-xl sm:p-6">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Users</h2>
                  <p className="text-sm text-gray-500">
                    View and manage registered users.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Verified</th>
                      <th className="px-4 py-3 font-semibold">Class</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.length > 0 ? (
                      users.map((user) => (
                        <tr
                          key={user._id}
                          className="border-b border-gray-100 text-sm text-gray-700 transition hover:bg-gray-50"
                        >
                          <td className="px-4 py-4 font-medium text-gray-900">
                            {user.name || "No Name"}
                          </td>

                          <td className="px-4 py-4 text-gray-600">
                            {user.email || "No Email"}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getRoleBadgeStyle(
                                user.role
                              )}`}
                            >
                              {formatRole(user.role)}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            {user.isAccountVerified ? (
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                Verified
                              </span>
                            ) : (
                              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                                Not Verified
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4 text-gray-600">
                            {user.class || user.year || "No Class"}
                          </td>

                          <td className="px-4 py-4">
                            <button
                              onClick={() => handleDeleteUser(user._id)}
                              className="rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={user._id === userData?._id}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="6"
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

const StatCard = ({ title, value }) => {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <h3 className="mt-3 text-3xl font-bold text-gray-900">{value}</h3>
    </div>
  );
};

export default Admin;