import React, { createContext, useContext, useReducer, useCallback } from 'react'

const initialState = {
  dialog: {
    visible: false,
    title: '',
    message: '',
    actions: [{ text: 'OK', style: 'default' }],
  },
}

const uiReducer = (state, action) => {
  switch (action.type) {
    case 'SHOW_DIALOG':
      return {
        ...state,
        dialog: {
          visible: true,
          title: String(action.payload.title || 'Thông báo'),
          message: String(action.payload.message || ''),
          actions: action.payload.actions || [{ text: 'OK', style: 'default' }],
        },
      }
    case 'CLOSE_DIALOG':
      return {
        ...state,
        dialog: { ...state.dialog, visible: false },
      }
    case 'CLEAR_DIALOG':
      return {
        ...state,
        dialog: {
          visible: false,
          title: '',
          message: '',
          actions: [{ text: 'OK', style: 'default' }],
        },
      }
    default:
      return state
  }
}

const UiContext = createContext(null)

export const useUiStore = () => {
  const context = useContext(UiContext)
  if (!context) {
    throw new Error('useUiStore must be used within UiProvider')
  }
  return context
}

export const UiProvider = ({ children }) => {
  const [state, dispatch] = useReducer(uiReducer, initialState)

  const showDialog = useCallback(({ title, message, actions }) => {
    const safeActions = Array.isArray(actions) && actions.length > 0
      ? actions
      : [{ text: 'OK', style: 'default' }]

    dispatch({
      type: 'SHOW_DIALOG',
      payload: { title, message, actions: safeActions },
    })
  }, [])

  const closeDialog = useCallback(() => {
    dispatch({ type: 'CLOSE_DIALOG' })
  }, [])

  const showNotice = useCallback((title, message) => {
    showDialog({ title, message })
  }, [showDialog])

  const showConfirm = useCallback(({ title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', variant = 'warning' }) => {
    return new Promise((resolve) => {
      dispatch({
        type: 'SHOW_DIALOG',
        payload: {
          title,
          message,
          actions: [
            { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
            { text: confirmText, style: variant, onPress: () => resolve(true) },
          ],
        },
      })
    })
  }, [])

  const showPrompt = useCallback(({ title, message, defaultValue = '', placeholder = '', confirmText = 'OK', cancelText = 'Hủy' }) => {
    return new Promise((resolve) => {
      dispatch({
        type: 'SHOW_DIALOG',
        payload: {
          title,
          message,
          actions: [
            { text: cancelText, style: 'cancel', onPress: () => resolve(null) },
            { text: confirmText, style: 'primary', onPress: (inputValue) => resolve(inputValue) },
          ],
          inputProps: { defaultValue, placeholder },
          isPrompt: true,
        },
      })
    })
  }, [])

  const clearDialog = useCallback(() => {
    dispatch({ type: 'CLEAR_DIALOG' })
  }, [])

  const value = {
    ...state,
    showDialog,
    closeDialog,
    showNotice,
    showConfirm,
    showPrompt,
    clearDialog,
  }

  return (
    <UiContext.Provider value={value}>
      {children}
    </UiContext.Provider>
  )
}

export default useUiStore
