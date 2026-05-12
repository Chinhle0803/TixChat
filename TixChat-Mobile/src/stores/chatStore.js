import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = {
  CONVERSATION_PREFERENCES: 'tixchat:conversationPreferences',
}

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') {
    return String(value._id || value.userId || value.id || value.conversationId || value.messageId || '')
  }
  return String(value)
}

const sortConversations = (items) => {
  const parseTimestamp = (value) => {
    if (!value) return 0
    const date = new Date(value)
    const ts = date.getTime()
    if (!Number.isNaN(ts)) return ts
    if (typeof value === 'number') return value
    return 0
  }

  return [...(items || [])].sort((a, b) => {
    const tsA = parseTimestamp(a?.lastMessageAt) || parseTimestamp(a?.latestMessage?.createdAt) || parseTimestamp(a?.updatedAt)
    const tsB = parseTimestamp(b?.lastMessageAt) || parseTimestamp(b?.latestMessage?.createdAt) || parseTimestamp(b?.updatedAt)
    return tsB - tsA
  })
}

const initialState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  onlineUsers: [],
  typingUsers: {},
  unreadByConversation: {},
  friendRequestCount: 0,
  preferences: {},
  profileCache: {},
  loadingConversations: false,
  loadingMessages: false,
}

const chatReducer = (state, action) => {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload }
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: sortConversations(action.payload || []) }
    case 'UPSERT_CONVERSATION': {
      const { conversationId, patch } = action.payload
      const existing = state.conversations.find(
        (c) => normalizeId(c?._id || c?.conversationId) === conversationId
      )
      const merged = {
        ...(existing || { _id: conversationId, conversationId, participants: [], type: '1-1' }),
        ...patch,
        _id: conversationId,
        conversationId,
      }
      const next = state.conversations.filter(
        (c) => normalizeId(c?._id || c?.conversationId) !== conversationId
      )
      return { ...state, conversations: sortConversations([...next, merged]) }
    }
    case 'REMOVE_CONVERSATION': {
      const conversationId = action.payload
      const targetId = normalizeId(conversationId)
      const currentConvId = normalizeId(state.currentConversation?._id || state.currentConversation?.conversationId)
      return {
        ...state,
        conversations: state.conversations.filter(
          (c) => normalizeId(c?._id || c?.conversationId) !== targetId
        ),
        currentConversation: currentConvId === targetId ? null : state.currentConversation,
        messages: currentConvId === targetId ? [] : state.messages,
      }
    }
    case 'ADD_MESSAGE': {
      const message = action.payload
      const msgId = normalizeId(message?._id || message?.messageId)
      const exists = state.messages.some(
        (m) => normalizeId(m?._id || m?.messageId) === msgId
      )
      if (exists) return { ...state }
      return { ...state, messages: [...state.messages, message] }
    }
    case 'UPDATE_MESSAGE': {
      const { messageId, updatedMessage } = action.payload
      return {
        ...state,
        messages: state.messages.map((msg) => {
          const msgId = normalizeId(msg._id || msg.messageId)
          return msgId === normalizeId(messageId) ? { ...msg, ...updatedMessage } : msg
        }),
      }
    }
    case 'DELETE_MESSAGE': {
      const messageId = action.payload
      return {
        ...state,
        messages: state.messages.filter(
          (msg) => normalizeId(msg._id || msg.messageId) !== normalizeId(messageId)
        ),
      }
    }
    case 'SET_TYPING_USER': {
      const { conversationId, userId, isTyping } = action.payload
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: {
            ...(state.typingUsers[conversationId] || {}),
            [userId]: isTyping,
          },
        },
      }
    }
    case 'CLEAR_TYPING_USERS': {
      const conversationId = action.payload
      const next = { ...state.typingUsers }
      delete next[conversationId]
      return { ...state, typingUsers: next }
    }
    case 'INCREMENT_UNREAD': {
      const conversationId = action.payload
      return {
        ...state,
        unreadByConversation: {
          ...state.unreadByConversation,
          [conversationId]: (Number(state.unreadByConversation?.[conversationId]) || 0) + 1,
        },
      }
    }
    case 'CLEAR_UNREAD': {
      const conversationId = action.payload
      return {
        ...state,
        unreadByConversation: {
          ...state.unreadByConversation,
          [conversationId]: 0,
        },
      }
    }
    case 'RESET':
      return {
        ...initialState,
        preferences: state.preferences,
      }
    default:
      return state
  }
}

const ChatContext = createContext(null)

export const useChatStore = () => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatStore must be used within ChatProvider')
  }
  return context
}

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState)

  const setLoadingConversations = useCallback((loading) => {
    dispatch({ type: 'SET_STATE', payload: { loadingConversations: loading } })
  }, [])

  const setLoadingMessages = useCallback((loading) => {
    dispatch({ type: 'SET_STATE', payload: { loadingMessages: loading } })
  }, [])

  const setConversations = useCallback((conversations) => {
    dispatch({ type: 'SET_CONVERSATIONS', payload: conversations })
  }, [])

  const upsertConversation = useCallback((conversationId, patch) => {
    dispatch({ type: 'UPSERT_CONVERSATION', payload: { conversationId, patch } })
  }, [])

  const removeConversation = useCallback((conversationId) => {
    dispatch({ type: 'REMOVE_CONVERSATION', payload: conversationId })
  }, [])

  const setCurrentConversation = useCallback((conversation) => {
    dispatch({ type: 'SET_STATE', payload: { currentConversation: conversation } })
  }, [])

  const clearCurrentConversation = useCallback(() => {
    dispatch({ type: 'SET_STATE', payload: { currentConversation: null, messages: [] } })
  }, [])

  const setMessages = useCallback((messages) => {
    dispatch({ type: 'SET_STATE', payload: { messages: messages || [] } })
  }, [])

  const addMessage = useCallback((message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message })
  }, [])

  const updateMessage = useCallback((messageId, updatedMessage) => {
    dispatch({ type: 'UPDATE_MESSAGE', payload: { messageId, updatedMessage } })
  }, [])

  const deleteMessage = useCallback((messageId) => {
    dispatch({ type: 'DELETE_MESSAGE', payload: messageId })
  }, [])

  const removeMessage = useCallback((messageId) => {
    dispatch({ type: 'DELETE_MESSAGE', payload: messageId })
  }, [])

  const setOnlineUsers = useCallback((users) => {
    dispatch({ type: 'SET_STATE', payload: { onlineUsers: users || [] } })
  }, [])

  const addOnlineUser = useCallback((userId) => {
    const normalizedId = normalizeId(userId)
    if (state.onlineUsers.some((u) => normalizeId(u._id) === normalizedId)) {
      return
    }
    dispatch({ type: 'SET_STATE', payload: { onlineUsers: [...state.onlineUsers, { _id: normalizedId }] } })
  }, [state.onlineUsers])

  const removeOnlineUser = useCallback((userId) => {
    dispatch({
      type: 'SET_STATE',
      payload: {
        onlineUsers: state.onlineUsers.filter((u) => normalizeId(u._id) !== normalizeId(userId)),
      },
    })
  }, [state.onlineUsers])

  const setTypingUser = useCallback((conversationId, userId, isTyping) => {
    dispatch({ type: 'SET_TYPING_USER', payload: { conversationId, userId, isTyping } })
  }, [])

  const clearTypingUsers = useCallback((conversationId) => {
    dispatch({ type: 'CLEAR_TYPING_USERS', payload: conversationId })
  }, [])

  const incrementUnread = useCallback((conversationId) => {
    dispatch({ type: 'INCREMENT_UNREAD', payload: conversationId })
  }, [])

  const clearUnread = useCallback((conversationId) => {
    dispatch({ type: 'CLEAR_UNREAD', payload: conversationId })
  }, [])

  const setUnreadCounts = useCallback((counts) => {
    dispatch({ type: 'SET_STATE', payload: { unreadByConversation: counts || {} } })
  }, [])

  const setUnread = useCallback((conversationId, count) => {
    dispatch({
      type: 'SET_STATE',
      payload: {
        unreadByConversation: {
          ...state.unreadByConversation,
          [conversationId]: Math.max(0, Number(count) || 0),
        },
      },
    })
  }, [state.unreadByConversation])

  const setFriendRequestCount = useCallback((count) => {
    dispatch({ type: 'SET_STATE', payload: { friendRequestCount: Math.max(0, Number(count) || 0) } })
  }, [])

  const incrementFriendRequestCount = useCallback(() => {
    dispatch({ type: 'SET_STATE', payload: { friendRequestCount: (state.friendRequestCount || 0) + 1 } })
  }, [state.friendRequestCount])

  const decrementFriendRequestCount = useCallback(() => {
    dispatch({ type: 'SET_STATE', payload: { friendRequestCount: Math.max(0, (state.friendRequestCount || 0) - 1) } })
  }, [state.friendRequestCount])

  const setPreferences = useCallback((preferences) => {
    dispatch({ type: 'SET_STATE', payload: { preferences: preferences || {} } })
  }, [])

  const updatePreference = useCallback((conversationId, patch) => {
    dispatch({
      type: 'SET_STATE',
      payload: {
        preferences: {
          ...state.preferences,
          [conversationId]: {
            ...(state.preferences?.[conversationId] || {}),
            ...patch,
          },
        },
      },
    })
  }, [state.preferences])

  const savePreferences = useCallback(async () => {
    try {
      await AsyncStorage.setItem(KEYS.CONVERSATION_PREFERENCES, JSON.stringify(state.preferences))
    } catch (error) {
      console.error('Failed to save preferences:', error)
    }
  }, [state.preferences])

  const loadPreferences = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.CONVERSATION_PREFERENCES)
      if (raw) {
        const cached = JSON.parse(raw)
        if (cached && typeof cached === 'object') {
          dispatch({ type: 'SET_STATE', payload: { preferences: cached } })
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
    }
  }, [])

  const setProfileCache = useCallback((profileMap) => {
    dispatch({ type: 'SET_STATE', payload: { profileCache: profileMap || {} } })
  }, [])

  const updateProfileCache = useCallback((userId, profile) => {
    dispatch({
      type: 'SET_STATE',
      payload: {
        profileCache: {
          ...state.profileCache,
          [userId]: {
            ...(state.profileCache?.[userId] || {}),
            ...profile,
            _id: userId,
            userId: userId,
          },
        },
      },
    })
  }, [state.profileCache])

  const getDisplayName = useCallback((profile) => {
    if (!profile) return 'Người dùng'
    return String(
      profile?.nickname ||
      profile?.displayName ||
      profile?.fullName ||
      profile?.name ||
      profile?.username ||
      'Người dùng'
    ).trim()
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const value = {
    ...state,
    setLoadingConversations,
    setLoadingMessages,
    setConversations,
    upsertConversation,
    removeConversation,
    setCurrentConversation,
    clearCurrentConversation,
    setMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    removeMessage,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
    setTypingUser,
    clearTypingUsers,
    setUnreadCounts,
    incrementUnread,
    clearUnread,
    setUnread,
    setFriendRequestCount,
    incrementFriendRequestCount,
    decrementFriendRequestCount,
    setPreferences,
    updatePreference,
    savePreferences,
    loadPreferences,
    setProfileCache,
    updateProfileCache,
    getDisplayName,
    reset,
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}

export default useChatStore
