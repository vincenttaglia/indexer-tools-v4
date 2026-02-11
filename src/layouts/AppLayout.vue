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
  background-color: var(--p-surface-0);
  border-right: 1px solid var(--p-surface-200);
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 1rem;
  border-bottom: 1px solid var(--p-surface-200);
}

.sidebar-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.sidebar-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.1rem 0.4rem;
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
  gap: 0.125rem;
  padding: 0.75rem 0.5rem;
  flex: 1;
}

.sidebar-footer {
  margin-top: auto;
  padding: 0.5rem;
  border-top: 1px solid var(--p-surface-200);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
  text-decoration: none;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
  border-left: 3px solid transparent;
}

.nav-link:hover {
  background-color: var(--p-surface-100);
  color: var(--p-text-color);
}

.nav-link.router-link-exact-active {
  color: var(--p-primary-color);
  background-color: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  border-left-color: var(--p-primary-color);
  font-weight: 600;
}

.nav-link i {
  font-size: 1rem;
  width: 1.25rem;
  text-align: center;
}

.main-content {
  flex: 1;
  overflow: hidden;
  background-color: var(--p-surface-ground);
}
</style>
