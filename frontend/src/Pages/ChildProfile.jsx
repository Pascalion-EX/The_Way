import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "react-toastify";

import axios from "../utils/axios";
import { AppContent } from "../Context/AppContext.jsx";
import Navbar from "../Components/Navbar.jsx";
import Waves from "../Components/Waves.jsx";

// ======================================================
// EMPTY FORM
// ======================================================

const emptyForm = {
  name: "",
  grade: "",
  firstParent: "",
  secondParent: "",
  firstParentNumber: "",
  secondParentNumber: "",
  allergies: "",
  address: "",
};

// ======================================================
// CHILD PROFILES PAGE
// ======================================================

const ChildProfiles = () => {
  const { backendUrl, userData } = useContext(AppContent);

  const API_URL = `${backendUrl}/api/children`;

  // ======================================================
  // STATE
  // ======================================================

  const [children, setChildren] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);

  const [editingChild, setEditingChild] = useState(null);

  const [form, setForm] = useState(emptyForm);

  // ======================================================
  // PERMISSIONS
  // ======================================================

  const allowedRoles = [
    "admin",
    "leader",
    "pascal",
    "pamela",
  ];

  const userRoles = userData
    ? Array.isArray(userData.role)
      ? userData.role.map((role) =>
          String(role).toLowerCase()
        )
      : [String(userData.role).toLowerCase()]
    : [];

  const canManage = userRoles.some((role) =>
    allowedRoles.includes(role)
  );

  // ======================================================
  // FETCH CHILDREN
  // ======================================================

  const fetchChildren = async () => {
    try {
      setLoading(true);

      const { data } = await axios.get(API_URL, {
        withCredentials: true,
      });

      if (data.success) {
        setChildren(data.children || []);
      } else {
        toast.error(
          data.message || "Failed to load children."
        );
      }
    } catch (error) {
      console.error(
        "Fetch child profiles error:",
        error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to load child profiles."
      );
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // INITIAL LOAD
  // ======================================================

  useEffect(() => {
    fetchChildren();
  }, []);

  // ======================================================
  // HANDLE FORM CHANGE
  // ======================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ======================================================
  // OPEN CREATE FORM
  // ======================================================

  const openCreateForm = () => {
    setEditingChild(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  // ======================================================
  // OPEN EDIT FORM
  // ======================================================

  const openEditForm = (child) => {
    setEditingChild(child);

    setForm({
      name: child.name || "",
      grade: child.grade || "",
      firstParent: child.firstParent || "",
      secondParent: child.secondParent || "",
      firstParentNumber:
        child.firstParentNumber || "",
      secondParentNumber:
        child.secondParentNumber || "",
      allergies: child.allergies || [],
      address: child.address || "",
    });

    setFormOpen(true);
  };

  // ======================================================
  // CLOSE FORM
  // ======================================================

  const closeForm = () => {
    if (saving) return;

    setFormOpen(false);
    setEditingChild(null);
    setForm(emptyForm);
  };

  // ======================================================
  // CREATE / UPDATE CHILD
  // ======================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error("Child name is required.");
      return;
    }

    if (!form.grade) {
      toast.error("Grade is required.");
      return;
    }

    const grade = Number(form.grade);

    if (grade < 1 || grade > 12) {
      toast.error(
        "Grade must be between 1 and 12."
      );
      return;
    }

    const payload = {
      name: form.name.trim(),
      grade,

      firstParent: form.firstParent.trim(),

      secondParent:
        form.secondParent.trim(),

      firstParentNumber:
        form.firstParentNumber.trim(),

      secondParentNumber:
        form.secondParentNumber.trim(),

    allergies: Array.isArray(form.allergies)
        ? form.allergies.filter(Boolean)
        : [],

      address:
        form.address.trim(),
    };

    try {
      setSaving(true);

      let response;

      // EDIT
      if (editingChild) {
        response = await axios.put(
          `${API_URL}/${editingChild._id}`,
          payload,
          {
            withCredentials: true,
          }
        );
      }

      // CREATE
      else {
        response = await axios.post(
          API_URL,
          payload,
          {
            withCredentials: true,
          }
        );
      }

      const { data } = response;

      if (!data.success) {
        toast.error(
          data.message ||
            "Failed to save child profile."
        );

        return;
      }

      toast.success(data.message);

      closeForm();

      await fetchChildren();
    } catch (error) {
      console.error(
        "Save child profile error:",
        error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to save child profile."
      );
    } finally {
      setSaving(false);
    }
  };

  // ======================================================
  // DELETE CHILD
  // ======================================================

  const handleDelete = async (child) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${child.name}?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(child._id);

      const { data } = await axios.delete(
        `${API_URL}/${child._id}`,
        {
          withCredentials: true,
        }
      );

      if (data.success) {
        toast.success(data.message);

        setChildren((previous) =>
          previous.filter(
            (item) =>
              item._id !== child._id
          )
        );
      } else {
        toast.error(
          data.message ||
            "Failed to delete child."
        );
      }
    } catch (error) {
      console.error(
        "Delete child error:",
        error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to delete child."
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ======================================================
  // FILTER CHILDREN
  // ======================================================

  const filteredChildren = useMemo(() => {
    return children.filter((child) => {
      const matchesSearch =
        child.name
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          ) ||
        child.firstParent
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          ) ||
        child.secondParent
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          );

      const matchesGrade =
        gradeFilter === "all" ||
        String(child.grade) ===
          gradeFilter;

      return (
        matchesSearch &&
        matchesGrade
      );
    });
  }, [
    children,
    search,
    gradeFilter,
  ]);

  // ======================================================
  // GRADE COUNTS
  // ======================================================

  const grades = useMemo(() => {
    return [
      ...new Set(
        children.map(
          (child) => child.grade
        )
      ),
    ].sort((a, b) => a - b);
  }, [children]);

  // ======================================================
  // PAGE
  // ======================================================

  return (
    <div
      className="
        relative
        min-h-screen
        overflow-hidden
        bg-gradient-to-br
        from-indigo-50
        via-white
        to-purple-50
        text-gray-900
      "
    >
      {/* ================================================= */}
      {/* BACKGROUND */}
      {/* ================================================= */}

      <div className="pointer-events-none absolute inset-0 z-0">
        <Waves
          lineColor="#e4b54f7e"
          backgroundColor="rgba(255,255,255,0)"
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

      <main
        className="
          relative
          z-10
          mx-auto
          max-w-7xl
          px-4
          pb-24
          pt-36
          sm:px-6
          lg:px-8
        "
      >
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <section className="mb-8">
          <div
            className="
              rounded-3xl
              border
              border-gray-200
              bg-white
              p-6
              shadow-xl
              sm:p-8
            "
          >
            <div
              className="
                flex
                flex-col
                gap-6
                md:flex-row
                md:items-center
                md:justify-between
              "
            >
              <div>
                <p
                  className="
                    text-sm
                    font-semibold
                    uppercase
                    tracking-[0.25em]
                    text-blue-500
                  "
                >
                  Church Service
                </p>

                <h1
                  className="
                    mt-3
                    text-3xl
                    font-bold
                    sm:text-4xl
                  "
                >
                  Child Profiles
                </h1>

                <p
                  className="
                    mt-3
                    max-w-2xl
                    text-sm
                    text-gray-600
                    sm:text-base
                  "
                >
                  Manage children,
                  grades, parents,
                  contact information
                  and important details.
                </p>
              </div>

              {canManage && (
                <button
                  onClick={
                    openCreateForm
                  }
                  className="
                    flex
                    shrink-0
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
                  "
                >
                  <Plus size={20} />

                  Add Child
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* STATISTICS */}
        {/* ================================================= */}

        <section
          className="
            mb-8
            grid
            grid-cols-1
            gap-4
            sm:grid-cols-2
          "
        >
          <StatCard
            title="Total Children"
            value={children.length}
            icon={
              <Users size={23} />
            }
          />

          <StatCard
            title="Grades"
            value={grades.length}
            icon={
              <UserRound size={23} />
            }
          />
        </section>

        {/* ================================================= */}
        {/* FILTERS */}
        {/* ================================================= */}

        <section
          className="
            mb-8
            rounded-3xl
            border
            border-gray-200
            bg-white
            p-5
            shadow-xl
          "
        >
          <div
            className="
              flex
              flex-col
              gap-4
              sm:flex-row
            "
          >
            {/* SEARCH */}

            <div className="relative flex-1">
              <Search
                size={19}
                className="
                  absolute
                  left-4
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />

              <input
                type="text"
                placeholder="Search child or parent..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-300
                  py-3
                  pl-11
                  pr-4
                  outline-none
                  transition
                  focus:border-[#D4AF37]
                  focus:ring-2
                  focus:ring-[#D4AF37]/20
                "
              />
            </div>

            {/* GRADE FILTER */}

            <select
              value={gradeFilter}
              onChange={(event) =>
                setGradeFilter(
                  event.target.value
                )
              }
              className="
                rounded-xl
                border
                border-gray-300
                bg-white
                px-4
                py-3
                outline-none
                focus:border-[#D4AF37]
                sm:min-w-48
              "
            >
              <option value="all">
                All Grades
              </option>

              {grades.map(
                (grade) => (
                  <option
                    key={grade}
                    value={grade}
                  >
                    Grade {grade}
                  </option>
                )
              )}
            </select>
          </div>
        </section>

        {/* ================================================= */}
        {/* CHILDREN */}
        {/* ================================================= */}

        {loading ? (
          <div
            className="
              flex
              min-h-80
              items-center
              justify-center
              rounded-3xl
              border
              border-gray-200
              bg-white
              shadow-xl
            "
          >
            <div className="text-center">
              <Loader2
                size={38}
                className="
                  mx-auto
                  animate-spin
                  text-[#D4AF37]
                "
              />

              <p className="mt-3 text-gray-500">
                Loading children...
              </p>
            </div>
          </div>
        ) : filteredChildren.length ===
          0 ? (
          <div
            className="
              rounded-3xl
              border
              border-gray-200
              bg-white
              p-12
              text-center
              shadow-xl
            "
          >
            <Users
              size={45}
              className="
                mx-auto
                text-gray-300
              "
            />

            <h2
              className="
                mt-4
                text-xl
                font-bold
                text-gray-800
              "
            >
              No children found
            </h2>

            <p
              className="
                mt-2
                text-sm
                text-gray-500
              "
            >
              Try changing the
              search or grade
              filter.
            </p>
          </div>
        ) : (
          <section
            className="
              grid
              grid-cols-1
              gap-5
              md:grid-cols-2
              xl:grid-cols-3
            "
          >
            {filteredChildren.map(
              (child) => (
                <ChildCard
                  key={child._id}
                  child={child}
                  canManage={
                    canManage
                  }
                  onEdit={() =>
                    openEditForm(
                      child
                    )
                  }
                  onDelete={() =>
                    handleDelete(
                      child
                    )
                  }
                  deleting={
                    deletingId ===
                    child._id
                  }
                />
              )
            )}
          </section>
        )}
      </main>

      {/* ================================================= */}
      {/* CREATE / EDIT MODAL */}
      {/* ================================================= */}

      {formOpen && (
        <ChildFormModal
          form={form}
          editingChild={
            editingChild
          }
          handleChange={
            handleChange
          }
          handleSubmit={
            handleSubmit
          }
          closeForm={closeForm}
          saving={saving}
        />
      )}
    </div>
  );
};

// ======================================================
// CHILD CARD
// ======================================================

const ChildCard = ({
  child,
  canManage,
  onEdit,
  onDelete,
  deleting,
}) => {
  return (
    <div
      className="
        rounded-3xl
        border
        border-gray-200
        bg-white
        p-6
        shadow-lg
        transition
        hover:-translate-y-1
        hover:shadow-xl
      "
    >
      {/* HEADER */}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="
              flex
              h-12
              w-12
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-[#D4AF37]/15
              text-lg
              font-bold
              text-[#9a791c]
            "
          >
            {child.name
              ?.charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <h2
              className="
                text-lg
                font-bold
                text-gray-900
              "
            >
              {child.name}
            </h2>

            <span
              className="
                mt-1
                inline-flex
                rounded-full
                bg-blue-50
                px-3
                py-1
                text-xs
                font-semibold
                text-blue-700
              "
            >
              Grade {child.grade}
            </span>
          </div>
        </div>
      </div>

      {/* INFORMATION */}

      <div className="mt-6 space-y-4">
        <ProfileItem
          icon={<UserRound />}
          label="First Parent"
          value={
            child.firstParent ||
            "Not provided"
          }
        />

        <ProfileItem
          icon={<Phone />}
          label="Phone"
          value={
            child.firstParentNumber ||
            "Not provided"
          }
        />

        {child.secondParent && (
          <ProfileItem
            icon={<UserRound />}
            label="Second Parent"
            value={
              child.secondParent
            }
          />
        )}

        {child.secondParentNumber && (
          <ProfileItem
            icon={<Phone />}
            label="Second Phone"
            value={
              child.secondParentNumber
            }
          />
        )}

        <ProfileItem
          icon={<MapPin />}
          label="Address"
          value={
            child.address ||
            "Not provided"
          }
        />

        <ProfileItem
          icon={
            <AlertTriangle />
          }
          label="Allergies"
          value={
            child.allergies ||
            "None recorded"
          }
          warning={
            Boolean(
              child.allergies
            )
          }
        />
      </div>

      {/* ACTIONS */}

      {canManage && (
        <div
          className="
            mt-6
            flex
            gap-3
            border-t
            border-gray-100
            pt-5
          "
        >
          <button
            onClick={onEdit}
            className="
              flex
              flex-1
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-blue-50
              px-4
              py-2.5
              text-sm
              font-semibold
              text-blue-700
              transition
              hover:bg-blue-100
            "
          >
            <Pencil size={17} />

            Edit
          </button>

          <button
            onClick={onDelete}
            disabled={deleting}
            className="
              flex
              flex-1
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-red-50
              px-4
              py-2.5
              text-sm
              font-semibold
              text-red-600
              transition
              hover:bg-red-100
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {deleting ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <Trash2 size={17} />
            )}

            Delete
          </button>
        </div>
      )}
    </div>
  );
};

// ======================================================
// PROFILE ITEM
// ======================================================

const ProfileItem = ({
  icon,
  label,
  value,
  warning = false,
}) => {
  return (
    <div className="flex gap-3">
      <div
        className={`
          mt-0.5
          [&>svg]:h-4
          [&>svg]:w-4
          ${
            warning
              ? "text-orange-500"
              : "text-gray-400"
          }
        `}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p
          className="
            text-xs
            font-semibold
            uppercase
            tracking-wide
            text-gray-400
          "
        >
          {label}
        </p>

        <p
          className={`
            mt-1
            break-words
            text-sm
            ${
              warning
                ? "font-medium text-orange-700"
                : "text-gray-700"
            }
          `}
        >
          {value}
        </p>
      </div>
    </div>
  );
};

// ======================================================
// CREATE / EDIT MODAL
// ======================================================

const ChildFormModal = ({
  form,
  editingChild,
  handleChange,
  handleSubmit,
  closeForm,
  saving,
}) => {
  return (
    <div
      className="
        fixed
        inset-0
        z-[9999]
        flex
        items-center
        justify-center
        bg-black/50
        p-4
        backdrop-blur-sm
      "
    >
      <div
        className="
          max-h-[90vh]
          w-full
          max-w-3xl
          overflow-y-auto
          rounded-3xl
          bg-white
          shadow-2xl
        "
      >
        {/* HEADER */}

        <div
          className="
            sticky
            top-0
            z-10
            flex
            items-center
            justify-between
            border-b
            border-gray-100
            bg-white
            px-6
            py-5
          "
        >
          <div>
            <p
              className="
                text-xs
                font-semibold
                uppercase
                tracking-[0.2em]
                text-blue-500
              "
            >
              Child Profile
            </p>

            <h2
              className="
                mt-1
                text-2xl
                font-bold
              "
            >
              {editingChild
                ? "Edit Child"
                : "Add Child"}
            </h2>
          </div>

          <button
            type="button"
            onClick={closeForm}
            className="
              rounded-full
              p-2
              text-gray-500
              transition
              hover:bg-gray-100
            "
          >
            <X size={22} />
          </button>
        </div>

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          className="p-6"
        >
          <div
            className="
              grid
              grid-cols-1
              gap-5
              md:grid-cols-2
            "
          >
            {/* NAME */}

            <FormInput
              label="Child Name"
              name="name"
              value={form.name}
              onChange={
                handleChange
              }
              required
              placeholder="Full name"
            />

            {/* GRADE */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Grade
                <span className="text-red-500">
                  {" "}
                  *
                </span>
              </label>

              <select
                name="grade"
                value={form.grade}
                onChange={
                  handleChange
                }
                required
                className={inputClass}
              >
                <option value="">
                  Select Grade
                </option>

                {Array.from(
                  {
                    length: 12,
                  },
                  (_, index) =>
                    index + 1
                ).map((grade) => (
                  <option
                    key={grade}
                    value={grade}
                  >
                    Grade {grade}
                  </option>
                ))}
              </select>
            </div>

            {/* PARENT 1 */}

            <FormInput
              label="First Parent"
              name="firstParent"
              value={
                form.firstParent
              }
              onChange={
                handleChange
              }
              placeholder="Parent name"
            />

            <FormInput
              label="First Parent Number"
              name="firstParentNumber"
              type="tel"
              value={
                form.firstParentNumber
              }
              onChange={
                handleChange
              }
              placeholder="Phone number"
            />

            {/* PARENT 2 */}

            <FormInput
              label="Second Parent"
              name="secondParent"
              value={
                form.secondParent
              }
              onChange={
                handleChange
              }
              placeholder="Parent name"
            />

            <FormInput
              label="Second Parent Number"
              name="secondParentNumber"
              type="tel"
              value={
                form.secondParentNumber
              }
              onChange={
                handleChange
              }
              placeholder="Phone number"
            />

            {/* ADDRESS */}

            <div className="md:col-span-2">
              <FormInput
                label="Address"
                name="address"
                value={
                  form.address
                }
                onChange={
                  handleChange
                }
                placeholder="Child address"
              />
            </div>

            {/* ALLERGIES */}

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Allergies / Medical Notes
              </label>

              <textarea
                name="allergies"
                value={
                  form.allergies
                }
                onChange={
                  handleChange
                }
                rows={4}
                placeholder="Enter allergies or important notes..."
                className={inputClass}
              />
            </div>
          </div>

          {/* BUTTONS */}

          <div
            className="
              mt-8
              flex
              flex-col-reverse
              gap-3
              border-t
              border-gray-100
              pt-6
              sm:flex-row
              sm:justify-end
            "
          >
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="
                rounded-xl
                border
                border-gray-300
                px-6
                py-3
                font-semibold
                text-gray-700
                transition
                hover:bg-gray-50
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="
                flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#D4AF37]
                px-6
                py-3
                font-semibold
                text-white
                shadow-md
                transition
                hover:bg-[#b9952e]
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {saving ? (
                <>
                  <Loader2
                    size={19}
                    className="animate-spin"
                  />

                  Saving...
                </>
              ) : (
                <>
                  <Save size={19} />

                  {editingChild
                    ? "Save Changes"
                    : "Create Child"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ======================================================
// FORM INPUT
// ======================================================

const FormInput = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}) => {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">
        {label}

        {required && (
          <span className="text-red-500">
            {" "}
            *
          </span>
        )}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={inputClass}
      />
    </div>
  );
};

// ======================================================
// INPUT STYLE
// ======================================================

const inputClass = `
  w-full
  rounded-xl
  border
  border-gray-300
  bg-white
  px-4
  py-3
  outline-none
  transition
  focus:border-[#D4AF37]
  focus:ring-2
  focus:ring-[#D4AF37]/20
`;

// ======================================================
// STAT CARD
// ======================================================

const StatCard = ({
  title,
  value,
  icon,
}) => {
  return (
    <div
      className="
        rounded-3xl
        border
        border-gray-200
        bg-white
        p-6
        shadow-xl
      "
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">
          {title}
        </p>

        <span className="text-[#D4AF37]">
          {icon}
        </span>
      </div>

      <h3 className="mt-3 text-3xl font-bold">
        {value}
      </h3>
    </div>
  );
};

export default ChildProfiles;