<template>
  <div class="settings">
    <h2 class="page-title">Settings</h2>
    <p class="page-subtitle">Configure WebCat server and agents</p>

    <div class="card" style="margin-top: 16px;">
      <div class="card-header">Model Providers</div>
      <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 12px;">
        Configure LLM providers for agent reasoning. API keys should be set via environment variables (WEBCAT_*).
      </p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
          <span style="width: 100px; font-size: 13px;">Provider</span>
          <span style="width: 180px; font-size: 13px;">API Key Env</span>
          <span style="width: 120px; font-size: 13px;">Default Model</span>
          <span style="font-size: 13px;">Status</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0;">
          <span style="width: 100px; font-size: 13px;">OpenAI</span>
          <code style="width: 180px; font-size: 12px;">WEBCAT_OPENAI_API_KEY</code>
          <span style="width: 120px; font-size: 12px; color: var(--text-muted);">gpt-4o</span>
          <span class="badge badge-status-connected">Ready</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0;">
          <span style="width: 100px; font-size: 13px;">Anthropic</span>
          <code style="width: 180px; font-size: 12px;">WEBCAT_ANTHROPIC_API_KEY</code>
          <span style="width: 120px; font-size: 12px; color: var(--text-muted);">claude-sonnet-4-20250514</span>
          <span class="badge badge-status-disabled">Not configured</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0;">
          <span style="width: 100px; font-size: 13px;">Local</span>
          <code style="width: 180px; font-size: 12px;">—</code>
          <span style="width: 120px; font-size: 12px; color: var(--text-muted);">ollama/mistral</span>
          <span class="badge badge-status-disabled">Not configured</span>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 16px;">
      <div class="card-header">Permission Profiles</div>
      <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 12px;">
        Control agent permissions and approval requirements.
      </p>
      <div style="display: flex; gap: 12px;">
        <select style="width: auto;">
          <option value="safe">Safe — require approval for all network actions</option>
          <option value="standard">Standard — auto-approve read-only within scope</option>
          <option value="permissive">Permissive — auto-approve read and write within scope</option>
        </select>
      </div>
    </div>

    <div class="card" style="margin-top: 16px;">
      <div class="card-header">Server</div>
      <div style="font-size: 13px; color: var(--text-secondary);">
        <div>WebCat Home: <code>~/.webcat</code></div>
        <div>Server Port: 3456</div>
        <div>Log Level: info</div>
      </div>
    </div>

    <div class="card" style="margin-top: 16px;">
      <div class="card-header">About WebCat</div>
      <div style="font-size: 13px; color: var(--text-secondary);">
        <p>Version: <strong>0.1.0</strong></p>
        <p>License: MIT</p>
        <p style="margin-top: 8px;">
          WebCat is a local-first, AI-assisted web-application penetration-testing platform.
          It combines an agent runtime with MCP-agnostic proxy integrations, a scope enforcement
          engine, and evidence-based reporting.
        </p>
        <p style="margin-top: 8px;">
          Built on architecture patterns from:<br/>
          · Kimi Code (<a href="https://github.com/MoonshotAI/kimi-code" style="color: var(--accent-primary);">github.com/MoonshotAI/kimi-code</a>) — MIT License<br/>
          · Caido MCP Server (<a href="https://github.com/c0tton-fluff/caido-mcp-server" style="color: var(--accent-primary);">github.com/c0tton-fluff/caido-mcp-server</a>) — MIT License
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
