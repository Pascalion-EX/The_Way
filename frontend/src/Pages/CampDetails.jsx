import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import { assets } from "../assets/assets.js";
import Waves from "../Components/Waves.jsx";
import Navbar from "@/Components/Navbar.jsx";

  const DesktopVisual = () => (
    <div className="relative hidden overflow-hidden lg:block">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-indigo-50" />

      <div className="absolute inset-0">
        <Waves
          lineColor="#e4b54f"
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

      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white" />

      <div className="relative z-10 flex h-full items-center justify-center px-12">
        <div className="max-w-md">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-gray-700 drop-shadow-md">
            Saint George Church Trips
          </p>

          <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
            A Trip of labour with Christ.
          </h1>

          <p className="mt-5 text-sm leading-6 text-gray-600">
            View the full trip details, available years, and registration
            information.
          </p>
        </div>
      </div>
    </div>
  );

const CampDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { backendUrl } = useContext(AppContent);

  const [camp, setCamp] = useState(location.state?.camp || null);
  const [loading, setLoading] = useState(!location.state?.camp);

  useEffect(() => {
    const fetchCamp = async () => {
      try {
        setLoading(true);

        const { data } = await axios.get(`${backendUrl}/api/camps/${id}`);

        if (data.success) {
          setCamp(data.camp);
        } else {
          toast.error(data.message || "Failed to load trip");
        }
      } catch (error) {
        toast.error(error.response?.data?.message || error.message);
      } finally {
        setLoading(false);
      }
    };

    if (!camp && id) {
      fetchCamp();
    }
  }, [backendUrl, id, camp]);

  const renderYears = () => {
    if (!Array.isArray(camp?.years) || camp.years.length === 0) {
      return <span className="text-sm text-gray-500">No years assigned</span>;
    }

    return camp.years
      .slice()
      .sort((a, b) => a - b)
      .map((year) => (
        <span
          key={year}
          className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"
        >
          Year {year}
        </span>
      ));
  };



  const renderContent = () => {
    if (loading) {
      return (
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <p className="text-sm text-gray-500">Loading trip...</p>
        </div>
      );
    }

    if (!camp) {
      return (
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <h1 className="break-words text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
            Trip not found
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            This trip may have been deleted or the link is invalid.
          </p>

          <button
            type="button"
            onClick={() => navigate("/camps")}
            className="mt-6 h-12 w-full rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
          >
            Back to trips
          </button>
        </div>
      );
    }

    return (
      <>
        {camp.image && (
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <img
              src={camp.image}
              alt={camp.title}
              className="h-44 w-full object-cover sm:h-72 lg:h-96"
            />
          </div>
        )}

        <article className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:mt-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                {camp.title}
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                {camp.name || "Trip Team"}
              </p>
            </div>

            {camp.TripType && (
              <span className="w-fit rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                {camp.TripType}
              </span>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 sm:mt-8 sm:gap-5">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                Available years
              </p>

              <div className="mt-4 flex flex-wrap gap-2">{renderYears()}</div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                Applications
              </p>

              <p className="mt-4 text-2xl font-semibold text-gray-900">
                {Array.isArray(camp.applicants) ? camp.applicants.length : 0}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Registered applicants
              </p>
            </div>
          </div>

          <div className="mt-6 sm:mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              Description
            </p>

            <p className="mt-4 whitespace-pre-line break-words text-sm leading-7 text-gray-700 sm:text-base sm:leading-8">
              {camp.body}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate("/camps")}
              className="h-12 w-full rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
            >
              Back to trips
            </button>
          </div>
        </article>
      </>
    );
  };

  return (

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
        <DesktopVisual />
        <Navbar/>

        <main className="px-4 pb-10 pt-40 sm:px-8 sm:pt-38 lg:px-16 lg:pt-28 lg:pb-28">
          <div className="mx-auto w-full max-w-5xl">
            <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Trip Details
                </h1>

                <p className="mt-2 text-sm leading-6 text-gray-500 sm:mt-3">
                  Full information about this trip.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/camps")}
                className="h-12 w-full rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
              >
                Back to trips
              </button>
            </div>

            {renderContent()}
          </div>
        </main>
      </div>
  );
};

export default CampDetails;