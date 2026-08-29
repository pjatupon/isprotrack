import { test } from "node:test";
import assert from "node:assert/strict";
import { canManageKnowledge } from "../src/lib/knowledge/policy";

test("canManageKnowledge allows ADMIN and STAFF", () => {
  assert.equal(canManageKnowledge("ADMIN"), true);
  assert.equal(canManageKnowledge("STAFF"), true);
});

test("canManageKnowledge denies APPROVER and REQUESTER", () => {
  assert.equal(canManageKnowledge("APPROVER"), false);
  assert.equal(canManageKnowledge("REQUESTER"), false);
});

test("canManageKnowledge denies unknown or empty role", () => {
  assert.equal(canManageKnowledge(null), false);
  assert.equal(canManageKnowledge(undefined), false);
  assert.equal(canManageKnowledge(""), false);
  assert.equal(canManageKnowledge("SUPER_ADMIN"), false);
});
