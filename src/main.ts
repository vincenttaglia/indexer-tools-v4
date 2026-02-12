import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { VueQueryPlugin } from '@tanstack/vue-query'
import PrimeVue from 'primevue/config'
import { definePreset } from '@primeuix/styled'
import Aura from '@primevue/themes/aura'
import router from '@/router'
import { loadRuntimeConfig } from '@/config/runtimeConfig'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAccountStore } from '@/stores/accountStore'

const PurplePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{purple.50}', 100: '{purple.100}', 200: '{purple.200}',
      300: '{purple.300}', 400: '{purple.400}', 500: '{purple.500}',
      600: '{purple.600}', 700: '{purple.700}', 800: '{purple.800}',
      900: '{purple.900}', 950: '{purple.950}',
    },
  },
})
import App from '@/App.vue'
import '@/styles/main.css'

async function bootstrap() {
  const app = createApp(App)

  // Pinia (client state: settings, filters, wizard, selections)
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  app.use(pinia)

  // TanStack Query (server state: all fetched data)
  app.use(VueQueryPlugin, {
    queryClientConfig: {
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          retry: 2,
          refetchOnWindowFocus: false,
        },
      },
    },
  })

  // PrimeVue (UI components)
  app.use(PrimeVue, {
    theme: {
      preset: PurplePreset,
      options: {
        darkModeSelector: '.app-dark',
      },
    },
  })

  // Router
  app.use(router)

  // Load runtime config from /config.json (Docker env var injection).
  // Only applies defaults when the user has no existing localStorage data.
  const config = await loadRuntimeConfig()
  console.log('[bootstrap] Runtime config loaded:', JSON.stringify(config))

  const settingsStore = useSettingsStore()
  if (!settingsStore.theGraphApiKey && config.theGraphApiKey) {
    settingsStore.theGraphApiKey = config.theGraphApiKey
  }
  if (!settingsStore.drpcApiKey && config.drpcApiKey) {
    settingsStore.drpcApiKey = config.drpcApiKey
  }

  const accountStore = useAccountStore()
  console.log('[bootstrap] Existing accounts in store:', accountStore.accounts.length, JSON.stringify(accountStore.accounts))
  console.log('[bootstrap] Active account key:', accountStore.activeAccountKey)

  if (config.accounts?.length) {
    if (accountStore.accounts.length === 0) {
      // No existing accounts — add all from config
      console.log('[bootstrap] No existing accounts, adding', config.accounts.length, 'from config')
      for (const account of config.accounts) {
        accountStore.addAccount(account)
      }
    } else {
      // Existing accounts — merge endpoint config from runtime config into
      // matching accounts (same address+chain) that are missing endpoints.
      // This handles the case where a user added an account via Settings
      // but didn't configure agent/graphman endpoints, and the Docker env
      // vars provide them.
      console.log('[bootstrap] Merging config into existing accounts')
      for (const configAccount of config.accounts) {
        const key = `${configAccount.address.toLowerCase()}-${configAccount.chain}`
        const existing = accountStore.accounts.find(
          (a) => `${a.address.toLowerCase()}-${a.chain}` === key,
        )
        if (existing) {
          console.log('[bootstrap] Found matching account:', key, 'agentEndpoint:', existing.agentEndpoint, '→', configAccount.agentEndpoint)
          if (!existing.agentEndpoint && configAccount.agentEndpoint) {
            existing.agentEndpoint = configAccount.agentEndpoint
          }
          if (!existing.graphmanEndpoint && configAccount.graphmanEndpoint) {
            existing.graphmanEndpoint = configAccount.graphmanEndpoint
          }
          if (!existing.graphmanToken && configAccount.graphmanToken) {
            existing.graphmanToken = configAccount.graphmanToken
          }
        } else {
          // Account doesn't exist yet — add it
          console.log('[bootstrap] No matching account for', key, '- adding new')
          accountStore.addAccount(configAccount)
        }
      }
    }
  } else {
    console.log('[bootstrap] No accounts in runtime config')
  }

  console.log('[bootstrap] Final accounts:', JSON.stringify(accountStore.accounts))
  console.log('[bootstrap] Active account:', JSON.stringify(accountStore.activeAccount))

  app.mount('#app')
  console.log('[bootstrap] App mounted')
}

bootstrap()
