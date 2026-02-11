import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { VueQueryPlugin } from '@tanstack/vue-query'
import PrimeVue from 'primevue/config'
import { definePreset } from '@primeuix/styled'
import Aura from '@primevue/themes/aura'
import router from '@/router'

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

app.mount('#app')
