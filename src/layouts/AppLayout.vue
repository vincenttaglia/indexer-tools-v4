<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useSettingsStore } from '@/stores'

const settingsStore = useSettingsStore()

function applyDarkMode(enabled: boolean) {
  if (enabled) {
    document.documentElement.classList.add('app-dark')
  } else {
    document.documentElement.classList.remove('app-dark')
  }
}

onMounted(() => {
  applyDarkMode(settingsStore.darkMode)
})

watch(() => settingsStore.darkMode, (enabled) => {
  applyDarkMode(enabled)
})
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">Indexer Tools</span>
        <span class="sidebar-badge">v4</span>
      </div>

      <nav class="sidebar-nav">
        <RouterLink to="/" class="nav-link">
          <i class="pi pi-th-large" />
          <span>Subgraphs</span>
        </RouterLink>
        <RouterLink to="/allocations" class="nav-link">
          <i class="pi pi-database" />
          <span>Allocations</span>
        </RouterLink>
        <RouterLink to="/wizard" class="nav-link">
          <i class="pi pi-bolt" />
          <span>Wizard</span>
        </RouterLink>
        <RouterLink to="/actions" class="nav-link">
          <i class="pi pi-list-check" />
          <span>Actions</span>
        </RouterLink>
        <RouterLink to="/offchain" class="nav-link">
          <i class="pi pi-cloud" />
          <span>Offchain Sync</span>
        </RouterLink>
        <RouterLink to="/qos" class="nav-link">
          <i class="pi pi-chart-bar" />
          <span>QoS</span>
        </RouterLink>
        <RouterLink to="/query" class="nav-link">
          <i class="pi pi-chart-line" />
          <span>Query Fees</span>
        </RouterLink>
        <RouterLink to="/status" class="nav-link">
          <i class="pi pi-heart" />
          <span>Status</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <RouterLink to="/settings" class="nav-link">
          <i class="pi pi-cog" />
          <span>Settings</span>
        </RouterLink>
      </div>
    </aside>

    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  display: flex;
  flex-direction: column;
  width: 240px;
  min-width: 240px;
  background-color: var(--app-surface-0);
  border-right: 1px solid var(--app-surface-200);
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  border-bottom: 1px solid var(--app-surface-200);
}

.sidebar-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--p-text-color);
  letter-spacing: -0.01em;
}

.sidebar-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1;
  color: var(--p-primary-contrast-color);
  background-color: var(--p-primary-color);
  border-radius: 4px;
  vertical-align: super;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 8px;
  flex: 1;
}

.sidebar-footer {
  margin-top: auto;
  padding: 8px;
  border-top: 1px solid var(--app-surface-200);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
  text-decoration: none;
  transition: all 150ms ease-out;
  position: relative;
}

.nav-link:hover {
  background-color: var(--app-surface-100);
  color: var(--p-text-color);
}

.nav-link.router-link-exact-active {
  color: var(--p-primary-color);
  background-color: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  font-weight: 600;
}

.nav-link.router-link-exact-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background-color: var(--p-primary-color);
}

.nav-link i {
  font-size: 1rem;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  overflow: hidden;
  background-color: var(--app-surface-ground);
}
</style>
