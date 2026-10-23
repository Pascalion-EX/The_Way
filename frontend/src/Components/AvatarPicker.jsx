import { useContext, useRef, useState } from "react";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import { Check } from "lucide-react";
import { AppContent } from "../Context/AppContext.jsx";
import { AVATAR_PRESETS, getAvatarPreset } from "../../../shared/avatarPresets.mjs";
import UserAvatar from "./UserAvatar.jsx";

export default function AvatarPicker({ disabled = false }) {
  const { userData, backendUrl, setUserData } = useContext(AppContent);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef(null);
  const savedId = getAvatarPreset(userData?.avatarId)?.id || "";
  const previewUser = open ? { ...userData, avatarId: selected } : userData;

  const close = () => {
    setOpen(false);
    setError("");
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving || selected === savedId) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await axios.put(`${backendUrl}/api/user/update-profile`, { avatarId: selected });
      if (!data.success) throw new Error(data.message || "Unable to save your picture");
      setUserData((previous) => previous ? { ...previous, avatarId: data.user.avatarId } : previous);
      toast.success("Profile picture updated");
      close();
    } catch (saveError) {
      setError(saveError.response?.data?.message || saveError.message || "Unable to save your picture. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? "Close picture picker" : "Change profile picture"}
        title="Change profile picture"
        aria-expanded={open}
        aria-controls="profile-picture-picker"
        disabled={disabled || saving || !userData?.isAccountVerified}
        onClick={() => {
          if (open) close();
          else {
            setSelected(savedId);
            setError("");
            setOpen(true);
          }
        }}
        className="mx-auto block cursor-pointer rounded-full transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserAvatar user={previewUser} decorative className="h-28 w-28 text-4xl ring-4 ring-white shadow-sm" />
      </button>

      {open && (
        <form id="profile-picture-picker" onSubmit={save} className="mt-5 border-t border-gray-100 pt-5 text-left">
          <fieldset disabled={saving || disabled} aria-describedby="profile-picture-hint">
            <legend className="font-semibold text-gray-900">Choose your picture</legend>
            <p id="profile-picture-hint" className="mt-1 text-xs leading-5 text-gray-500">
              Choose a New Testament character. Your saved picture appears across The Way.
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {AVATAR_PRESETS.map(({ id, label }) => (
                <label key={id} className="relative cursor-pointer text-center">
                  <input
                    type="radio"
                    name="avatar"
                    value={id}
                    checked={selected === id}
                    onChange={() => setSelected(id)}
                    className="peer sr-only"
                  />
                  <span className="flex flex-col items-center gap-1 rounded-xl border-2 border-transparent p-1 transition hover:bg-gray-50 peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600">
                    <UserAvatar user={{ name: label, avatarId: id }} decorative className="aspect-square w-full max-w-16" />
                    <span className="text-[11px] font-medium text-gray-600">{label}</span>
                  </span>
                  {selected === id && <Check aria-hidden="true" size={16} className="absolute right-0 top-0 rounded-full bg-blue-600 p-0.5 text-white" />}
                </label>
              ))}
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input type="radio" name="avatar" value="" checked={selected === ""} onChange={() => setSelected("")} className="accent-blue-600" />
              Use my initial instead
            </label>
          </fieldset>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving || disabled || selected === savedId} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Saving…" : "Save picture"}
            </button>
            <button type="button" onClick={close} disabled={saving} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
