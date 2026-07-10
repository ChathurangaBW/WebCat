<template>
  <div class="dashboard">
    <h2 class="page-title">Dashboard</h2>
    <p class="page-subtitle">WebCat penetration testing platform</p>

    <div class="grid grid-3" style="margin-top: 24px;">
      <div class="card">
        <div class="card-header">Active Engagements</div>
        <div style="font-size: 32px; font-weight: 700; color: var(--accent-primary);">{{ engagementCount }}</div>
      </div>
      <div class="card">
        <div class="card-header">Total Findings</div>
        <div style="font-size: 32px; font-weight: 700; color: var(--accent-warning);">{{ findingCount }}</div>
      </div>
      <div class="card">
        <div class="card-header">Connected MCP Servers</div>
        <div style="font-size: 32px; font-weight: 700; color: var(--accent-success);">{{ mcpCount }}</div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top: 24px;">
      <div class="card">
        <div class="card-header">Pending Approvals</div>
        <div v-if="pendingApprovals.length === 0" style="color: var(--text-muted);">No pending approvals</div>
        <div v-for="a in pendingApprovals" :key="a.id" style="padding: 8px 0; border-bottom: 1px solid var(--border-color);">
          <strong>{{ a.tool }}</strong> — {{ a.description }}
        </div>
      </div>
      <div class="card">
        <div class="card-header">Recent Audit Events</div>
        <div v-if="auditEvents.length === 0" style="color: var(--text-muted);">No audit events yet</div>
        <div v-for="e in auditEvents.slice(0, 5)" :key="e.id" style="padding: 6px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
          <span style="color: var(--text-secondary);">{{ e.time }}</span> — {{ e.action }}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <div class="card-header">Quick Actions</div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <router-link to="/engagements" class="btn btn-primary">New Engagement</router-link>
        <router-link to="/mcp" class="btn">Manage MCP Connections</router-link>
        <router-link to="/findings" class="btn">View Findings</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const engagementCount = ref(0);
const findingCount = ref(0);
const mcpCount = ref(0);
const pendingApprovals = ref<any[]>([]);
const auditEvents = ref<any[]>([]);

onMounted(async () => {
  try {
    const [eng, find, mcp, audit] = await Promise.all([
      fetch('/api/v1/engagements').then(r => r.json()),
      fetch('/api/v1/findings').then(r => r.json()),
      fetch('/api/v1/mcp/connections').then(r => r.json()),
      fetch('/api/v1/audit').then(r => r.json()),
    ]);
    engagementCount.value = eng.data?.length ?? 0;
    findingCount.value = find.data?.length ?? 0;
    mcpCount.value = mcp.data?.length ?? 0;
    auditEvents.value = (audit.data ?? []).map((e: any) => ({
      id: e.id,
      action: e.action,
      time: new Date(e.startTime).toLocaleTimeString(),
    }));
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
});
</script>
