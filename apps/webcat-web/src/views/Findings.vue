<template>
  <div class="findings">
    <h2 class="page-title">Findings</h2>
    <p class="page-subtitle">Security findings and evidence</p>

    <div style="display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap;">
      <select v-model="severityFilter" @change="loadFindings">
        <option value="">All Severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
        <option value="info">Info</option>
      </select>
      <select v-model="statusFilter" @change="loadFindings">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="under_review">Under Review</option>
        <option value="confirmed">Confirmed</option>
        <option value="remediated">Remediated</option>
        <option value="false_positive">False Positive</option>
      </select>
      <div style="flex: 1;"></div>
      <div style="color: var(--text-secondary); font-size: 13px; display: flex; align-items: center;">
        {{ findings.length }} finding(s)
      </div>
    </div>

    <div v-if="findings.length === 0" class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
      No findings yet.
    </div>

    <div v-for="f in findings" :key="f.id" class="card" style="cursor: pointer;" @click="selected = f">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span :class="'badge badge-severity-' + f.severity">{{ f.severity }}</span>
            <span class="badge badge-status-pending">{{ f.confidence }}</span>
            <span style="font-size: 13px; font-weight: 600;">{{ f.title }}</span>
          </div>
          <div style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">
            {{ f.description?.slice(0, 120) }}{{ f.description?.length > 120 ? '...' : '' }}
          </div>
          <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 12px; color: var(--text-muted);">
            <span v-if="f.cwe">{{ f.cwe }}</span>
            <span v-if="f.owasp">{{ f.owasp }}</span>
            <span v-if="f.affectedEndpoint">{{ f.affectedEndpoint }}</span>
            <span>Status: {{ f.status }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Finding Detail Modal -->
    <div v-if="selected" class="modal-overlay" @click.self="selected = null">
      <div class="modal" style="max-width: 700px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
          <h3>{{ selected.title }}</h3>
          <button class="btn" @click="selected = null">✕</button>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <span :class="'badge badge-severity-' + selected.severity">{{ selected.severity }}</span>
          <span class="badge badge-status-pending">{{ selected.confidence }}</span>
          <span class="badge badge-status-pending">{{ selected.status }}</span>
        </div>
        <div v-if="selected.cwe || selected.owasp" style="margin-bottom: 16px; font-size: 13px; color: var(--text-secondary);">
          {{ selected.cwe }}{{ selected.cwe && selected.owasp ? ' · ' : '' }}{{ selected.owasp }}
        </div>
        <div style="margin-bottom: 16px;">
          <h4 style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Description</h4>
          <p style="font-size: 14px;">{{ selected.description }}</p>
        </div>
        <div v-if="selected.affectedEndpoint" style="margin-bottom: 16px;">
          <h4 style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">Affected Endpoint</h4>
          <code style="font-size: 13px;">{{ selected.affectedEndpoint }}</code>
        </div>
        <div v-if="selected.remediation" style="margin-bottom: 16px;">
          <h4 style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">Remediation</h4>
          <p style="font-size: 14px;">{{ selected.remediation }}</p>
        </div>
        <div v-if="selected.evidenceIds?.length" style="margin-bottom: 16px;">
          <h4 style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">Evidence</h4>
          <span style="font-size: 12px; color: var(--text-muted);">{{ selected.evidenceIds.length }} evidence artifact(s)</span>
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
          Created: {{ new Date(selected.createdAt).toLocaleString() }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const findings = ref<any[]>([]);
const selected = ref<any>(null);
const severityFilter = ref('');
const statusFilter = ref('');

async function loadFindings() {
  try {
    const params = new URLSearchParams();
    if (severityFilter.value) params.set('severity', severityFilter.value);
    if (statusFilter.value) params.set('status', statusFilter.value);
    const res = await fetch(`/api/v1/findings?${params}`);
    const body = await res.json();
    findings.value = body.data ?? [];
  } catch (err) {
    console.error('Failed to load findings:', err);
  }
}

onMounted(loadFindings);
</script>
