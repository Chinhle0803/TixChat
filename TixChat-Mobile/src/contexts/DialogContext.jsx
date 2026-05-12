import React, { createContext, useContext, useCallback } from 'react'
import { useUiStore } from '../stores/uiStore'

const DialogContext = createContext(null)

export const useDialog = () => {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialog must be used within DialogProvider')
  }
  return context
}

export const DialogProvider = ({ children }) => {
  const {
    dialog,
    showDialog,
    closeDialog,
    showNotice,
    showConfirm,
    showPrompt,
    clearDialog,
  } = useUiStore()

  const notify = useCallback(async (options) => {
    const { title, message, confirmText = 'OK', variant = 'info' } = options || {}

    return new Promise((resolve) => {
      showDialog({
        title,
        message,
        actions: [
          {
            text: confirmText,
            style: variant === 'error' ? 'danger' : variant === 'warning' ? 'warning' : 'default',
            onPress: () => resolve(true),
          },
        ],
      })
    })
  }, [showDialog])

  const confirm = useCallback(async (options) => {
    const {
      title,
      message,
      confirmText = 'Xác nhận',
      cancelText = 'Hủy',
      variant = 'warning',
    } = options || {}

    return showConfirm({
      title,
      message,
      confirmText,
      cancelText,
      variant,
    })
  }, [showConfirm])

  const prompt = useCallback(async (options) => {
    const {
      title,
      message,
      defaultValue = '',
      placeholder = '',
      confirmText = 'OK',
      cancelText = 'Hủy',
    } = options || {}

    return showPrompt({
      title,
      message,
      defaultValue,
      placeholder,
      confirmText,
      cancelText,
    })
  }, [showPrompt])

  const value = {
    dialog,
    notify,
    confirm,
    prompt,
    closeDialog,
    showDialog,
    clearDialog,
  }

  return (
    <DialogContext.Provider value={value}>
      {children}
    </DialogContext.Provider>
  )
}

export default DialogProvider
