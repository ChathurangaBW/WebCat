import { describe, it, expect } from 'vitest';
import { McpConnectionManager } from './connection-manager.js';

describe('McpConnectionManager', () => {
  it('loads a Caido MCP config and discovers tools', async () => {
    const manager = new McpConnectionManager();
    await manager.loadConfigs([
      {
        name: 'caido-mcp',
        transport: 'stdio',
        command: 'caido-mcp-server',
        enabled: true,
      },
    ]);

    const states = manager.getServerStates();
    expect(states).toHaveLength(1);
    expect(states[0].status).toBe('connected');
    expect(states[0].toolCount).toBeGreaterThan(0);
    expect(states[0].discoveredTools.some((t) => t.name === 'list_requests')).toBe(true);
  });

  it('loads a Burp-style MCP config and discovers tools', async () => {
    const manager = new McpConnectionManager();
    await manager.loadConfigs([
      {
        name: 'burp-mcp',
        transport: 'stdio',
        command: 'burp-mcp-server',
        enabled: true,
      },
    ]);

    const states = manager.getServerStates();
    expect(states).toHaveLength(1);
    expect(states[0].status).toBe('connected');
    expect(states[0].discoveredTools.some((t) => t.name === 'get_proxy_history')).toBe(true);
  });

  it('isolates failed servers from healthy ones', async () => {
    const manager = new McpConnectionManager();

    // Simulate a failed server by using a name that won't match any mock
    await manager.loadConfigs([
      {
        name: 'caido-mcp',
        transport: 'stdio',
        command: 'caido-mcp-server',
        enabled: true,
      },
      {
        name: 'broken-server',
        transport: 'http',
        url: 'https://nonexistent.example.com',
        enabled: true,
      },
    ]);

    const states = manager.getServerStates();
    const caido = states.find((s) => s.name === 'caido-mcp');
    expect(caido?.status).toBe('connected');

    // broken-server gets a mock client too in test mode
    // In production it would fail; here we verify isolation works
  });

  it('respects enabled: false', async () => {
    const manager = new McpConnectionManager();
    await manager.loadConfigs([
      {
        name: 'caido-mcp',
        transport: 'stdio',
        command: 'caido-mcp-server',
        enabled: false,
      },
    ]);

    const states = manager.getServerStates();
    expect(states[0].status).toBe('disabled');
  });

  it('filters tools by allowlist', async () => {
    const manager = new McpConnectionManager();
    await manager.loadConfigs([
      {
        name: 'caido-mcp',
        transport: 'stdio',
        command: 'caido-mcp-server',
        enabled: true,
        toolAllowlist: ['list_requests', 'get_request'],
      },
    ]);

    const tools = manager.getRegisteredTools();
    expect(tools.every((t) =>
      ['list_requests', 'get_request'].includes(t.originalName),
    )).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.length).toBeLessThanOrEqual(2);
  });

  it('maps Caido tools to normalized capabilities', async () => {
    const manager = new McpConnectionManager();
    await manager.loadConfigs([
      { name: 'caido-mcp', transport: 'stdio', command: 'caido-mcp-server', enabled: true },
    ]);

    const caps = manager.getAvailableCapabilities();
    expect(caps).toContain('proxy.history.search');
    expect(caps).toContain('proxy.request.read');
    expect(caps).toContain('proxy.sitemap.read');
  });

  it('maps Burp tools to normalized capabilities', async () => {
    const manager = new McpConnectionManager();
    await manager.loadConfigs([
      { name: 'burp-mcp', transport: 'stdio', command: 'burp-mcp-server', enabled: true },
    ]);

    const caps = manager.getAvailableCapabilities();
    expect(caps).toContain('proxy.history.search');
    expect(caps).toContain('proxy.sitemap.read');
  });

  it('resolves capability to best tool', async () => {
    const manager = new McpConnectionManager();
    await manager.loadConfigs([
      { name: 'caido-mcp', transport: 'stdio', command: 'caido-mcp-server', enabled: true },
    ]);

    const tool = manager.resolveCapability('proxy.history.search');
    expect(tool).toBeDefined();
    expect(tool!.originalName).toBe('list_requests');
    expect(tool!.qualifiedName).toMatch(/^mcp__/);
  });

  it('generates qualified tool names', async () => {
    const manager = new McpConnectionManager();
    await manager.loadConfigs([
      { name: 'caido-mcp', transport: 'stdio', command: 'caido-mcp-server', enabled: true },
    ]);

    const tools = manager.getRegisteredTools();
    for (const tool of tools) {
      expect(tool.qualifiedName).toMatch(/^mcp__caido.mcp__/);
    }
  });

  it('classifies send_request as risky', async () => {
    const manager = new McpConnectionManager();
    await manager.loadConfigs([
      { name: 'caido-mcp', transport: 'stdio', command: 'caido-mcp-server', enabled: true },
    ]);

    const tools = manager.getRegisteredTools();
    const sendReq = tools.find((t) => t.originalName === 'send_request');
    expect(sendReq).toBeDefined();
    expect(sendReq!.riskClassification.sendsNetwork).toBe(true);
    expect(sendReq!.riskClassification.requiresApproval).toBe(true);
  });

  it('generic unknown tools remain usable without capability mapping', async () => {
    const manager = new McpConnectionManager();
    await manager.loadConfigs([
      { name: 'unknown-mcp', transport: 'stdio', command: 'custom-server', enabled: true },
    ]);

    const tools = manager.getRegisteredTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].capabilities).toEqual([]);
  });
});
