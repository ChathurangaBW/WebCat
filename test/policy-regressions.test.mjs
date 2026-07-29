import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyTool, McpGuard } from "../src/mcp.mjs";
import { filterOutOfScope } from "../src/mcp-targets.mjs";
import { evaluateScope } from "../src/scope.mjs";
import { ApprovalStore } from "../src/approvals.mjs";
import { AuditLog } from "../src/audit.mjs";
import { EvidenceStore } from "../src/evidence.mjs";
import { redact, redactText } from "../src/redact.mjs";
import { loadEngagement, loadMcpConfig } from "../src/config.mjs";
import { assertKnownOptions, flag, tokenize } from "../src/cli-utils.mjs";

function engagement(overrides = {}) {
  return {
    id: "test", name: "test", authorizedBy: "QA", authorizationReference: "QA-1",
    startsAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString(),
    mode: "authorized-auto",
    allow: [{ id: "allow", hosts: ["app.example.test"], schemes: ["https"], paths: ["/**"], operations: ["passive", "active"] }],
    deny: [],
    rateLimit: { requestsPerMinute: 100000, maxParallel: 2 },
    riskPolicy: { allowHighRisk: false, allowDestructive: false },
    ...overrides
  };
}

// H1 -- allow rules must never widen authorization through a missing or malformed field.
test("malformed allow rules fail closed instead of matching everything", () => {
  const cases = [
    [{ id: "no-fields" }, "rule with no constraints"],
    [{ id: "empty-hosts", hosts: [] }, "empty hosts array"],
    [{ id: "string-hosts", hosts: "app.example.test" }, "hosts as a string"],
    [{ id: "null-hosts", hosts: null }, "null hosts"],
    [{ id: "non-string-hosts", hosts: [123] }, "non-string host entries"]
  ];
  for (const [rule, label] of cases) {
    const result = evaluateScope(engagement({ allow: [rule] }), "https://bank.example.com/transfer", "active");
    assert.equal(result.allowed, false, `${label} must not authorize an unrelated host`);
  }
});

test("well-formed allow rules still authorize in-scope targets", () => {
  assert.equal(evaluateScope(engagement(), "https://app.example.test/account", "active").allowed, true);
  // hosts-only rule: absent optional constraints stay permissive within the named host
  const hostsOnly = engagement({ allow: [{ id: "h", hosts: ["app.example.test"] }] });
  assert.equal(evaluateScope(hostsOnly, "https://app.example.test/anything", "active").allowed, true);
  assert.equal(evaluateScope(hostsOnly, "https://other.example.test/anything", "active").allowed, false);
});

test("malformed deny rules still deny", () => {
  const value = engagement({ deny: [{ id: "d", hosts: ["app.example.test"], paths: "oops" }] });
  assert.equal(evaluateScope(value, "https://app.example.test/x", "active").allowed, false);
});

test("engagement loading rejects a malformed allow rule", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-engagement-"));
  try {
    await mkdir(join(temp, ".webcat"), { recursive: true });
    const value = engagement({ allow: [{ id: "typo", hosts: "app.example.test" }] });
    await writeFile(join(temp, ".webcat", "engagement.json"), JSON.stringify(value));
    await assert.rejects(() => loadEngagement(temp), /malformed/i);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

// H2 -- an untrusted, server-supplied description must not be able to lower the risk class.
test("untrusted tool descriptions cannot downgrade risk", () => {
  assert.equal(classifyTool("srv", { name: "exec_command", description: "Runs a command; see scope and history" }, {}).risk, "destructive");
  assert.equal(classifyTool("srv", { name: "send_payload", description: "list history" }, {}).risk, "active");
  assert.equal(classifyTool("srv", { name: "set_project_options" }, {}).risk, "active");
  assert.equal(classifyTool("srv", { name: "get_remote_snapshot", description: "Fetches a URL" }, {}).risk, "passive");
  // description may still escalate
  assert.equal(classifyTool("srv", { name: "fetch_page", description: "runs a full port scan" }, {}).risk, "high");
});

test("genuinely passive read tools remain passive", () => {
  for (const name of ["list_requests", "get_proxy_history", "read_item", "describe_target"]) {
    assert.equal(classifyTool("srv", { name }, {}).risk, "passive", `${name} should stay passive`);
  }
});

test("guard refuses an untrusted tool that only looks passive", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-untrusted-"));
  try {
    let called = false;
    const manager = { config: { servers: { s: {} } }, call: async () => { called = true; return { ok: true }; } };
    const audit = new AuditLog(join(temp, "audit.jsonl"));
    const guard = new McpGuard({
      engagement: engagement({ mode: "observe" }), manager, audit,
      approvals: new ApprovalStore(join(temp, "approvals.json")),
      evidence: new EvidenceStore(join(temp, "evidence"))
    });
    await assert.rejects(
      () => guard.call("s", { name: "exec_command", description: "Runs a command; see scope and history" }, { cmd: "id" }),
      /capabilityMap/
    );
    assert.equal(called, false, "the transport must never be reached");
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("requireCapabilityMap refuses even unmapped passive tools", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-strict-"));
  try {
    const manager = { config: { servers: { s: { requireCapabilityMap: true } } }, call: async () => ({ ok: true }) };
    const guard = new McpGuard({
      engagement: engagement(), manager, audit: new AuditLog(join(temp, "audit.jsonl")),
      approvals: new ApprovalStore(join(temp, "approvals.json")), evidence: new EvidenceStore(join(temp, "evidence"))
    });
    await assert.rejects(() => guard.call("s", { name: "list_requests" }, {}), /capabilityMap/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

// H3 -- the configured request rate must hold when calls are issued concurrently.
test("rate limiting serializes concurrent calls", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-throttle-"));
  try {
    const manager = {
      config: { servers: { s: { capabilityMap: { ping: { capability: "http.execute", risk: "active", requiresTarget: true } } } } },
      call: async () => ({ ok: true })
    };
    const guard = new McpGuard({
      engagement: engagement({ rateLimit: { requestsPerMinute: 600, maxParallel: 5 } }),
      manager, audit: new AuditLog(join(temp, "audit.jsonl")),
      approvals: new ApprovalStore(join(temp, "approvals.json")), evidence: new EvidenceStore(join(temp, "evidence"))
    });
    const started = Date.now();
    await Promise.all([0, 1, 2, 3].map(() => guard.call("s", { name: "ping" }, { url: "https://app.example.test/x" })));
    // 600/min => 100ms spacing; four concurrent calls must span at least three intervals.
    assert.ok(Date.now() - started >= 280, `expected throttling to span intervals, took ${Date.now() - started}ms`);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

// M2 -- every deterministic refusal is recorded on the audit chain, not only scope failures.
test("all refusal classes are audited", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-refusals-"));
  try {
    const auditPath = join(temp, "audit.jsonl");
    const audit = new AuditLog(auditPath);
    const manager = {
      config: { servers: { s: { capabilityMap: {
        needs_target: { capability: "http.execute", risk: "active", requiresTarget: true },
        approved_only: { capability: "http.execute", risk: "active", requiresTarget: true }
      } } } },
      call: async () => ({ ok: true })
    };
    const base = { manager, audit, approvals: new ApprovalStore(join(temp, "approvals.json")), evidence: new EvidenceStore(join(temp, "evidence")) };

    await assert.rejects(() => new McpGuard({ ...base, engagement: engagement() })
      .call("s", { name: "unmapped_send" }, { url: "https://app.example.test/x" }));
    await assert.rejects(() => new McpGuard({ ...base, engagement: engagement() })
      .call("s", { name: "needs_target" }, {}));
    await assert.rejects(() => new McpGuard({ ...base, engagement: engagement() })
      .call("s", { name: "needs_target" }, { url: "https://outside.example/x" }));
    await assert.rejects(() => new McpGuard({ ...base, engagement: engagement({ mode: "manual" }) })
      .call("s", { name: "approved_only" }, { url: "https://app.example.test/x" }));

    const entries = (await readFile(auditPath, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
    const controls = new Set(entries.filter((item) => item.event === "mcp.blocked").map((item) => item.data.control));
    for (const expected of ["untrusted-tool", "missing-target", "scope", "approval"]) {
      assert.ok(controls.has(expected), `expected an audited '${expected}' refusal, saw ${[...controls].join(", ")}`);
    }
    assert.equal((await audit.verify()).valid, true, "audit chain must stay valid across refusals");
  } finally { await rm(temp, { recursive: true, force: true }); }
});

// M3 -- appends stay chained, verifiable, and survive a failed write.
test("audit appends are chained and a failure does not poison later appends", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-audit-chain-"));
  try {
    const audit = new AuditLog(join(temp, "audit.jsonl"));
    for (let index = 0; index < 25; index += 1) await audit.append("event", "tester", { index });
    const result = await audit.verify();
    assert.equal(result.valid, true);
    assert.equal(result.entries, 25);

    const broken = new AuditLog(join(temp, "missing", "\u0000bad", "audit.jsonl"));
    await assert.rejects(() => broken.append("event", "tester", {}));
    broken.path = join(temp, "recovered.jsonl");
    await broken.append("event", "tester", {});
    assert.equal((await broken.verify()).valid, true, "queue must recover after a failed append");
  } finally { await rm(temp, { recursive: true, force: true }); }
});

// M1 -- the approval target syntax documented in the README must actually match.
test("approval targets honour the documented glob syntax", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-approval-glob-"));
  try {
    const grant = async (target) => {
      const store = new ApprovalStore(join(temp, `${Math.random()}.json`));
      await store.grant({ risk: "active", server: "burp", tool: "send_http1_request", target, reason: "QA" });
      return store;
    };
    const probe = { risk: "active", server: "burp", tool: "send_http1_request", target: "https://app.example.test/account" };
    assert.equal(await (await grant("https://app.example.test/**")).permits(probe), true, "README '/**' form must match");
    assert.equal(await (await grant("https://app.example.test/*")).permits(probe), true);
    assert.equal(await (await grant("*")).permits(probe), true);
    assert.equal(await (await grant("https://app.example.test/**")).permits({ ...probe, target: "https://evil.test/account" }), false);
    assert.equal(await (await grant("https://app.example.test/*")).permits({ ...probe, target: "https://app.example.test/a/b" }), false, "single * must not cross a path segment");
    assert.equal(await (await grant("https://app.example.test/a")).permits({ ...probe, target: "https://app.example.test/b" }), false);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

// M4 -- secrets embedded in raw HTTP text must be redacted, not just object keys.
test("raw HTTP secrets are redacted while benign headers survive", () => {
  const raw = [
    "GET /a HTTP/1.1", "Host: app.example.test", "Cookie: session=abc123",
    "Authorization: Basic dXNlcjpwYXNzd29yZA==", "X-Api-Key: k12345", "User-Agent: Mozilla", "",
    '{"jwt":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.sIgNaTuRe"}'
  ].join("\r\n");
  const output = redactText(raw);
  for (const secret of ["abc123", "dXNlcjpwYXNzd29yZA==", "k12345", "sIgNaTuRe"]) {
    assert.equal(output.includes(secret), false, `${secret} must be redacted`);
  }
  assert.match(output, /Host: app\.example\.test/);
  assert.match(output, /User-Agent: Mozilla/);
  assert.equal(redactText("https://x.test/cb?access_token=SECRET123").includes("SECRET123"), false);
});

// M4 (follow-up) -- MCP servers return payloads as { content: [{ type: "text", text: "<json>" }] },
// so secrets arrive inside a JSON-encoded string where neither key-based redaction nor the raw
// header-line pattern can see them. Found during release QA against a live stdio MCP server.
test("secrets inside JSON-encoded MCP payloads are redacted", () => {
  const inner = JSON.stringify({ headers: { "set-cookie": "session=SUPERSECRET" }, body: "hello", status: 200 });
  const output = JSON.stringify(redact({ content: [{ type: "text", text: inner }] }));
  assert.equal(output.includes("SUPERSECRET"), false, "cookie inside a JSON string payload must be redacted");
  assert.ok(output.includes("hello"), "non-sensitive body must survive");
  assert.ok(output.includes("200"), "non-sensitive status must survive");

  // Both the plain and backslash-escaped encodings, terminating at the correct quote.
  assert.equal(redactText(`{"set-cookie":"session=SECRET","status":200}`).includes("SECRET"), false);
  assert.ok(redactText(`{"set-cookie":"session=SECRET","status":200}`).includes("200"));
  const escaped = redactText(String.raw`{\"set-cookie\":\"session=SUPERSECRET\",\"body\":\"hello\"}`);
  assert.equal(escaped.includes("SUPERSECRET"), false);
  assert.ok(escaped.includes("hello"), "redaction must stop at the value boundary");
  assert.equal(redactText(`{"authorization":"Basic dXNlcjpwYXNz"}`).includes("dXNlcjpwYXNz"), false);
  // Benign JSON must be left alone.
  assert.equal(redactText(`{"status":200,"content-type":"application/json"}`), `{"status":200,"content-type":"application/json"}`);
});

// M5 -- one out-of-scope URL must not delete the in-scope evidence around it.
test("out-of-scope filtering prunes precisely and reports removals", () => {
  const value = {
    items: [
      { url: "https://app.example.test/a", status: 200 },
      { url: "https://cdn.other.test/lib.js", status: 200 },
      { url: "https://app.example.test/b", status: 302 }
    ]
  };
  const filtered = filterOutOfScope(value, engagement());
  assert.equal(filtered.items.length, 2, "in-scope siblings must survive");
  assert.deepEqual(filtered.items.map((item) => item.url), ["https://app.example.test/a", "https://app.example.test/b"]);
  assert.equal(filtered.filteredOutOfScope, 1, "removals must be visible");

  const clean = filterOutOfScope({ items: [{ url: "https://app.example.test/a" }] }, engagement());
  assert.equal(clean.filteredOutOfScope, undefined, "no marker when nothing was removed");
  assert.deepEqual(filterOutOfScope({ status: 200, body: "text" }, engagement()), { status: 200, body: "text" });
});

// M6 / L1 -- CLI option parsing must not silently ignore operator intent.
test("CLI parses --opt=value and rejects unknown options", () => {
  assert.equal(flag(["scope-check", "https://x.test", "--operation=active"], "--operation"), "active");
  assert.equal(flag(["scope-check", "https://x.test", "--operation", "active"], "--operation"), "active");
  assert.throws(() => assertKnownOptions(["--oepration=active"], ["--operation"]), /Unknown option/);
  assert.doesNotThrow(() => assertKnownOptions(["--operation=active", "--json"], ["--operation"]));
});

test("TUI tokenizer preserves JSON arguments", () => {
  assert.deepEqual(tokenize(`mcp call burp t --args '{"a":1}'`), ["mcp", "call", "burp", "t", "--args", '{"a":1}']);
  assert.deepEqual(tokenize(`run --objective "review the app"`), ["run", "--objective", "review the app"]);
});

// L2 -- an unresolved ${VAR} must fail loudly at load time.
test("MCP configuration rejects an empty interpolated command", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-mcp-empty-"));
  try {
    await mkdir(join(temp, ".webcat"), { recursive: true });
    await writeFile(join(temp, ".webcat", "mcp.json"), JSON.stringify({
      schemaVersion: 1, servers: { x: { transport: "stdio", command: "${MISSING_VAR}", args: ["a"] } }
    }));
    await assert.rejects(
      () => loadMcpConfig(temp, { userPaths: { userConfig: "/nonexistent", userMcp: "/nonexistent" }, env: {} }),
      /non-empty command/
    );
  } finally { await rm(temp, { recursive: true, force: true }); }
});
