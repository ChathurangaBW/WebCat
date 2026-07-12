import type { RiskClass } from "@webcat/core";

export interface CapabilityOverride {
  name: string;
  risk: RiskClass;
  trusted?: boolean;
}

export interface McpServerConfig {
  transport: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  timeoutMs?: number;
  startupTimeoutMs?: number;
  enabledTools?: string[];
  disabledTools?: string[];
  capabilities?: Record<string, CapabilityOverride>;
}

export interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  method?: string;
  params?: unknown;
}

export interface Capability {
  name: string;
  risk: RiskClass;
  trusted: boolean;
  source: "exact" | "custom" | "annotation" | "heuristic";
}

export interface McpServerStatus {
  name: string;
  transport: McpServerConfig["transport"];
  connected: boolean;
  toolCount: number;
  error?: string;
}
