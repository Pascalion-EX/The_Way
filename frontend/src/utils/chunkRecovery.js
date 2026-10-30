const RELOAD_KEY = "the-way:chunk-reload";

// A new deployment can retire a chunk needed by an already-open tab. Refresh
// once for this entry bundle; persistent failures reach the error boundary.
export function installChunkRecovery(target, version) {
  let reloading = false;
  const recover = (event) => {
    if (reloading) {
      event.preventDefault();
      return;
    }
    if (target.navigator?.onLine === false) return;
    try {
      const storage = target.sessionStorage;
      if (storage.getItem(RELOAD_KEY) === version) return;
      storage.setItem(RELOAD_KEY, version);
    } catch {
      // Without persistent tab storage, automatic reload could create a loop.
      return;
    }
    try {
      reloading = true;
      target.location.reload();
      event.preventDefault();
    } catch {
      reloading = false;
    }
  };
  target.addEventListener("vite:preloadError", recover);
  return () => target.removeEventListener("vite:preloadError", recover);
}
