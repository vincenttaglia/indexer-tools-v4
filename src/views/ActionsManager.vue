<script setup lang="ts">
import { computed, ref, h } from 'vue'
import { createColumnHelper, type ColumnDef } from '@tanstack/vue-table'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'

// PrimeVue components
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import SelectButton from 'primevue/selectbutton'

// Project components
import { DataTable } from '@/components/DataTable'

// Composables
import { useActionsQuery } from '@/composables'

// Stores
import { useAccountStore, useSelectionStore } from '@/stores'

// API
import {
  createGraphQLClient,
  approveActions,
  cancelActions,
  deleteActions,
  executeApprovedActions,
} from '@/api'

// Types
import type { Action, ActionStatus } from '@/types'

// Formatting
import { formatNumber } from '@/services/formatting/numbers'

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
const accountStore = useAccountStore()
const selectionStore = useSelectionStore()
const queryClient = useQueryClient()

const { activeAccount } = storeToRefs(accountStore)
const { selectedActions } = storeToRefs(selectionStore)

// ---------------------------------------------------------------------------
// Agent endpoint
// ---------------------------------------------------------------------------
const agentEndpoint = computed(() => activeAccount.value?.agentEndpoint ?? '')
const hasAgent = computed(() => !!agentEndpoint.value)

// ---------------------------------------------------------------------------
// Status filter
// ---------------------------------------------------------------------------
type StatusTab = 'all' | ActionStatus

const statusFilter = ref<StatusTab>('all')

const statusOptions: { label: string; value: StatusTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Queued', value: 'queued' },
  { label: 'Approved', value: 'approved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Success', value: 'success' },
  { label: 'Failed', value: 'failed' },
  { label: 'Canceled', value: 'canceled' },
]

// ---------------------------------------------------------------------------
// Query - fetch ALL actions (no filter), then filter client-side
// ---------------------------------------------------------------------------
const actionsQuery = useActionsQuery()

const allActions = computed<Action[]>(() => actionsQuery.data.value ?? [])

const filteredActions = computed<Action[]>(() => {
  if (statusFilter.value === 'all') return allActions.value
  return allActions.value.filter((a) => a.status === statusFilter.value)
})

// ---------------------------------------------------------------------------
// Status counts
// ---------------------------------------------------------------------------
const statusCounts = computed(() => {
  const counts: Record<StatusTab, number> = {
    all: 0,
    queued: 0,
    approved: 0,
    pending: 0,
    success: 0,
    failed: 0,
    canceled: 0,
  }
  for (const action of allActions.value) {
    counts.all++
    counts[action.status]++
  }
  return counts
})

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
const isLoading = computed(() => actionsQuery.isLoading.value)

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------
function refreshAll() {
  actionsQuery.refetch()
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
function handleSelectionChange(ids: Set<string>) {
  selectionStore.selectAllActions([...ids])
}

function getRowId(row: Action) {
  return String(row.id)
}

// ---------------------------------------------------------------------------
// Selected action helpers
// ---------------------------------------------------------------------------
const selectedActionsList = computed(() =>
  allActions.value.filter((a) => selectedActions.value.has(String(a.id))),
)

const selectedQueuedIds = computed(() =>
  selectedActionsList.value
    .filter((a) => a.status === 'queued')
    .map((a) => String(a.id)),
)

const selectedCancelableIds = computed(() =>
  selectedActionsList.value
    .filter((a) => a.status === 'queued' || a.status === 'approved')
    .map((a) => String(a.id)),
)

const selectedIds = computed(() =>
  selectedActionsList.value.map((a) => String(a.id)),
)


// ---------------------------------------------------------------------------
// Confirmation state for delete
// ---------------------------------------------------------------------------
const confirmingDelete = ref(false)

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
const approveMutation = useMutation({
  mutationFn: async (ids: string[]) => {
    const client = createGraphQLClient(agentEndpoint.value)
    return approveActions(client, ids)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['actions'] })
    selectionStore.clearAllActions()
  },
})

const cancelMutation = useMutation({
  mutationFn: async (ids: string[]) => {
    const client = createGraphQLClient(agentEndpoint.value)
    return cancelActions(client, ids)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['actions'] })
    selectionStore.clearAllActions()
  },
})

const deleteMutation = useMutation({
  mutationFn: async (ids: string[]) => {
    const client = createGraphQLClient(agentEndpoint.value)
    return deleteActions(client, ids)
  },
  onSuccess: (_count: number) => {
    queryClient.invalidateQueries({ queryKey: ['actions'] })
    selectionStore.clearAllActions()
    confirmingDelete.value = false
  },
})

const executeMutation = useMutation({
  mutationFn: async () => {
    const client = createGraphQLClient(agentEndpoint.value)
    return executeApprovedActions(client)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['actions'] })
  },
})

// ---------------------------------------------------------------------------
// Mutation handlers
// ---------------------------------------------------------------------------
function handleApprove() {
  if (selectedQueuedIds.value.length === 0) return
  approveMutation.mutate(selectedQueuedIds.value)
}

function handleCancel() {
  if (selectedCancelableIds.value.length === 0) return
  cancelMutation.mutate(selectedCancelableIds.value)
}

function handleDelete() {
  if (selectedIds.value.length === 0) return
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    return
  }
  deleteMutation.mutate(selectedIds.value)
}

function handleCancelDelete() {
  confirmingDelete.value = false
}

function handleExecuteApproved() {
  executeMutation.mutate()
}

// ---------------------------------------------------------------------------
// Any mutation loading
// ---------------------------------------------------------------------------
const isMutating = computed(
  () =>
    approveMutation.isPending.value ||
    cancelMutation.isPending.value ||
    deleteMutation.isPending.value ||
    executeMutation.isPending.value,
)

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------
function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = Date.now()
    const diffMs = now - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)

    if (diffSec < 60) return `${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 30) return `${diffDay}d ago`
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ---------------------------------------------------------------------------
// Status / type badge severities
// ---------------------------------------------------------------------------
type TagSeverity = 'info' | 'warn' | 'success' | 'danger' | 'secondary' | 'contrast' | undefined

function statusSeverity(status: ActionStatus): TagSeverity {
  const map: Record<ActionStatus, TagSeverity> = {
    queued: 'info',
    approved: 'warn',
    pending: 'warn',
    success: 'success',
    failed: 'danger',
    canceled: 'secondary',
  }
  return map[status]
}

function typeSeverity(type: string): TagSeverity {
  const map: Record<string, TagSeverity> = {
    allocate: 'success',
    unallocate: 'danger',
    reallocate: 'warn',
  }
  return map[type] ?? 'info'
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
const columnHelper = createColumnHelper<Action>()

const columns: ColumnDef<Action, any>[] = [
  columnHelper.accessor('id', {
    id: 'id',
    header: 'ID',
    size: 70,
    cell: (info) => {
      const id = info.getValue() as number
      return h('span', { class: 'mono-text', title: String(id) }, `#${id}`)
    },
  }),
  columnHelper.accessor('type', {
    id: 'type',
    header: 'Type',
    size: 120,
    cell: (info) => {
      const val = info.getValue() as string
      return h(Tag, {
        value: val,
        severity: typeSeverity(val),
      })
    },
  }),
  columnHelper.accessor('status', {
    id: 'status',
    header: 'Status',
    size: 110,
    cell: (info) => {
      const val = info.getValue() as ActionStatus
      return h(Tag, {
        value: val,
        severity: statusSeverity(val),
      })
    },
  }),
  columnHelper.accessor('deploymentID', {
    id: 'deployment',
    header: 'Deployment',
    size: 140,
    cell: (info) => {
      const val = info.getValue() as string
      const short = val ? val.slice(0, 12) + '...' : '-'
      return h('span', { class: 'mono-text', title: val }, short)
    },
  }),
  columnHelper.accessor('amount', {
    id: 'amount',
    header: 'Amount (GRT)',
    size: 140,
    cell: (info) => {
      const val = info.getValue() as string | null
      if (!val || val === '0') return h('span', { class: 'text-muted' }, '-')
      const parsed = parseFloat(val)
      if (isNaN(parsed)) return h('span', { class: 'text-muted' }, '-')
      return h('span', { class: 'token-value' }, `${formatNumber(parsed, 0)} GRT`)
    },
  }),
  columnHelper.accessor('priority', {
    id: 'priority',
    header: 'Priority',
    size: 80,
    cell: (info) => {
      const val = info.getValue() as number
      return h('span', { class: 'priority-cell' }, String(val))
    },
  }),
  columnHelper.accessor((row) => `${row.source}${row.reason ? ` / ${row.reason}` : ''}`, {
    id: 'source',
    header: 'Source / Reason',
    size: 180,
    cell: (info) => {
      const val = info.getValue() as string
      return h('span', { class: 'text-ellipsis', title: val }, val)
    },
  }),
  columnHelper.accessor('createdAt', {
    id: 'createdAt',
    header: 'Created',
    size: 110,
    cell: (info) => {
      const val = info.getValue() as string
      const relative = formatRelativeTime(val)
      return h('span', { title: val }, relative)
    },
  }),
  columnHelper.accessor('transaction', {
    id: 'transaction',
    header: 'Transaction',
    size: 130,
    cell: (info) => {
      const val = info.getValue() as string | null
      if (!val) return h('span', { class: 'text-muted' }, '-')
      const short = `${val.slice(0, 6)}...${val.slice(-4)}`
      return h('span', { class: 'mono-text', title: val }, short)
    },
  }),
  columnHelper.accessor('failureReason', {
    id: 'failureReason',
    header: 'Failure Reason',
    size: 160,
    cell: (info) => {
      const val = info.getValue() as string | null
      if (!val) return h('span', { class: 'text-muted' }, '-')
      const truncated = val.length > 30 ? val.slice(0, 30) + '...' : val
      return h('span', { class: 'failure-text', title: val }, truncated)
    },
  }),
]
</script>

<template>
  <div class="actions-manager">
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
          To manage actions, configure your indexer agent endpoint in
          <strong>Settings</strong>.
        </p>
      </div>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="dashboard-header">
        <div class="header-left">
          <h1 class="page-title">Action Queue</h1>
          <span class="row-count">
            {{ filteredActions.length }} / {{ allActions.length }}
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

      <!-- Status filter tabs -->
      <div class="filter-bar">
        <SelectButton
          v-model="statusFilter"
          :options="statusOptions"
          optionLabel="label"
          optionValue="value"
          class="status-tabs"
        >
          <template #option="slotProps">
            <span class="status-tab-label">
              {{ slotProps.option.label }}
              <span class="status-tab-count">({{ statusCounts[slotProps.option.value as StatusTab] }})</span>
            </span>
          </template>
        </SelectButton>
      </div>

      <!-- Action buttons toolbar -->
      <div class="toolbar">
        <Button
          label="Approve Selected"
          icon="pi pi-check"
          severity="success"
          outlined
          size="small"
          :disabled="selectedQueuedIds.length === 0 || isMutating"
          :loading="approveMutation.isPending.value"
          @click="handleApprove"
        />
        <Button
          label="Cancel Selected"
          icon="pi pi-ban"
          severity="warn"
          outlined
          size="small"
          :disabled="selectedCancelableIds.length === 0 || isMutating"
          :loading="cancelMutation.isPending.value"
          @click="handleCancel"
        />

        <template v-if="!confirmingDelete">
          <Button
            label="Delete Selected"
            icon="pi pi-trash"
            severity="danger"
            outlined
            size="small"
            :disabled="selectedIds.length === 0 || isMutating"
            @click="handleDelete"
          />
        </template>
        <template v-else>
          <Button
            label="Confirm Delete"
            icon="pi pi-trash"
            severity="danger"
            size="small"
            :loading="deleteMutation.isPending.value"
            @click="handleDelete"
          />
          <Button
            label="Cancel"
            severity="secondary"
            text
            size="small"
            @click="handleCancelDelete"
          />
        </template>

        <span class="toolbar-spacer" />

        <Button
          label="Execute Approved"
          icon="pi pi-play"
          severity="info"
          size="small"
          :disabled="isMutating"
          :loading="executeMutation.isPending.value"
          @click="handleExecuteApproved"
        />
      </div>

      <!-- Data table -->
      <div class="table-wrapper">
        <DataTable
          :data="filteredActions"
          :columns="columns"
          :loading="isLoading"
          :enable-selection="true"
          :selected-keys="selectedActions"
          :get-row-id="getRowId"
          table-height="100%"
          empty-message="No actions found. The action queue is empty."
          @selection-change="handleSelectionChange"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.actions-manager {
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

/* --- Filter bar --- */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.status-tabs {
  flex-wrap: wrap;
}

.status-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8125rem;
}

.status-tab-count {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  font-variant-numeric: tabular-nums;
}

/* --- Toolbar --- */
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
  padding: 8px 12px;
  background-color: var(--app-surface-50);
  border: 1px solid var(--app-surface-200);
  border-radius: 12px;
}

.toolbar-spacer {
  flex: 1;
}

/* --- Table wrapper --- */
.table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* --- Cell styles --- */
:deep(.mono-text) {
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  font-size: 0.75rem;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

:deep(.text-muted) {
  color: var(--p-text-muted-color);
  font-size: 0.8125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.text-ellipsis) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  max-width: 100%;
  display: inline-block;
  font-size: 0.8125rem;
}

:deep(.priority-cell) {
  font-size: 0.8125rem;
  text-transform: capitalize;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.failure-text) {
  font-size: 0.75rem;
  color: var(--p-red-400);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
</style>
