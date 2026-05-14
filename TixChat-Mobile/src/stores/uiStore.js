import React, { useEffect } from 'react'
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const THEME_PREFERENCE_KEY = 'tixchat.theme.v1'

const DEFAULT_DIALOG = {
  visible: false,
  title: '',
  message: '',
  actions: [{ text: 'OK', style: 'default' }],
  inputProps: null,
  isPrompt: false,
}

const normalizeThemePreference = (value) => {
  const preference = String(value || 'system').toLowerCase()
  if (preference === 'light' || preference === 'dark' || preference === 'system') {
    return preference
  }
  return 'system'
}

export const useUiStore = create((set, get) => ({
  dialog: DEFAULT_DIALOG,
  themePreference: 'system',
  themeReady: false,

  initializeThemePreference: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      set({
        themePreference: normalizeThemePreference(stored),
        themeReady: true,
      })
    } catch (_) {
      set({ themePreference: 'system', themeReady: true })
    }
  },

  setThemePreference: async (value) => {
    const nextPreference = normalizeThemePreference(value)
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, nextPreference)
    set({ themePreference: nextPreference })
  },

  showDialog: ({ title, message, actions, inputProps, isPrompt } = {}) => {
    const safeActions = Array.isArray(actions) && actions.length > 0
      ? actions
      : [{ text: 'OK', style: 'default' }]

    set({
      dialog: {
        visible: true,
        title: String(title || 'Thông báo'),
        message: String(message || ''),
        actions: safeActions,
        inputProps: inputProps || null,
        isPrompt: Boolean(isPrompt),
      },
    })
  },

  closeDialog: () => {
    set((state) => ({
      dialog: {
        ...state.dialog,
        visible: false,
      },
    }))
  },

  clearDialog: () => {
    set({ dialog: DEFAULT_DIALOG })
  },

  showNotice: (title, message) => {
    get().showDialog({ title, message })
  },

  showConfirm: ({ title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', variant = 'warning' } = {}) =>
    new Promise((resolve) => {
      get().showDialog({
        title,
        message,
        actions: [
          { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
          { text: confirmText, style: variant, onPress: () => resolve(true) },
        ],
      })
    }),

  showPrompt: ({
    title,
    message,
    defaultValue = '',
    placeholder = '',
    confirmText = 'OK',
    cancelText = 'Hủy',
  } = {}) =>
    new Promise((resolve) => {
      get().showDialog({
        title,
        message,
        actions: [
          { text: cancelText, style: 'cancel', onPress: () => resolve(null) },
          { text: confirmText, style: 'primary', onPress: (inputValue) => resolve(inputValue) },
        ],
        inputProps: { defaultValue, placeholder },
        isPrompt: true,
      })
    }),
}))

export const UiProvider = ({ children }) => {
  const initializeThemePreference = useUiStore((state) => state.initializeThemePreference)

  useEffect(() => {
    initializeThemePreference()
  }, [initializeThemePreference])

  return children
}

export default useUiStore
