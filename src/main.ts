import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { VueQueryPlugin } from '@tanstack/vue-query'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import router from '@/router'
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
    preset: Aura,
    options: {
      darkModeSelector: '.app-dark',
    },
  },
})

// Router
app.use(router)

app.mount('#app')
