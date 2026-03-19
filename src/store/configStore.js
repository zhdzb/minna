import { defineStore } from 'pinia'

const STORAGE_KEY = 'minna_app_config'

const getDefaultConfig = () => ({
  api_key: '',
  api_timeout: 30000,
  max_retries: 3
})

export const useConfigStore = defineStore('config', {
  state: () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return { ...getDefaultConfig(), ...parsed }
      } catch (e) {
        console.error('Failed to parse config, using defaults', e)
      }
    }
    return getDefaultConfig()
  },

  getters: {
    apiKey: (state) => state.api_key,
    hasApiKey: (state) => !!state.api_key
  },

  actions: {
    setApiKey(key) {
      this.api_key = key
      this.save()
    },

    clearApiKey() {
      this.api_key = ''
      this.save()
    },

    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
    },

    load() {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          this.$patch(JSON.parse(saved))
        } catch (e) {
          console.error('Failed to load config', e)
        }
      }
    }
  }
})
