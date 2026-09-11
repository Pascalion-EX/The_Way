import React, { useState } from "react";
import { toast } from "react-toastify";
import axios from "../utils/axios";

const VideoRequestForm = ({ backendUrl, onRequestCreated }) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    videoLink: "",
    referenceLink: "",
    deadline: "",
    priority: "Normal",
  });

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      videoLink: "",
      referenceLink: "",
      deadline: "",
      priority: "Normal",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.title.trim() ||
      !formData.description.trim() ||
      !formData.videoLink.trim()
    ) {
      toast.error(
        "Title, description and video link are required."
      );
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        videoLink: formData.videoLink.trim(),
        referenceLink: formData.referenceLink.trim(),
        deadline: formData.deadline || null,
        priority: formData.priority,
      };

      const { data } = await axios.post(
        `${backendUrl}/api/video-requests`,
        payload,
        {
          withCredentials: true,
        }
      );

      if (!data.success) {
        toast.error(
          data.message || "Failed to submit request."
        );
        return;
      }

      if (data.emailSent === false) {
        toast.warning(
          "Request was saved, but the email notification could not be sent."
        );
      } else {
        toast.success(
          "Video editing request submitted successfully."
        );
      }

      resetForm();

      if (onRequestCreated) {
        onRequestCreated(data.request);
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to submit video request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">
          New Editing Request
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Submit the video information and editing requirements.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {/* Title */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Request title
          </label>

          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Example: Camp highlights video"
            maxLength={150}
            className="
              w-full rounded-xl border border-gray-300
              bg-white px-4 py-3
              text-gray-900 outline-none
              transition
              placeholder:text-gray-400
              focus:border-amber-500
              focus:ring-2 focus:ring-amber-200
            "
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Editing description
          </label>

          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={6}
            placeholder="Describe what you want in the final video..."
            className="
              w-full resize-y rounded-xl
              border border-gray-300
              bg-white px-4 py-3
              text-gray-900 outline-none
              transition
              placeholder:text-gray-400
              focus:border-amber-500
              focus:ring-2 focus:ring-amber-200
            "
          />
        </div>

        {/* Video link */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Video files link
          </label>

          <input
            type="url"
            name="videoLink"
            value={formData.videoLink}
            onChange={handleChange}
            placeholder="https://drive.google.com/..."
            className="
              w-full rounded-xl border border-gray-300
              bg-white px-4 py-3
              text-gray-900 outline-none
              transition
              placeholder:text-gray-400
              focus:border-amber-500
              focus:ring-2 focus:ring-amber-200
            "
          />

          <p className="mt-1 text-xs text-gray-500">
            You can use Google Drive, OneDrive, Dropbox,
            YouTube, or another accessible link.
          </p>
        </div>

        {/* Reference */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Reference video
            <span className="ml-1 font-normal text-gray-400">
              optional
            </span>
          </label>

          <input
            type="url"
            name="referenceLink"
            value={formData.referenceLink}
            onChange={handleChange}
            placeholder="https://youtube.com/..."
            className="
              w-full rounded-xl border border-gray-300
              bg-white px-4 py-3
              text-gray-900 outline-none
              transition
              placeholder:text-gray-400
              focus:border-amber-500
              focus:ring-2 focus:ring-amber-200
            "
          />
        </div>

        {/* Deadline / priority */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Deadline
              <span className="ml-1 font-normal text-gray-400">
                optional
              </span>
            </label>

            <input
              type="date"
              name="deadline"
              value={formData.deadline}
              onChange={handleChange}
              className="
                w-full rounded-xl border border-gray-300
                bg-white px-4 py-3
                text-gray-900 outline-none
                transition
                focus:border-amber-500
                focus:ring-2 focus:ring-amber-200
              "
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Priority
            </label>

            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className="
                w-full rounded-xl border border-gray-300
                bg-white px-4 py-3
                text-gray-900 outline-none
                transition
                focus:border-amber-500
                focus:ring-2 focus:ring-amber-200
              "
            >
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="
              rounded-xl bg-amber-500
              px-6 py-3
              font-semibold text-white
              transition
              hover:bg-amber-600
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {submitting
              ? "Submitting..."
              : "Submit Request"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VideoRequestForm;