<template>
  <div class="engagements">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <div>
        <h2 class="page-title">Engagements</h2>
        <p class="page-subtitle">Manage penetration testing engagements</p>
      </div>
      <button class="btn btn-primary" @click="showCreate = true">+ New Engagement</button>
    </div>

    <!-- Engagement List -->
    <div v-if="engagements.length === 0" class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
      No engagements yet. Create one to begin testing.
    </div>

    <div v-for="eng in engagements" :key="eng.id" class="card">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <h3 style="margin-bottom: 4px;">{{ eng.name }}</h3>
          <div style="color: var(--text-secondary); font-size: 13px;">
            Owner: {{ eng.owner }} &middot;
            Intensity: {{ eng.testIntensity }} &middot;
            Status: <span :class="statusBadgeClass(eng.status)">{{ eng.status }}</span>
          </div>
          <div style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">
            Scope: {{ eng.scope?.allowed?.map((r: any) => r.value).join(', ') ?? 'None' }}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            {{ eng.testingPeriod?.start }} → {{ eng.testingPeriod?.end }}
          </div>
        </div>
      </div>
    </div>

    <!-- Create Engagement Modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <h3 style="margin-bottom: 16px;">New Engagement</h3>
        <form @submit.prevent="createEngagement">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <label>Engagement Name</label>
              <input v-model="form.name" required placeholder="e.g., Q3 WebApp Pentest" />
            </div>
            <div>
              <label>Owner</label>
              <input v-model="form.owner" required placeholder="Your name or team" />
            </div>
            <div class="grid grid-2">
              <div>
                <label>Start Date</label>
                <input v-model="form.start" type="datetime-local" required />
              </div>
              <div>
                <label>End Date</label>
                <input v-model="form.end" type="datetime-local" required />
              </div>
            </div>
            <div>
              <label>Test Intensity</label>
              <select v-model="form.intensity">
                <option value="passive">Passive — observe only</option>
                <option value="safe">Safe — read-only + safe requests</option>
                <option value="standard">Standard — including mutation testing</option>
                <option value="intrusive">Intrusive — including fuzzing</option>
              </select>
            </div>
            <div>
              <label>Allowed Hosts (one per line)</label>
              <textarea v-model="form.hosts" rows="3" placeholder="example.com&#10;api.example.com" required></textarea>
            </div>
            <div>
              <label>Denied Hosts (one per line)</label>
              <textarea v-model="form.deniedHosts" rows="2" placeholder="admin.example.com"></textarea>
            </div>
            <div>
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" v-model="form.authorized" style="width: auto;" />
                I affirm that I am authorized to test the specified targets
              </label>
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
              <button type="button" class="btn" @click="showCreate = false">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="!form.authorized || submitting">
                {{ submitting ? 'Creating...' : 'Create Engagement' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const engagements = ref<any[]>([]);
const showCreate = ref(false);
const submitting = ref(false);

const form = ref({
  name: '',
  owner: '',
  start: '',
  end: '',
  intensity: 'safe',
  hosts: '',
  deniedHosts: '',
  authorized: false,
});

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    draft: 'badge-status-pending',
    validated: 'badge-status-connected',
    in_progress: 'badge-status-connected',
    completed: 'badge-status-connected',
    cancelled: 'badge-status-disabled',
  };
  return map[status] ?? '';
}

async function loadEngagements() {
  try {
    const res = await fetch('/api/v1/engagements');
    const body = await res.json();
    engagements.value = body.data ?? [];
  } catch (err) {
    console.error('Failed to load engagements:', err);
  }
}

async function createEngagement() {
  if (!form.value.authorized) return;
  submitting.value = true;
  try {
    const res = await fetch('/api/v1/engagements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.value.name,
        owner: form.value.owner,
        authorizationAffirmation: true,
        testingPeriodStart: new Date(form.value.start).toISOString(),
        testingPeriodEnd: new Date(form.value.end).toISOString(),
        testIntensity: form.value.intensity,
        allowedHosts: form.value.hosts.split('\n').map(h => h.trim()).filter(Boolean),
        deniedHosts: form.value.deniedHosts.split('\n').map(h => h.trim()).filter(Boolean),
      }),
    });
    if (res.ok) {
      showCreate.value = false;
      form.value = { name: '', owner: '', start: '', end: '', intensity: 'safe', hosts: '', deniedHosts: '', authorized: false };
      await loadEngagements();
    }
  } catch (err) {
    console.error('Failed to create engagement:', err);
  } finally {
    submitting.value = false;
  }
}

onMounted(loadEngagements);
</script>
