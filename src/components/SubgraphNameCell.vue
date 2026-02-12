<script setup lang="ts">
import { ref } from 'vue'
import Popover from 'primevue/popover'
import type { DeploymentStatus, HealthStatus } from '@/types/status'
import SubgraphAvatar from './SubgraphAvatar.vue'
import SubgraphDetailPanel from './SubgraphDetailPanel.vue'

defineProps<{
  displayName: string
  ipfsHash: string
  imageUrl: string | null
  network: string | null
  health: HealthStatus | null
  synced: boolean | null
  denied: boolean
  isDeployed: boolean
  isAllocated: boolean
  deploymentStatus: DeploymentStatus | null
  epochBlockNumber: number | null
  isOffchainSynced: boolean
  agentConnected: boolean
}>()

defineEmits<{
  addOffchainSync: []
  removeOffchainSync: []
}>()

const panelRef = ref<InstanceType<typeof Popover> | null>(null)

function togglePanel(event: Event) {
  panelRef.value?.toggle(event)
}
</script>

<template>
  <div class="name-cell">
    <SubgraphAvatar
      :image-url="imageUrl"
      :health="health"
      :synced="synced"
      :denied="denied"
      @click="togglePanel"
    />
    <div class="name-text">
      <span class="name-primary">
        {{ displayName }}
        <span v-if="isDeployed" class="deployed-dot" title="Deployed on your node" />
        <span v-if="isAllocated" class="allocated-dot" title="Currently allocated" />
      </span>
      <span class="name-hash">{{ ipfsHash }}</span>
    </div>
    <Popover ref="panelRef">
      <SubgraphDetailPanel
        :image-url="imageUrl"
        :display-name="displayName"
        :ipfs-hash="ipfsHash"
        :network="network"
        :health="health"
        :denied="denied"
        :deployment-status="deploymentStatus"
        :epoch-block-number="epochBlockNumber"
        :is-offchain-synced="isOffchainSynced"
        :agent-connected="agentConnected"
        @add-offchain-sync="$emit('addOffchainSync')"
        @remove-offchain-sync="$emit('removeOffchainSync')"
      />
    </Popover>
  </div>
</template>

<style scoped>
.name-cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
}

.name-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  overflow: hidden;
}

.name-primary {
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.deployed-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--p-green-400);
  flex-shrink: 0;
}

.allocated-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--p-primary-400);
  flex-shrink: 0;
}

.name-hash {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
    Menlo, Consolas, monospace;
  overflow-x: auto;
  white-space: nowrap;
  user-select: all;
}
</style>
