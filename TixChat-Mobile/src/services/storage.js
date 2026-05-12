import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = {
  USER: 'tixchat:user',
  ACCESS_TOKEN: 'tixchat:accessToken',
  REFRESH_TOKEN: 'tixchat:refreshToken',
  CONVERSATION_PREFERENCES: 'tixchat:conversationPreferences',
}

export const storage = {
  async getAuth() {
    const [userRaw, accessToken, refreshToken] = await Promise.all([
      AsyncStorage.getItem(KEYS.USER),
      AsyncStorage.getItem(KEYS.ACCESS_TOKEN),
      AsyncStorage.getItem(KEYS.REFRESH_TOKEN),
    ])

    return {
      user: userRaw ? JSON.parse(userRaw) : null,
      accessToken: accessToken || null,
      refreshToken: refreshToken || null,
    }
  },

  async setAuth({ user, accessToken, refreshToken }) {
    const updates = [
      AsyncStorage.setItem(KEYS.USER, JSON.stringify(user || null)),
      AsyncStorage.setItem(KEYS.ACCESS_TOKEN, accessToken || ''),
      AsyncStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken || ''),
    ]

    await Promise.all(updates)
  },

  async clearAuth() {
    await Promise.all([
      AsyncStorage.removeItem(KEYS.USER),
      AsyncStorage.removeItem(KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(KEYS.REFRESH_TOKEN),
    ])
  },

  async getConversationPreferences() {
    const raw = await AsyncStorage.getItem(KEYS.CONVERSATION_PREFERENCES)
    if (!raw) return {}

    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {}
      }

      return parsed
    } catch (_) {
      return {}
    }
  },

  async setConversationPreferences(preferences) {
    const safePreferences =
      preferences && typeof preferences === 'object' && !Array.isArray(preferences)
        ? preferences
        : {}

    await AsyncStorage.setItem(KEYS.CONVERSATION_PREFERENCES, JSON.stringify(safePreferences))
  },
}
