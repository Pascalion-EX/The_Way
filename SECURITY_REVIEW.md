# The Way — security review

**Remediation update (14 October 2026):** Findings F01–F05 have been addressed in
the working tree. See [the remediation record](security-review/REMEDIATION.md) for
changes, validation, and remaining findings. The assessment below preserves the
original review of commit `440da9d17828c635fad8950cd75fdf45321a5af4`.

**Review date:** 14 October 2026, Africa/Cairo.  
**Reviewed commit:** `440da9d17828c635fad8950cd75fdf45321a5af4`.  
**Overall assessment:** High risk. Fix the child/attendance/notification permission gaps and password-recovery controls before exposing this version publicly with real personal data.

This report records 17 prioritized assessment entries: five high, eight medium, and four low. The dependency entry consolidates version advisories and has conditional exposure; these are not 17 independently demonstrated remote exploits. The principal application failures were reproduced offline with synthetic records. No application code or dependencies were changed; only this report and supporting audit artifacts were added.

## Scope and method

Reviewed the Express server, every application route/controller/model group, authentication and permission middleware, cookie settings, OTP generation and background email delivery, React pages/components/authentication state, media rendering, package manifests and lockfiles, and repository/deployment documentation. The checkout contained 143 tracked first-party files/assets and 7,217 tracked dependency files. Third-party code was assessed through dependency advisories and targeted source inspection rather than a line-by-line review of every vendor file.

Checks performed:

- Manual authorization and input-flow review across all API modules.
- Offline controller/middleware proofs with synthetic users and stubbed database/email operations; actual JWT verification, selected Express routing, Mongoose casting, and bulk-write casting were retained.
- npm advisory queries for the root, backend, and frontend lockfiles, using the public npm registry.
- First-party secret-pattern scanning, sensitive-filename inspection across all 35 locally reachable commits, scanning 322 unique historical first-party text blobs, and comparing configured backend secrets against tracked current/historical first-party content. Values were kept out of tool output and artifacts.
- The four existing test files and a frontend production build, with build output written outside the project.

This was a repository review and offline validation, not a live infrastructure penetration test. Production TLS, DNS, proxy headers, firewall rules, database exposure/permissions, backups, cloud permissions, deployed environment variables, and external access logs were not available for validation. Local Git history does not include inaccessible remote refs, deleted remote branches, or other copies of the repository. Runtime exploit throughput was not measured.

## Prioritized findings

| ID | Severity | Finding | Required access / evidence |
|---|---|---|---|
| F01 | High | All child profiles readable and writable by any verified account | Default verified `unAssigned` account; middleware/controller proof |
| F02 | High | Attendance readable, replaceable, and deletable by any verified account | Default verified account; deletion proof and route/controller inspection |
| F03 | High | Any verified account can broadcast and globally erase notifications | Creation and role-clearing proofs |
| F04 | High | Password-reset and verification codes permit unlimited guesses for 12 hours | Reset is unauthenticated; repeated-failure proof |
| F05 | High priority; conditional exposure | Vulnerable locked dependencies, including a reachable Mongoose casting flaw | Registry matches; reachability triage below |
| F06 | Medium | Mark-as-seen leaks notifications intended for other roles | Known notification ID; synthetic admin-message disclosure |
| F07 | Medium | Email change retains verified status without password or new-address verification | Existing verified session; proof |
| F08 | Medium | Existing JWTs survive logout and password reset for up to 48 hours | Previously copied session token; proof |
| F09 | Medium | Login/registration/recovery lack broad abuse limits | Public endpoints; repeated-login proof and code review |
| F10 | Medium | Weak password and mailbox validation permit one-character passwords and recipient lists | Public registration/reset; proof |
| F11 | Medium | Camp reads disclose all applicants' membership, emails, and roles | Any verified account; proof |
| F12 | Medium | Event updates permit protected fields, raw update operators, and vulnerable casting | Authorized event staff; casting proofs |
| F13 | Medium | Stored video URLs can embed arbitrary active third-party content | Content author/compromised staff; helper/rendering proof |
| F14 | Low | Weekly attendance bulk writes bypass status enum validation | Access to attendance endpoint; actual casting proof |
| F15 | Low | Production logout permits cross-origin form requests | Browser session; offline Express routing proof |
| F16 | Low | Recovery reveals whether an account exists | Public endpoint; proof |
| F17 | Low | Numerous API error responses return internal exception messages | Malformed inputs; source inspection |

### F01 — Unrestricted child-profile access

**Evidence:** [childProfileRoutes.js:13](/home/kfam/Service/The_Way/backend/routes/childProfileRoutes.js:13), [childProfileController.js:64](/home/kfam/Service/The_Way/backend/controllers/childProfileController.js:64), [childProfileController.js:175](/home/kfam/Service/The_Way/backend/controllers/childProfileController.js:175), [childProfileController.js:222](/home/kfam/Service/The_Way/backend/controllers/childProfileController.js:222).

Every child route checks only `userAuth`, which validates a signed-in, verified account. It does not require staff membership or a relationship to the requested child. Both `/api/children` and `/api/childProfile` mount the same router. Listing returns complete documents, including child names/grades, parent names and phone numbers, home addresses, and allergies. IDs from the list can be reused for update/delete requests.

**Proof:** A synthetic verified `unAssigned` account passed the actual JWT/verification middleware, received sensitive child fields, and successfully invoked child deletion. The frontend's [ChildProfile.jsx:69](/home/kfam/Service/The_Way/frontend/src/Pages/ChildProfile.jsx:69) restricts management to `admin`, `leader`, `pascal`, and `pamela`; that restriction is absent from the backend.

**Impact:** Unauthorized disclosure of children's/families' personal and health-related details, alteration of safety information, and deletion of records. Email verification alone does not establish authorization to manage children.

**Fix:** Immediately require authorized staff on backend reads and writes. If guardians/class leaders need access, store explicit guardian/class relationships and include them in database query conditions. Return only fields needed for the caller's role. Protect both router mount paths. Test `unAssigned`, unrelated parent, related parent, staff for another class, authorized staff, and admin.

### F02 — Unrestricted attendance access and modification

**Evidence:** [attendanceRoutes.js:17](/home/kfam/Service/The_Way/backend/routes/attendanceRoutes.js:17), [attendanceControllers.js:98](/home/kfam/Service/The_Way/backend/controllers/attendanceControllers.js:98), [attendanceControllers.js:208](/home/kfam/Service/The_Way/backend/controllers/attendanceControllers.js:208), [attendanceControllers.js:270](/home/kfam/Service/The_Way/backend/controllers/attendanceControllers.js:270), [attendanceControllers.js:385](/home/kfam/Service/The_Way/backend/controllers/attendanceControllers.js:385), [attendanceControllers.js:429](/home/kfam/Service/The_Way/backend/controllers/attendanceControllers.js:429).

All `/api/attendance` reads and mutations have only `userAuth`. Single and weekly writes upsert by child/date without checking the recorder's permitted children/classes. Date/year reads populate full child profiles, repeating the privacy exposure in F01. Direct mutations select only the supplied attendance ID.

**Proof:** A verified `unAssigned` account could delete a synthetic attendance record. The frontend explicitly limits attendance-taking to staff at [Attendance.jsx:109](/home/kfam/Service/The_Way/frontend/src/Pages/Attendance.jsx:109).

**Impact:** Any verified member can inspect children's attendance patterns, falsify records, overwrite existing attendance, or remove records.

**Fix:** Enforce backend staff permissions and child/class scope for each read/write. Populate a limited set of child fields. Record immutable change history; updating `recordedBy` alone loses the previous recorder attribution.

### F03 — Notification broadcast and global deletion lack sender permissions

**Evidence:** [notificationRoutes.js:30](/home/kfam/Service/The_Way/backend/routes/notificationRoutes.js:30), [notificationRoutes.js:36](/home/kfam/Service/The_Way/backend/routes/notificationRoutes.js:36), [notificationRoutes.js:42](/home/kfam/Service/The_Way/backend/routes/notificationRoutes.js:42), [notificationRoutes.js:60](/home/kfam/Service/The_Way/backend/routes/notificationRoutes.js:60), [notificationController.js:69](/home/kfam/Service/The_Way/backend/controllers/notificationController.js:69), [notificationController.js:568](/home/kfam/Service/The_Way/backend/controllers/notificationController.js:568).

`POST /api/notifications`, `POST /api/notifications/role/:role`, `PUT /api/notifications/clear/roles`, and `DELETE /api/notifications/:id` require verification but no publishing/administrative role. Controllers validate target role names, not the sender's privileges. Role clearing can delete or strip all notices targeting `admin` without knowing individual IDs. Individual deletion removes the shared document for everyone.

**Proof:** A verified `unAssigned` account created an admin-targeted notice and cleared admin-targeted notices using synthetic records.

**Impact:** Forged announcements, spam, and suppression of legitimate notices throughout the application.

**Fix:** Define explicit publishing and administrative permissions on the server, retain sender identity, and audit broadcasts/clears. If ordinary users may dismiss a notice, store per-user dismissal rather than deleting the shared notice. Accept safe internal destinations for notification links.

### F04 — Unlimited guessing of long-lived OTPs

**Evidence:** [authController.js:221](/home/kfam/Service/The_Way/backend/controllers/authController.js:221), [authController.js:286](/home/kfam/Service/The_Way/backend/controllers/authController.js:286), [otpRequests.js:14](/home/kfam/Service/The_Way/backend/services/otpRequests.js:14), [authRoutes.js:24](/home/kfam/Service/The_Way/backend/routes/authRoutes.js:24).

Codes are generated securely with `crypto.randomInt(100000, 1000000)`, giving 900,000 possibilities, but remain valid for 12 hours. Wrong submissions do not increment an attempt counter, invalidate the code, or impose a delay. The atomic 60-second resend cooldown limits requesting a replacement code; it does not limit guessing an existing one. Password-reset submission is unauthenticated.

**Proof:** 100 wrong verification submissions and 100 wrong reset submissions left their codes active and caused no lockout or HTTP 429. This demonstrates missing application controls, not production request capacity. Exhausting 900,000 candidates over 12 hours would require about 21 requests/second; no live brute-force attack was attempted.

**Impact:** Account takeover through password recovery, and bypass of email ownership verification, if sufficient guesses can reach the backend. Accounts with staff privileges are also exposed.

**Fix:** Use short validity, such as 5–10 minutes; atomically cap attempts per code/account, invalidate after a small number of failures, and consume successful codes atomically. Add distributed per-account and per-IP limits. Extend tests to concurrent submissions, resend replacement, expiry, attempt exhaustion, and replay.

### F05 — Dependency advisories and deployment reachability

All results below cover the complete locked dependency trees, including development/build tools. These are npm vulnerability **package entries**, which can inherit severity from another package and can overlap across directories; they are not counts of distinct exploitable application flaws.

| Package tree | Critical | High | Moderate | Low | Total entries |
|---|---:|---:|---:|---:|---:|
| Backend | 1 | 9 | 1 | 1 | 12 |
| Frontend | 3 | 25 | 8 | 2 | 38 |
| Root | 0 | 0 | 2 | 0 | 2 |

Full registry results are retained in [backend audit](security-review/npm-audit-backend.json), [frontend audit](security-review/npm-audit-frontend.json), and [root audit](security-review/npm-audit-root.json). Installed versions matched the lockfiles for the principal packages checked.

| Component | Locked version | Project-specific assessment |
|---|---|---|
| Mongoose | 9.1.3 | Runtime. An event update reaches the prototype-pollution casting path described in F12. The separate `$nor` sanitizer advisory requires attacker control of an entire query filter; that condition was not demonstrated here. Upgrade to a compatible current 9.x release at least 9.7.2, covering these two advisories. [Maintainer casting advisory](https://github.com/Automattic/mongoose/security/advisories/GHSA-664h-wqgq-64gw), [maintainer sanitizer advisory](https://github.com/Automattic/mongoose/security/advisories/GHSA-wpg9-53fq-2r8h). |
| Nodemailer | 7.0.12 | Runtime. Public registration passes unvalidated recipient strings into queued emails, making address-parser advisories relevant. Other advisories require options such as raw mail, OAuth2, or transport settings that callers cannot control in this project. The registry suggests 10.1.0, a major upgrade requiring SMTP/queue compatibility checks. See the backend JSON for exact address-parser advisories and ranges. |
| proxy-addr | 2.0.7 | Registry severity critical. Exploitation requires particular unsafe trusted-proxy subnet configuration. The checked Express server does not enable `trust proxy`, so this review did not establish that condition. Upgrade to at least 2.0.8 and configure only the actual proxy hops when adding rate limits. [Maintainer advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h). |
| Vite | 7.3.1 | Development-server arbitrary file-read advisories. This config does not expose `server.host`; the known WebSocket issue requires network exposure of the development server. Upgrade within a maintained compatible release line covering every Vite advisory in the captured JSON. A static production bundle does not expose a Vite development server. [Maintainer advisory](https://github.com/vitejs/vite/security/advisories/GHSA-p9ff-h696-f583). |
| Axios | 1.13.2 | Used by the browser frontend. Many reported proxy/HTTP-adapter SSRF cases require Node.js behavior not used by these client calls. Prototype-pollution gadgets require an additional pollution source; no application browser source was found. Update to a compatible release outside the captured affected ranges. |
| React Router / react-router-dom | 7.13.0 | BrowserRouter SPA, with no React Router SSR/RSC/single-fetch server identified. Registry RCE/SSR/RSC headlines do not establish server execution in this architecture. Update nonetheless and test navigation/redirects. |
| shell-quote / concurrently | 1.8.3 / 9.2.1 | Critical registry entries include inherited severity. Project scripts use fixed command strings rather than caller-supplied operator objects; an application route reaching command execution was not found. Keep these tools out of deployed serving processes and update their tree. |
| DOMPurify / fflate | 3.4.2 / 0.8.2 | Root PDF-related dependencies. Frontend viewers import `jspdf` from the root-installed package tree, so auditing only the frontend would miss these entries. No vulnerable DOMPurify mode or untrusted ZIP parsing path was demonstrated. |

Other audited entries include build-time globbing/parsing/source-map tools, `body-parser`, `path-to-regexp`, `qs`, and transitive CLI dependencies. The exact advisory list and ranges are in the saved JSON. Default `express.json()` still has its default body-size cap; the review did not show it disabled by the reported invalid-limit issue.

**Fix strategy:** Update deliberately and re-run the three audits, application checks, and targeted security regression checks. Avoid blindly using `npm audit fix --force`: this scan proposes downgrading `nodemon` to 1.14.10 and `shadcn` to 1.0.0 to escape some dependency ranges, which is not a sound default remediation. Move build/CLI tools out of runtime dependency sets or remove unused ones. Vite is a devDependency in the manifest but is promoted into the lockfile production graph through the production `@tailwindcss/vite` peer dependency; audit omission flags alone do not establish runtime reachability.

### F06 — Notification mark-as-seen bypasses role privacy

**Evidence:** [notificationController.js:409](/home/kfam/Service/The_Way/backend/controllers/notificationController.js:409), [notificationController.js:436](/home/kfam/Service/The_Way/backend/controllers/notificationController.js:436).

`PUT /api/notifications/:id/seen` selects solely by ID, adds the caller to `seenBy`, and returns the complete notification. It does not check whether the caller belongs to `targetRoles`, although normal list reads do filter by roles.

**Proof/impact:** A verified `unAssigned` user who knows an admin-only notification ID received its private message. Knowledge of the ID is required; the review did not demonstrate enumeration of every private ID.

**Fix:** Combine `_id` with authorized target roles in the database update, use atomic `$addToSet`, and return only display fields plus the caller's seen status.

### F07 — Changing email preserves verified status

**Evidence:** [userController.js:33](/home/kfam/Service/The_Way/backend/controllers/userController.js:33), [userController.js:53](/home/kfam/Service/The_Way/backend/controllers/userController.js:53), [userAuth.js:55](/home/kfam/Service/The_Way/backend/middleware/userAuth.js:55).

A verified user can replace `email` through `/api/user/update-profile` without a password, recent authentication, or verification of the new address. `isAccountVerified` remains true. A synthetic email change still passed verification middleware.

**Impact:** False email ownership claims and recovery-address takeover by someone holding a session. The target email must satisfy database uniqueness, so this is not demonstrated direct takeover of another existing user's document.

**Fix:** Require recent authentication; stage and verify a pending address before replacing the current one. Notify the old address and invalidate outstanding OTPs/jobs and affected sessions.

### F08 — Recovery and logout do not revoke sessions

**Evidence:** [authCookie.js:1](/home/kfam/Service/The_Way/backend/config/authCookie.js:1), [userAuth.js:15](/home/kfam/Service/The_Way/backend/middleware/userAuth.js:15), [authController.js:175](/home/kfam/Service/The_Way/backend/controllers/authController.js:175), [authController.js:314](/home/kfam/Service/The_Way/backend/controllers/authController.js:314).

JWT validation checks signature/expiry, not a persisted session or token version. Password reset updates the password only, and logout clears the current browser cookie. Both leave a previously copied JWT valid until its 48-hour expiry.

**Proof/impact:** The old synthetic token authenticated after both actions. A stolen token can survive the user's recovery action. This does not mean a cleared browser cookie reappears on its own; the risk requires a retained token copy.

**Fix:** Use revocable session identifiers or a server-checked `tokenVersion`/`passwordChangedAt`. Revoke all sessions on reset and the current session on logout; consider shorter access-token lifetimes.

### F09 — Broad authentication and mail abuse limits are absent

**Evidence:** [authRoutes.js:17](/home/kfam/Service/The_Way/backend/routes/authRoutes.js:17), [server.js:29](/home/kfam/Service/The_Way/backend/server.js:29), [authController.js:75](/home/kfam/Service/The_Way/backend/controllers/authController.js:75).

No application rate limiter/global quota was found for login, registration, or recovery. Thirty consecutive wrong passwords returned ordinary 401s without delay or lockout. Unauthenticated registration can queue welcome/verification email jobs repeatedly. Per-account resend cooldown is useful but does not cap requests spread across many accounts or registration attempts.

**Impact:** Credential guessing/stuffing, CPU/database load, mail spam, and exhaustion of SMTP quotas. Production edge controls could limit exposure, but none are defined in this repository.

**Fix:** Implement shared, endpoint-specific limits for IP/account/global request volume, gradual login backoff, and bounded email-send quotas. Apply correct trusted-proxy configuration and test limits across multiple workers. Use bounded pagination and per-request item limits for large record and bulk endpoints as additional resource protection.

### F10 — Password and mailbox validation are inconsistent

**Evidence:** [authController.js:19](/home/kfam/Service/The_Way/backend/controllers/authController.js:19), [authController.js:26](/home/kfam/Service/The_Way/backend/controllers/authController.js:26), [authController.js:288](/home/kfam/Service/The_Way/backend/controllers/authController.js:288), [userModel.js:6](/home/kfam/Service/The_Way/backend/models/userModel.js:6), [emailQueue.js:53](/home/kfam/Service/The_Way/backend/services/emailQueue.js:53).

Registration/reset require truthy passwords without a shared type/strength/length policy. Both accepted `x` in the proof. Registration accepts an email string containing two comma-separated mailboxes; the queued destination parses as two recipients. Login separately trims/lowercases and validates email format, while registration/profile/recovery use inconsistent normalization.

**Impact:** Easily guessed accounts, unsolicited multi-recipient emails, ineffective per-address uniqueness for recipient-list strings, and confusing/inaccessible accounts. The multi-recipient test did not send any real email.

**Fix:** Use shared request schemas. Validate exactly one mailbox, reject recipient lists and unwanted display-name syntax, cap input lengths, and normalize identically across account operations. Apply a strong password policy and reject compromised/common passwords; handle bcrypt's input byte-length limitation explicitly rather than silently truncating long credentials.

### F11 — Camp membership and applicant emails are overexposed

**Evidence:** [campController.js:134](/home/kfam/Service/The_Way/backend/controllers/campController.js:134), [campController.js:154](/home/kfam/Service/The_Way/backend/controllers/campController.js:154), [campController.js:421](/home/kfam/Service/The_Way/backend/controllers/campController.js:421), [campController.js:470](/home/kfam/Service/The_Way/backend/controllers/campController.js:470).

Member camp listings return all applicant IDs/timestamps; camp details populate all applicants' emails and roles. Applying/withdrawing also returns the entire camp. A verified `unAssigned` account received the synthetic membership and applicant emails/roles.

**Impact:** Unnecessary disclosure of community participation and contact details to unrelated members.

**Fix:** Return applicant counts and current-user registration status to members; expose full applicants through a separate staff-authorized endpoint. Use explicit projections for list/detail/apply/withdraw responses.

**Qualification:** The camp schema declares `applicants` twice at [campsModel.js:50](/home/kfam/Service/The_Way/backend/models/campsModel.js:50) and [campsModel.js:113](/home/kfam/Service/The_Way/backend/models/campsModel.js:113). The second definition wins and currently drops submitted child/phone/notes fields. Actual Mongoose construction confirmed this. Therefore camp disclosure of those dropped fields was not established; the confirmed exposure is membership/emails/roles. The duplicate definition is also a separate functional data-loss bug.

### F12 — Raw event updates permit metadata forgery and vulnerable casting

**Evidence:** [eventController.js:105](/home/kfam/Service/The_Way/backend/controllers/eventController.js:105), [EventModel.js:57](/home/kfam/Service/The_Way/backend/models/EventModel.js:57), [EventModel.js:67](/home/kfam/Service/The_Way/backend/models/EventModel.js:67), [eventPermission.js:5](/home/kfam/Service/The_Way/backend/middleware/eventPermission.js:5).

Event staff can pass arbitrary `req.body` into `findByIdAndUpdate`. Actual casting accepts `createdBy`, `source`, `calendarKey`, and `generatedYear`, as well as caller-owned update operators. Staff can forge author attribution and tamper with generated-calendar metadata. This endpoint is staff-gated, so this is not an unprivileged event authorization bypass.

A separate disposable offline casting check against the actual Event model observed an `__proto__`-prefixed update modifying `Object.prototype.$fullPath` before throwing. The observed effect was shared prototype metadata pollution; arbitrary property assignment, execution, or a broader privilege-escalation chain was not demonstrated. This matches the affected behavior documented by the [Mongoose maintainer advisory](https://github.com/Automattic/mongoose/security/advisories/GHSA-664h-wqgq-64gw).

**Fix:** Upgrade Mongoose to at least a compatible 9.7.2 release and whitelist editable event fields into a server-constructed `$set`. Reject operator/prototype/dotted keys; preserve server-owned authorship and generated-calendar fields. Retain validation but do not treat schema validation as authorization for protected fields.

### F13 — Video URL classification embeds arbitrary content

**Evidence:** [GamesViewer.jsx:197](/home/kfam/Service/The_Way/frontend/src/Pages/GamesViewer.jsx:197), [GamesViewer.jsx:277](/home/kfam/Service/The_Way/frontend/src/Pages/GamesViewer.jsx:277), [LessonViewer.jsx:451](/home/kfam/Service/The_Way/frontend/src/Pages/LessonViewer.jsx:451), [LessonViewer.jsx:603](/home/kfam/Service/The_Way/frontend/src/Pages/LessonViewer.jsx:603), [ActivitiesViewer.jsx:187](/home/kfam/Service/The_Way/frontend/src/Pages/ActivitiesViewer.jsx:187), [ActivitiesViewer.jsx:264](/home/kfam/Service/The_Way/frontend/src/Pages/ActivitiesViewer.jsx:264).

The helpers preserve unrecognized URLs, then select the iframe branch when the full URL contains `youtube.com/embed`. A query parameter on an unrelated HTTPS host or a `data:` URL can contain that string. The iframe uses the supplied URL without a sandbox; backend content controllers only trim the stored video string.

**Proof:** Extracted the three real helpers and applied two synthetic URLs: `https://attacker.example/watch?next=youtube.com/embed` and a harmless `data:` HTML example containing the marker. Both were preserved and selected the iframe branch in all three viewers. React rendering preserved the iframe source; no page was opened or fetched.

**Impact:** A content author or compromised staff account can place a phishing page/third-party active content inside the trusted interface. Cross-origin/opaque-origin protections still apply. This is not demonstrated same-origin XSS or authentication-cookie theft.

**Fix:** Require HTTPS, exact supported hostnames, and valid video IDs, then construct canonical embed URLs. Unsupported URLs must never select the iframe branch. Apply limited iframe permissions and a compatible sandbox policy; validate on both server and client.

### F14 — Bulk attendance updates skip enum validation

**Evidence:** [attendanceControllers.js:220](/home/kfam/Service/The_Way/backend/controllers/attendanceControllers.js:220), [attendanceControllers.js:232](/home/kfam/Service/The_Way/backend/controllers/attendanceControllers.js:232), [attendanceModel.js:17](/home/kfam/Service/The_Way/backend/models/attendanceModel.js:17).

Weekly attendance copies caller status values into `bulkWrite` update operations. Actual Mongoose bulk casting forwarded an arbitrary invalid status to the stubbed collection despite the model enum. This can corrupt attendance/reporting, including after F02's permission gap is repaired.

**Fix:** Validate every item, status, ID, notes length, array size, and duplicate child/date combination before building bulk operations. Reject invalid items before any write.

### F15 — Logout CSRF in production cookie configuration

**Evidence:** [authCookie.js:9](/home/kfam/Service/The_Way/backend/config/authCookie.js:9), [authRoutes.js:20](/home/kfam/Service/The_Way/backend/routes/authRoutes.js:20), [server.js:31](/home/kfam/Service/The_Way/backend/server.js:31).

Production uses `SameSite=None`; no CSRF token or origin check was found. An offline Express request with an untrusted Origin and form content type reached logout and expired the cookie even though CORS omitted `Access-Control-Allow-Origin`. CORS controls response access and preflight, not rejection of all simple requests. Browser cookie restrictions can affect practical cross-site delivery.

**Impact:** Forced logout. Arbitrary authenticated JSON mutations were not proven: JSON-only parsing and CORS preflight limit many other routes.

**Fix:** Validate trusted origins for browser mutations, add CSRF protection, and prefer `SameSite=Lax`/`Strict` when compatible with the deployment. Cover logout as well as JSON mutations.

### F16 — Account enumeration through recovery

**Evidence:** [authController.js:271](/home/kfam/Service/The_Way/backend/controllers/authController.js:271), [authController.js:281](/home/kfam/Service/The_Way/backend/controllers/authController.js:281), [authController.js:33](/home/kfam/Service/The_Way/backend/controllers/authController.js:33).

Reset requests return `User not found` for absent accounts and queued success for existing accounts; the proof observed both paths. Registration also explicitly reveals existing users. This undermines login's generic invalid-credentials response.

**Fix:** Return a generic recovery result regardless of existence, make timing reasonably uniform, and throttle. Review whether registration's explicit disclosure is needed.

### F17 — Internal error messages returned to callers

**Evidence/examples:** [childProfileController.js:56](/home/kfam/Service/The_Way/backend/controllers/childProfileController.js:56), [eventController.js:122](/home/kfam/Service/The_Way/backend/controllers/eventController.js:122). Similar catch blocks occur across domain controllers.

Many endpoints serialize `error.message`, which can reveal schema names, field paths, cast values, and database diagnostic details. Full exceptions are also logged in many controllers. No specific leaked production credential or live stack trace was established.

**Fix:** Centralize error handling, return safe validation messages and generic internal-failure responses, and log redacted diagnostics with request IDs. Avoid passwords, OTPs, request bodies, and personally identifying values in logs.

## Additional privacy, configuration, and operational gaps

These items are repository observations or hardening opportunities, rather than proven attacks on a deployed environment.

1. **Committed dependencies:** Git tracks 7,217 dependency files: 5,302 under root `node_modules` and 1,915 under `backend/node_modules`; `frontend/node_modules` has no tracked files. `.gitignore` does not remove already tracked files. Committed vendors can drift from lockfiles and obscure review. Remove the two tracked dependency folders from the index in a separate reviewed change and install from lockfiles with `npm ci`; do not blindly delete local files or rewrite history during an audit.
2. **Production serving:** Root [package.json:1](/home/kfam/Service/The_Way/package.json:1) starts the frontend with Vite preview. Configure a production static host/reverse proxy for the built frontend, define HTTPS and a production origin allowlist, and deploy the backend behind a bounded proxy. The current [server.js:27](/home/kfam/Service/The_Way/backend/server.js:27) allows only `http://localhost:5173`. That is a deployment mismatch, not an open CORS policy. The root `concurrently` command is also undeclared in the root manifest, making clean installation behavior fragile.
3. **Headers and caching:** No application-defined CSP, frame-ancestors, HSTS, or other explicit security-header middleware was found. Production proxy/static-host behavior was not inspected. Set an application-appropriate policy there or in the app, limit frames to supported media sources, disable Express branding, and mark authenticated/sensitive responses private/no-store where appropriate.
4. **Secret configuration:** Backend `.env` has populated database, JWT, and SMTP settings; frontend `.env` contains a backend URL. Neither file is tracked, and no `.env`/private-key filename was found in the 35 local commits. Current secret exact-match scanning found no tracked first-party matches. The only current literal-secret pattern was a test-only cookie secret; historical URI hits were username/password placeholders. The README's claim that `.env` is currently tracked is stale. These checks are not proof that credentials were never exposed elsewhere.
5. **Signing-key policy:** The local JWT secret is 16 characters; no source-enforced cryptographic key-generation/minimum-strength/startup validation policy was found. Length alone does not prove a guessable key. Use an independently generated secret with at least 32 random bytes, protect it in deployment secrets, and validate required configuration before accepting traffic. Replacing the current key invalidates sessions and should be deliberate.
6. **Pending OTP storage:** OTP fields and queued email text contain raw codes at [userModel.js:8](/home/kfam/Service/The_Way/backend/models/userModel.js:8), [userModel.js:12](/home/kfam/Service/The_Way/backend/models/userModel.js:12), and [otpRequests.js:26](/home/kfam/Service/The_Way/backend/services/otpRequests.js:26). A database/backup reader could obtain active recovery codes. Hashing OTP fields alone leaves queued text exposed; protect pending mail payloads separately and minimize retention. No unauthorized database reader was demonstrated.
7. **Trusted-email HTML:** Staff-only camp mail inserts raw title/message HTML at [campController.js:557](/home/kfam/Service/The_Way/backend/controllers/campController.js:557). A stubbed mail send confirmed markup is preserved. Escape plain text or sanitize an explicitly supported rich format; the risk is trusted-email content/phishing, not established browser script execution.
8. **Relationship metadata:** Chant reads expose favorites user IDs, and notifications expose all `seenBy` IDs. Prefer current-user booleans/counts over everyone else's identifiers. See [chantController.js:157](/home/kfam/Service/The_Way/backend/controllers/chantController.js:157) and [notificationController.js:300](/home/kfam/Service/The_Way/backend/controllers/notificationController.js:300).
9. **Reliability issues affecting security review:** Camp update reads `req.user.role` although authentication supplies only `req.userId` ([campController.js:180](/home/kfam/Service/The_Way/backend/controllers/campController.js:180)); it fails closed and breaks legitimate updates. Lesson/camp regex searches were blocked by current global `sanitizeFilter` in an offline casting check, so an active search ReDoS was not established. Fix search with typed, bounded, escaped inputs and server-owned query operators; do not disable sanitization globally to repair functionality.
10. **Auditability and coverage:** No repository-defined CI security scanning/dependency maintenance/deployment policy was found. Existing tests do not cover the principal authorization and recovery failures. Email queue documentation names `emailQueue.test.js`, `emailVerification.test.js`, and `adminRoles.test.js`, which are absent in this checkout. Keep security-sensitive tests and documentation in sync, and log administrative permission changes and destructive actions without sensitive payloads.

## Controls that are already useful

- Passwords are bcrypt hashes; OTP generation uses Node's cryptographic random generator.
- Cookies are HttpOnly; Secure is enabled by default and mandatory in production. Cookie/JWT lifetimes are aligned.
- Registration restricts roles to `parent`/`unAssigned`; profile updates whitelist fields and do not permit role/password mass assignment.
- A parent was denied the admin dashboard in the offline proof. Administrative mutations check database-backed roles and allowed role assignments.
- All domain route groups require signed-in, verified users; the failures above concern additional permissions/scope.
- Lesson/game/activity/chant/curriculum writes check staff roles. Event writes have staff middleware. Video-request `/my` queries use the requester ID, while all/detail/mutation routes require `pascal`.
- Curriculum rejects invalid references/cycles and uses optimistic concurrency.
- Global Mongoose filter sanitization and strict query handling are enabled. Typed login inputs and field-specific queries reduce injection exposure; the installed library still needs its security updates.
- Frontend text generally renders through JSX. No application `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write`, browser token storage, or `postMessage` handler was found. React blocked a tested `javascript:` hyperlink; generic link XSS was not reported.
- External links generally use `noreferrer` or `noopener noreferrer`. Authentication state stays in React memory, and protected routes wait for session/verification state.
- No application shell execution, file-upload processing, or caller-controlled server-side URL fetch was identified in the domain request handlers.
- Email delivery uses atomic leases, resend reservation, stale-job discard, TLS SMTP/timeouts, and redacted worker logs. Profile/admin responses exclude queued mail payloads.

## Validation and retained evidence

| Check | Result | Meaning / limits |
|---|---|---|
| `node --test backend/tests/*.test.js frontend/tests/*.test.js` | Exit 0; all four test files passed | Existing behavior checks; does not cover most findings |
| `npm run build -- --outDir /tmp/the-way-security-build` in frontend | Exit 0 | Build succeeded; four CSS optimization warnings and a large-bundle warning remain |
| `node security-review/proof-auth.mjs` | All assertions passed | Reproduces verification/recovery/session/input/CSRF flaws using in-memory model stubs and offline Express routing |
| `node security-review/proof-domain.mjs` | All 13 checks passed | Reproduces permission/privacy flaws and selected casting/HTML behavior; database and SMTP are stubbed |
| `node security-review/proof-media.mjs` | All three viewers preserved both synthetic URLs and selected iframe rendering | Local helper/React rendering; no actual browser or external content loaded |
| Three npm lockfile audits | Completed; exit 1 because advisories were found | Full JSON retained; counts are package/advisory graph entries |
| Git/configured-secret scans | No confirmed first-party secret exposure in inspected content | Pattern/exact-match coverage; remote/deleted copies and unknown secret formats remain outside coverage |

The proof scripts are audit artifacts: **passing means the described unsafe behavior exists**, not that the application is secure. Run each in a separate disposable Node process; they replace model methods in that process. They do not load `.env`, start `server.js`, connect to MongoDB, deliver email, or modify application records. After fixes, replace these demonstrations with regression tests asserting denied access and safe behavior.

## Recommended repair order and acceptance criteria

1. **Contain personal-data exposure first:** Server-enforce child/attendance/notification permissions on every router alias and mutation. Verify ordinary members cannot read/write unrelated child/attendance records, broadcast notices, or clear shared notices. Keep authorized staff workflows working.
2. **Protect account recovery:** Attempt limits, short/atomic OTP lifecycle, shared abuse limits, strong input validation, safe email-change flow, and session revocation. A correct code must be usable only once; exhausted/expired codes and pre-reset/revoked tokens must fail.
3. **Remove raw update/media trust:** Whitelist event updates, upgrade Mongoose, canonicalize video URLs, and validate attendance items before bulk writes. Protected event metadata must remain unchanged by client payloads; unsupported media URLs must not become iframes.
4. **Minimize response data:** Member camp responses omit applicants; role-private notifications cannot be fetched through seen mutations; populated children/favorites/seen lists return only justified fields.
5. **Update and package dependencies:** Review compatible upgrades, remove unnecessary runtime CLI tools and tracked vendors, rerun audits across all three trees, and document any remaining advisory's actual reachability. Avoid forced historical downgrades.
6. **Verify deployment controls and monitor:** Production HTTPS/origins/CSRF/headers/private caching, correct proxy trust, restricted database/backup access, generated secrets, immutable administrative logs, and automated security checks. Validate these against the actual deployed environment rather than inferring them from a successful local build.
