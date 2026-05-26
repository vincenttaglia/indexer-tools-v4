<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import Popover from 'primevue/popover'
import { useAccountStore } from '@/stores/accountStore'
import { accountKey } from '@/types'
import type { IndexerAccount } from '@/types'
import { getChainLabel, CHAIN_ABBREV } from '@/config/chains'

const accountStore = useAccountStore()
const { accounts, activeAccountKey, activeAccount } = storeToRefs(accountStore)

const router = useRouter()
const popoverRef = ref<InstanceType<typeof Popover> | null>(null)
const isOpen = ref(false)

function togglePopover(event: Event): void {
  popoverRef.value?.toggle(event)
}

function handleShow(): void {
  isOpen.value = true
}

function handleHide(): void {
  isOpen.value = false
}

function getKey(account: IndexerAccount): string {
  return accountKey(account)
}

function isActive(account: IndexerAccount): boolean {
  return activeAccountKey.value === getKey(account)
}

/** First 6 + last 4 of an address: `0x1234…aB12` */
function formatAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Last 6 of the address, used on the resting trigger to save space. */
function lastSix(address: string): string {
  if (address.length <= 6) return address
  return `…${address.slice(-6)}`
}

function selectAccount(account: IndexerAccount, event: Event): void {
  accountStore.setActive(getKey(account))
  popoverRef.value?.hide()
  event.stopPropagation()
}

function goToSettings(event?: Event): void {
  popoverRef.value?.hide()
  event?.stopPropagation()
  void router.push('/settings')
}

const triggerLabel = computed<string>(() => {
  if (activeAccount.value) return activeAccount.value.label
  return 'Select account'
})
</script>

<template>
  <!-- Empty state: no accounts configured -->
  <button
    v-if="accounts.length === 0"
    type="button"
    class="add-account-cta"
    data-testid="account-switcher-add-cta"
    @click="goToSettings"
  >
    <i class="pi pi-plus" />
    <span>Add account</span>
  </button>

  <!-- Normal state: at least one account configured -->
  <template v-else>
    <button
      type="button"
      class="switcher-trigger"
      :class="{ 'switcher-trigger--open': isOpen }"
      data-testid="account-switcher-trigger"
      @click="togglePopover"
    >
      <div class="trigger-body">
        <span class="trigger-label">{{ triggerLabel }}</span>
        <span v-if="activeAccount" class="trigger-meta">
          <span class="chain-pill">{{ CHAIN_ABBREV[activeAccount.chain] }}</span>
          <span class="trigger-address">{{ lastSix(activeAccount.address) }}</span>
        </span>
      </div>
      <i class="pi pi-angle-down trigger-chevron" />
    </button>

    <Popover
      ref="popoverRef"
      append-to="body"
      :pt="{ root: { class: 'account-switcher-popover' } }"
      @show="handleShow"
      @hide="handleHide"
    >
      <div class="popover-body">
        <div class="account-rows">
          <button
            v-for="account in accounts"
            :key="getKey(account)"
            type="button"
            class="account-row"
            :class="{ 'account-row--active': isActive(account) }"
            data-testid="account-switcher-row"
            @click="selectAccount(account, $event)"
          >
            <div class="account-row-body">
              <div class="account-row-label">{{ account.label }}</div>
              <div class="account-row-meta">
                <span class="account-row-chain">{{ getChainLabel(account.chain) }}</span>
                <span class="account-row-address">{{ formatAddress(account.address) }}</span>
              </div>
            </div>
            <span v-if="isActive(account)" class="active-badge">Active</span>
          </button>
        </div>
        <div class="popover-divider" />
        <button
          type="button"
          class="manage-row"
          data-testid="account-switcher-manage"
          @click="goToSettings"
        >
          <i class="pi pi-cog" />
          <span>Manage accounts</span>
        </button>
      </div>
    </Popover>
  </template>
</template>

<style scoped>
/* ---------------------------------------------------------------------------
 * Resting trigger: matches .nav-link styling from AppLayout.vue
 * ------------------------------------------------------------------------- */
.switcher-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background-color: transparent;
  color: var(--p-text-muted-color);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 150ms ease-out;
  min-width: 0;
}

.switcher-trigger:hover {
  background-color: var(--app-surface-100);
  color: var(--p-text-color);
}

.switcher-trigger--open {
  background-color: var(--app-surface-100);
  color: var(--p-text-color);
}

.trigger-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.trigger-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.trigger-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.chain-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--p-primary-color);
  background-color: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
  border-radius: 4px;
  flex-shrink: 0;
}

.trigger-address {
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-chevron {
  font-size: 0.75rem;
  flex-shrink: 0;
  transition: transform 150ms ease-out;
}

.switcher-trigger--open .trigger-chevron {
  transform: rotate(180deg);
}

/* ---------------------------------------------------------------------------
 * Empty state: dashed-border "Add account" CTA
 * ------------------------------------------------------------------------- */
.add-account-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: 1px dashed var(--app-surface-300);
  border-radius: 8px;
  background-color: transparent;
  color: var(--p-text-muted-color);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease-out;
}

.add-account-cta:hover {
  border-color: var(--p-primary-color);
  color: var(--p-primary-color);
  background-color: color-mix(in srgb, var(--p-primary-color) 6%, transparent);
}

.add-account-cta i {
  font-size: 0.875rem;
}

/* ---------------------------------------------------------------------------
 * Popover body (mounted at document.body via appendTo)
 * ------------------------------------------------------------------------- */
:global(.account-switcher-popover .p-popover-content) {
  padding: 6px;
  width: 280px;
}

.popover-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.account-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}

.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  position: relative;
  transition: background-color 150ms ease-out;
  min-width: 0;
}

.account-row:hover {
  background-color: var(--app-surface-100);
}

.account-row--active {
  background-color: color-mix(in srgb, var(--p-primary-color) 4%, transparent);
}

.account-row--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background-color: color-mix(in srgb, var(--p-primary-color) 40%, transparent);
}

.account-row-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.account-row-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.account-row-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.account-row-chain {
  white-space: nowrap;
}

.account-row-address {
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-primary-color);
  background-color: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  padding: 2px 8px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.popover-divider {
  height: 1px;
  background-color: var(--app-surface-200);
  margin: 4px 6px;
}

.manage-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: var(--p-text-muted-color);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all 150ms ease-out;
}

.manage-row:hover {
  background-color: var(--app-surface-100);
  color: var(--p-text-color);
}

.manage-row i {
  font-size: 0.875rem;
  width: 16px;
  text-align: center;
}
</style>
