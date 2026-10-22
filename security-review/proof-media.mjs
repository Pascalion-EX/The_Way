// Regression check for the repaired F13 finding. No browser or external content is loaded.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const tests = [
  "../backend/tests/videoSecurity.test.js",
  "../backend/tests/lessonVariants.test.js",
  "../frontend/tests/videoSecurity.test.js",
  "../frontend/tests/youtubePlayer.test.js",
].map((path) => fileURLToPath(new URL(path, import.meta.url)));
const result = spawnSync(process.execPath, ["--test", ...tests], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
