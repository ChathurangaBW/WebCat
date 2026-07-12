import {
  ApprovalService,
  ScopeEngine,
  extractHttpUrls,
  type AppConfig,
  type Engagement,
  type OperationKind
} from "@webcat/core";
import { resolveCapability } from "./capabilities.js";
import type { Capability, CapabilityOverride, McpTool } from "./types.js";

export interface McpCallRequest {
  server: string;
  tool: McpTool;
  arguments: Record<string, unknown>;
  operatorApproved?: boolean;
  customCapabilities?: Record<string, CapabilityOverride>;
}

export interface McpCallDecision {
  allowed: boolean;
  reason: string;
  capability?: Capability;
  targetUrls: string[];
  approvalId?: string;
}

export function findTargetUrls(value: unknown): string[] {
  return extractHttpUrls(value);
}

function operationFor(capability: Capability): OperationKind {
  return capability.risk === "read" ? "passive" : capability.risk;
}

export async function authorizeMcpCall(
  engagement: Engagement,
  config: AppConfig,
  approvals: ApprovalService,
  request: McpCallRequest
): Promise<McpCallDecision> {
  const capability = resolveCapability(request.tool.name, request.tool.annotations, request.customCapabilities);
  const targetUrls = findTargetUrls(request.arguments);
  if (!capability) return { allowed: false, reason: "MCP tool has no capability mapping", targetUrls };
  if (!capability.trusted && capability.risk !== "read") {
    return {
      allowed: false,
      reason: "untrusted active capability requires an explicit server capability mapping",
      capability,
      targetUrls
    };
  }
  if (capability.risk !== "read" && targetUrls.length === 0) {
    return {
      allowed: false,
      reason: "active MCP capability requires an absolute target URL in its arguments",
      capability,
      targetUrls
    };
  }

  const decisions = new ScopeEngine(engagement).evaluateMany(targetUrls, operationFor(capability));
  const blocked = decisions.find((decision) => !decision.allowed);
  if (blocked) return { allowed: false, reason: blocked.reason, capability, targetUrls };

  const activeNeedsApproval = capability.risk === "active" &&
    (engagement.mode === "manual" || config.security.requireApprovalForActive);
  const requiresApproval = activeNeedsApproval || capability.risk === "high" || capability.risk === "destructive";
  if (!requiresApproval) {
    return { allowed: true, reason: "MCP call passed capability and scope checks", capability, targetUrls };
  }

  if (request.operatorApproved) {
    return { allowed: true, reason: "operator supplied one-time approval", capability, targetUrls };
  }
  const approval = await approvals.findValid({
    risk: capability.risk,
    server: request.server,
    tool: request.tool.name,
    ...(targetUrls[0] ? { target: targetUrls[0] } : {})
  });
  if (!approval) {
    return {
      allowed: false,
      reason: `${capability.risk}-risk MCP capability requires operator approval`,
      capability,
      targetUrls
    };
  }
  return {
    allowed: true,
    reason: "MCP call passed scope and stored approval checks",
    capability,
    targetUrls,
    approvalId: approval.id
  };
}

export function filterMcpResultToScope(value: unknown, engagement: Engagement): unknown {
  const scope = new ScopeEngine(engagement);
  const filterString = (input: string): string => {
    let output = input;
    for (const url of extractHttpUrls(input)) {
      if (!scope.evaluate(url, "passive").allowed) output = output.split(url).join("[OUT_OF_SCOPE]");
    }
    return output;
  };

  const visit = (item: unknown): unknown => {
    if (typeof item === "string") return filterString(item);
    if (Array.isArray(item)) {
      return item.map(visit).filter((candidate) => candidate !== undefined);
    }
    if (!item || typeof item !== "object") return item;
    const urls = extractHttpUrls(item);
    if (urls.length && urls.every((url) => !scope.evaluate(url, "passive").allowed)) return undefined;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
      const filtered = visit(child);
      if (filtered !== undefined) output[key] = filtered;
    }
    return output;
  };

  return visit(value) ?? { filtered: true, reason: "MCP output contained only out-of-scope records" };
}
