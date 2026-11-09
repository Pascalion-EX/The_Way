import ImageUpload from "../Components/ImageUpload.jsx";
import React, { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContent.js";
import axios from "../utils/axios";
import { toast } from "react-toastify";

import Navbar from "@/Components/Navbar.jsx";

  const DesktopVisual = () => (
    <div className="relative hidden overflow-hidden lg:block">

      <div className="relative z-10 flex h-full items-center justify-center px-12">
        <div className="max-w-md">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-gray-700 drop-shadow-md">
            Saint George Church Trips
          </p>

          <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
            Create and manage trips for the service.
          </h1>
        </div>
      </div>
    </div>
  );

const CreateCamp = () => {
  const navigate = useNavigate();
  const { backendUrl, userData } = useContext(AppContent);

  const [imageUploading, setImageUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [price, setPrice] = useState("");
  const [paymentQrImage, setPaymentQrImage] = useState("");
  const [qrUploading, setQrUploading] = useState(false);
  const [tripType, setTripType] = useState("");
  const [selectedYears, setSelectedYears] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const yearOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const tripTypeOptions = ["Camp", "Trip", "Outing", "Other"];

  const canCreate = useMemo(() => {
    const allowedRoles = ["pascal", "admin", "servant", "pamela"];

    const rawRoles = userData?.role;

    const normalizedRoles = Array.isArray(rawRoles)
      ? rawRoles.map((role) => String(role).toLowerCase().trim())
      : rawRoles
      ? [String(rawRoles).toLowerCase().trim()]
      : [];

    return normalizedRoles.some((role) => allowedRoles.includes(role));
  }, [userData]);

  const toggleYear = (year) => {
    setSelectedYears((prevYears) => {
      if (prevYears.includes(year)) {
        return prevYears.filter((item) => item !== year);
      }

      return [...prevYears, year].sort((a, b) => a - b);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (imageUploading || qrUploading) {
      toast.error("Please wait for the image to finish uploading.");
      return;
    }

    if (price === "" || !Number.isFinite(Number(price)) || Number(price) < 0) {
      toast.error("Enter a valid price in EGP. Use 0 for a free trip.");
      return;
    }
    if (Number(price) > 0 && !paymentQrImage) {
      toast.error("Upload a payment QR image for this paid trip.");
      return;
    }

    if (!canCreate) {
      toast.error("You are not allowed to create Trips");
      return;
    }

    if (
      !title ||
      !name ||
      !body ||
      !image ||
      !tripType ||
      selectedYears.length === 0
    ) {
      toast.error("All fields are required");
      return;
    }

    try {
      setIsSubmitting(true);

      const { data } = await axios.post(`${backendUrl}/api/camps`, {
        title,
        name,
        body,
        image,
        price: Number(price),
        paymentQrImage,
        TripType: tripType,
        years: selectedYears,
      });

      if (data.success) {
        toast.success(data.message || "Camp created successfully");
        navigate("/camps");
      } else {
        toast.error(data.message || "Failed to create camp");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="relative min-h-screen overflow-hidden text-gray-900 bg-transparent">
          <Navbar/>

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-transparent">
          <DesktopVisual />

          <main className="min-w-0 flex items-start justify-center px-4 pb-10 pt-40 sm:px-8 lg:min-h-screen lg:items-center lg:px-16 lg:py-24">
            <div className="w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
              <h1 className="break-words text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Create Trip
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                Only users with pascal, admin, servant, or pamela roles can create
                Trips.
              </p>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => navigate("/camps")}
                  className="h-12 w-full rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                >
                  Back to Trips
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-gray-900 bg-transparent">
        <Navbar/>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-transparent">
        <DesktopVisual />

        <main className="min-w-0 px-4 pb-12 pt-40 sm:px-8 lg:px-12 lg:pb-28 lg:pt-36 xl:px-16">
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-6 sm:mb-8">
              <h1 className="break-words text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Create Trip
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                &quot;For he will command his angels concerning you to guard you
                in all your ways.&quot; — Psalm 91:11
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Trip title"
                  className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />

                <input
                  type="text"
                  placeholder="Trip name / team name"
                  className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                <div className="md:col-span-2">
                  <ImageUpload
                    value={image}
                    onChange={setImage}
                    onUploadingChange={setImageUploading}
                    disabled={isSubmitting || imageUploading}
                    required
                  />
                </div>

                <select
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 md:col-span-2"
                  value={tripType}
                  onChange={(e) => setTripType(e.target.value)}
                  required
                >
                  <option value="">Select trip type</option>
                  {tripTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <section className="mt-5 space-y-4 rounded-2xl border border-gray-300 p-4 sm:p-5" aria-label="Payment settings">
                <div>
                  <label htmlFor="camp-price" className="block text-sm font-medium text-gray-700">Price per applicant (EGP)</label>
                  <input id="camp-price" type="number" min="0" max="1000000000" step="0.01" required value={price}
                    onChange={(e) => setPrice(e.target.value)} placeholder="0.00"
                    className="mt-2 h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  <p className="mt-2 text-xs text-gray-500">Use 0 for a free trip. Parents applying to paid trips must attach a payment screenshot.</p>
                </div>
                <ImageUpload label="Payment QR code" value={paymentQrImage} onChange={setPaymentQrImage}
                  onUploadingChange={setQrUploading} required={Number(price) > 0} disabled={isSubmitting || qrUploading} />
              </section>

              <div className="mt-5 rounded-2xl border border-gray-300 p-4 sm:p-5">
                <p className="text-sm font-medium text-gray-700">
                  Available years
                </p>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Select one or more years for this activity.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {yearOptions.map((year) => {
                    const isSelected = selectedYears.includes(year);

                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => toggleYear(year)}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Year {year}
                      </button>
                    );
                  })}
                </div>
              </div>

              <textarea
                placeholder="Trip description"
                rows="12"
                className="mt-5 min-h-[260px] w-full resize-y rounded-2xl border border-gray-300 px-4 py-4 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:min-h-[420px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="submit"
                  disabled={isSubmitting || imageUploading || qrUploading}
                  className="h-12 w-full rounded-xl bg-indigo-600 px-8 text-sm font-medium text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {isSubmitting ? "Creating..." : "Create Trip"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/camps")}
                  className="h-12 w-full rounded-xl border border-gray-300 px-8 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                >
                  Back to Trips
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CreateCamp;
