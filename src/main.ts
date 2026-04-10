import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'primeicons/primeicons.css'
import './style.css'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())
app.use(PrimeVue, {
  ripple: false,
  inputVariant: 'filled',
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: false,
    },
  },
})
app.mount('#app')
