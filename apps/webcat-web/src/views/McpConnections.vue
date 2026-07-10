<template>
  <div class="mcp-connections">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <div>
        <h2 class="page-title">MCP Connections</h2>
        <p class="page-subtitle">Manage MCP server integrations</p>
      </div>
      <button class="btn btn-primary" @click="showAdd = true">+ Add Connection</button>
    </div>

    <div v-if="connections.length === 0" class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
      <p>No MCP connections configured.</p>
      <p style="margin-top: 8px;">Connect a Caido, Burp Suite, ZAP, or generic MCP server to get started.</p>
    </div>

    <div v-for="conn in connections" :key="conn.name" class="card">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <h3>{{ conn.name }}</h3>
            <span :class="statusClass(conn.status)">{{ conn.status }}</span>
            <span class="badge" :class="trustClass(conn.trustLevel)">{{ conn.trustLevel }}</span>
          </div>
          <div style="color: var(--text-secondary); font-size: 13px;">
            {{ conn.transport }} &middot; {{ conn.toolCount }} tools &middot; {{ conn.resourceCount }} resources
          </div>
          <div v-if="conn.capabilityMappings?.length" style="margin-top: 8px;">
            <span v-for="cap in conn.capabilityMappings.slice(0, 5)" :key="cap.capability"
                  style="background: var(--bg-tertiary); padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px;">
              {{ cap.capability }}
            </span>
            <span v-if="conn.capabilityMappings.length > 5" style="font-size: 11px; color: var(--text-muted);">
              +{{ conn.capabilityMappings.length - 5 }} more
            </span>
          </div>
          <div v-if="conn.lastError" style="color: var(--accent-danger); font-size: 12px; margin-top: 4px;">
            Error: {{ conn.lastError }}
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn" @click="testConnection(conn.name)">Test</button>
        </div>
      </div>
    </div>

    <!-- Add Connection Modal -->
    <div v-if="showAdd" class="modal-overlay" @click.self="showAdd = false">
      <div class="modal">
        <h3 style="margin-bottom: 16px;">Add MCP Connection</h3>
        <form @submit.prevent="addConnection">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <label>Connection Name</label>
              <input v-model="addForm.name" required placeholder="e.g., caido-mcp, burp-suite" />
            </div>
            <div>
              <label>Transport</label>
              <select v-model="addForm.transport">
                <option value="stdio">stdio (local process)</option>
                <option value="http">HTTP (remote server)</option>
                <option value="sse">SSE (Server-Sent Events)</option>
              </select>
            </div>
            <div v-if="addForm.transport === 'stdio'">
              <label>Command</label>
              <input v-model="addForm.command" placeholder="caido-mcp-server" />
            </div>
            <div v-if="addForm.transport !== 'stdio'">
              <label>URL</label>
              <input v-model="addForm.url" placeholder="https://mcp.example.com" />
            </div>
            <div class="grid grid-2">
              <div>
                <label>Trust Level</label>
                <select v-model="addForm.trustLevel">
                  <option value="untrusted">Untrusted — all actions require approval</option>
                  <option value="reviewed">Reviewed — read-only auto-approved</option>
                  <option value="trusted">Trusted — in-scope auto-approved</option>
                </select>
              </div>
              <div>
                <label>Bearer Token Env</label>
                <input v-model="addForm.bearerTokenEnv" placeholder="MCP_TOKEN" />
              </div>
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
              <button type="button" class="btn" @click="showAdd = false">Cancel</button>
              <button type="submit" class="btn btn-primary">Add Connection</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const connections = ref<any[]>([]);
const showAdd = ref(false);
const addForm = ref({
  name: '',
  transport: 'stdio' as string,
  command: '',
  url: '',
  trustLevel: 'untrusted',
  bearerTokenEnv: '',
});

function statusClass(status: string) {
  const map: Record<string, string> = {
    connected: 'badge-status-connected',
    failed: 'badge-status-failed',
    disabled: 'badge-status-disabled',
    pending: 'badge-status-pending',
    connecting: 'badge-status-pending',
    'needs-auth': 'badge-status-pending',
  };
  return `badge ${map[status] ?? 'badge-status-disabled'}`;
}

function trustClass(level: string) {
  const map: Record<string, string> = {
    system: 'badge-severity-info',
    trusted: 'badge-severity-low',
    reviewed: 'badge-severity-medium',
    untrusted: 'badge-severity-high',
  };
  return map[level] ?? '';
}

async function loadConnections() {
  try {
    const res = await fetch('/api/v1/mcp/connections');
    const body = await res.json();
    connections.value = body.data ?? [];
  } catch (err) {
    console.error('Failed to load MCP connections:', err);
  }
}

async function addConnection() {
  try {
    const payload: any = {
      name: addForm.value.name,
      transport: addForm.value.transport,
      trustLevel: addForm.value.trustLevel,
      enabled: true,
    };
    if (addForm.value.transport === 'stdio') {
      payload.command = addForm.value.command;
    } else {
      payload.url = addForm.value.url;
    }
    if (addForm.value.bearerTokenEnv) {
      payload.bearerTokenEnv = addForm.value.bearerTokenEnv;
    }
    const res = await fetch('/api/v1/mcp/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showAdd.value = false;
      addForm.value = { name: '', transport: 'stdio', command: '', url: '', trustLevel: 'untrusted', bearerTokenEnv: '' };
      await loadConnections();
    }
  } catch (err) {
    console.error('Failed to add connection:', err);
  }
}

async function testConnection(name: string) {
  try {
    await fetch(`/api/v1/mcp/connections/${encodeURIComponent(name)}/test`, { method: 'POST' });
    await loadConnections();
  } catch (err) {
    console.error('Failed to test connection:', err);
  }
}

onMounted(loadConnections);
</script>
