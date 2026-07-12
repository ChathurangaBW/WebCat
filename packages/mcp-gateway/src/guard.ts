import { ApprovalService, ScopeEngine, type AppConfig, type Engagement, type OperationKind } from "@webcat/core";
import { resolveCapability } from "./capabilities.js";
import type { Capability, McpTool } from "./types.js";

export interface McpCallRequest {
  server: string;
  tool: McpTool;
  arguments: Record<string, unknown>;
  operatorApproved?: boolean;
}

export interface McpCallDecision {
  allowed: boolean;
  reason: string;
  capability?: Capability;
  targetUrls: string[];
  approvalId?: string;
}

export function findTargetUrls(value: unknown): string[] {
  const output = new Set<string>();
  const visit = (item: unknown, key = ""): void => {
    if (typeof item === "string") {
      const direct = item.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
      for (const url of direct) output.add(url.replace(/[),.;]+$/, ""));
      if (/url|target|endpoint|uri|location/i.test(key) && /^https?:\/\//i.test(item)) output.add(item);
      return;
    }
    if (Array.isArray(item)) { for (const child of item) visit(child, key); return; }
    if (item && typeof item === "object") for (const [childKey, child] of Object.entries(item as Record<string, unknown>)) visit(child, childKey);
  };
  visit(value);
  return [...output];
}

export async function authorizeMcpCall(
  engagement: Engagement,
  config: AppConfig,
  approvals: ApprovalService,
  request: McpCallRequest
): Promise<McpCallDecision> {
  const capability = resolveCapability(request.tool.name, request.tool.annotations);
  const targetUrls = findTargetUrls(request.arguments);
  if (!capability) return { allowed: false, reason: "MCP tool has no trusted capability mapping", targetUrls };
  if (!capability.trusted && capability.risk !== "read") return { allowed: false, reason: "untrusted active capability requires an explicit adapter mapping", capability, targetUrls };
  if (capability.risk !== "read" && targetUrls.length === 0) return { allowed: false, reason: "active MCP capability requires an absolute target URL in its arguments", capability, targetUrls };

  const operation: OperationKind = capability.risk === "read" ? "passive" : capability.risk;
  const decisions = new ScopeEngine(engagement).evaluateMany(targetUrls, operation);
  const blocked = decisions.find((decision) => !decision.allowed);
  if (blocked) return { allowed: false, reason: blocked.reason, capability, targetUrls };

  const requiresApproval = capability.risk === "high" || capability.risk === "destructive" || (capability.risk === "active" && config.security.requireApprovalForActive);
  if (requiresApproval) {
    if (request.operatorApproved) return { allowed: true, reason: "operator supplied one-time approval", capability, targetUrls };
    const approval = await approvals.findValid({
      risk: capability.risk,
      server: request.server,
      tool: request.tool.name,
      ...(targetUrls[0] ? { target: targetUrls[0] } : {})
    });
    if (!approval) return { allowed: false, reason: `${capability.risk}-risk MCP capability requires operator approval`, capability, targetUrls };
    return { allowed: true, reason: "MCP call passed scope and stored approval checks", capability, targetUrls, approvalId: approval.id };
  }

  return { allowed: true, reason: "MCP call passed capability and scope checks", capability, targetUrls };
}
