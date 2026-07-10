import type { TrustLevel, RiskClassification } from '@webcat/shared';
import type {
  McpConnectionConfig,
  McpServerState,
  McpServerStatus,
  McpToolDefinition,
  McpResourceDefinition,
  McpPromptDefinition,
  McpAdapter,
  RegisteredMcpTool,
  CapabilityMapping,
  McpClient,
  McpTransport,
} from './types.js';
import { KNOWN_ADAPTERS } from './types.js';
import { qualifyMcpToolName, sanitizeMcpNamePart } from './naming.js';
import { classifyToolRisk } from './risk.js';

// ── Connection Manager ────────────────────────────────────────────

export type StatusListener = (state: McpServerState) => void;

export interface McpConnectionManagerOptions {
  /** Lookup environment variables by name */
  envLookup?: (name: string) => string | undefined;
  /** Default working directory for stdio processes */
  stdioCwd?: string;
  /** Default startup timeout */
  defaultStartupTimeoutMs?: number;
  /** Default tool call timeout */
  defaultToolCallTimeoutMs?: number;
  /** Custom adapter implementations to supplement known adapters */
  customAdapters?: McpAdapter[];
}

export class McpConnectionManager {
  private readonly servers = new Map<string, McpServerState>();
  private readonly listeners = new Set<StatusListener>();
  private readonly options: Required<McpConnectionManagerOptions>;
  private readonly adapters: McpAdapter[];
  private initialLoadComplete = false;

  constructor(options: McpConnectionManagerOptions = {}) {
    this.options = {
      envLookup: options.envLookup ?? ((name: string) => process.env[name]),
      stdioCwd: options.stdioCwd ?? process.cwd(),
      defaultStartupTimeoutMs: options.defaultStartupTimeoutMs ?? 30_000,
      defaultToolCallTimeoutMs: options.defaultToolCallTimeoutMs ?? 60_000,
      customAdapters: options.customAdapters ?? [],
    };
    this.adapters = [...KNOWN_ADAPTERS, ...this.options.customAdapters];
  }

  onStatusChange(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Load configurations for multiple MCP servers and connect them all.
   * Per-server failures are isolated.
   */
  async loadConfigs(configs: McpConnectionConfig[]): Promise<void> {
    const promises = configs.map((config) => this.connectServer(config).catch((err) => {
      this.updateServer(config.name, {
        status: 'failed',
        lastError: err instanceof Error ? err.message : String(err),
        healthStatus: 'unhealthy',
      });
    }));

    await Promise.allSettled(promises);
    this.initialLoadComplete = true;
  }

  /**
   * Connect a single MCP server by configuration.
   */
  async connectServer(config: McpConnectionConfig): Promise<McpServerState> {
    if (config.enabled === false) {
      const state = this.createInitialState(config, 'disabled');
      this.servers.set(config.name, state);
      this.notifyListeners(state);
      return state;
    }

    this.updateServer(config.name, { status: 'connecting' });

    try {
      // Simulated connection — in production, this would use the MCP SDK
      // to create a real stdio/HTTP/SSE client
      const client = await this.createClient(config);

      // Discover tools, resources, prompts
      const [tools, resources, prompts] = await Promise.all([
        this.safeCall(() => client.listTools(), []),
        this.safeCall(() => client.listResources(), []),
        this.safeCall(() => client.listPrompts(), []),
      ]);

      // Apply allowlist/blocklist
      const filteredTools = this.filterTools(tools, config);

      // Classify risk for each tool and mark as enabled
      const classifiedTools = filteredTools.map((t) => ({
        ...t,
        enabled: true,
        riskClassification: this.classifyTool(t, config),
      }));

      // Determine adapter and map capabilities
      const adapter = this.detectAdapter(config);
      const capabilityMappings = this.mapCapabilities(classifiedTools, config, adapter);

      const state: McpServerState = {
        name: config.name,
        transport: config.transport,
        status: 'connected',
        trustLevel: config.trustLevel ?? 'untrusted',
        toolCount: classifiedTools.length,
        resourceCount: resources.length,
        healthStatus: 'healthy',
        authState: config.oauth ? 'oauth' : config.bearerTokenEnv ? 'static_token' : 'none',
        discoveredTools: classifiedTools,
        discoveredResources: resources,
        discoveredPrompts: prompts,
        capabilityMappings,
        lastConnectedAt: new Date().toISOString(),
      };

      this.servers.set(config.name, state);
      this.notifyListeners(state);
      return state;
    } catch (err) {
      const state = this.createInitialState(config, 'failed');
      state.lastError = err instanceof Error ? err.message : String(err);
      state.healthStatus = 'unhealthy';
      this.servers.set(config.name, state);
      this.notifyListeners(state);
      return state;
    }
  }

  /**
   * Get all registered tools from all connected servers.
   */
  getRegisteredTools(): RegisteredMcpTool[] {
    const tools: RegisteredMcpTool[] = [];
    for (const [serverName, state] of this.servers) {
      if (state.status !== 'connected') continue;
      for (const tool of state.discoveredTools) {
        if (!tool.enabled) continue;
        const capabilities = state.capabilityMappings
          .filter((m) => m.toolName === tool.name)
          .map((m) => m.capability);
        tools.push({
          qualifiedName: qualifyMcpToolName(serverName, tool.name),
          serverName,
          originalName: tool.name,
          description: `[${serverName}] ${tool.description}`,
          inputSchema: tool.inputSchema,
          capabilities,
          trustLevel: state.trustLevel,
          riskClassification: tool.riskClassification,
          enabled: true,
        });
      }
    }
    return tools;
  }

  /**
   * Get all server states.
   */
  getServerStates(): McpServerState[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get a specific server state.
   */
  getServerState(name: string): McpServerState | undefined {
    return this.servers.get(name);
  }

  /**
   * Disconnect and remove a server.
   */
  async disconnectServer(name: string): Promise<void> {
    this.servers.delete(name);
    this.notifyListeners({
      name,
      transport: 'stdio',
      status: 'disabled',
      trustLevel: 'untrusted',
      toolCount: 0,
      resourceCount: 0,
      healthStatus: 'unhealthy',
      authState: 'none',
      discoveredTools: [],
      discoveredResources: [],
      discoveredPrompts: [],
      capabilityMappings: [],
    });
  }

  /**
   * Get capabilities provided by connected servers.
   */
  getAvailableCapabilities(): string[] {
    const caps = new Set<string>();
    for (const state of this.servers.values()) {
      for (const mapping of state.capabilityMappings) {
        caps.add(mapping.capability);
      }
    }
    return Array.from(caps);
  }

  /**
   * Check if a capability is available.
   */
  hasCapability(capability: string): boolean {
    for (const state of this.servers.values()) {
      if (state.status !== 'connected') continue;
      if (state.capabilityMappings.some((m) => m.capability === capability)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find the best tool for a given capability.
   */
  resolveCapability(capability: string): RegisteredMcpTool | undefined {
    const tools = this.getRegisteredTools();
    // Prefer tools with an explicit capability mapping
    const mapped = tools.filter((t) => t.capabilities.includes(capability));
    if (mapped.length > 0) {
      // Prefer higher trust level
      mapped.sort((a, b) => trustLevelRank(b.trustLevel) - trustLevelRank(a.trustLevel));
      return mapped[0];
    }
    return undefined;
  }

  // ── Private Helpers ────────────────────────────────────────────

  private createInitialState(config: McpConnectionConfig, status: McpServerStatus): McpServerState {
    return {
      name: config.name,
      transport: config.transport,
      status,
      trustLevel: config.trustLevel ?? 'untrusted',
      toolCount: 0,
      resourceCount: 0,
      healthStatus: status === 'connected' ? 'healthy' : 'unhealthy',
      authState: config.oauth ? 'oauth' : config.bearerTokenEnv ? 'static_token' : 'none',
      discoveredTools: [],
      discoveredResources: [],
      discoveredPrompts: [],
      capabilityMappings: [],
    };
  }

  private updateServer(name: string, partial: Partial<McpServerState>): void {
    const existing = this.servers.get(name);
    if (existing) {
      Object.assign(existing, partial);
      this.notifyListeners(existing);
    }
  }

  private notifyListeners(state: McpServerState): void {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // Listener errors must not break the manager
      }
    }
  }

  private async createClient(config: McpConnectionConfig): Promise<McpClient> {
    // In production, this creates real MCP SDK clients.
    // For now, return a mock client that simulates discovery.
    return createMockMcpClient(config);
  }

  private filterTools(tools: McpToolDefinition[], config: McpConnectionConfig): McpToolDefinition[] {
    let filtered = tools;

    if (config.toolAllowlist && config.toolAllowlist.length > 0) {
      filtered = filtered.filter((t) => config.toolAllowlist!.includes(t.name));
    }

    if (config.toolBlocklist && config.toolBlocklist.length > 0) {
      filtered = filtered.filter((t) => !config.toolBlocklist!.includes(t.name));
    }

    return filtered;
  }

  private classifyTool(tool: McpToolDefinition, config: McpConnectionConfig): RiskClassification {
    const adapter = this.detectAdapter(config);
    const overrides = adapter?.riskOverrides[tool.name] ?? {};
    return classifyToolRisk(tool, overrides);
  }

  private detectAdapter(config: McpConnectionConfig): McpAdapter | undefined {
    const searchStr = `${config.name} ${config.command ?? ''} ${config.url ?? ''}`;
    return this.adapters.find((a) => a.vendorPatterns.some((p) => p.test(searchStr)));
  }

  private mapCapabilities(
    tools: McpToolDefinition[],
    config: McpConnectionConfig,
    adapter?: McpAdapter,
  ): CapabilityMapping[] {
    const mappings: CapabilityMapping[] = [];

    for (const tool of tools) {
      if (adapter?.toolNameMapping[tool.name]) {
        for (const cap of adapter.toolNameMapping[tool.name]) {
          mappings.push({
            capability: cap,
            serverName: config.name,
            toolName: tool.name,
            confidence: 1.0,
          });
        }
      }
      // Allow unknown tools without mappings — they remain usable as generic MCP tools
    }

    return mappings;
  }

  private async safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }
}

// ── Trust Level Ranking ───────────────────────────────────────────

function trustLevelRank(level: TrustLevel): number {
  switch (level) {
    case 'system': return 4;
    case 'trusted': return 3;
    case 'reviewed': return 2;
    case 'untrusted': return 1;
    default: return 0;
  }
}

// ── Mock MCP Client Factory ───────────────────────────────────────

function createMockMcpClient(config: McpConnectionConfig): McpClient {
  // Map of mock tool sets by vendor detection
  const nameLower = config.name.toLowerCase();
  const isCaido = /caido/i.test(nameLower);
  const isBurp = /burp/i.test(nameLower);
  const isBrowser = /browser|playwright|puppeteer/i.test(nameLower);

  let tools: McpToolDefinition[];
  if (isCaido) {
    tools = createCaidoMockTools();
  } else if (isBurp) {
    tools = createBurpMockTools();
  } else if (isBrowser) {
    tools = createBrowserMockTools();
  } else {
    tools = createGenericMockTools(config.name);
  }

  return {
    async listTools() { return tools; },
    async listResources() { return []; },
    async listPrompts() { return []; },
    async callTool(_name: string, _args: Record<string, unknown>) {
      return { content: [{ type: 'text', text: `Mock result from ${config.name}` }], isError: false };
    },
    async close() {},
  };
}

function createCaidoMockTools(): McpToolDefinition[] {
  return [
    { name: 'list_requests', description: 'List HTTP request/response pairs from proxy history', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, filter: { type: 'string' } } } },
    { name: 'get_request', description: 'Get full request and response for a specific ID', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'diff_responses', description: 'Diff two responses', inputSchema: { type: 'object', properties: { id1: { type: 'string' }, id2: { type: 'string' } }, required: ['id1', 'id2'] } },
    { name: 'send_request', description: 'Send a single HTTP request', inputSchema: { type: 'object', properties: { request: { type: 'string' } }, required: ['request'] } },
    { name: 'get_sitemap', description: 'Get the sitemap tree', inputSchema: { type: 'object', properties: {} } },
    { name: 'list_projects', description: 'List Caido projects', inputSchema: { type: 'object', properties: {} } },
    { name: 'list_findings', description: 'List findings', inputSchema: { type: 'object', properties: {} } },
    { name: 'create_finding', description: 'Create a finding', inputSchema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, severity: { type: 'string' } }, required: ['title', 'description'] } },
    { name: 'list_scopes', description: 'List scope rules', inputSchema: { type: 'object', properties: {} } },
    { name: 'is_in_scope', description: 'Check if URL is in scope', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  ];
}

function createBurpMockTools(): McpToolDefinition[] {
  return [
    { name: 'get_proxy_history', description: 'Get Burp proxy HTTP history', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, host: { type: 'string' } } } },
    { name: 'send_to_repeater', description: 'Send request to Repeater', inputSchema: { type: 'object', properties: { request: { type: 'string' } }, required: ['request'] } },
    { name: 'get_sitemap', description: 'Get target sitemap', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_issues', description: 'Get scanner issues', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_scope', description: 'Get configured scope', inputSchema: { type: 'object', properties: {} } },
    { name: 'is_in_scope', description: 'Check if URL is in scope', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  ];
}

function createBrowserMockTools(): McpToolDefinition[] {
  return [
    { name: 'navigate', description: 'Navigate to a URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
    { name: 'screenshot', description: 'Take a screenshot', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_content', description: 'Get page content', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_console', description: 'Get browser console output', inputSchema: { type: 'object', properties: {} } },
  ];
}

function createGenericMockTools(_serverName: string): McpToolDefinition[] {
  return [
    { name: 'example_tool', description: 'An example MCP tool', inputSchema: { type: 'object', properties: { input: { type: 'string' } } } },
  ];
}
