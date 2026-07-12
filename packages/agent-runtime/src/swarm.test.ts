import test from "node:test";
import assert from "node:assert/strict";
import { SwarmOrchestrator } from "./swarm.js";
import type { Engagement } from "@webcat/core";

const engagement: Engagement = { id: "e", name: "e", authorizationConfirmed: true, authorizationReference: "A", mode: "manual", allow: [], deny: [], maxRequestsPerSecond: 1, maxParallelRequests: 1, allowHighRisk: false, allowDestructive: false };
test("selects specialized lanes from objective", () => {
  const orchestrator = new SwarmOrchestrator({} as any, engagement, {} as any, {} as any);
  const names = orchestrator.selectProfiles("Assess login sessions, tenant authorization, and business workflow races").map((profile) => profile.name);
  assert.ok(names.includes("auth-session-analyst"));
  assert.ok(names.includes("access-control-analyst"));
  assert.ok(names.includes("business-logic-analyst"));
});
