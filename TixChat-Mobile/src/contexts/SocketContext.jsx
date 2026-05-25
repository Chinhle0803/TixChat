import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { connectSocket, disconnectSocket, getSocket, joinConversationRoom, leaveConversationRoom, emitTypingStart, emitTypingStop } from '../services/socket'
import { useAuthStore } from '../stores/authStore'
import { useChatStore } from '../stores/chatStore'

const SocketContext = createContext(null)

export const useSocketContext = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocketContext must be used within SocketProvider')
  }
  return context
}

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') {
    return String(value._id || value.userId || value.id || value.conversationId || value.messageId || '')
  }
  return String(value)
}

export const SocketProvider = ({ children }) => {
  const socketCoreRef = useRef(null)
  const listenersRef = useRef([])

  const { accessToken, user, isAuthenticated } = useAuthStore()
  const {
    addMessage,
    updateMessage,
    deleteMessage,
    setTypingUser,
    clearTypingUsers,
    addOnlineUser,
    removeOnlineUser,
    upsertConversation,
    removeConversation,
    incrementUnread,
    clearUnread,
    incrementFriendRequestCount,
    decrementFriendRequestCount,
    currentConversation,
  } = useChatStore()

  const setupSocketListeners = useCallback(() => {
    const socket = getSocket()
    if (!socket) return

    const cleanupListeners = []

    const messageReceivedHandler = ({ message }) => {
      if (!message) return

      const convId = normalizeId(message?.conversationId)
      const currentConvId = normalizeId(currentConversation?._id)

      if (convId === currentConvId) {
        addMessage(message)
        clearUnread(convId)
        socket.emit('message:seen', { conversationId: convId })
      } else {
        incrementUnread(convId)
      }

      upsertConversation(convId, { latestMessage: message, lastMessageAt: message?.createdAt || Date.now() })
    }
    socket.on('message:received', messageReceivedHandler)
    cleanupListeners.push({ event: 'message:received', handler: messageReceivedHandler })
    socket.on('message:sent', messageReceivedHandler)
    cleanupListeners.push({ event: 'message:sent', handler: messageReceivedHandler })

    const messageDeliveredHandler = ({ messageId, userId }) => {
      updateMessage(messageId, { status: 'delivered' })
    }
    socket.on('message:delivered', messageDeliveredHandler)
    cleanupListeners.push({ event: 'message:delivered', handler: messageDeliveredHandler })

    const messageSeenHandler = ({ conversationId, userId }) => {
      updateMessage(conversationId, { seen: true })
    }
    socket.on('message:seen', messageSeenHandler)
    cleanupListeners.push({ event: 'message:seen', handler: messageSeenHandler })

    const messageEditedHandler = ({ message }) => {
      if (message) {
        const msgId = normalizeId(message._id || message.messageId)
        updateMessage(msgId, {
          ...message,
          isEdited: true,
          editedAt: message.editedAt || Date.now(),
        })
      }
    }
    socket.on('message:edited', messageEditedHandler)
    cleanupListeners.push({ event: 'message:edited', handler: messageEditedHandler })

    const messageDeletedHandler = ({ messageId, isDeleted }) => {
      const msgId = normalizeId(messageId)
      if (isDeleted) {
        deleteMessage(msgId)
      }
    }
    socket.on('message:deleted', messageDeletedHandler)
    cleanupListeners.push({ event: 'message:deleted', handler: messageDeletedHandler })

    const messageHiddenHandler = ({ messageId, conversationId, hiddenBy }) => {
      const msgId = normalizeId(messageId)
      deleteMessage(msgId)
    }
    socket.on('message:hidden', messageHiddenHandler)
    cleanupListeners.push({ event: 'message:hidden', handler: messageHiddenHandler })

    const messageEmojiHandler = ({ message }) => {
      if (message) {
        const msgId = normalizeId(message._id || message.messageId)
        updateMessage(msgId, { reactions: message.reactions })
      }
    }
    socket.on('message:emoji', messageEmojiHandler)
    cleanupListeners.push({ event: 'message:emoji', handler: messageEmojiHandler })

    const typingStartHandler = ({ conversationId, userId }) => {
      const currentUserId = normalizeId(user?._id || user?.userId)
      if (normalizeId(userId) !== currentUserId) {
        setTypingUser(conversationId, userId, true)
      }
    }
    socket.on('typing:start', typingStartHandler)
    cleanupListeners.push({ event: 'typing:start', handler: typingStartHandler })

    const typingStopHandler = ({ conversationId, userId }) => {
      setTypingUser(conversationId, userId, false)
    }
    socket.on('typing:stop', typingStopHandler)
    cleanupListeners.push({ event: 'typing:stop', handler: typingStopHandler })

    const userOnlineHandler = ({ userId }) => {
      addOnlineUser(userId)
    }
    socket.on('user:online', userOnlineHandler)
    cleanupListeners.push({ event: 'user:online', handler: userOnlineHandler })

    const userOfflineHandler = ({ userId }) => {
      removeOnlineUser(userId)
    }
    socket.on('user:offline', userOfflineHandler)
    cleanupListeners.push({ event: 'user:offline', handler: userOfflineHandler })

    const userPresenceHandler = ({ userId, status }) => {
      if (status === 'offline') {
        removeOnlineUser(userId)
      } else {
        addOnlineUser(userId)
      }
    }
    socket.on('user:presence', userPresenceHandler)
    cleanupListeners.push({ event: 'user:presence', handler: userPresenceHandler })

    const participantAddedHandler = ({ conversationId, participantId, addedBy }) => {
      upsertConversation(conversationId, { needsRefresh: true })
    }
    socket.on('participant:added', participantAddedHandler)
    cleanupListeners.push({ event: 'participant:added', handler: participantAddedHandler })

    const participantRemovedHandler = ({ conversationId, participantId }) => {
      upsertConversation(conversationId, { needsRefresh: true })
    }
    socket.on('participant:removed', participantRemovedHandler)
    cleanupListeners.push({ event: 'participant:removed', handler: participantRemovedHandler })

    const participantRoleUpdatedHandler = ({ conversationId, targetUserId, oldRole, newRole }) => {
      upsertConversation(conversationId, { needsRefresh: true })
    }
    socket.on('participant:role_updated', participantRoleUpdatedHandler)
    cleanupListeners.push({ event: 'participant:role_updated', handler: participantRoleUpdatedHandler })

    const conversationCreatedHandler = ({ conversationId, type, participants }) => {
      upsertConversation(conversationId, { _id: conversationId, conversationId, needsRefresh: true })
    }
    socket.on('conversation:created', conversationCreatedHandler)
    cleanupListeners.push({ event: 'conversation:created', handler: conversationCreatedHandler })

    const conversationDissolvedHandler = ({ conversationId, dissolvedByUserId }) => {
      removeConversation(conversationId)
    }
    socket.on('conversation:dissolved', conversationDissolvedHandler)
    cleanupListeners.push({ event: 'conversation:dissolved', handler: conversationDissolvedHandler })

    const friendRequestNewHandler = ({ fromUserId }) => {
      incrementFriendRequestCount()
    }
    socket.on('friend_request:new', friendRequestNewHandler)
    cleanupListeners.push({ event: 'friend_request:new', handler: friendRequestNewHandler })

    const friendRequestSentHandler = ({ toUserId }) => {
      // Update UI if needed
    }
    socket.on('friend_request:sent', friendRequestSentHandler)
    cleanupListeners.push({ event: 'friend_request:sent', handler: friendRequestSentHandler })

    const friendRequestAcceptedHandler = ({ byUserId }) => {
      decrementFriendRequestCount()
    }
    socket.on('friend_request:accepted', friendRequestAcceptedHandler)
    cleanupListeners.push({ event: 'friend_request:accepted', handler: friendRequestAcceptedHandler })

    const friendRequestRejectedHandler = ({ byUserId }) => {
      // Update UI if needed
    }
    socket.on('friend_request:rejected', friendRequestRejectedHandler)
    cleanupListeners.push({ event: 'friend_request:rejected', handler: friendRequestRejectedHandler })

    listenersRef.current = cleanupListeners
  }, [
    user,
    currentConversation,
    addMessage,
    updateMessage,
    deleteMessage,
    setTypingUser,
    addOnlineUser,
    removeOnlineUser,
    upsertConversation,
    removeConversation,
    incrementUnread,
    clearUnread,
    incrementFriendRequestCount,
    decrementFriendRequestCount,
  ])

  const cleanupSocketListeners = useCallback(() => {
    const socket = getSocket()
    if (!socket) return

    listenersRef.current.forEach(({ event, handler }) => {
      socket.off(event, handler)
    })
    listenersRef.current = []
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      cleanupSocketListeners()
      disconnectSocket()
      return
    }

    const socket = connectSocket(accessToken)
    if (socket) {
      setupSocketListeners()
    }

    return () => {
      cleanupSocketListeners()
    }
  }, [isAuthenticated, accessToken])

  const handleJoinConversation = useCallback(async (conversationId) => {
    try {
      await joinConversationRoom(conversationId)
      clearTypingUsers(conversationId)
    } catch (error) {
      console.error('Failed to join conversation room:', error)
    }
  }, [clearTypingUsers])

  const handleLeaveConversation = useCallback(async (conversationId) => {
    try {
      await leaveConversationRoom(conversationId)
      emitTypingStop(conversationId)
      clearTypingUsers(conversationId)
    } catch (error) {
      console.error('Failed to leave conversation room:', error)
    }
  }, [clearTypingUsers])

  const handleTypingStart = useCallback((conversationId) => {
    emitTypingStart(conversationId)
  }, [])

  const handleTypingStop = useCallback((conversationId) => {
    emitTypingStop(conversationId)
  }, [])

  const value = {
    joinConversation: handleJoinConversation,
    leaveConversation: handleLeaveConversation,
    emitTypingStart: handleTypingStart,
    emitTypingStop: handleTypingStop,
    isConnected: () => getSocket()?.connected || false,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export default SocketProvider
