// AUDIT ARTIFACT: passing assertions reproduce known vulnerabilities, not secure behavior.
// Isolated process only; mocks all database/email I/O. Does not load .env or start server.js.
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import bcrypt from '../backend/node_modules/bcryptjs/index.js';
import jwt from '../backend/node_modules/jsonwebtoken/index.js';
import express from '../backend/node_modules/express/index.js';
import cors from '../backend/node_modules/cors/lib/index.js';
import cookieParser from '../backend/node_modules/cookie-parser/index.js';
import addressParser from '../backend/node_modules/nodemailer/lib/addressparser/index.js';
import userModel from '../backend/models/userModel.js';
import { updateProfile } from '../backend/controllers/userController.js';
import { verifyEmail, resetPassword, logout, login, register, sendResetOtp } from '../backend/controllers/authController.js';
import { authenticateUser, requireVerifiedUser } from '../backend/middleware/userAuth.js';
import { AUTH_TOKEN_TTL_SECONDS } from '../backend/config/authCookie.js';
import { getAdminDashboard } from '../backend/controllers/adminController.js';
import authRouter from '../backend/routes/authRoutes.js';

// Direct invocation with in-memory model stubs. No DB, HTTP listener, or SMTP.
const response = () => ({ statusCode: 200, status(s) { this.statusCode = s; return this; }, json(b) { this.body = b; return this; }, set() { return this; }, cookie() { return this; }, clearCookie() { return this; } });
process.env.JWT_SECRET = 'local-audit-secret-not-a-production-secret';
const user = { _id: '507f1f77bcf86cd799439011', email: 'owned@example.invalid', isAccountVerified: true, role: ['parent'], verifyOtp: '', verifyOtpExpireAt: 0, resetOtp: '426913', resetOtpExpireAt: Date.now() + 60000, emailJobs: {}, password: await bcrypt.hash('old-audit-password', 4), async save() { return this; } };
userModel.findByIdAndUpdate = (id, updates) => ({ select: async () => { Object.assign(user, updates); return user; } });
let r = response();
await updateProfile({ userId: user._id, body: { email: 'unowned@example.invalid' } }, r);
assert.equal(r.body.success, true);
assert.equal(user.isAccountVerified, true);
userModel.findById = () => ({ select: async () => user });
let passed = false;
await requireVerifiedUser({ userId: user._id }, response(), () => { passed = true; });
assert.equal(passed, true);
console.log('Confirmed: email changed without password; previous verified status retained; verification middleware still grants access.');

const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: AUTH_TOKEN_TTL_SECONDS });
userModel.findOne = async () => user;
r = response();
await resetPassword({ body: { email: user.email, otp: '426913', newPassword: 'x' } }, r);
assert.equal(r.body.success, true);
assert.equal(await bcrypt.compare('x', user.password), true);
passed = false;
await authenticateUser({ cookies: { token } }, response(), () => { passed = true; });
assert.equal(passed, true);
console.log('Confirmed: one-character replacement password accepted; pre-reset JWT remains valid.');
await logout({}, response());
passed = false;
await authenticateUser({ cookies: { token } }, response(), () => { passed = true; });
assert.equal(passed, true);
console.log('Confirmed: logout does not revoke a copied JWT; maximum token lifetime is', AUTH_TOKEN_TTL_SECONDS, 'seconds.');

user.isAccountVerified = false;
user.verifyOtp = '876543';
user.verifyOtpExpireAt = Date.now() + 60000;
user.resetOtp = '765432';
user.resetOtpExpireAt = Date.now() + 60000;
userModel.findById = async () => user;
for (let i = 0; i < 100; i++) {
  r = response();
  await verifyEmail({ userId: user._id, body: { otp: '100000' } }, r);
  assert.equal(r.body.success, false);
  assert.notEqual(r.statusCode, 429);
  assert.equal(user.verifyOtp, '876543');
}
for (let i = 0; i < 100; i++) {
  r = response();
  await resetPassword({ body: { email: user.email, otp: '100000', newPassword: 'new-audit-password' } }, r);
  assert.equal(r.body.success, false);
  assert.notEqual(r.statusCode, 429);
  assert.equal(user.resetOtp, '765432');
}
console.log('Confirmed: 100 consecutive bad verification OTPs and 100 bad reset OTPs cause no lockout, code invalidation, or HTTP 429.');
userModel.findOne = () => ({ setOptions: async () => user });
for (let i = 0; i < 30; i++) {
  r = response();
  await login({ body: { email: user.email, password: 'incorrect-audit-password' } }, r);
  assert.equal(r.statusCode, 401);
}
console.log('Confirmed: 30 consecutive wrong passwords cause no application login lockout or HTTP 429.');
userModel.findById = async () => user;
r = response();
await getAdminDashboard({ userId: user._id }, r);
assert.equal(r.statusCode, 403);
console.log('Positive control: parent account denied admin dashboard.');

userModel.findOne = async () => null;
r = response();
await sendResetOtp({ body: { email: 'absent@example.invalid' } }, r);
assert.equal(r.body.message, 'User not found');
const absent = r.body;
userModel.findOne = async () => user;
userModel.findOneAndUpdate = async () => user;
r = response();
await sendResetOtp({ body: { email: user.email } }, r);
assert.equal(r.body.success, true);
assert.notEqual(absent.success, r.body.success);
console.log('Confirmed: unauthenticated reset request distinguishes existing and nonexistent accounts.');

userModel.findOne = async () => null;
let registered;
userModel.prototype.save = async function () { registered = this; return this; };
r = response();
await register({ body: { name: 'Audit user', email: 'one@example.invalid,two@example.invalid', password: 'x', role: 'parent' } }, r);
assert.equal(r.body.success, true);
assert.equal(await bcrypt.compare('x', registered.password), true);
assert.equal(addressParser(registered.emailJobs.verification.to).length, 2);
console.log('Confirmed: registration accepts a one-character password and a recipient-list email; queued OTP addresses parse as two recipients.');

process.env.NODE_ENV = 'production';
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: ['http://localhost:5173'], credentials: true }));
app.use('/api/auth', authRouter);
const req = Readable.from([]);
req.method = 'POST';
req.url = '/api/auth/logout';
req.originalUrl = req.url;
req.headers = { origin: 'https://attacker.invalid', 'content-type': 'application/x-www-form-urlencoded', host: 'api.example.invalid', cookie: 'token=audit-placeholder' };
req.socket = {};
req.connection = req.socket;
const headers = new Map();
const res = Object.create(express.response);
res.req = req;
res.setHeader = (key, value) => headers.set(key.toLowerCase(), value);
res.getHeader = (key) => headers.get(key.toLowerCase());
const body = await new Promise((resolve, reject) => {
  res.json = resolve;
  app.handle(req, res, (err) => err ? reject(err) : reject(new Error('Unexpected route fallthrough')));
});
assert.equal(body.success, true);
assert.match(headers.get('set-cookie'), /^token=;/);
assert.equal(headers.has('access-control-allow-origin'), false);
console.log('Confirmed offline Express routing: cross-origin HTML-form POST logout succeeds and expires the auth cookie although CORS omits Access-Control-Allow-Origin.');
