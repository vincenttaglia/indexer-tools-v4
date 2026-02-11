<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Card from 'primevue/card'
import ToggleSwitch from 'primevue/toggleswitch'
import Password from 'primevue/password'
import Textarea from 'primevue/textarea'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChainStore } from '@/stores/chainStore'
import { useAccountStore } from '@/stores/accountStore'
import { CHAIN_OPTIONS } from '@/config/chains'
import { accountKey } from '@/types'
import type { ChainId } from '@/types'
import type { IndexerAccount } from '@/types'

const settingsStore = useSettingsStore()
const chainStore = useChainStore()
const accountStore = useAccountStore()

// Dark mode watcher
watch(() => settingsStore.darkMode, (dark) => {
  document.documentElement.classList.toggle('app-dark', dark)
}, { immediate: true })

// Add account form visibility
const showAddForm = ref(false)

// New account form state
const newAccount = reactive<{
  label: string
  address: string
  chain: ChainId
  agentEndpoint: string
  graphmanEndpoint: string
  graphmanToken: string
}>({
  label: '',
  address: '',
  chain: 'arbitrum-one',
  agentEndpoint: '',
  graphmanEndpoint: '',
  graphmanToken: '',
})

function resetForm(): void {
  newAccount.label = ''
  newAccount.address = ''
  newAccount.chain = 'arbitrum-one'
  newAccount.agentEndpoint = ''
  newAccount.graphmanEndpoint = ''
  newAccount.graphmanToken = ''
}

function handleAddAccount(): void {
  if (!newAccount.label.trim() || !newAccount.address.trim()) return

  const account: IndexerAccount = {
    label: newAccount.label.trim(),
    address: newAccount.address.trim(),
    chain: newAccount.chain,
    agentEndpoint: newAccount.agentEndpoint.trim(),
    graphmanEndpoint: newAccount.graphmanEndpoint.trim(),
    graphmanToken: newAccount.graphmanToken.trim(),
  }

  accountStore.addAccount(account)
  resetForm()
  showAddForm.value = false
}

function handleCancelAdd(): void {
  resetForm()
  showAddForm.value = false
}

function getAccountKey(account: IndexerAccount): string {
  return accountKey(account)
}

function getChainLabel(chainId: ChainId): string {
  const option = CHAIN_OPTIONS.find(o => o.id === chainId)
  return option?.label ?? chainId
}
</script>

<template>
  <div class="settings-page">
    <h1 class="page-title">Settings</h1>

    <!-- Section 1: API Keys -->
    <Card class="settings-section">
      <template #title>API Keys</template>
      <template #subtitle>Configure your API keys for The Graph and DRPC services</template>
      <template #content>
        <div class="form-grid">
          <div class="form-field">
            <label for="graph-api-key" class="field-label">The Graph API Key</label>
            <Password
              id="graph-api-key"
              v-model="settingsStore.theGraphApiKey"
              placeholder="Enter your The Graph API key"
              :feedback="false"
              toggleMask
              class="field-input"
              inputClass="field-input-inner"
            />
          </div>
          <div class="form-field">
            <label for="drpc-api-key" class="field-label">DRPC API Key</label>
            <Password
              id="drpc-api-key"
              v-model="settingsStore.drpcApiKey"
              placeholder="Enter your DRPC API key"
              :feedback="false"
              toggleMask
              class="field-input"
              inputClass="field-input-inner"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Section 2: Network Selection -->
    <Card class="settings-section">
      <template #title>Network Selection</template>
      <template #subtitle>Choose the active Graph Protocol network</template>
      <template #content>
        <div class="form-field">
          <label for="chain-select" class="field-label">Active Chain</label>
          <Select
            id="chain-select"
            v-model="chainStore.selectedChain"
            :options="CHAIN_OPTIONS"
            optionLabel="label"
            optionValue="id"
            placeholder="Select a chain"
            class="field-select"
          />
        </div>
      </template>
    </Card>

    <!-- Section 3: Dark Mode -->
    <Card class="settings-section">
      <template #title>Appearance</template>
      <template #subtitle>Customize the application theme</template>
      <template #content>
        <div class="toggle-row">
          <div class="toggle-info">
            <span class="field-label">Dark Mode</span>
            <span class="field-hint">Toggle between dark and light themes</span>
          </div>
          <ToggleSwitch v-model="settingsStore.darkMode" />
        </div>
      </template>
    </Card>

    <!-- Section 4: Subgraph Lists -->
    <Card class="settings-section">
      <template #title>Subgraph Lists</template>
      <template #subtitle>Manage blacklist and synclist for subgraph filtering (comma or newline separated IPFS hashes)</template>
      <template #content>
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label for="blacklist" class="field-label">Subgraph Blacklist</label>
            <Textarea
              id="blacklist"
              v-model="settingsStore.subgraphBlacklist"
              placeholder="QmHash1, QmHash2..."
              rows="4"
              class="field-input"
              autoResize
            />
            <span class="field-hint">Subgraphs to exclude when the blacklist filter is active</span>
          </div>
          <div class="form-field form-field--full">
            <label for="synclist" class="field-label">Subgraph Synclist</label>
            <Textarea
              id="synclist"
              v-model="settingsStore.subgraphSynclist"
              placeholder="QmHash1, QmHash2..."
              rows="4"
              class="field-input"
              autoResize
            />
            <span class="field-hint">Only show these subgraphs when the synclist filter is active</span>
          </div>
        </div>
      </template>
    </Card>

    <!-- Section 5: Indexer Accounts -->
    <Card class="settings-section">
      <template #title>Indexer Accounts</template>
      <template #subtitle>Manage your indexer accounts across different chains</template>
      <template #content>
        <!-- Account List -->
        <div v-if="accountStore.accounts.length > 0" class="account-list">
          <div
            v-for="account in accountStore.accounts"
            :key="getAccountKey(account)"
            class="account-row"
            :class="{ 'account-row--active': accountStore.activeAccountKey === getAccountKey(account) }"
          >
            <div class="account-info">
              <div class="account-label">
                {{ account.label }}
                <span
                  v-if="accountStore.activeAccountKey === getAccountKey(account)"
                  class="active-badge"
                >Active</span>
              </div>
              <div class="account-details">
                <span class="account-address">{{ account.address }}</span>
                <span class="account-chain">{{ getChainLabel(account.chain) }}</span>
              </div>
            </div>
            <div class="account-actions">
              <Button
                v-if="accountStore.activeAccountKey !== getAccountKey(account)"
                label="Set Active"
                severity="secondary"
                size="small"
                outlined
                @click="accountStore.setActive(getAccountKey(account))"
              />
              <Button
                label="Remove"
                severity="danger"
                size="small"
                outlined
                @click="accountStore.removeAccount(getAccountKey(account))"
              />
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          No indexer accounts configured yet.
        </div>

        <!-- Add Account Button -->
        <div v-if="!showAddForm" class="add-button-row">
          <Button
            label="Add Account"
            icon="pi pi-plus"
            @click="showAddForm = true"
          />
        </div>

        <!-- Add Account Form -->
        <div v-if="showAddForm" class="add-account-form">
          <h3 class="form-heading">New Account</h3>
          <div class="form-grid">
            <div class="form-field">
              <label for="new-label" class="field-label">Label</label>
              <InputText
                id="new-label"
                v-model="newAccount.label"
                placeholder="e.g. My Indexer"
                class="field-input"
              />
            </div>
            <div class="form-field">
              <label for="new-address" class="field-label">Address</label>
              <InputText
                id="new-address"
                v-model="newAccount.address"
                placeholder="0x..."
                class="field-input"
              />
            </div>
            <div class="form-field">
              <label for="new-chain" class="field-label">Chain</label>
              <Select
                id="new-chain"
                v-model="newAccount.chain"
                :options="CHAIN_OPTIONS"
                optionLabel="label"
                optionValue="id"
                placeholder="Select a chain"
                class="field-select"
              />
            </div>
            <div class="form-field">
              <label for="new-agent" class="field-label">Agent Endpoint</label>
              <InputText
                id="new-agent"
                v-model="newAccount.agentEndpoint"
                placeholder="http://localhost:18000"
                class="field-input"
              />
            </div>
            <div class="form-field">
              <label for="new-graphman" class="field-label">Graphman Endpoint</label>
              <InputText
                id="new-graphman"
                v-model="newAccount.graphmanEndpoint"
                placeholder="http://localhost:8030/graphql"
                class="field-input"
              />
            </div>
            <div class="form-field">
              <label for="new-graphman-token" class="field-label">Graphman Token</label>
              <Password
                id="new-graphman-token"
                v-model="newAccount.graphmanToken"
                placeholder="Bearer token"
                :feedback="false"
                toggleMask
                class="field-input"
                inputClass="field-input-inner"
              />
            </div>
          </div>
          <div class="form-actions">
            <Button
              label="Cancel"
              severity="secondary"
              outlined
              @click="handleCancelAdd"
            />
            <Button
              label="Add Account"
              :disabled="!newAccount.label.trim() || !newAccount.address.trim()"
              @click="handleAddAccount"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100%;
  overflow-y: auto;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 0;
  letter-spacing: -0.01em;
}

.settings-section {
  background: var(--app-surface-0);
  border: 1px solid var(--app-surface-200);
  border-radius: 12px;
}

/* Form layout */
.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field--full {
  grid-column: 1 / -1;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--p-text-color);
}

.field-hint {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.field-input {
  width: 100%;
}

:deep(.field-input-inner) {
  width: 100%;
}

.field-select {
  width: 100%;
}

/* Toggle row */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Account list */
.account-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  background: var(--app-surface-50);
  border: 1px solid var(--app-surface-200);
  border-radius: 8px;
  flex-wrap: wrap;
  transition: border-color 150ms ease-out;
}

.account-row:hover {
  border-color: var(--app-surface-300);
}

.account-row--active {
  border-color: color-mix(in srgb, var(--p-primary-color) 40%, var(--app-surface-200));
  background: color-mix(in srgb, var(--p-primary-color) 4%, var(--app-surface-50));
}

.account-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.account-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.active-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  padding: 2px 8px;
  border-radius: 9999px;
}

.account-details {
  display: flex;
  gap: 12px;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  flex-wrap: wrap;
}

.account-address {
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  word-break: break-all;
}

.account-chain {
  white-space: nowrap;
}

.account-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--p-text-muted-color);
  font-size: 0.8125rem;
}

/* Add button */
.add-button-row {
  margin-top: 8px;
}

/* Add account form */
.add-account-form {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--app-surface-200);
}

.form-heading {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin: 0 0 16px 0;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

/* Responsive stacking */
@media (max-width: 480px) {
  .settings-page {
    padding: 16px;
  }

  .account-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .account-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .toggle-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-actions {
    flex-direction: column;
  }

  .form-actions > * {
    width: 100%;
  }
}
</style>
