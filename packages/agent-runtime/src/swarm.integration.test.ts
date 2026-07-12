import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { DEFAULT_CONFIG, EngagementStore, type Engagement } from "@webcat/core";
import { McpManager } from "@webcat/mcp-gateway";
import { SwarmOrchestrator } from "./swarm.js";

function assistant(content: string, toolCalls: unknown[] = []): unknown {
  return { choices: [{ message: { role: "assistant", content, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) } }] };
}

function toolCall(id: string, name: string, args: Record<string, unknown>): unknown {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

test("swarm creates, validates, and reports a candidate finding", async () => {
  const server = http.createServer((request: any, response: any) => {
    let body = "";
    request.on("data", (chunk: string) => { body += chunk; });
    request.on("end", () => {
      const input = JSON.parse(body);
      const system = String(input.messages?.[0]?.content ?? "");
      const toolMessages = input.messages.filter((message: any) => message.role === "tool");
      let payload: unknown;
      if (system.includes("Compare authorized and unauthorized identities")) {
        if (toolMessages.length === 0) {
          payload = assistant("", [toolCall("obs", "webcat_record_observation", {
            summary: "Cross-account response difference",
            data: { control: 403, test: 200 }
          })]);
        } else if (toolMessages.length === 1) {
          const evidence = JSON.parse(toolMessages[0].content);
          payload = assistant("", [toolCall("finding", "webcat_submit_candidate_finding", {
            title: "Object authorization bypass",
            severity: "medium",
            description: "A controlled identity comparison returned another account object.",
            impact: "An authenticated user could read another account record.",
            remediation: "Enforce object ownership on the server.",
            target: "https://app.test/api/users/2",
            evidenceIds: [evidence.id],
            hypothesisIds: []
          })]);
        } else {
          payload = assistant("Access-control lane complete.");
        }
      } else if (system.includes("Require reproduction")) {
        const user = String(input.messages?.[1]?.content ?? "");
        const id = user.match(/"id":"(find_[^"]+)"/)?.[1] ?? "missing";
        payload = assistant("", [toolCall("validate", "webcat_set_finding_status", {
          findingId: id,
          status: "validated",
          validationNotes: "Independent control and reproduction confirmed the authorization difference.",
          evidenceIds: []
        })]);
        if (toolMessages.length) payload = assistant("Candidate validation complete.");
      } else {
        payload = assistant("Lane complete with no additional candidates.");
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "webcat-swarm-"));
  const config = structuredClone(DEFAULT_CONFIG);
  config.provider.baseUrl = `http://127.0.0.1:${port}/v1`;
  config.provider.model = "mock-model";
  config.provider.apiKeyRequired = false;
  config.swarm.maxConcurrency = 2;
  config.swarm.maxAgentTurns = 5;
  const engagement: Engagement = {
    id: "e",
    name: "Authorized test",
    authorizationConfirmed: true,
    authorizationReference: "AUTH-1",
    mode: "manual",
    allow: [{ id: "primary", scheme: "https", host: "app.test", pathPrefix: "/api" }],
    deny: [],
    maxRequestsPerSecond: 2,
    maxParallelRequests: 2,
    allowHighRisk: false,
    allowDestructive: false
  };
  const store = new EngagementStore(directory);
  const manager = new McpManager({ servers: {} }, config, engagement, store);
  try {
    const result = await new SwarmOrchestrator(config, engagement, manager, store).run("Assess object access control");
    assert.equal(result.session.state, "COMPLETED");
    assert.equal(result.reportPaths.length, 2);
    const findings = await store.listFindings();
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.status, "validated");
  } finally {
    await manager.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
