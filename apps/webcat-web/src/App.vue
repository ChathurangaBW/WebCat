<template>
  <div class="app">
    <nav class="sidebar">
      <div class="sidebar-header">
        <h1 class="logo">
          <span class="logo-icon">🐱</span>
          <span class="logo-text">WebCat</span>
        </h1>
      </div>
      <ul class="nav-links">
        <li>
          <router-link to="/" class="nav-link" active-class="active" exact>
            <span class="nav-icon">📊</span> Dashboard
          </router-link>
        </li>
        <li>
          <router-link to="/engagements" class="nav-link" active-class="active">
            <span class="nav-icon">🎯</span> Engagements
          </router-link>
        </li>
        <li>
          <router-link to="/mcp" class="nav-link" active-class="active">
            <span class="nav-icon">🔌</span> MCP Connections
          </router-link>
        </li>
        <li>
          <router-link to="/findings" class="nav-link" active-class="active">
            <span class="nav-icon">🔍</span> Findings
          </router-link>
        </li>
        <li>
          <router-link to="/approvals" class="nav-link" active-class="active">
            <span class="nav-icon">✅</span> Approvals
          </router-link>
        </li>
        <li>
          <router-link to="/settings" class="nav-link" active-class="active">
            <span class="nav-icon">⚙️</span> Settings
          </router-link>
        </li>
      </ul>
      <div class="sidebar-footer">
        <span class="version">v0.1.0</span>
      </div>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
</script>

<style>
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --border-color: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;
  --accent-primary: #58a6ff;
  --accent-success: #3fb950;
  --accent-warning: #d29922;
  --accent-danger: #f85149;
  --accent-purple: #a371f7;
  --sidebar-width: 240px;
  --header-height: 0px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
}

.app {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: var(--sidebar-width);
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  overflow-y: auto;
}

.sidebar-header {
  padding: 20px 16px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-primary);
}

.logo-icon { font-size: 24px; }

.nav-links {
  list-style: none;
  padding: 12px 0;
  flex: 1;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  transition: background-color 0.15s, color 0.15s;
  border-left: 2px solid transparent;
}

.nav-link:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-link.active {
  color: var(--accent-primary);
  background-color: rgba(88, 166, 255, 0.08);
  border-left-color: var(--accent-primary);
}

.nav-icon { font-size: 16px; width: 20px; text-align: center; }

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-muted);
}

.main-content {
  margin-left: var(--sidebar-width);
  flex: 1;
  padding: 24px 32px;
  max-width: calc(100vw - var(--sidebar-width));
  overflow-x: hidden;
}

/* Shared components */
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-header {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.btn:hover {
  background: var(--border-color);
}

.btn-primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}

.btn-primary:hover {
  background: #4090e0;
}

.btn-danger {
  background: var(--accent-danger);
  border-color: var(--accent-danger);
  color: #fff;
}

.btn-success {
  background: var(--accent-success);
  border-color: var(--accent-success);
  color: #fff;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.badge-severity-critical { background: #7b1fa2; color: #fff; }
.badge-severity-high { background: var(--accent-danger); color: #fff; }
.badge-severity-medium { background: var(--accent-warning); color: #000; }
.badge-severity-low { background: var(--accent-success); color: #000; }
.badge-severity-info { background: var(--accent-primary); color: #000; }

.badge-status-connected { background: rgba(63, 185, 80, 0.15); color: var(--accent-success); }
.badge-status-failed { background: rgba(248, 81, 73, 0.15); color: var(--accent-danger); }
.badge-status-disabled { background: rgba(110, 118, 129, 0.15); color: var(--text-muted); }
.badge-status-pending { background: rgba(210, 153, 34, 0.15); color: var(--accent-warning); }

.grid { display: grid; gap: 16px; }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }

@media (max-width: 1024px) {
  .grid-3 { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  .sidebar { display: none; }
  .main-content { margin-left: 0; max-width: 100vw; }
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
}

th {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

tr:hover td {
  background: rgba(88, 166, 255, 0.03);
}

input, select, textarea {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  padding: 8px 12px;
  font-size: 13px;
  width: 100%;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
}

label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  min-width: 480px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}
</style>
