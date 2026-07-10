import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import Dashboard from './views/Dashboard.vue';
import Engagements from './views/Engagements.vue';
import McpConnections from './views/McpConnections.vue';
import Findings from './views/Findings.vue';
import Approvals from './views/Approvals.vue';
import Settings from './views/Settings.vue';

const routes = [
  { path: '/', name: 'dashboard', component: Dashboard },
  { path: '/engagements', name: 'engagements', component: Engagements },
  { path: '/mcp', name: 'mcp', component: McpConnections },
  { path: '/findings', name: 'findings', component: Findings },
  { path: '/approvals', name: 'approvals', component: Approvals },
  { path: '/settings', name: 'settings', component: Settings },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const app = createApp(App);
app.use(router);
app.mount('#app');
