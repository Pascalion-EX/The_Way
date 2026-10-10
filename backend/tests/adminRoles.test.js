import test, { after } from "node:test";
import assert from "node:assert/strict";
import userModel from "../models/userModel.js";
import { updateUserRolesByAdmin, updateUserClassByAdmin } from "../controllers/adminController.js";
import { updateProfile } from "../controllers/userController.js";

const originalFindById = userModel.findById;
const originalUpdate = userModel.findByIdAndUpdate;
after(() => {
  userModel.findById = originalFindById;
  userModel.findByIdAndUpdate = originalUpdate;
});

const targetId = "507f1f77bcf86cd799439011";

async function request(actorRole, role, id = targetId, targetExists = true, handler = updateUserRolesByAdmin, body = { role }) {
  let update;
  let projection;
  userModel.findById = async () => actorRole === null ? null : { role: actorRole };
  userModel.findByIdAndUpdate = (userId, changes, options) => {
    update = { userId, changes, options };
    return {
      select: async (fields) => {
        projection = fields;
        return targetExists ? { _id: userId, ...changes } : null;
      },
    };
  };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ userId: "actor", params: { id }, body }, res);
  return { ...res, update, projection };
}

test("each privileged role can assign multiple roles with validation and safe projection", async () => {
  for (const role of ["pascal", "admin", "pamela"]) {
    const result = await request(["parent", role], ["leader", "parent", "leader"]);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.user.role, ["leader", "parent"]);
    assert.deepEqual(result.update, {
      userId: targetId,
      changes: { role: ["leader", "parent"] },
      options: { new: true, runValidators: true },
    });
    for (const field of ["password", "verifyOtp", "resetOtp", "verifyOtpExpireAt", "resetOtpExpireAt"]) {
      assert.ok(result.projection.split(" ").includes(`-${field}`));
    }
  }
});

test("ordinary users cannot assign roles, including privileged roles to themselves", async () => {
  for (const role of [["parent"], ["leader"], ["unAssigned"], []]) {
    const result = await request(role, ["admin"]);
    assert.equal(result.statusCode, 403);
    assert.equal(result.update, undefined);
  }
});

test("invalid role payloads and user IDs cannot modify a user", async () => {
  for (const role of [undefined, null, "admin", [], ["unknown"], [null], ["unAssigned", "parent"]]) {
    const result = await request(["admin"], role);
    assert.equal(result.statusCode, 400);
    assert.equal(result.update, undefined);
  }
  const result = await request(["admin"], ["parent"], "invalid-id");
  assert.equal(result.statusCode, 400);
  assert.equal(result.update, undefined);
});

test("all model roles can be assigned and unassigned can be restored", async () => {
  for (const role of ["pascal", "admin", "pamela", "leader", "parent", "unAssigned"]) {
    const result = await request(["admin"], [role]);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.user.role, [role]);
  }
});

test("missing actor or target returns not found", async () => {
  const actor = await request(null, ["parent"]);
  assert.equal(actor.statusCode, 404);
  assert.equal(actor.update, undefined);
  const target = await request(["admin"], ["parent"], targetId, false);
  assert.equal(target.statusCode, 404);
});

const requestClass = (actorRole, userClass, id = targetId, targetExists = true) =>
  request(actorRole, undefined, id, targetExists, updateUserClassByAdmin, { class: userClass, role: ["admin"] });

test("each privileged role can assign and clear classes without changing roles", async () => {
  for (const role of ["pascal", "admin", "pamela"]) {
    for (const userClass of [0, 1, 12]) {
      const result = await requestClass(["parent", role], userClass);
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.user.class, userClass);
      assert.deepEqual(result.update, {
        userId: targetId,
        changes: { class: userClass },
        options: { new: true, runValidators: true },
      });
      for (const field of ["password", "verifyOtp", "resetOtp", "verifyOtpExpireAt", "resetOtpExpireAt"]) {
        assert.ok(result.projection.split(" ").includes(`-${field}`));
      }
    }
  }
});

test("ordinary users cannot assign classes through the admin endpoint", async () => {
  for (const role of [["parent"], ["leader"], ["unAssigned"], []]) {
    const result = await requestClass(role, 3);
    assert.equal(result.statusCode, 403);
    assert.equal(result.update, undefined);
  }
});

test("invalid classes and IDs are rejected before updating", async () => {
  for (const value of [undefined, null, "3", "", -1, 13, 100, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, true, [], {}]) {
    const result = await requestClass(["admin"], value);
    assert.equal(result.statusCode, 400);
    assert.equal(result.update, undefined);
  }
  const result = await requestClass(["admin"], 3, "invalid-id");
  assert.equal(result.statusCode, 400);
  assert.equal(result.update, undefined);
});

test("class assignment reports missing actor and target", async () => {
  const actor = await requestClass(null, 3);
  assert.equal(actor.statusCode, 404);
  assert.equal(actor.update, undefined);
  const target = await requestClass(["admin"], 3, targetId, false);
  assert.equal(target.statusCode, 404);
});

test("profile updates enforce the class range and preserve no class", async () => {
  for (const value of [0, 12, "0", "12"]) {
    const result = await request(["parent"], undefined, targetId, true, updateProfile, { class: value });
    assert.equal(result.body.success, true);
    assert.equal(result.update.changes.class, Number(value));
    assert.equal(result.update.options.runValidators, true);
  }
  for (const value of [-1, 13, "13", 1.5, "", null, true]) {
    const result = await request(["parent"], undefined, targetId, true, updateProfile, { class: value });
    assert.equal(result.statusCode, 400);
    assert.equal(result.update, undefined);
  }
});

test("user schema validates classes from 0 through 12", () => {
  for (const value of [0, 12]) {
    const user = new userModel({ name: "Test", email: "test@example.com", password: "test", class: value });
    assert.equal(user.validateSync(), undefined);
  }
  for (const value of [-1, 13, 1.5]) {
    const user = new userModel({ name: "Test", email: "test@example.com", password: "test", class: value });
    assert.ok(user.validateSync().errors.class);
  }
});
