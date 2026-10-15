# Camp response privacy — F11

Implemented on 15 October 2026 following [the original review](../SECURITY_REVIEW.md).

Camp lists, details, registration/withdrawal, creation, and update now use the
same explicit response allowlist. Every successful camp response contains only
`_id`, `title`, `name`, `body`, `TripType`, `image`, `years`, `createdAt`,
`updatedAt`, `applicantCount`, and `hasApplied`. Optional absent fields may be
omitted. No applicant array, membership IDs, application timestamps, applicant
contact details, creator account/contact details, or internal fields are included
in these summaries. Staff also receive this summary on the ordinary routes.

List/detail queries use inclusive MongoDB aggregation projections to calculate
the count and authenticated viewer's registration flag without loading the
roster into the application. Request-body/query user IDs, role claims, and
population options cannot select another person's status or expose applicants.
The summary serializer provides the same allowlist for mutation results and
excludes future private fields and populated user objects.

`GET /api/camps/:id/applicants` is the separate private roster endpoint. It uses
the existing `userAuth` and `requireStaff` middleware: a current, verified
`admin`, `leader`, `pascal`, or `pamela` account is required. Current database
roles determine access; signed token/body role claims do not grant permission.
Ordinary members are denied before camp lookup or user population. Revoked,
deleted, anonymous, and unverified accounts cannot access the roster.

The endpoint selects only the camp's applicant records and populates only user
`_id`, `name`, `email`, and `role`. Its response is allowlisted to applicant
`_id`, `appliedAt`, and those user fields, plus camp ID/count. Deleted applicant
accounts become `user: null`. No passwords, OTP/email payloads, phone fields, or
future internal user fields are included. This uses the currently effective
applicant schema; the existing duplicate schema declaration and dropped
application-detail fields remain a separate data-model issue.

All camp responses use `Cache-Control: private, no-store`, including personalized
summaries and staff rosters. Missing camps and invalid IDs retain 404/400
responses; new read failures return generic errors. The aggregation filters
accept bounded strings, valid years/trip types, and escaped literal searches so
moving away from Mongoose `find` does not introduce raw query operators/regexes.

The camps UI now reads `hasApplied` directly for apply/withdraw controls, and the
details page displays `applicantCount`. It no longer needs a roster or a user ID
in the profile payload. Apply/withdraw success responses update those fields in
the existing UI state. Camp update authorization also now reads current roles
from the database; the former `req.user.role` check could not work with the
existing middleware, which sets `req.userId`.

## Validation

`backend/tests/campPrivacy.test.js` covers unrelated members, all four staff
roles, forged claims/status selectors, list/detail/apply/withdraw/create/update
response shapes, current-user status, mutation persistence, duplicate apply and
withdraw, denied roster queries before camp I/O, staff role revocation, missing
authorization lookups, session revocation, anonymous/unverified/deleted users,
deleted applicants, missing/null applicant arrays, input filters, missing camps,
invalid IDs, read failures, and future private fields/populated documents.

Tests retain Express routing, JWT validation, Mongoose queries, population,
document hydration, and save operations; database collection I/O is simulated.
MongoDB aggregation results are emulated while the exact inclusive projection
and authenticated-user expression are checked. A live MongoDB instance and
deployed caching/proxy configuration are outside these tests. No production
records are changed and no email is sent.

Run `npm test` for the full backend/frontend regression suite and
`npm run build --prefix frontend -- --outDir /tmp/the-way-camp-privacy-build` for
the frontend production build.

All **14 test files passed**, including **12 new camp privacy regression cases**.
The production build passed with the existing four CSS optimization warnings
and large-bundle warning. ESLint passed on both changed camp pages with no
errors; the existing `fetchCamps` effect-dependency warning remains.
