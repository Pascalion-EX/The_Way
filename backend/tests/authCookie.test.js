import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { register, login, logout } from "../controllers/authController.js";
import { authenticateUser } from "../middleware/userAuth.js";
import userModel from "../models/userModel.js";

// Use Express's real cookie serialization without opening a network listener.
const createResponse = () => {
  const res = Object.create(express.response);
  const headers = new Map();
  res.req = {};
  res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
  res.getHeader = (name) => headers.get(name.toLowerCase());
  res.json = (body) => { res.body = body; return res; };
  return res;
};

for (const { name, environment, override, secure, sameSite } of [
  { name: "default HTTPS cookies", secure: true, sameSite: "Strict" },
  { name: "explicit local HTTP override", environment: "development", override: "false", secure: false, sameSite: "Strict" },
  { name: "production ignores HTTP override", environment: "production", override: "false", secure: true, sameSite: "None" },
]) {
  test(name, async (t) => {
    const previous = { ...process.env };
    t.after(() => {
      for (const key of ["NODE_ENV", "AUTH_COOKIE_SECURE", "JWT_SECRET"]) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    });
    if (environment) process.env.NODE_ENV = environment;
    else delete process.env.NODE_ENV;
    if (override) process.env.AUTH_COOKIE_SECURE = override;
    else delete process.env.AUTH_COOKIE_SECURE;
    process.env.JWT_SECRET = "test-only-cookie-secret";

    const credentials = { name: "Test User", email: "test@example.com", password: "test-password", role: "parent" };
    const user = { _id: "6ab26b08171afea3091f04b3", tokenVersion: 0, password: await bcrypt.hash(credentials.password, 4) };
    const find = t.mock.method(userModel, "findOne", async () => null);
    t.mock.method(userModel, "findById", () => ({ select: async () => user }));
    t.mock.method(userModel.prototype, "save", async function () { return this; });

    for (const controller of [register, login]) {
      if (controller === login) {
        find.mock.mockImplementation(() => ({ setOptions: async () => user }));
      }
      const res = createResponse();
      await controller({ body: credentials }, res);
      assert.equal(res.body.success, true);
      const cookie = res.getHeader("Set-Cookie");
      assert.match(cookie, /; HttpOnly/);
      assert.equal(cookie.includes("; Secure"), secure);
      assert.ok(cookie.includes(`; SameSite=${sameSite}`));
      assert.match(cookie, /; Path=\//);
      assert.match(cookie, /; Max-Age=172800/);

      const token = cookie.split(";")[0].slice("token=".length);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      assert.equal(decoded.tokenVersion, 0);
      assert.equal(decoded.exp - decoded.iat, 172800);
      const req = { cookies: { token } };
      let authenticated = false;
      await authenticateUser(req, createResponse(), () => { authenticated = true; });
      assert.equal(authenticated, true);
      assert.equal(req.userId, decoded.id);
    }

    const res = createResponse();
    await logout({}, res);
    const cleared = res.getHeader("Set-Cookie");
    assert.match(cleared, /^token=;/);
    assert.match(cleared, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    assert.match(cleared, /; HttpOnly/);
    assert.equal(cleared.includes("; Secure"), secure);
    assert.ok(cleared.includes(`; SameSite=${sameSite}`));
    assert.match(cleared, /; Path=\//);
    assert.equal(cleared.includes("Max-Age"), false);
  });
}
