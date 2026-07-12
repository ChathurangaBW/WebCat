import { ScopeEngine, type Engagement } from "@webcat/core";
import { resolveCapability, type CapabilityRisk } from "./capabilities.js";

export interface McpCallRequest {
  toolName: string;
  targetUrl?: string;
  approvalGranted?: boolean;
}

export interface McpCallDecision {
  allowed: boolean;
  reason: string;
  capability?: string;
  risk?: CapabilityRisk;
}

export function authorizeMcpCall(
  engagement: Engagement,
  request: McpCallRequest,
): McpCallDecision {
  const capability = resolveCapability(request.toolName);
  if (!capability) {
    return { allowed: false, reason: "MCP tool has no trusted capability mapping" };
  }

  if (capability.risk === "destructive") {
    return {
      allowed: false,
      reason: "destructive MCP capabilities are disabled by default",
      capability: capability.name,
      risk: capability.risk,
    };
  }

  if ((capability.risk === "active" || capability.risk === "high") && !request.targetUrl) {
    return {
      allowed: false,
      reason: "active MCP capability requires a target URL for scope evaluation",
      capability: capability.name,
      risk: capability.risk,
    };
  }

  if (capability.risk === "high" && !request.approvalGranted) {
    return {
      allowed: false,
      reason: "high-risk MCP capability requires explicit approval",
      capability: capability.name,
      risk: capability.risk,
    };
  }

  if (request.targetUrl) {
    const scope = new ScopeEngine(engagement).evaluate(
      request.targetUrl,
      capability.risk === "read" ? "passive" : "active",
    );
    if (!scope.allowed) {
      return {
        allowed: false,
        reason: scope.reason,
        capability: capability.name,
        risk: capability.risk,
      };
    }
  }

  return {
    allowed: true,
    reason: "MCP call passed capability, scope, and approval checks",
    capability: capability.name,
    risk: capability.risk,
  };
}
