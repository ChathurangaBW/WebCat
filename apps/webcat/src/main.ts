#!/usr/bin/env node
import { ScopeEngine, type Engagement } from "@webcat/core";
import { WEB_SECURITY_PROFILES } from "@webcat/agent-profiles";
import { resolveCapability } from "@webcat/mcp-gateway";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

const lockedEngagement: Engagement = {
  id: "unconfigured",
  name: "Unconfigured engagement",
  authorizationConfirmed: false,
  mode: "observe",
  allow: [],
  deny: [],
};

function printHelp(): void {
  console.log(`WebCat 0.1.0

Usage:
  webcat help
  webcat profiles
  webcat scope-check <url>
  webcat capability <mcp-tool-name>

Active operations are denied until an authorized engagement and explicit scope are loaded.`);
}

switch (command) {
  case "profiles":
    for (const profile of WEB_SECURITY_PROFILES) {
      console.log(`${profile.name}\t${profile.purpose}`);
    }
    break;
  case "scope-check": {
    const target = args[1];
    if (!target) throw new Error("scope-check requires an absolute URL");
    console.log(JSON.stringify(new ScopeEngine(lockedEngagement).evaluate(target, "active"), null, 2));
    break;
  }
  case "capability": {
    const toolName = args[1];
    if (!toolName) throw new Error("capability requires an MCP tool name");
    console.log(JSON.stringify(resolveCapability(toolName) ?? { trusted: false }, null, 2));
    break;
  }
  case "help":
  case "--help":
  case "-h":
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
}
