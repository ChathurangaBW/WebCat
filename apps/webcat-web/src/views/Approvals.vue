<template>
  <div class="approvals">
    <h2 class="page-title">Approvals</h2>
    <p class="page-subtitle">Review and respond to agent action requests</p>

    <div v-if="approvals.length === 0" class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
      No pending approvals.
    </div>

    <div v-for="a in approvals" :key="a.id" class="card">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span class="badge badge-status-pending">{{ a.status }}</span>
            <strong>{{ a.toolName ?? a.tool }}</strong>
          </div>
          <div style="color: var(--text-secondary); font-size: 13px;">
            <div v-if="a.agentId">Requested by: {{ a.agentId }}</div>
            <div v-if="a.mcpServer">MCP Server: {{ a.mcpServer }}</div>
            <div v-if="a.target?.original">Target: <code>{{ a.target.original }}</code></div>
            <div v-if="a.riskClassification">
              Risk: 
              <span v-if="a.riskClassification.sendsNetwork" style="color: var(--accent-warning);">Network </span>
              <span v-if="a.riskClassification.writesData" style="color: var(--accent-warning);">Write </span>
              <span v-if="a.riskClassification.isDestructive" style="color: var(--accent-danger);">Destructive </span>
              <span v-if="a.riskClassification.executesCommands" style="color: var(--accent-danger);">Exec </span>
            </div>
            <div v-if="a.expectedEffect" style="margin-top: 4px; font-style: italic;">
              "{{ a.expectedEffect }}"
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; max-width: 320px; justify-content: flex-end;">
          <button class="btn btn-danger" @click="decide(a.id, 'deny')">Deny</button>
          <button class="btn" @click="decide(a.id, 'approve_once')">Approve Once</button>
          <button class="btn btn-success" @click="decide(a.id, 'approve_for_task')">Approve for Task</button>
          <button class="btn btn-primary" @click="decide(a.id, 'approve_for_session')">Approve for Session</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const approvals = ref<any[]>([]);

async function loadApprovals() {
  try {
    const res = await fetch('/api/v1/approvals');
    const body = await res.json();
    approvals.value = (body.data ?? []).filter((a: any) => a.status === 'pending');
  } catch (err) {
    console.error('Failed to load approvals:', err);
  }
}

async function decide(id: string, decision: string) {
  try {
    await fetch(`/api/v1/approvals/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    await loadApprovals();
  } catch (err) {
    console.error('Failed to submit decision:', err);
  }
}

onMounted(loadApprovals);
</script>
