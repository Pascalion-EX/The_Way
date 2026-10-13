// AUDIT ARTIFACT: passing assertions reproduce known vulnerabilities, not secure behavior.
// Isolated process only; mocks all database/email I/O. Does not load .env or start server.js.
// Reproducible, offline security checks. All database and email I/O is stubbed.
// Run from project root: node security-review/proof-domain.mjs
import assert from 'node:assert/strict';
import mongoose from '../backend/node_modules/mongoose/index.js';
import jwt from '../backend/node_modules/jsonwebtoken/index.js';
import userAuth from '../backend/middleware/userAuth.js';
import User from '../backend/models/userModel.js';
import Child from '../backend/models/childProfileModel.js';
import Attendance from '../backend/models/attendanceModel.js';
import Notification from '../backend/models/notificationModel.js';
import Camp from '../backend/models/campsModel.js';
import Event from '../backend/models/EventModel.js';
import transporter from '../backend/config/nodemailer.js';
import { getAllChildProfiles, deleteChildProfile } from '../backend/controllers/childProfileController.js';
import { deleteAttendance } from '../backend/controllers/attendanceControllers.js';
import { createNotification, markNotificationAsSeen, deleteNotificationsByRoles } from '../backend/controllers/notificationController.js';
import { getAllCamps, getCampById, notifyCampApplicants } from '../backend/controllers/campController.js';
import { updateEvent } from '../backend/controllers/eventController.js';

mongoose.set('bufferCommands', false);
const accountId = '6ab26b08171afea3091f04b3';
const documentId = '6ab26b08171afea3091f04b4';
const response = () => ({
  status(n) { this.statusCode = n; return this; },
  json(b) { this.body = b; return this; },
});
function userQuery(role) {
  const doc = { _id: accountId, role, isAccountVerified: true };
  return {
    select() { return Promise.resolve(doc); },
    then(resolve, reject) { return Promise.resolve(doc).then(resolve, reject); },
  };
}
const pass = (message) => console.log(`PASS: ${message}`);
process.env.JWT_SECRET = 'synthetic-offline-proof-secret';
User.findById = () => userQuery(['unAssigned']);
const req = {
  cookies: { token: jwt.sign({ id: accountId }, process.env.JWT_SECRET) },
  params: { id: documentId }, body: {}, query: {},
};
let allowed = false;
await userAuth(req, response(), () => { allowed = true; });
assert.equal(allowed, true);
assert.equal(req.userId, accountId);
pass('verified unAssigned account passes actual JWT/verification middleware');

Child.find = () => ({ sort: async () => [{ _id: documentId, name: 'Synthetic Child', address: 'Synthetic Address', firstParentNumber: 123456789, allergies: ['Peanuts'] }] });
let r = response();
await getAllChildProfiles(req, r);
assert.equal(r.statusCode, 200);
assert.equal(r.body.children[0].address, 'Synthetic Address');
assert.equal(r.body.children[0].firstParentNumber, 123456789);
assert.deepEqual(r.body.children[0].allergies, ['Peanuts']);
pass('unAssigned child list exposes address, parent phone, and allergies');

Child.findByIdAndDelete = async () => ({ _id: documentId });
r = response(); await deleteChildProfile(req, r);
assert.equal(r.statusCode, 200);
pass('unAssigned child delete succeeds');
Attendance.findByIdAndDelete = async () => ({ _id: documentId });
r = response(); await deleteAttendance(req, r);
assert.equal(r.statusCode, 200);
pass('unAssigned attendance delete succeeds');

Notification.create = async (data) => ({ _id: documentId, ...data });
req.body = { title: 'Synthetic Staff Instruction', message: 'Synthetic', targetRoles: ['admin'], url: '/admin' };
r = response(); await createNotification(req, r);
assert.equal(r.statusCode, 201);
assert.deepEqual(r.body.notification.targetRoles, ['admin']);
pass('unAssigned account creates an admin-targeted notification');

const privateNote = {
  targetRoles: ['admin'], title: 'Synthetic private admin notice', message: 'Synthetic admin secret', seenBy: [],
  save: async () => {},
  toObject() { return { targetRoles: this.targetRoles, title: this.title, message: this.message, seenBy: this.seenBy }; },
};
Notification.findById = async () => privateNote;
r = response(); await markNotificationAsSeen(req, r);
assert.equal(r.statusCode, 200);
assert.equal(r.body.notification.message, 'Synthetic admin secret');
pass('unAssigned account retrieves private admin notification through the seen endpoint');
let cleared = false;
Notification.find = async () => [{ targetRoles: ['admin'], deleteOne: async () => { cleared = true; } }];
req.body = { targetRoles: ['admin'] };
r = response(); await deleteNotificationsByRoles(req, r);
assert.equal(r.statusCode, 200); assert.equal(cleared, true);
pass('unAssigned account clears admin-targeted notifications');

Camp.find = () => ({ sort: async () => [{ _id: documentId, applicants: [{ user: accountId, appliedAt: '2026-10-14' }] }] });
r = response(); await getAllCamps(req, r);
assert.equal(r.statusCode, 200);
assert.equal(r.body.camps[0].applicants[0].user, accountId);
pass('unAssigned account receives full camp membership');
const campDetail = { _id: documentId, applicants: [{ user: { _id: accountId, email: 'synthetic@example.invalid', role: ['parent'] } }] };
Camp.findById = () => ({ populate() { return this; }, then(resolve) { resolve(campDetail); } });
r = response(); await getCampById(req, r);
assert.equal(r.statusCode, 200);
assert.equal(r.body.camp.applicants[0].user.email, 'synthetic@example.invalid');
pass('unAssigned camp detail receives all applicant emails and roles');

const protectedUpdate = { $set: { createdBy: documentId, source: 'coptic-calendar', calendarKey: 'coptic:2027:resurrection', generatedYear: 2027 } };
const casted = Event.findByIdAndUpdate(accountId, protectedUpdate, { runValidators: true })._castUpdate(protectedUpdate);
assert.deepEqual(Object.keys(casted.$set).sort(), ['calendarKey', 'createdBy', 'generatedYear', 'source']);
Event.findById = async () => ({ _id: documentId });
let forwarded;
Event.findByIdAndUpdate = async (_id, update) => { forwarded = update; return { _id: documentId }; };
req.body = protectedUpdate;
r = response(); await updateEvent(req, r);
assert.equal(r.statusCode, 200); assert.equal(forwarded, protectedUpdate);
pass('event update controller forwards Mongo operators and protected fields accepted by actual Mongoose casting');

let invalidStatus;
Attendance.collection.bulkWrite = async (ops) => { invalidStatus = ops[0].updateOne.update.$set.status; return { ok: 1 }; };
await Attendance.bulkWrite([{ updateOne: {
  filter: { child: documentId, serviceDate: new Date('2026-10-14') },
  update: { $set: { status: 'arbitrary_invalid_status' } }, upsert: true,
} }]);
assert.equal(invalidStatus, 'arbitrary_invalid_status');
pass('actual Mongoose bulkWrite bypasses attendance status enum validation');

const camp = new Camp({ title: 'Example', name: 'Example', body: 'Example', TripType: 'Trip', years: [1], createdBy: accountId, applicants: [{ user: documentId, applicationType: 'parent_for_child', childName: 'Synthetic Child', childYear: 1, parentPhone: 'Synthetic Phone', notes: 'Synthetic Notes' }] });
assert.deepEqual(Object.keys(camp.applicants[0].toObject()).sort(), ['_id', 'appliedAt', 'user']);
pass('duplicate camp applicant schema drops submitted child/phone/notes fields');

User.findById = () => userQuery(['leader']);
const campForMail = { title: '<a href="https://example.invalid">Injected title</a>', applicants: [{ user: { email: 'synthetic@example.invalid' } }] };
Camp.findById = () => ({ populate() { return this; }, then(resolve) { resolve(campForMail); } });
let mail;
transporter.sendMail = async (payload) => { mail = payload; return {}; };
req.body = { subject: 'Synthetic', message: '<a href="https://example.invalid">Injected message</a>' };
r = response(); await notifyCampApplicants(req, r);
assert.equal(r.statusCode, 200);
assert.ok(mail.html.includes('<a href="https://example.invalid">Injected title</a>'));
assert.ok(mail.html.includes('<a href="https://example.invalid">Injected message</a>'));
pass('camp HTML email embeds title/message HTML without escaping; SMTP was stubbed');
console.log('All checks are synthetic; no database connection, HTTP server, SMTP send, or project mutation occurred.');
