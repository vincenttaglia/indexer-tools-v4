<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

// PrimeVue components
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'

// Stores
import { useWizardStore, useChainStore, useAccountStore } from '@/stores'

// API
import { createGraphQLClient, queueActions } from '@/api'

// CLI command generation
import {
  generateIndexingRuleCommands,
  generateActionQueueCommands,
  toClosingAllocations,
  toNewAllocations,
} from '@/services/export/cliCommands'

// Types
import type { ActionInput } from '@/types'

// Formatting
import { formatNumber } from '@/services/formatting/numbers'

// ---------------------------------------------------------------------------
// Router & Stores
// ---------------------------------------------------------------------------
const router = useRouter()
const wizardStore = useWizardStore()
const chainStore = useChainStore()
const accountStore = useAccountStore()
const { activeAccount } = storeToRefs(accountStore)

// ---------------------------------------------------------------------------
// Generated actions
// ---------------------------------------------------------------------------

const actions = computed<ActionInput[]>(() =>
  wizardStore.buildActions(chainStore.selectedChain),
)

const hasActions = computed(() => actions.value.length > 0)

// ---------------------------------------------------------------------------
// Grouped actions for display
// ---------------------------------------------------------------------------

const unallocateActions = computed(() =>
  actions.value.filter((a) => a.type === 'unallocate'),
)

const allocateActions = computed(() =>
  actions.value.filter((a) => a.type === 'allocate'),
)

const reallocateActions = computed(() =>
  actions.value.filter((a) => a.type === 'reallocate'),
)

// ---------------------------------------------------------------------------
// CLI commands
// ---------------------------------------------------------------------------

const commandParams = computed(() => ({
  closingAllocations: toClosingAllocations(wizardStore.closingAllocations),
  newAllocations: toNewAllocations(
    wizardStore.selectedDeployments,
    wizardStore.allocationAmounts,
  ),
  customPOIs: wizardStore.customPOIs,
  customBlockHeights: wizardStore.customBlockHeights,
  customPublicPOIs: wizardStore.customPublicPOIs,
  chainId: chainStore.selectedChain,
}))

const actionQueueCommands = computed(() =>
  generateActionQueueCommands(commandParams.value),
)

const indexingRuleCommands = computed(() =>
  generateIndexingRuleCommands(commandParams.value),
)

// ---------------------------------------------------------------------------
// Queue actions handler
// ---------------------------------------------------------------------------

const isQueueing = ref(false)
const queueError = ref<string | null>(null)
const queueSuccess = ref(false)

const canQueue = computed(() => {
  const account = activeAccount.value
  return !!(account && account.agentEndpoint && hasActions.value)
})

async function handleQueueActions() {
  const account = activeAccount.value
  if (!account?.agentEndpoint) {
    queueError.value = 'No agent endpoint configured for the active account.'
    return
  }
  const currentActions = wizardStore.buildActions(chainStore.selectedChain)
  if (currentActions.length === 0) {
    queueError.value = 'No valid actions to queue.'
    return
  }
  isQueueing.value = true
  queueError.value = null
  queueSuccess.value = false
  try {
    const client = createGraphQLClient(account.agentEndpoint)
    await queueActions(client, currentActions)
    queueSuccess.value = true
    wizardStore.clearAll()
    setTimeout(() => router.push({ name: 'actions' }), 1500)
  } catch (err: unknown) {
    queueError.value = err instanceof Error ? err.message : 'Failed to queue actions'
  } finally {
    isQueueing.value = false
  }
}

// ---------------------------------------------------------------------------
// Clipboard copy
// ---------------------------------------------------------------------------

const copied = ref<string | null>(null)

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = label
    setTimeout(() => {
      copied.value = null
    }, 2000)
  } catch {
    /* ignore clipboard errors */
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateId(id: string): string {
  if (id.length <= 16) return id
  return `${id.slice(0, 8)}...${id.slice(-6)}`
}

function formatAmount(amount: string): string {
  const parsed = parseFloat(amount)
  if (Number.isNaN(parsed) || parsed === 0) return '-'
  return `${formatNumber(parsed, 0)} GRT`
}
</script>

<template>
  <div class="wizard-step-execute">
    <!-- Empty state -->
    <div v-if="!hasActions" class="empty-state">
      <i class="pi pi-inbox empty-icon" />
      <p class="empty-text">No actions to execute.</p>
      <p class="empty-hint">
        Go back to previous steps to select allocations to close or subgraphs to allocate.
      </p>
    </div>

    <template v-else>
      <!-- Action Summary -->
      <div class="actions-summary">
        <h2 class="section-title">
          Action Summary ({{ actions.length }})
        </h2>

        <!-- Unallocate group -->
        <div v-if="unallocateActions.length > 0" class="action-group">
          <div class="group-header">
            <span class="group-badge badge-unallocate">UNALLOCATE</span>
            <span class="group-count">{{ unallocateActions.length }}</span>
          </div>
          <div
            v-for="action in unallocateActions"
            :key="`unalloc-${action.deploymentID}-${action.allocationID}`"
            class="action-item"
          >
            <span class="action-type-indicator indicator-unallocate" />
            <span class="action-deployment" :title="action.deploymentID">
              {{ truncateId(action.deploymentID) }}
            </span>
            <span class="action-detail">
              P{{ action.priority }}
            </span>
          </div>
        </div>

        <!-- Allocate group -->
        <div v-if="allocateActions.length > 0" class="action-group">
          <div class="group-header">
            <span class="group-badge badge-allocate">ALLOCATE</span>
            <span class="group-count">{{ allocateActions.length }}</span>
          </div>
          <div
            v-for="action in allocateActions"
            :key="`alloc-${action.deploymentID}`"
            class="action-item"
          >
            <span class="action-type-indicator indicator-allocate" />
            <span class="action-deployment" :title="action.deploymentID">
              {{ truncateId(action.deploymentID) }}
            </span>
            <span class="action-amount">
              {{ formatAmount(action.amount) }}
            </span>
            <span class="action-detail">
              P{{ action.priority }}
            </span>
          </div>
        </div>

        <!-- Reallocate group -->
        <div v-if="reallocateActions.length > 0" class="action-group">
          <div class="group-header">
            <span class="group-badge badge-reallocate">REALLOCATE</span>
            <span class="group-count">{{ reallocateActions.length }}</span>
          </div>
          <div
            v-for="action in reallocateActions"
            :key="`realloc-${action.deploymentID}-${action.allocationID}`"
            class="action-item"
          >
            <span class="action-type-indicator indicator-reallocate" />
            <span class="action-deployment" :title="action.deploymentID">
              {{ truncateId(action.deploymentID) }}
            </span>
            <span class="action-amount">
              {{ formatAmount(action.amount) }}
            </span>
            <span class="action-detail">
              P{{ action.priority }}
            </span>
          </div>
        </div>
      </div>

      <!-- Queue Actions -->
      <div class="queue-section">
        <div class="queue-bar">
          <div class="queue-info">
            <span v-if="!activeAccount" class="queue-hint">
              No active account configured.
            </span>
            <span v-else-if="!activeAccount.agentEndpoint" class="queue-hint">
              No agent endpoint set. Use the CLI commands below instead.
            </span>
            <span v-else class="queue-hint queue-hint-ready">
              Ready to queue {{ actions.length }} action(s) to the indexer agent.
            </span>
          </div>
          <Button
            label="Queue Actions"
            icon="pi pi-send"
            :loading="isQueueing"
            :disabled="!canQueue || queueSuccess"
            @click="handleQueueActions"
          />
        </div>

        <!-- Status messages -->
        <Message
          v-if="queueError"
          severity="error"
          :closable="true"
          @close="queueError = null"
        >
          {{ queueError }}
        </Message>
        <Message
          v-if="queueSuccess"
          severity="success"
          :closable="false"
        >
          Actions queued successfully. Redirecting to Actions page...
        </Message>
      </div>

      <!-- CLI Commands -->
      <div class="cli-section">
        <h2 class="section-title">CLI Commands</h2>
        <Tabs value="actionQueue">
          <TabList>
            <Tab value="actionQueue">Action Queue Commands</Tab>
            <Tab value="indexingRule">Indexing Rule Commands</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="actionQueue">
              <div class="cli-panel">
                <Textarea
                  :modelValue="actionQueueCommands"
                  readonly
                  autoResize
                  class="cli-textarea"
                  rows="6"
                />
                <Button
                  :label="copied === 'actionQueue' ? 'Copied!' : 'Copy'"
                  :icon="copied === 'actionQueue' ? 'pi pi-check' : 'pi pi-copy'"
                  severity="secondary"
                  outlined
                  size="small"
                  class="copy-btn"
                  @click="copyToClipboard(actionQueueCommands, 'actionQueue')"
                />
              </div>
            </TabPanel>
            <TabPanel value="indexingRule">
              <div class="cli-panel">
                <Textarea
                  :modelValue="indexingRuleCommands"
                  readonly
                  autoResize
                  class="cli-textarea"
                  rows="6"
                />
                <Button
                  :label="copied === 'indexingRule' ? 'Copied!' : 'Copy'"
                  :icon="copied === 'indexingRule' ? 'pi pi-check' : 'pi pi-copy'"
                  severity="secondary"
                  outlined
                  size="small"
                  class="copy-btn"
                  @click="copyToClipboard(indexingRuleCommands, 'indexingRule')"
                />
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </template>
  </div>
</template>

<style scoped>
.wizard-step-execute {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 16px;
  overflow-y: auto;
}

/* --- Empty state --- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 8px;
}

.empty-icon {
  font-size: 2.5rem;
  color: var(--p-text-muted-color);
  opacity: 0.5;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 0;
}

.empty-hint {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  margin: 0;
  text-align: center;
  max-width: 400px;
}

/* --- Section titles --- */
.section-title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin: 0 0 8px 0;
}

/* --- Actions summary --- */
.actions-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background-color: var(--app-surface-0);
  border: 1px solid var(--app-surface-200);
  border-radius: 10px;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.group-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.badge-allocate {
  background-color: rgba(34, 197, 94, 0.15);
  color: var(--p-green-400);
}

.badge-unallocate {
  background-color: rgba(239, 68, 68, 0.15);
  color: var(--p-red-400);
}

.badge-reallocate {
  background-color: rgba(234, 179, 8, 0.15);
  color: var(--p-yellow-400);
}

.group-count {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  font-variant-numeric: tabular-nums;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background-color: var(--app-surface-50);
  border: 1px solid var(--app-surface-100);
  border-radius: 6px;
}

.action-type-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.indicator-allocate {
  background-color: var(--p-green-400);
}

.indicator-unallocate {
  background-color: var(--p-red-400);
}

.indicator-reallocate {
  background-color: var(--p-yellow-400);
}

.action-deployment {
  flex: 1;
  font-size: 0.8125rem;
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.action-amount {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--p-text-color);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
}

.action-detail {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* --- Queue section --- */
.queue-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queue-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background-color: var(--app-surface-100);
  border-radius: 10px;
}

.queue-info {
  display: flex;
  align-items: center;
  min-width: 0;
}

.queue-hint {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
}

.queue-hint-ready {
  color: var(--p-text-color);
}

/* --- CLI section --- */
.cli-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  background-color: var(--app-surface-0);
  border: 1px solid var(--app-surface-200);
  border-radius: 10px;
}

.cli-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

.cli-textarea {
  width: 100%;
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  resize: vertical;
}

.copy-btn {
  align-self: flex-end;
}
</style>
