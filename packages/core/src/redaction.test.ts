import test from "node:test";
import assert from "node:assert/strict";
import { redactValue } from "./redaction.js";

test("redacts sensitive fields and bearer values", () => {
  const value = redactValue({ authorization: "Bearer abc.def", nested: "token=secret-value" }) as any;
  assert.equal(value.authorization, "[REDACTED]");
  assert.match(value.nested, /\[REDACTED\]/);
});
