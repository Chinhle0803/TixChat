import { SOCKET_URL } from '../config/env'
import { createSocketCore } from './socketCore.js'
import { normalizeId } from '../utils/normalize.js'

let socketInstance = null
let socketCore = null

export const connectSocket = (accessToken) => {
  if (!accessToken) return null

  if (!socketCore) {
    socketCore = createSocketCore({
      socketUrl: SOCKET_URL,
      getAccessToken: () => accessToken,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
  }

  socketInstance = socketCore.connect()

  if (socketInstance && socketInstance.auth?.token !== accessToken) {
    socketInstance.auth = { ...(socketInstance.auth || {}), token: accessToken }
  }

  if (socketInstance && !socketInstance.connected) {
    socketInstance.connect()
  }

  return socketInstance
}

export const getSocket = () => socketInstance

export const disconnectSocket = () => {
  if (socketCore) {
    socketCore.disconnect()
    socketCore = null
    socketInstance = null
    return
  }

  if (socketInstance) {
    socketInstance.removeAllListeners()
    socketInstance.disconnect()
    socketInstance = null
  }
}

export const joinConversationRoom = (conversationId) => {
  if (!socketCore) {
    return Promise.reject(new Error('Socket is not connected'))
  }

  return socketCore.joinConversation(conversationId, 5000)
}

export const leaveConversationRoom = (conversationId) => {
  if (!socketCore || !socketInstance?.connected) {
    return Promise.resolve(null)
  }

  return socketCore.leaveConversation(conversationId, 5000).catch(() => null)
}

export const emitTypingStart = (conversationId) => {
  if (!socketCore || !conversationId) {
    return
  }

  socketCore.emit('typing:start', { conversationId }).catch(() => {})
}

export const emitTypingStop = (conversationId) => {
  if (!socketCore || !conversationId) {
    return
  }

  socketCore.emit('typing:stop', { conversationId }).catch(() => {})
}

export const onTypingStart = (handler) => {
  if (!socketCore || typeof handler !== 'function') return () => {}
  return socketCore.on('typing:start', handler)
}

export const onTypingStop = (handler) => {
  if (!socketCore || typeof handler !== 'function') return () => {}
  return socketCore.on('typing:stop', handler)
}

export const buildIncomingMessageHandler = (activeConversationId, onIncoming) => (payload) => {
  const message = payload?.message
  const messageConversationId = normalizeId(message?.conversationId)

  if (!messageConversationId) return

  onIncoming({
    message,
    isCurrentConversation:
      normalizeId(activeConversationId.current) === normalizeId(messageConversationId),
  })
}
