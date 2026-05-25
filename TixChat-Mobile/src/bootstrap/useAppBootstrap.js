import { useEffect } from 'react'
import { setInMemoryAuth } from '../services/api'
import { storage } from '../services/storage'
import { useAuthStore } from '../stores/authStore'

export const normalizeAuthState = (auth = {}) => {
  const user = auth?.user
    ? {
        ...auth.user,
        _id: auth.user?._id || auth.user?.userId,
      }
    : null

  return {
    user,
    accessToken: auth?.accessToken || '',
    refreshToken: auth?.refreshToken || '',
  }
}

export const syncAuthStoreState = (auth = {}) => {
  const nextAuth = normalizeAuthState(auth)
  useAuthStore.setState({
    user: nextAuth.user,
    accessToken: nextAuth.accessToken || null,
    refreshToken: nextAuth.refreshToken || '',
    isAuthenticated: Boolean(nextAuth.user && nextAuth.accessToken),
    authLoading: false,
    authError: '',
  })
}

export const useAppBootstrap = ({
  setBooting,
  setBootHasCachedAuth,
  setUser,
  setAccessToken,
  setRefreshToken,
  setConversationPreferences,
}) => {
  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      try {
        const [cached, cachedPreferences] = await Promise.all([
          storage.getAuth(),
          storage.getConversationPreferences(),
        ])
        const hasCachedAuth = Boolean(cached?.accessToken && cached?.user)

        if (!mounted) return

        setBootHasCachedAuth(hasCachedAuth)

        if (hasCachedAuth) {
          const normalizedAuth = normalizeAuthState(cached)
          setInMemoryAuth(normalizedAuth)
          syncAuthStoreState(normalizedAuth)
          setUser(normalizedAuth.user)
          setAccessToken(normalizedAuth.accessToken)
          setRefreshToken(normalizedAuth.refreshToken || '')
        }

        if (cachedPreferences && typeof cachedPreferences === 'object') {
          setConversationPreferences(cachedPreferences)
        }
      } finally {
        if (mounted) {
          setBooting(false)
        }
      }
    }

    bootstrap()

    return () => {
      mounted = false
    }
  }, [
    setAccessToken,
    setBootHasCachedAuth,
    setBooting,
    setConversationPreferences,
    setRefreshToken,
    setUser,
  ])
}
