<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app-layout">
    <header class="app-bar">
      <div class="app-bar-left">
        <span class="app-title">Indexer Tools</span>
        <nav class="app-nav">
          <RouterLink to="/">Subgraphs</RouterLink>
          <RouterLink to="/allocations">Allocations</RouterLink>
          <RouterLink to="/wizard">Wizard</RouterLink>
          <RouterLink to="/actions">Actions</RouterLink>
          <RouterLink to="/offchain">Offchain</RouterLink>
          <RouterLink to="/qos">QoS</RouterLink>
          <RouterLink to="/query">Query</RouterLink>
          <RouterLink to="/status">Status</RouterLink>
          <RouterLink to="/settings">Settings</RouterLink>
        </nav>
      </div>
    </header>
    <main class="app-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--p-surface-0);
  color: var(--p-text-color);
}

.app-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 3.5rem;
  background-color: var(--p-surface-50);
  border-bottom: 1px solid var(--p-surface-200);
}

.app-bar-left {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.app-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.app-nav {
  display: flex;
  gap: 0.25rem;
}

.app-nav a {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
  text-decoration: none;
  transition: background-color 0.15s, color 0.15s;
}

.app-nav a:hover {
  background-color: var(--p-surface-100);
  color: var(--p-text-color);
}

.app-nav a.router-link-active {
  background-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.app-content {
  flex: 1;
  padding: 1.5rem;
}
</style>
