import type { TrustLevel, RiskClassification } from '@webcat/shared';

// ── MCP Connection Configuration ──────────────────────────────────

export type McpTransport = 'stdio' | 'http' | 'sse';

export interface McpConnectionConfig {
  /** Unique name for this MCP server connection */
  name: string;
  /** Transport type */
  transport: McpTransport;
  /** For stdio: command to execute */
  command?: string;
  /** For stdio: command arguments */
  args?: string[];
  /** For http/sse: remote URL */
  url?: string;
  /** Working directory for stdio processes */
  workingDir?: string;
  /** Environment variables (references to secrets, not values) */
  env?: Record<string, string>;
  /** Static headers for HTTP connections */
  headers?: Record<string, string>;
  /** Bearer token environment variable reference */
  bearerTokenEnv?: string;
  /** OAuth configuration */
  oauth?: McpOAuthConfig;
  /** Startup timeout in milliseconds */
  startupTimeoutMs?: number;
  /** Tool call timeout in milliseconds */
  toolCallTimeoutMs?: number;
  /** Whether this connection is enabled */
  enabled?: boolean;
  /** Allowlist of tool names (if set, only these tools are exposed) */
  toolAllowlist?: string[];
  /** Blocklist of tool names (these tools are never exposed) */
  toolBlocklist?: string[];
  /** Trust level for this MCP server */
  trustLevel?: TrustLevel;
}

export interface McpOAuthConfig {
  /** OAuth authorization endpoint */
  authorizationUrl: string;
  /** OAuth token endpoint */
  tokenUrl: string;
  /** OAuth client ID */
  clientId: string;
  /** OAuth scopes */
  scopes?: string[];
  /** PKCE support */
  usePkce?: boolean;
}

// ── MCP Server Status ─────────────────────────────────────────────

export type McpServerStatus =
  | 'pending'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'disabled'
  | 'needs-auth';

export interface McpServerState {
  name: string;
  transport: McpTransport;
  status: McpServerStatus;
  trustLevel: TrustLevel;
  toolCount: number;
  resourceCount: number;
  error?: string;
  lastError?: string;
  lastConnectedAt?: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  authState: 'none' | 'static_token' | 'oauth' | 'oauth_refreshing';
  discoveredTools: McpToolDefinition[];
  discoveredResources: McpResourceDefinition[];
  discoveredPrompts: McpPromptDefinition[];
  capabilityMappings: CapabilityMapping[];
}

// ── MCP Tool Definitions ──────────────────────────────────────────

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Risk classification assigned during discovery */
  riskClassification: RiskClassification;
  /** Whether this tool is enabled */
  enabled: boolean;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

// ── Capability Normalization ──────────────────────────────────────

/**
 * Normalized capability identifiers that abstract vendor-specific tool names.
 */
export type NormalizedCapability = string;

export interface CapabilityMapping {
  /** The normalized capability */
  capability: NormalizedCapability;
  /** The MCP server that provides this capability */
  serverName: string;
  /** The specific MCP tool that maps to this capability */
  toolName: string;
  /** Confidence in this mapping (0-1) */
  confidence: number;
}

// ── Adapter Interface ─────────────────────────────────────────────

export interface McpAdapter {
  /** Unique adapter name */
  name: string;
  /** Patterns to match against MCP server/tool names for auto-detection */
  vendorPatterns: RegExp[];
  /** Map tool names to normalized capabilities */
  toolNameMapping: Record<string, NormalizedCapability[]>;
  /** Risk classification overrides for specific tools */
  riskOverrides: Record<string, Partial<RiskClassification>>;
  /** Optional input normalization for tool arguments */
  inputNormalizer?: (toolName: string, args: Record<string, unknown>) => Record<string, unknown>;
  /** Optional output normalization for tool results */
  outputNormalizer?: (toolName: string, result: unknown) => unknown;
  /** Optional health check */
  healthCheck?: (client: McpClient) => Promise<boolean>;
}

// ── MCP Client Interface ──────────────────────────────────────────

export interface McpClient {
  /** List tools advertised by the MCP server */
  listTools(): Promise<McpToolDefinition[]>;
  /** List resources */
  listResources(): Promise<McpResourceDefinition[]>;
  /** List prompts */
  listPrompts(): Promise<McpPromptDefinition[]>;
  /** Call a tool */
  callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<McpToolResult>;
  /** Close the connection */
  close(): Promise<void>;
}

export interface McpToolResult {
  content: McpContentBlock[];
  isError: boolean;
}

export interface McpContentBlock {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  [key: string]: unknown;
}

// ── Tool Registration (for agent runtime) ─────────────────────────

/**
 * Sanitized tool name: mcp__<server>__<tool>
 */
export type QualifiedMcpToolName = string;

export interface RegisteredMcpTool {
  qualifiedName: QualifiedMcpToolName;
  serverName: string;
  originalName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  capabilities: NormalizedCapability[];
  trustLevel: TrustLevel;
  riskClassification: RiskClassification;
  enabled: boolean;
}

// ── Adapter Registry ──────────────────────────────────────────────

export const KNOWN_ADAPTERS: McpAdapter[] = [
  {
    name: 'Caido',
    vendorPatterns: [/caido/i, /caido[-_]mcp/i],
    toolNameMapping: {
      'list_requests': ['proxy.history.search'],
      'get_request': ['proxy.request.read', 'proxy.response.read'],
      'diff_responses': ['proxy.response.diff'],
      'send_request': ['proxy.replay.send'],
      'batch_send': ['proxy.replay.batch'],
      'edit_request': ['proxy.replay.edit'],
      'create_replay_session': ['proxy.replay.session.create'],
      'list_replay_sessions': ['proxy.replay.session.read'],
      'delete_replay_sessions': ['proxy.replay.session.delete'],
      'get_session_cookies': ['proxy.cookies.read_metadata'],
      'clear_session_cookies': ['proxy.cookies.clear'],
      'get_sitemap': ['proxy.sitemap.read'],
      'list_scopes': ['proxy.scope.read'],
      'is_in_scope': ['proxy.scope.check'],
      'create_scope': ['proxy.scope.manage'],
      'delete_scope': ['proxy.scope.manage'],
      'list_projects': ['proxy.project.list'],
      'select_project': ['proxy.project.select'],
      'list_findings': ['proxy.finding.list'],
      'create_finding': ['proxy.finding.create'],
      'export_findings': ['proxy.finding.export'],
      'delete_findings': ['proxy.finding.delete'],
      'intercept_status': ['proxy.intercept.status'],
      'forward_intercept': ['proxy.intercept.forward'],
      'drop_intercept': ['proxy.intercept.drop'],
      'list_ws_streams': ['proxy.websocket.streams.read'],
      'list_ws_messages': ['proxy.websocket.messages.read'],
      'list_automate_sessions': ['proxy.fuzzer.list'],
      'get_automate_session': ['proxy.fuzzer.read'],
    },
    riskOverrides: {
      'send_request': { sendsNetwork: true, writesData: true, requiresApproval: true, maxRate: 60 },
      'batch_send': { sendsNetwork: true, writesData: true, requiresApproval: true, maxRate: 10 },
      'delete_findings': { deletesData: true, isDestructive: true, requiresApproval: true },
      'delete_scope': { deletesData: true, isDestructive: true, requiresApproval: true },
      'delete_replay_sessions': { deletesData: true, requiresApproval: true },
    },
  },
  {
    name: 'Burp Suite',
    vendorPatterns: [/burp/i, /burpsuite/i, /burp[-_]mcp/i],
    toolNameMapping: {
      'get_proxy_history': ['proxy.history.search'],
      'get_request': ['proxy.request.read', 'proxy.response.read'],
      'send_to_repeater': ['proxy.replay.send'],
      'send_to_intruder': ['proxy.fuzzer.start'],
      'get_sitemap': ['proxy.sitemap.read'],
      'get_issues': ['proxy.finding.list'],
      'get_scope': ['proxy.scope.read'],
      'is_in_scope': ['proxy.scope.check'],
      'set_scope': ['proxy.scope.manage'],
      'get_cookies': ['proxy.cookies.read_metadata'],
      'intercept_toggle': ['proxy.intercept.status'],
      'get_ws_history': ['proxy.websocket.messages.read'],
    },
    riskOverrides: {
      'send_to_repeater': { sendsNetwork: true, writesData: true, requiresApproval: true },
      'send_to_intruder': { sendsNetwork: true, writesData: true, requiresApproval: true, maxRate: 10 },
      'set_scope': { writesData: true, requiresApproval: true },
    },
  },
  {
    name: 'OWASP ZAP',
    vendorPatterns: [/zap/i, /owasp[-_]zap/i, /zap[-_]mcp/i],
    toolNameMapping: {
      'core_messages': ['proxy.history.search'],
      'core_message': ['proxy.request.read', 'proxy.response.read'],
      'core_sites': ['proxy.sitemap.read'],
      'core_alerts': ['proxy.finding.list'],
      'core_new_alert': ['proxy.finding.create'],
      'core_delete_alert': ['proxy.finding.delete'],
      'ascan_scan': ['proxy.fuzzer.start'],
      'ascan_status': ['proxy.fuzzer.read'],
      'ascan_stop': ['proxy.fuzzer.cancel'],
      'context_include_in_context': ['proxy.scope.manage'],
    },
    riskOverrides: {
      'ascan_scan': { sendsNetwork: true, writesData: true, requiresApproval: true, maxRate: 5 },
      'core_delete_alert': { deletesData: true, requiresApproval: true },
    },
  },
  {
    name: 'Browser',
    vendorPatterns: [/browser/i, /playwright/i, /puppeteer/i, /selenium/i],
    toolNameMapping: {
      'navigate': ['browser.navigate'],
      'screenshot': ['browser.screenshot'],
      'click': ['browser.navigate'],
      'type': ['browser.navigate'],
      'get_content': ['browser.dom.read'],
      'evaluate': ['browser.dom.read'],
      'get_console': ['browser.console.read'],
      'get_network_requests': ['browser.request.inspect'],
    },
    riskOverrides: {
      'navigate': { sendsNetwork: true, requiresApproval: true, maxRate: 30 },
      'click': { sendsNetwork: true, writesData: true, requiresApproval: true },
      'type': { sendsNetwork: true, writesData: true, requiresApproval: true },
      'evaluate': { executesCommands: true, requiresApproval: true },
    },
  },
  {
    name: 'Generic HTTP',
    vendorPatterns: [/http/i, /request/i, /replay/i],
    toolNameMapping: {
      'send_request': ['http.request.send'],
      'batch_request': ['http.request.batch'],
      'compare_response': ['http.response.compare'],
    },
    riskOverrides: {
      'send_request': { sendsNetwork: true, requiresApproval: true, maxRate: 60 },
      'batch_request': { sendsNetwork: true, requiresApproval: true, maxRate: 10 },
    },
  },
];
