<script setup lang="ts">
import { computed, ref, h } from 'vue'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'

// PrimeVue components
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

// Project components
import { DataTable, AddressCell } from '@/components/DataTable'

// Stores
import { useAccountStore, useChainStore } from '@/stores'

// API
import {
  createGraphQLClient,
  fetchIndexingRules,
  setIndexingRule,
  deleteIndexingRule,
} from '@/api'

// Types
import type { IndexingRule } from '@/types'

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const accountStore = useAccountStore()
const chainStore = useChainStore()
const queryClient = useQueryClient()
const { activeAccount } = storeToRefs(accountStore)

// ---------------------------------------------------------------------------
// Agent endpoint
// ---------------------------------------------------------------------------
const agentEndpoint = computed(() => activeAccount.value?.agentEndpoint ?? '')
const hasAgent = computed(() => !!agentEndpoint.value)

// ---------------------------------------------------------------------------
// Query: indexing rules filtered to offchain only
// ---------------------------------------------------------------------------
const indexingRulesQuery = useQuery({
  queryKey: computed(() => [
    'indexing-rules',
    agentEndpoint.value,
    chainStore.selectedChain,
  ] as const),
  queryFn: async () => {
    if (!agentEndpoint.value) throw new Error('No agent endpoint configured')
    const client = createGraphQLClient(agentEndpoint.value)
    const rules = await fetchIndexingRules(client, chainStore.selectedChain)
    return rules.filter((r) => r.decisionBasis === 'offchain')
  },
  enabled: computed(() => !!agentEndpoint.value),
})

const offchainRules = computed<IndexingRule[]>(() => indexingRulesQuery.data.value ?? [])
const isLoading = computed(() => indexingRulesQuery.isLoading.value)

// ---------------------------------------------------------------------------
// Add deployment input
// ---------------------------------------------------------------------------
const newDeploymentHash = ref('')

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
const addMutation = useMutation({
  mutationFn: async (ipfsHash: string) => {
    const client = createGraphQLClient(agentEndpoint.value)
    return setIndexingRule(client, {
      identifier: ipfsHash,
      identifierType: 'deployment',
      decisionBasis: 'offchain',
      protocolNetwork: chainStore.selectedChain,
    })
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['indexing-rules'] })
    newDeploymentHash.value = ''
  },
})

const removeMutation = useMutation({
  mutationFn: async (ipfsHash: string) => {
    const client = createGraphQLClient(agentEndpoint.value)
    return deleteIndexingRule(client, {
      identifier: ipfsHash,
      protocolNetwork: chainStore.selectedChain,
    })
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['indexing-rules'] })
  },
})

const isMutating = computed(
  () => addMutation.isPending.value || removeMutation.isPending.value,
)

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
function handleAdd() {
  const hash = newDeploymentHash.value.trim()
  if (!hash) return
  addMutation.mutate(hash)
}

function handleRemove(ipfsHash: string) {
  removeMutation.mutate(ipfsHash)
}

function refreshAll() {
  indexingRulesQuery.refetch()
}

// ---------------------------------------------------------------------------
// Row ID
// ---------------------------------------------------------------------------
function getRowId(row: IndexingRule) {
  return row.identifier
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
const columnHelper = createColumnHelper<IndexingRule>()

const columns: ColumnDef<IndexingRule, any>[] = [
  columnHelper.accessor('identifier', {
    id: 'deployment',
    header: 'Deployment',
    size: 340,
    cell: (info) => {
      const hash = info.getValue() as string
      return h(AddressCell, { address: hash })
    },
  }),
  columnHelper.accessor('identifierType', {
    id: 'type',
    header: 'Type',
    size: 120,
    cell: (info) => h('span', { class: 'type-cell' }, info.getValue() as string),
  }),
  columnHelper.accessor('protocolNetwork', {
    id: 'network',
    header: 'Network',
    size: 160,
    cell: (info) => h('span', { class: 'network-cell' }, info.getValue() as string),
  }),
  columnHelper.display({
    id: 'actions',
    header: '',
    size: 100,
    cell: (info) => {
      const rule = info.row.original
      return h(Button, {
        icon: 'pi pi-trash',
        severity: 'danger',
        text: true,
        size: 'small',
        disabled: isMutating.value,
        loading: removeMutation.isPending.value && removeMutation.variables.value === rule.identifier,
        onClick: () => handleRemove(rule.identifier),
      })
    },
  }),
]
</script>

<template>
  <div class="offchain-sync-manager">
    <!-- No agent endpoint message -->
    <div v-if="!hasAgent" class="no-agent-message">
      <div class="no-agent-card">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h2>Agent Endpoint Not Configured</h2>
        <p>
          To manage offchain sync, configure your indexer agent endpoint in
          <strong>Settings</strong>.
        </p>
      </div>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="dashboard-header">
        <div class="header-left">
          <h1 class="page-title">Offchain Sync</h1>
          <span class="row-count">
            {{ offchainRules.length }} deployments
          </span>
        </div>
        <div class="header-right">
          <Button
            label="Refresh"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            :loading="isLoading"
            @click="refreshAll"
          />
        </div>
      </div>

      <!-- Add deployment bar -->
      <div class="add-bar">
        <InputText
          v-model="newDeploymentHash"
          placeholder="Enter deployment IPFS hash (Qm...)..."
          class="add-input"
          @keyup.enter="handleAdd"
        />
        <Button
          label="Add to Offchain Sync"
          icon="pi pi-plus"
          size="small"
          :disabled="!newDeploymentHash.trim() || isMutating"
          :loading="addMutation.isPending.value"
          @click="handleAdd"
        />
      </div>

      <!-- Error messages -->
      <div v-if="addMutation.error.value" class="error-message">
        Add failed: {{ addMutation.error.value instanceof Error ? addMutation.error.value.message : 'Unknown error' }}
      </div>
      <div v-if="removeMutation.error.value" class="error-message">
        Remove failed: {{ removeMutation.error.value instanceof Error ? removeMutation.error.value.message : 'Unknown error' }}
      </div>

      <!-- Data table -->
      <div class="table-wrapper">
        <DataTable
          :data="offchainRules"
          :columns="columns"
          :loading="isLoading"
          :get-row-id="getRowId"
          table-height="100%"
          empty-message="No offchain sync deployments. Add a deployment IPFS hash above to start syncing."
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.offchain-sync-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 24px;
  overflow: hidden;
}

/* --- No agent message --- */
.no-agent-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.no-agent-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px;
  text-align: center;
  color: var(--p-text-muted-color);
}

.no-agent-card h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.no-agent-card p {
  margin: 0;
  font-size: 0.875rem;
  max-width: 400px;
  line-height: 1.5;
}

.no-agent-card svg {
  opacity: 0.3;
  color: var(--app-surface-400);
}

/* --- Header --- */
.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 0;
  letter-spacing: -0.01em;
}

.row-count {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* --- Add bar --- */
.add-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 12px 16px;
  background-color: var(--app-surface-50);
  border: 1px solid var(--app-surface-200);
  border-radius: 12px;
}

.add-input {
  flex: 1;
  min-width: 200px;
}

/* --- Error message --- */
.error-message {
  padding: 8px 16px;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: var(--p-red-400);
  font-size: 0.8125rem;
  flex-shrink: 0;
}

/* --- Table wrapper --- */
.table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* --- Cell styles --- */
:deep(.type-cell) {
  font-size: 0.8125rem;
  color: var(--p-text-color);
  text-transform: capitalize;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.network-cell) {
  font-size: 0.8125rem;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
