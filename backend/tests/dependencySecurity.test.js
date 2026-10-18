import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import Event from "../models/EventModel.js";
import transporter from "../config/nodemailer.js";

test("Mongoose sanitizes selectors nested under nor", () => {
  const filter = { $nor: [{ title: { $ne: "Synthetic event" } }] };
  mongoose.sanitizeFilter(filter);
  assert.deepEqual(filter.$nor[0].title, { $eq: { $ne: "Synthetic event" } });
});

test("event update casting cannot modify shared prototype metadata", () => {
  const fields = ["$fullPath", "$parentSchemaDocArray"];
  const before = fields.map((name) => Object.getOwnPropertyDescriptor(Object.prototype, name));
  for (const update of [
    JSON.parse('{"$set":{"__proto__.auditMarker":"synthetic"}}'),
    JSON.parse('{"__proto__.auditMarker":"synthetic"}'),
  ]) {
    const query = Event.findByIdAndUpdate("6ab26b08171afea3091f04b3", update, { returnDocument: "after", runValidators: true });
    try { query._castUpdate(query.getUpdate()); } catch { /* Invalid keys may be rejected. */ }
    for (const [index, name] of fields.entries()) {
      assert.deepEqual(Object.getOwnPropertyDescriptor(Object.prototype, name), before[index]);
    }
  }
  assert.equal(Object.prototype.auditMarker, undefined);
});

test("updated Nodemailer preserves SMTP configuration and generates current email formats offline", async () => {
  assert.equal(transporter.options.host, "SMTP.gmail.com");
  assert.equal(transporter.options.port, 465);
  assert.equal(transporter.options.secure, true);
  assert.equal(transporter.options.pool, true);
  assert.equal(transporter.options.maxConnections, 2);
  assert.equal(transporter.options.connectionTimeout, 15000);
  const offline = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  try {
    for (const content of [
      { text: "Dear Synthetic User,\nYour verification OTP is 123456" },
      { text: "Dear Synthetic User,\nYour password reset OTP is 123456" },
      { html: "<h2>Synthetic trip</h2><p>Staff announcement</p>" },
    ]) {
      const info = await offline.sendMail({
        from: "sender@example.invalid", to: "recipient@example.invalid",
        subject: "Synthetic compatibility check", messageId: "<synthetic@the-way.invalid>", ...content,
      });
      assert.deepEqual(info.envelope.to, ["recipient@example.invalid"]);
      assert.equal(info.messageId, "<synthetic@the-way.invalid>");
      assert.match(info.message.toString(), /Subject: Synthetic compatibility check/);
      assert.match(info.message.toString(), /(?:123456|Staff announcement)/);
    }
  } finally {
    offline.close();
  }
});
