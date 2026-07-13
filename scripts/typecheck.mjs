const modules = [
  "../src/identity.mjs",
  "../src/paths.mjs",
  "../src/redact.mjs",
  "../src/logger.mjs",
  "../src/toml.mjs",
  "../src/config.mjs",
  "../src/scope.mjs",
  "../src/approvals.mjs",
  "../src/audit.mjs",
  "../src/evidence.mjs",
  "../src/burp.mjs",
  "../src/mcp-targets.mjs",
  "../src/mcp-transports.mjs",
  "../src/mcp.mjs",
  "../src/store.mjs",
  "../src/swarm.mjs",
  "../src/report.mjs",
  "../src/cli.mjs"
];
for (const module of modules) await import(module);
const contracts = [
  ["identity", (await import("../src/identity.mjs")).IDENTITY?.command === "webcat"],
  ["paths", typeof (await import("../src/paths.mjs")).userPaths === "function"],
  ["scope", typeof (await import("../src/scope.mjs")).evaluateScope === "function"],
  ["Burp presets", Array.isArray((await import("../src/burp.mjs")).listBurpPresets())],
  ["MCP", typeof (await import("../src/mcp.mjs")).McpManager === "function"],
  ["swarm", Array.isArray((await import("../src/swarm.mjs")).PROFILES)],
  ["CLI", typeof (await import("../src/cli.mjs")).main === "function"]
];
const failed = contracts.filter(([, valid]) => !valid);
if (failed.length) throw new Error(`Module contract check failed: ${failed.map(([name]) => name).join(", ")}`);
console.log(`Module contract check passed for ${modules.length} modules.`);
