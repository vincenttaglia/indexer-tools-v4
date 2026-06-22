import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { VueQueryPlugin } from '@tanstack/vue-query'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
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
  app.directive('tooltip', Tooltip)

  // Router
  app.use(router)

  // Load runtime config from /config.json (Docker env var injection).
  // Only applies defaults when the user has no existing localStorage data.
  const config = await loadRuntimeConfig()

  const settingsStore = useSettingsStore()
  if (!settingsStore.theGraphApiKey && config.theGraphApiKey) {
    settingsStore.theGraphApiKey = config.theGraphApiKey
  }
  if (!settingsStore.drpcApiKey && config.drpcApiKey) {
    settingsStore.drpcApiKey = config.drpcApiKey
  }

  const accountStore = useAccountStore()
  if (config.accounts?.length) {
    for (const configAccount of config.accounts) {
      const key = `${configAccount.address.toLowerCase()}-${configAccount.chain}`
      const existing = accountStore.accounts.find(
        (a) => `${a.address.toLowerCase()}-${a.chain}` === key,
      )
      if (existing) {
        // Always apply endpoint config from Docker env vars — they are the
        // authoritative source for proxy paths (regenerated each boot).
        if (configAccount.agentEndpoint) {
          existing.agentEndpoint = configAccount.agentEndpoint
        }
        if (configAccount.graphmanEndpoint) {
          existing.graphmanEndpoint = configAccount.graphmanEndpoint
        }
        if (configAccount.graphmanToken) {
          existing.graphmanToken = configAccount.graphmanToken
        }
      } else {
        accountStore.addAccount(configAccount)
      }
    }

    // Ensure an account is active after config loading
    if (!accountStore.activeAccountKey && accountStore.accounts.length > 0) {
      const firstKey = `${accountStore.accounts[0]!.address.toLowerCase()}-${accountStore.accounts[0]!.chain}`
      accountStore.setActive(firstKey)
    }
  }

  app.mount('#app')
}

bootstrap()
