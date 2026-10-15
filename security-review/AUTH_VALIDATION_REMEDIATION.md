# Password and mailbox validation — F10

Implemented on 15 October 2026 following [the original review](../SECURITY_REVIEW.md).

`shared/authValidation.mjs` defines the password and mailbox rules used by both
the backend and frontend. Registration and password reset reject invalid new
passwords with HTTP 400 and `INVALID_PASSWORD` before hashing, account lookup,
OTP attempt reservation, account writes, or email-job creation.

- New passwords require at least **15 Unicode code points** and at most **72
  UTF-8 bytes**, matching the existing bcrypt input boundary. Oversized secrets
  are rejected rather than silently truncated, including during login and email
  change reauthentication. Unicode and spaces are supported; the supplied secret
  is hashed and compared exactly, without trimming or normalization. Null bytes
  and malformed Unicode are rejected.
- A bundled baseline blocklist rejects common passwords and public example
  passphrases. Screening also rejects repeated short patterns, whitespace-only
  input, and obvious numeric/alphabetic/keyboard sequences. This is local common
  password screening, **not** a comprehensive compromised-password corpus or a
  remote breach check. No plaintext or hashed candidate passwords leave the app.
- Existing short passwords remain usable for login and reauthentication, so
  this change does not lock out those accounts. New registrations and resets
  must meet the new policy. Existing passwords exceeding 72 UTF-8 bytes must be
  reset because login no longer accepts silently truncated credentials.
- Every account-email input uses the same bounded single-mailbox validator:
  registration, login, recovery requests, password reset, profile updates,
  rate-limit keys, OTP issuance, and queued mail. Recipient lists, display names,
  groups, quoted local parts, controls/header injection, malformed domains, and
  oversized addresses are rejected. The supported format is a plain ASCII
  mailbox, with local parts up to 64 characters, domain labels up to 63, and
  complete addresses up to 254. Surrounding spaces are removed and the address
  is lowercased; dots and plus tags are retained.
- Registration and profile changes persist the normalized mailbox. Login,
  recovery, duplicate-registration checks, and reset share indexed normalized
  lookups, with an exact supplied-string fallback for legacy mixed-case/spaced
  accounts. Legacy account records are not migrated automatically; the fallback
  requires their exact stored spelling if no normalized account exists. It does
  not reconcile pre-existing case/space identity collisions.
- Reset admission is tied to the resolved account ID and stored email. Profile
  updates retain current-password reauthentication, verification reset, queued
  mail invalidation, and the existing concurrency guard.
- The user schema rejects invalid mailbox writes. Email-job creation and OTP
  issuance independently validate destinations. The worker validates again and
  normalizes valid legacy destinations before SMTP; unsafe legacy jobs are
  discarded. Nodemailer receives exactly one normalized mailbox.

The forms use the same shared module for early feedback and show new-password
guidance. All API rules remain enforced if client validation is bypassed. Keep
the `shared` directory alongside `backend` and `frontend` when packaging or
deploying; Vite's development server allows that directory explicitly.

## Validation

`backend/tests/authValidation.test.js` adds regression cases for invalid mailbox
types/syntax across all five account entry points, one-character/common passwords,
Unicode character counting, exact 72-byte boundaries, rejection before hashing
and OTP reservation, unchanged plaintext hashing, legacy short-password login,
normalized recovery and legacy fallback, profile reauthentication, model
validation, unsafe queue rejection, and a single-recipient SMTP envelope using
offline Nodemailer stream transport.

All **13 test files passed** with `npm test`, including the **13 new validation
regression cases**. ESLint passed for the three changed forms. The frontend
production build passed with
`npm run build --prefix frontend -- --outDir /tmp/the-way-auth-validation-final-build`.
Database and SMTP I/O are stubbed; no production records are changed and no real
email is delivered. Existing CSS optimization and bundle-size warnings remain.

Policy references: [OWASP password strength controls](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#implement-proper-password-strength-controls),
[OWASP bcrypt input limitations](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#input-limits-of-bcrypt).
