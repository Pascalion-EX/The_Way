import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { AppContent } from "../Context/AppContext.jsx";
import Navbar from "../Components/Navbar";
import Waves from "../Components/Waves.jsx";
import { toast } from "react-toastify";
import { CalendarPlus } from "lucide-react";

const Admin = () => {
  const { backendUrl, userData, getUserData } = useContext(AppContent);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [generatingCalendar, setGeneratingCalendar] = useState(false);

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
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };
  const handleGenerateCopticCalendar = async () => {
  const confirmed = window.confirm(
    "Populate the calendar with Coptic fasts and feasts for the next 3 years starting from today?"
  );

  if (!confirmed) return;

  try {
    setGeneratingCalendar(true);

    const { data } = await axios.post(
      `${backendUrl}/api/events/seed-coptic-calendar`,
      {},
      {
        withCredentials: true,
      }
    );

    if (data.success) {
      toast.success(
        `${data.created} events added. ${data.skipped} existing events skipped.`
      );
    } else {
      toast.error(
        data.message || "Failed to generate Coptic calendar."
      );
    }
  } catch (error) {
    console.error(
      "Generate Coptic calendar error:",
      error
    );

    toast.error(
      error.response?.data?.message ||
        "Failed to generate Coptic calendar."
    );
  } finally {
    setGeneratingCalendar(false);
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

  const handleSaveClass = async (user, userClass) => {
    try {
      const { data } = await axios.patch(
        `${backendUrl}/api/admin/users/${user._id}/class`,
        { class: userClass },
        { withCredentials: true }
      );

      if (!data.success) {
        toast.error(data.message || "Failed to update class");
        return false;
      }

      setUsers((prev) => prev.map((entry) => entry._id === user._id ? { ...entry, class: data.user.class } : entry));
      toast.success(data.message);
      await getUserData();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update class");
      return false;
    }
  };

  const handleSaveRoles = async (user, role) => {
    try {
      const { data } = await axios.patch(
        `${backendUrl}/api/admin/users/${user._id}/roles`,
        { role },
        { withCredentials: true }
      );

      if (!data.success) {
        toast.error(data.message || "Failed to update roles");
        return false;
      }

      setUsers((prev) => prev.map((entry) => entry._id === user._id ? { ...entry, role: data.user.role } : entry));
      setStats((prev) => {
        if (!prev) return prev;
        const updatedStats = { ...prev };
        const previousRoles = Array.isArray(user.role) ? user.role : [user.role];
        for (const value of ["admin", "leader", "pascal", "pamela", "parent"]) {
          updatedStats[`${value}Count`] += Number(data.user.role.includes(value)) - Number(previousRoles.includes(value));
        }
        return updatedStats;
      });
      toast.success(data.message);
      await getUserData();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update roles");
      return false;
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

      {/* LEFT SIDE */}

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

      {/* RIGHT SIDE - COPTIC CALENDAR BUTTON */}

      <div className="flex shrink-0">
        <button
          onClick={handleGenerateCopticCalendar}
          disabled={generatingCalendar}
          className="
            flex
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-[#D4AF37]
            px-5
            py-3
            font-semibold
            text-white
            shadow-md
            transition
            hover:bg-[#b9952e]
            hover:shadow-lg
            active:scale-95
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {generatingCalendar ? (
            <>
              <span
                className="
                  h-5
                  w-5
                  animate-spin
                  rounded-full
                  border-2
                  border-white/40
                  border-t-white
                "
              />

              Generating...
            </>
          ) : (
            <>
              <CalendarPlus size={21} />

              Fill Coptic Calendar
            </>
          )}
        </button>
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
              <StatCard title="Leaders" value={(stats?.leaderCount ?? 0)+(stats?.adminCount ?? 0)+(stats?.pamelaCount ?? 0)+(stats?.pascalCount ?? 0)} />
              <StatCard title="Parents" value={stats?.parentCount || 0} />
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
                            <UserRoleEditor user={user} onSave={handleSaveRoles} />
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
                            {user.class || "No Class"}
                            <UserClassEditor user={user} onSave={handleSaveClass} />
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

const UserClassEditor = ({ user, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [userClass, setUserClass] = useState("");
  const [saving, setSaving] = useState(false);
  const numericClass = Number(userClass);
  const validClass = userClass !== "" && Number.isSafeInteger(numericClass) && numericClass >= 0 && numericClass <= 12;

  const save = async (event) => {
    event.preventDefault();
    if (!validClass || saving) return;
    setSaving(true);
    try {
      if (await onSave(user, numericClass)) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Edit class for ${user.name || user.email}`}
        onClick={() => {
          setUserClass(String(user.class ?? 0));
          setEditing(true);
        }}
        className="mt-2 block text-xs font-semibold text-blue-600 hover:text-blue-800"
      >
        Edit class
      </button>
    );
  }

  return (
    <form onSubmit={save} className="mt-3 min-w-48 rounded-xl border border-gray-200 bg-white p-3">
      <label className="block text-xs font-semibold">
        Assign class
        <input
          type="number"
          min="0"
          max="12"
          step="1"
          required
          value={userClass}
          onChange={(event) => setUserClass(event.target.value)}
          disabled={saving}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>
      <p className="mt-2 text-xs text-gray-500">Classes 1–12. Use 0 for no class.</p>
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving || !validClass} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Saving..." : "Save class"}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">
          Cancel
        </button>
      </div>
    </form>
  );
};

const UserRoleEditor = ({ user, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [saving, setSaving] = useState(false);
  const roles = ["pascal", "admin", "pamela", "leader", "parent", "unAssigned"];

  const toggleRole = (role) => {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) return prev.filter((value) => value !== role);
      if (role === "unAssigned") return [role];
      return [...prev.filter((value) => value !== "unAssigned"), role];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      if (await onSave(user, selectedRoles)) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Edit roles for ${user.name || user.email}`}
        onClick={() => {
          setSelectedRoles(Array.isArray(user.role) ? user.role : user.role ? [user.role] : []);
          setEditing(true);
        }}
        className="mt-2 block text-xs font-semibold text-blue-600 hover:text-blue-800"
      >
        Edit roles
      </button>
    );
  }

  return (
    <div className="mt-3 min-w-48 rounded-xl border border-gray-200 bg-white p-3">
      <fieldset disabled={saving}>
        <legend className="mb-2 text-xs font-semibold">Assign roles</legend>
        <div className="grid grid-cols-2 gap-2">
          {roles.map((role) => (
            <label key={role} className="flex items-center gap-2 text-xs capitalize">
              <input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => toggleRole(role)} />
              {role === "unAssigned" ? "Unassigned" : role}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={save} disabled={saving || selectedRoles.length === 0} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Saving..." : "Save roles"}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default Admin;
