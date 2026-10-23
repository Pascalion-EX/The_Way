import { useState } from "react";
import { getAvatarPreset } from "../../../shared/avatarPresets.mjs";

export default function UserAvatar({ user, className = "h-10 w-10 text-sm", decorative = false }) {
  const preset = getAvatarPreset(user?.avatarId);
  const src = preset ? `${import.meta.env.BASE_URL}avatars/${preset.image}` : "";
  const [failedSrc, setFailedSrc] = useState(null);
  const name = user?.name?.trim() || "User";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-black bg-gray-900 font-semibold text-white ${className}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${name}'s profile picture`}
      aria-hidden={decorative || undefined}
    >
      {src && failedSrc !== src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : name[0].toUpperCase()}
    </span>
  );
}
