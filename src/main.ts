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

  const settingsStore = useSettingsStore()
  if (!settingsStore.theGraphApiKey && config.theGraphApiKey) {
    settingsStore.theGraphApiKey = config.theGraphApiKey
  }
  if (!settingsStore.drpcApiKey && config.drpcApiKey) {
    settingsStore.drpcApiKey = config.drpcApiKey
  }

  const accountStore = useAccountStore()
  if (accountStore.accounts.length === 0 && config.accounts?.length) {
    for (const account of config.accounts) {
      accountStore.addAccount(account)
    }
  }

  app.mount('#app')
}

bootstrap()
