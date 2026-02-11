<script setup lang="ts">
import { ref } from 'vue'

// PrimeVue components
import Stepper from 'primevue/stepper'
import StepList from 'primevue/steplist'
import StepPanels from 'primevue/steppanels'
import Step from 'primevue/step'
import StepPanel from 'primevue/steppanel'
import Button from 'primevue/button'

// Wizard step components
import WizardStepClose from '@/views/wizard/WizardStepClose.vue'
import WizardStepPOI from '@/views/wizard/WizardStepPOI.vue'
import WizardStepSelect from '@/views/wizard/WizardStepSelect.vue'
import WizardStepAllocate from '@/views/wizard/WizardStepAllocate.vue'
import WizardStepExecute from '@/views/wizard/WizardStepExecute.vue'
import WizardSummary from '@/views/wizard/WizardSummary.vue'

// Stores
import { useWizardStore } from '@/stores'

const wizardStore = useWizardStore()

// Active step (string values to match PrimeVue Stepper API)
const activeStep = ref<string>('1')
</script>

<template>
  <div class="allocation-wizard">
    <!-- Header -->
    <div class="wizard-header">
      <h1 class="page-title">Allocation Wizard</h1>
      <Button
        label="Clear All"
        icon="pi pi-times"
        severity="secondary"
        outlined
        size="small"
        @click="wizardStore.clearAll(); activeStep = '1'"
      />
    </div>

    <!-- Stepper -->
    <div class="stepper-wrapper">
      <Stepper v-model:value="activeStep" linear>
        <StepList>
          <Step value="1">Close Allocations</Step>
          <Step value="2">Set POIs</Step>
          <Step value="3">Pick Subgraphs</Step>
          <Step value="4">Set Allocations</Step>
          <Step value="5">Execute</Step>
        </StepList>
        <StepPanels>
          <StepPanel v-slot="{ activateCallback }" value="1">
            <div class="step-content">
              <WizardStepClose />
              <div class="step-nav">
                <span />
                <Button
                  label="Next"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  @click="activateCallback('2')"
                />
              </div>
            </div>
          </StepPanel>
          <StepPanel v-slot="{ activateCallback }" value="2">
            <div class="step-content">
              <WizardStepPOI />
              <div class="step-nav">
                <Button
                  label="Back"
                  icon="pi pi-arrow-left"
                  severity="secondary"
                  outlined
                  @click="activateCallback('1')"
                />
                <Button
                  label="Next"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  @click="activateCallback('3')"
                />
              </div>
            </div>
          </StepPanel>
          <StepPanel v-slot="{ activateCallback }" value="3">
            <div class="step-content">
              <WizardStepSelect />
              <div class="step-nav">
                <Button
                  label="Back"
                  icon="pi pi-arrow-left"
                  severity="secondary"
                  outlined
                  @click="activateCallback('2')"
                />
                <Button
                  label="Next"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  :disabled="wizardStore.selectedDeployments.size === 0"
                  @click="activateCallback('4')"
                />
              </div>
            </div>
          </StepPanel>
          <StepPanel v-slot="{ activateCallback }" value="4">
            <div class="step-content">
              <WizardStepAllocate />
              <div class="step-nav">
                <Button
                  label="Back"
                  icon="pi pi-arrow-left"
                  severity="secondary"
                  outlined
                  @click="activateCallback('3')"
                />
                <Button
                  label="Next"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  :disabled="wizardStore.totalAllocated <= 0 && wizardStore.closingAllocations.size === 0"
                  @click="activateCallback('5')"
                />
              </div>
            </div>
          </StepPanel>
          <StepPanel v-slot="{ activateCallback }" value="5">
            <div class="step-content">
              <WizardStepExecute />
              <div class="step-nav">
                <Button
                  label="Back"
                  icon="pi pi-arrow-left"
                  severity="secondary"
                  outlined
                  @click="activateCallback('4')"
                />
                <span />
              </div>
            </div>
          </StepPanel>
        </StepPanels>
      </Stepper>
    </div>

    <!-- Summary footer -->
    <WizardSummary />
  </div>
</template>

<style scoped>
.allocation-wizard {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 24px;
  overflow: hidden;
}

/* --- Header --- */
.wizard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 0;
  letter-spacing: -0.01em;
}

/* --- Stepper wrapper --- */
.stepper-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.stepper-wrapper :deep(.p-stepper) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.stepper-wrapper :deep(.p-steplist) {
  flex-shrink: 0;
}

.stepper-wrapper :deep(.p-steppanels) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.stepper-wrapper :deep(.p-steppanel) {
  height: 100%;
}

.stepper-wrapper :deep(.p-steppanel-content) {
  height: 100%;
}

/* --- Step content --- */
.step-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
  overflow: hidden;
}

/* --- Step navigation --- */
.step-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 8px 0;
}
</style>
