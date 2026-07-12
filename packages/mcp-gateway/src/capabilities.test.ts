import test from "node:test";
import assert from "node:assert/strict";
import { resolveCapability } from "./capabilities.js";

test("maps common replay tools", () => assert.equal(resolveCapability("caido_send_request")?.name, "proxy.request.replay"));
test("uses read-only annotations", () => assert.equal(resolveCapability("unknown_history", { readOnlyHint: true })?.risk, "read"));
test("uses explicit WebCat adapter mappings", () => assert.deepEqual(resolveCapability("vendor_tool", { webcatCapability: "scanner.run", webcatRisk: "high", webcatTrusted: true }), { name: "scanner.run", risk: "high", trusted: true }));
