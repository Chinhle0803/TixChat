import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { disconnectSocket } from '../services/socket'

const KEYS = {
  USER: 'tixchat:user',
  ACCESS_TOKEN: 'tixchat:accessToken',
  REFRESH_TOKEN: 'tixchat:refreshToken',
}

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  authLoading: true,
  authError: '',
}

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload }
    case 'SET_LOADING':
      return { ...state, authLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, authError: action.payload }
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        authError: '',
      }
    case 'INIT_COMPLETE':
      return { ...state, authLoading: false }
    default:
      return state
  }
}

const AuthContext = createContext(null)

export const useAuthStore = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthStore must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const isInitialized = useRef(false)

  const initialize = useCallback(async () => {
    if (isInitialized.current) return
    isInitialized.current = true

    try {
      const [userRaw, accessToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem(KEYS.USER),
        AsyncStorage.getItem(KEYS.ACCESS_TOKEN),
        AsyncStorage.getItem(KEYS.REFRESH_TOKEN),
      ])

      const user = userRaw ? JSON.parse(userRaw) : null

      if (accessToken && user) {
        dispatch({
          type: 'SET_STATE',
          payload: {
            user,
            accessToken,
            refreshToken: refreshToken || '',
            isAuthenticated: true,
            authLoading: false,
          },
        })
      } else {
        dispatch({ type: 'INIT_COMPLETE' })
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error)
      dispatch({ type: 'INIT_COMPLETE' })
    }
  }, [])

  useEffect(() => {
    initialize()
  }, [initialize])

  const setAuth = useCallback(async (user, accessToken, refreshToken) => {
    await Promise.all([
      AsyncStorage.setItem(KEYS.USER, JSON.stringify(user || null)),
      AsyncStorage.setItem(KEYS.ACCESS_TOKEN, accessToken || ''),
      AsyncStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken || ''),
    ])

    const normalizedUser = {
      ...user,
      _id: user?._id || user?.userId,
    }

    dispatch({
      type: 'SET_STATE',
      payload: {
        user: normalizedUser,
        accessToken,
        refreshToken: refreshToken || '',
        isAuthenticated: true,
        authError: '',
      },
    })
  }, [])

  const updateUser = useCallback((user) => {
    const current = state
    const updatedUser = {
      ...current.user,
      ...user,
      _id: user?._id || user?.userId || current.user?._id,
    }

    Promise.all([
      AsyncStorage.setItem(KEYS.USER, JSON.stringify(updatedUser)),
      AsyncStorage.setItem(KEYS.ACCESS_TOKEN, current.accessToken || ''),
      AsyncStorage.setItem(KEYS.REFRESH_TOKEN, current.refreshToken || ''),
    ]).catch(() => {})

    dispatch({
      type: 'SET_STATE',
      payload: { user: updatedUser },
    })
  }, [state])

  const setAuthLoading = useCallback((loading) => {
    dispatch({ type: 'SET_LOADING', payload: loading })
  }, [])

  const setAuthError = useCallback((error) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }, [])

  const logout = useCallback(async () => {
    disconnectSocket()
    await Promise.all([
      AsyncStorage.removeItem(KEYS.USER),
      AsyncStorage.removeItem(KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(KEYS.REFRESH_TOKEN),
    ])

    dispatch({ type: 'LOGOUT' })
  }, [])

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: '' })
  }, [])

  const value = {
    ...state,
    setAuth,
    updateUser,
    setAuthLoading,
    setAuthError,
    logout,
    clearError,
    initialize,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default useAuthStore
