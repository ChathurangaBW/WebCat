import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ApprovalService, DEFAULT_CONFIG, EngagementStore, type Engagement } from "@webcat/core";
import { authorizeMcpCall, filterMcpResultToScope } from "./guard.js";

const manual: Engagement = {
  id: "e",
  name: "e",
  authorizationConfirmed: true,
  authorizationReference: "AUTH-1",
  mode: "manual",
  allow: [{ id: "a", scheme: "https", host: "app.test", pathPrefix: "/api" }],
  deny: [],
  maxRequestsPerSecond: 2,
  maxParallelRequests: 2,
  allowHighRisk: false,
  allowDestructive: false
};

test("manual mode requires approval for active MCP calls", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "webcat-guard-"));
  const approvals = new ApprovalService(new EngagementStore(directory));
  const decision = await authorizeMcpCall(manual, DEFAULT_CONFIG, approvals, {
    server: "proxy",
    tool: { name: "send_request" },
    arguments: { url: "https://app.test/api/users" }
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /approval/);
});

test("observe mode blocks active MCP calls", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "webcat-observe-"));
  const approvals = new ApprovalService(new EngagementStore(directory));
  const decision = await authorizeMcpCall({ ...manual, mode: "observe", authorizationConfirmed: false }, DEFAULT_CONFIG, approvals, {
    server: "proxy",
    tool: { name: "send_request" },
    arguments: { url: "https://app.test/api/users" },
    operatorApproved: true
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /observe mode|authorization/);
});

test("filters out-of-scope MCP result records", () => {
  const result = filterMcpResultToScope([
    { url: "https://app.test/api/users", status: 200 },
    { url: "https://outside.test/private", status: 200 }
  ], manual) as any[];
  assert.equal(result.length, 1);
  assert.equal(result[0].status, 200);
});
