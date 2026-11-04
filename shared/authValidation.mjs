export const PASSWORD_MIN_CHARACTERS = 12;
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_HINT = `Use at least ${PASSWORD_MIN_CHARACTERS} characters and a unique passphrase. Spaces and Unicode are welcome.`;

// A local baseline blocklist; no passwords are sent to an external service.
const commonPasswords = new Set([
  "passwordpassword", "password12345678", "password123456789", "password1234567890",
  "password123456789!", "password1234567890!", "passwordpassword1!", "passwordpassword!", "letmeinletmeinletmein",
  "iloveyouiloveyou", "welcome123456789", "changeme123456789", "admin1234567890",
  "thisismypassword", "thisismypassword123", "mysecretpassword", "supersecretpassword",
  "verystrongpassword", "correcthorsebatterystaple", "thewaypassword123", "saintgeorge12345",
]);
const sequences = ["0123456789", "9876543210", "abcdefghijklmnopqrstuvwxyz", "zyxwvutsrqponmlkjihgfedcba", "qwertyuiopasdfghjklzxcvbnm"];
const encoder = new TextEncoder();

// Accept one plain ASCII mailbox; reject lists, display names, and controls
// before trimming. Never reinterpret a list as a single account identity.
export const normalizeAuthEmail = (value) => {
  if (typeof value !== "string" || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) return null;
  const [local, domain] = email.split("@");
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..") ||
      domain.split(".").some((label) => label.length > 63)) return null;
  return email;
};

// Verification deliberately accepts existing short passwords. The byte limit
// prevents bcrypt from silently treating different long inputs as identical.
export const passwordInputError = (password) => {
  if (typeof password !== "string" || !password) return "Password is required";
  if (/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(password)) {
    return "Password contains an invalid character";
  }
  if (password.length > PASSWORD_MAX_BYTES || encoder.encode(password).length > PASSWORD_MAX_BYTES) {
    return "Password must be at most 72 UTF-8 bytes; use fewer characters if it contains emoji or other Unicode characters";
  }
  return null;
};

export const newPasswordError = (password) => {
  const inputError = passwordInputError(password);
  if (inputError) return inputError;
  if ([...password].length < PASSWORD_MIN_CHARACTERS) return `Password must contain at least ${PASSWORD_MIN_CHARACTERS} characters`;
  // Fold only for screening. Never trim, normalize, or otherwise change the
  // actual secret supplied to the password hasher or verifier.
  const screened = password.normalize("NFKC").trim().toLowerCase();
  if (!screened || commonPasswords.has(screened) || /^(.{1,4})\1+$/u.test(screened) ||
      sequences.some((sequence) => sequence.repeat(8).includes(screened))) {
    return "This password is too common or predictable. Choose a unique passphrase";
  }
  return null;
};
