import React, { useEffect } from 'react'
import { create } from 'zustand'
import { storage } from '../services/storage'

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') {
    return String(value._id || value.userId || value.id || value.conversationId || value.messageId || '')
  }
  return String(value)
}

const parseTimestamp = (value) => {
  if (!value) return 0
  const date = new Date(value)
  const ts = date.getTime()
  if (!Number.isNaN(ts)) return ts
  if (typeof value === 'number') return value
  return 0
}

const sortConversations = (items) =>
  [...(items || [])].sort((a, b) => {
    const tsA =
      parseTimestamp(a?.lastMessageAt) ||
      parseTimestamp(a?.latestMessage?.createdAt) ||
      parseTimestamp(a?.updatedAt)

    const tsB =
      parseTimestamp(b?.lastMessageAt) ||
      parseTimestamp(b?.latestMessage?.createdAt) ||
      parseTimestamp(b?.updatedAt)

    return tsB - tsA
  })

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

export const useChatStore = create((set, get) => ({
  ...initialState,

  setLoadingConversations: (loading) => set({ loadingConversations: Boolean(loading) }),
  setLoadingMessages: (loading) => set({ loadingMessages: Boolean(loading) }),

  setConversations: (conversations) => set({ conversations: sortConversations(conversations || []) }),

  upsertConversation: (conversationId, patch) =>
    set((state) => {
      const targetId = normalizeId(conversationId)
      const existing = state.conversations.find(
        (conversation) => normalizeId(conversation?._id || conversation?.conversationId) === targetId
      )

      const merged = {
        ...(existing || { _id: targetId, conversationId: targetId, participants: [], type: '1-1' }),
        ...patch,
        _id: targetId,
        conversationId: targetId,
      }

      const next = state.conversations.filter(
        (conversation) => normalizeId(conversation?._id || conversation?.conversationId) !== targetId
      )

      return { conversations: sortConversations([...next, merged]) }
    }),

  removeConversation: (conversationId) =>
    set((state) => {
      const targetId = normalizeId(conversationId)
      const currentConversationId = normalizeId(
        state.currentConversation?._id || state.currentConversation?.conversationId
      )

      return {
        conversations: state.conversations.filter(
          (conversation) => normalizeId(conversation?._id || conversation?.conversationId) !== targetId
        ),
        currentConversation: currentConversationId === targetId ? null : state.currentConversation,
        messages: currentConversationId === targetId ? [] : state.messages,
      }
    }),

  setCurrentConversation: (conversation) => set({ currentConversation: conversation || null }),
  clearCurrentConversation: () => set({ currentConversation: null, messages: [] }),
  setMessages: (messages) => set({ messages: messages || [] }),

  addMessage: (message) =>
    set((state) => {
      const messageId = normalizeId(message?._id || message?.messageId)
      const exists = state.messages.some(
        (item) => normalizeId(item?._id || item?.messageId) === messageId
      )
      return exists ? state : { messages: [...state.messages, message] }
    }),

  updateMessage: (messageId, updatedMessage) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        normalizeId(message?._id || message?.messageId) === normalizeId(messageId)
          ? { ...message, ...updatedMessage }
          : message
      ),
    })),

  deleteMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter(
        (message) => normalizeId(message?._id || message?.messageId) !== normalizeId(messageId)
      ),
    })),

  removeMessage: (messageId) => get().deleteMessage(messageId),
  setOnlineUsers: (users) => set({ onlineUsers: users || [] }),

  addOnlineUser: (userId) =>
    set((state) => {
      const targetId = normalizeId(userId)
      if (state.onlineUsers.some((user) => normalizeId(user?._id) === targetId)) {
        return state
      }
      return { onlineUsers: [...state.onlineUsers, { _id: targetId }] }
    }),

  removeOnlineUser: (userId) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.filter((user) => normalizeId(user?._id) !== normalizeId(userId)),
    })),

  setTypingUser: (conversationId, userId, isTyping) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: {
          ...(state.typingUsers?.[conversationId] || {}),
          [userId]: Boolean(isTyping),
        },
      },
    })),

  clearTypingUsers: (conversationId) =>
    set((state) => {
      const next = { ...state.typingUsers }
      delete next[conversationId]
      return { typingUsers: next }
    }),

  setUnreadCounts: (counts) => set({ unreadByConversation: counts || {} }),
  incrementUnread: (conversationId) =>
    set((state) => ({
      unreadByConversation: {
        ...state.unreadByConversation,
        [conversationId]: (Number(state.unreadByConversation?.[conversationId]) || 0) + 1,
      },
    })),

  clearUnread: (conversationId) =>
    set((state) => ({
      unreadByConversation: {
        ...state.unreadByConversation,
        [conversationId]: 0,
      },
    })),

  setUnread: (conversationId, count) =>
    set((state) => ({
      unreadByConversation: {
        ...state.unreadByConversation,
        [conversationId]: Math.max(0, Number(count) || 0),
      },
    })),

  setFriendRequestCount: (count) => set({ friendRequestCount: Math.max(0, Number(count) || 0) }),
  incrementFriendRequestCount: () => set((state) => ({ friendRequestCount: (state.friendRequestCount || 0) + 1 })),
  decrementFriendRequestCount: () =>
    set((state) => ({ friendRequestCount: Math.max(0, (state.friendRequestCount || 0) - 1) })),

  setPreferences: (preferences) => set({ preferences: preferences || {} }),
  updatePreference: (conversationId, patch) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        [conversationId]: {
          ...(state.preferences?.[conversationId] || {}),
          ...patch,
        },
      },
    })),

  savePreferences: async () => {
    await storage.setConversationPreferences(get().preferences)
  },

  loadPreferences: async () => {
    const preferences = await storage.getConversationPreferences()
    set({ preferences })
  },

  setProfileCache: (profileMap) => set({ profileCache: profileMap || {} }),
  updateProfileCache: (userId, profile) =>
    set((state) => ({
      profileCache: {
        ...state.profileCache,
        [userId]: {
          ...(state.profileCache?.[userId] || {}),
          ...profile,
          _id: userId,
          userId,
        },
      },
    })),

  getDisplayName: (profile) => {
    if (!profile) return 'Người dùng'
    return String(
      profile?.nickname ||
      profile?.displayName ||
      profile?.fullName ||
      profile?.name ||
      profile?.username ||
      'Người dùng'
    ).trim()
  },

  reset: () =>
    set((state) => ({
      ...initialState,
      preferences: state.preferences,
    })),
}))

export const ChatProvider = ({ children }) => {
  const loadPreferences = useChatStore((state) => state.loadPreferences)

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  return children
}

export default useChatStore
