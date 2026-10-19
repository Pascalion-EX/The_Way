import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { formatMediaTime, loadYouTubePlayerApi } from "../utils/youtubePlayer.js";

const ChantYouTubePlayer = ({ embedUrl, title, projectorMode }) => {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const [playback, setPlayback] = useState({
    ready: false, playing: false, time: 0, duration: 0, volume: 100, muted: false,
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const host = hostRef.current;
    let disposed = false;
    let timer;
    let player;
    const iframe = document.createElement("iframe");
    const url = new URL(embedUrl);
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("origin", window.location.origin);
    url.searchParams.set("playsinline", "1");
    iframe.src = url.toString();
    iframe.title = title;
    iframe.className = "h-full w-full";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;
    host.append(iframe);

    const syncPlayback = (target) => {
      if (disposed) return;
      setPlayback({
        ready: true,
        playing: target.getPlayerState() === 1,
        time: target.getCurrentTime() || 0,
        duration: target.getDuration() || 0,
        volume: target.getVolume(),
        muted: target.isMuted(),
      });
    };

    loadYouTubePlayerApi().then((YT) => {
      if (disposed) return;
      player = new YT.Player(iframe, {
        events: {
          onReady: ({ target }) => {
            if (disposed) return;
            playerRef.current = target;
            syncPlayback(target);
            timer = window.setInterval(() => syncPlayback(target), 500);
          },
          onStateChange: ({ target, data }) => {
            syncPlayback(target);
            if (!disposed && data === 1) setNotice("");
          },
          onAutoplayBlocked: () => {
            if (!disposed) setNotice("Press Play to start the chant audio.");
          },
          onError: () => {
            if (!disposed) setError("This YouTube video cannot be played here. Try another video link.");
          },
        },
      });
    }).catch((failure) => {
      if (!disposed) setError(failure.message);
    });

    return () => {
      disposed = true;
      window.clearInterval(timer);
      playerRef.current = null;
      player?.destroy();
      host.replaceChildren();
    };
  }, [embedUrl, title]);

  const disabled = !playback.ready || Boolean(error);
  const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20 disabled:opacity-40";

  return (
    <section aria-label="Chant YouTube player">
      {/* Keep this player mounted so changing presentation mode preserves playback. */}
      <div
        ref={hostRef}
        aria-hidden={projectorMode || undefined}
        inert={projectorMode || undefined}
        className={projectorMode
          ? "fixed -left-[10000px] top-0 h-[270px] w-[480px] pointer-events-none"
          : "aspect-video min-h-[200px] w-full overflow-hidden rounded-2xl border border-gray-200"}
      />

      <div className={projectorMode ? "rounded-2xl border border-white/10 bg-white/5 p-4 text-white" : "hidden"}>
        <p className="mb-3 truncate text-sm text-white/70">YouTube audio · {title}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label={playback.playing ? "Pause chant audio" : "Play chant audio"}
            disabled={disabled}
            className={buttonClass}
            onClick={() => playback.playing ? playerRef.current.pauseVideo() : playerRef.current.playVideo()}
          >
            {playback.playing ? <Pause size={18} /> : <Play size={18} />}
            {playback.playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            aria-label="Restart chant audio"
            disabled={disabled || !playback.duration}
            className={buttonClass}
            onClick={() => {
              playerRef.current.seekTo(0, true);
              setPlayback((previous) => ({ ...previous, time: 0 }));
            }}
          >
            <RotateCcw size={18} />
          </button>
          <span className="text-xs tabular-nums text-white/70">
            {formatMediaTime(playback.time)} / {formatMediaTime(playback.duration)}
          </span>
          <input
            type="range"
            aria-label="Seek chant audio"
            min="0"
            max={playback.duration || 1}
            step="1"
            value={Math.min(playback.time, playback.duration || 1)}
            disabled={disabled || !playback.duration}
            className="min-w-24 flex-1 accent-white disabled:opacity-40"
            onChange={(event) => {
              const time = Number(event.target.value);
              playerRef.current.seekTo(time, true);
              setPlayback((previous) => ({ ...previous, time }));
            }}
          />
          <button
            type="button"
            aria-label={playback.muted ? "Unmute chant audio" : "Mute chant audio"}
            disabled={disabled}
            className={buttonClass}
            onClick={() => {
              if (playback.muted) playerRef.current.unMute();
              else playerRef.current.mute();
              setPlayback((previous) => ({ ...previous, muted: !previous.muted }));
            }}
          >
            {playback.muted || playback.volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            aria-label="Chant audio volume"
            min="0"
            max="100"
            value={playback.muted ? 0 : playback.volume}
            disabled={disabled}
            className="w-24 accent-white disabled:opacity-40"
            onChange={(event) => {
              const volume = Number(event.target.value);
              playerRef.current.setVolume(volume);
              playerRef.current.unMute();
              setPlayback((previous) => ({ ...previous, volume, muted: false }));
            }}
          />
        </div>
        {!playback.ready && !error && <p role="status" className="mt-2 text-xs text-white/60">Loading YouTube audio…</p>}
        {notice && !error && <p role="status" className="mt-2 text-xs text-white/70">{notice}</p>}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
};

export default ChantYouTubePlayer;
