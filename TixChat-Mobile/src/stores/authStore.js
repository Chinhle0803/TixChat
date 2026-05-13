import React, { useEffect } from 'react'
import { create } from 'zustand'
import { storage } from '../services/storage'
import { disconnectSocket } from '../services/socket'

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  authLoading: true,
  authError: '',
}

export const useAuthStore = create((set, get) => ({
  ...initialState,

  initialize: async () => {
    if (!get().authLoading && (get().user || get().accessToken !== null)) return

    try {
      const cached = await storage.getAuth()
      if (cached?.accessToken && cached?.user) {
        set({
          user: {
            ...cached.user,
            _id: cached.user?._id || cached.user?.userId,
          },
          accessToken: cached.accessToken,
          refreshToken: cached.refreshToken || '',
          isAuthenticated: true,
          authLoading: false,
          authError: '',
        })
        return
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error)
    }

    set({ authLoading: false })
  },

  setAuth: async (user, accessToken, refreshToken) => {
    const normalizedUser = user
      ? { ...user, _id: user?._id || user?.userId }
      : null

    await storage.setAuth({
      user: normalizedUser,
      accessToken: accessToken || '',
      refreshToken: refreshToken || '',
    })

    set({
      user: normalizedUser,
      accessToken,
      refreshToken: refreshToken || '',
      isAuthenticated: Boolean(normalizedUser && accessToken),
      authError: '',
      authLoading: false,
    })
  },

  updateUser: async (user) => {
    const current = get()
    const updatedUser = {
      ...current.user,
      ...user,
      _id: user?._id || user?.userId || current.user?._id,
    }

    await storage.setAuth({
      user: updatedUser,
      accessToken: current.accessToken || '',
      refreshToken: current.refreshToken || '',
    })

    set({ user: updatedUser })
  },

  setAuthLoading: (loading) => set({ authLoading: Boolean(loading) }),
  setAuthError: (error) => set({ authError: String(error || '') }),
  clearError: () => set({ authError: '' }),

  logout: async () => {
    disconnectSocket()
    await storage.clearAuth()
    set({
      ...initialState,
      authLoading: false,
    })
  },
}))

export const AuthProvider = ({ children }) => {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return children
}

export default useAuthStore
