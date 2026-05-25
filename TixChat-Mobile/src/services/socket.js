import { SOCKET_URL } from '../config/env'
import { createSocketCore } from './socketCore.js'
import { normalizeId } from '../utils/normalize.js'
import { getInMemoryAuth } from './authState'

let socketInstance = null
let socketCore = null

const socketDiagnosticsEnabled = String(process.env.EXPO_PUBLIC_API_DIAGNOSTICS || '').toLowerCase() === 'true'
const isNgrokUrl = (value) => /(?:\.ngrok-free\.dev|\.ngrok\.app|\.ngrok\.io)/i.test(String(value || ''))
const socketExtraHeaders = isNgrokUrl(SOCKET_URL)
  ? { 'ngrok-skip-browser-warning': 'true' }
  : undefined
const socketTransports = isNgrokUrl(SOCKET_URL)
  ? ['polling', 'websocket']
  : undefined

const logSocketDiagnostic = (type, details = {}) => {
  if (!socketDiagnosticsEnabled) return

  const logger = type === 'connect_error' || type === 'reconnect_error' ? console.warn : console.log
  logger(`[socket:${type}]`, {
    socketUrl: SOCKET_URL,
    ...details,
  })
}

const summarizeSocketError = (error) => ({
  message: error?.message || String(error || 'Socket error'),
  type: error?.type,
  description: error?.description,
  contextStatus: error?.context?.status,
})

const bindSocketDiagnostics = (socket) => {
  if (!socket || socket.__tixchatDiagnosticsBound) return
  socket.__tixchatDiagnosticsBound = true

  socket.on('connect', () => {
    logSocketDiagnostic('connect', {
      id: socket.id,
      transport: socket.io?.engine?.transport?.name,
    })
  })

  socket.on('disconnect', (reason) => {
    logSocketDiagnostic('disconnect', { reason })
  })

  socket.on('connect_error', (error) => {
    logSocketDiagnostic('connect_error', summarizeSocketError(error))
  })

  socket.io?.on?.('reconnect_attempt', (attempt) => {
    logSocketDiagnostic('reconnect_attempt', { attempt })
  })

  socket.io?.on?.('reconnect_error', (error) => {
    logSocketDiagnostic('reconnect_error', summarizeSocketError(error))
  })

  socket.io?.on?.('reconnect', (attempt) => {
    logSocketDiagnostic('reconnect', {
      attempt,
      id: socket.id,
      transport: socket.io?.engine?.transport?.name,
    })
  })
}

const getSocketAuthToken = (fallbackToken = '') => {
  const inMemoryToken = String(getInMemoryAuth()?.accessToken || '').trim()
  if (inMemoryToken) return inMemoryToken

  const nextToken = String(fallbackToken || socketInstance?.auth?.token || '').trim()
  return nextToken
}

export const syncSocketAuthToken = (accessToken, { reconnectIfNeeded = true } = {}) => {
  const token = String(accessToken || '').trim()
  if (!socketInstance || !token) return

  const tokenChanged = socketInstance.auth?.token !== token
  if (tokenChanged) {
    socketInstance.auth = { ...(socketInstance.auth || {}), token }
  }

  if (!reconnectIfNeeded) return

  if (tokenChanged && socketInstance.connected) {
    socketInstance.disconnect()
    socketInstance.connect()
    return
  }

  if (socketInstance.disconnected) {
    if (tokenChanged && socketInstance.active) {
      socketInstance.disconnect()
    }
    socketInstance.connect()
  }
}

export const connectSocket = (accessToken = '') => {
  const token = getSocketAuthToken(accessToken)
  if (!token) return null

  if (!socketCore) {
    socketCore = createSocketCore({
      socketUrl: SOCKET_URL,
      getAccessToken: () => getSocketAuthToken(),
      transports: socketTransports,
      extraHeaders: socketExtraHeaders,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })
  }

  socketInstance = socketCore.connect()
  bindSocketDiagnostics(socketInstance)
  syncSocketAuthToken(token, { reconnectIfNeeded: false })

  if (socketInstance && socketInstance.disconnected && !socketInstance.active) {
    socketInstance.connect()
  }

  return socketInstance
}

export const getSocket = () => {
  if (socketInstance?.connected) {
    return socketInstance
  }

  return connectSocket()
}

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
