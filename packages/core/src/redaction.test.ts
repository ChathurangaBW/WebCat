import test from "node:test";
import assert from "node:assert/strict";
import { redactString, redactValue } from "./redaction.js";

test("redacts bearer tokens and sensitive keys", () => {
  assert.equal(redactString("Authorization: Bearer abc.def.ghi"), "Authorization: [REDACTED]");
  assert.deepEqual(redactValue({ password: "secret", nested: { cookie: "sid=123", safe: "ok" } }), { password: "[REDACTED]", nested: { cookie: "[REDACTED]", safe: "ok" } });
});
