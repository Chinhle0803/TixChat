import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StatusBar } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import AuthScreen from './components/AuthScreen'
import RegisterScreen from './components/RegisterScreen'
import VerifyOtpScreen from './components/VerifyOtpScreen'
import ForgotPasswordScreen from './components/ForgotPasswordScreen'
import ConversationListScreen from './components/ConversationListScreen'
import ChatScreen from './components/ChatScreen'
import MobileCallOverlay from './components/MobileCallOverlay'
import ProfileScreen from './components/ProfileScreen'
import FriendHubScreen from './components/FriendHubScreen'
import CreateGroupScreen from './components/CreateGroupScreen'
import DiscoverScreen from './components/DiscoverScreen'
import DiaryScreen from './components/DiaryScreen'
import UrbanIncidentScreen from './components/UrbanIncidentScreen'
import AssistantScreen from './components/AssistantScreen'
import CallsScreen from './components/CallsScreen'
import AppDialogModal from './components/AppDialogModal'
import ErrorBoundary from './components/ErrorBoundary'
import { SocketProvider } from './contexts/SocketContext'
import { DialogProvider } from './contexts/DialogContext'
import { AuthProvider, useAuthStore } from './stores/authStore'
import { ChatProvider, useChatStore } from './stores/chatStore'
import { UiProvider, useUiStore } from './stores/uiStore'
import { authApi, userApi, conversationApi, messageApi, notificationApi, callApi, setInMemoryAuth } from './services/api'
import {
  buildIncomingMessageHandler,
  connectSocket,
  disconnectSocket,
  emitTypingStart,
  emitTypingStop,
  joinConversationRoom,
  leaveConversationRoom,
  onTypingStart,
  onTypingStop,
} from './services/socket'
import { storage } from './services/storage'
import {
  MOBILE_CHIME_EVENTS,
  addMobileChimeEventListener,
  getMobileChimeAudioRoutes,
  setMobileChimeAudioRoute,
  setMobileChimeCameraEnabled,
  setMobileChimeMuted,
  startMobileChimeMeeting,
  stopMobileChimeMeeting,
  switchMobileChimeCamera,
} from './services/mobileChimeBridge'
import {
  addNotificationResponseListener,
  registerForPushNotificationsAsync,
  scheduleCallNotification,
  scheduleMessageNotification,
} from './services/notifications'

const Stack = createNativeStackNavigator()

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') {
    return String(value._id || value.userId || value.id || value.conversationId || value.messageId || '')
  }
  return String(value)
}

const getParticipantId = (participant) => {
  if (!participant) return ''
  if (typeof participant === 'string') return normalizeId(participant)
  return normalizeId(participant?._id || participant?.userId || participant?.id)
}

const getParticipantName = (participant) => {
  if (!participant) return ''
  if (typeof participant === 'string') return 'Người dùng'

  return (
    participant?.nickname ||
    participant?.displayName ||
    participant?.fullName ||
    participant?.name ||
    participant?.username ||
    'Người dùng'
  )
}

const getJoinInfoCall = (joinInfo) => joinInfo?.call || joinInfo?.data?.call || null
const getJoinInfoMeeting = (joinInfo) => joinInfo?.meeting || joinInfo?.data?.meeting || null
const getJoinInfoAttendee = (joinInfo) => joinInfo?.attendee || joinInfo?.data?.attendee || null

const normalizeJoinInfo = (joinInfo) => {
  if (!joinInfo) return null
  const call = getJoinInfoCall(joinInfo)
  const meeting = getJoinInfoMeeting(joinInfo)
  const attendee = getJoinInfoAttendee(joinInfo)
  if (!call || !meeting || !attendee) return null
  return { ...joinInfo, call, meeting, attendee }
}

const getParticipantAvatar = (participant) => {
  if (!participant || typeof participant === 'string') return ''
  return String(participant?.avatar || participant?.photoURL || participant?.profilePicture || '')
}

const createDefaultConversationPreference = () => ({
  alias: '',
  muted: false,
  pinned: false,
  hidden: false,
  autoDelete: 'never',
  chatTheme: 'default',
})

const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024

const IMAGE_PICKER_MEDIA_TYPES = ImagePicker?.MediaType?.Images
  ? [ImagePicker.MediaType.Images]
  : ['images']

const inferMimeTypeFromName = (fileName = '') => {
  const ext = String(fileName || '').split('.').pop()?.toLowerCase()
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
  }

  return map[ext] || 'application/octet-stream'
}

const resolveAssetMimeType = (asset = {}, sourceLabel = 'Tệp') => {
  const rawMime = String(asset?.mimeType || asset?.type || '').toLowerCase()
  if (rawMime.includes('/')) return rawMime

  const byName = inferMimeTypeFromName(asset?.name || asset?.fileName || '')
  if (byName !== 'application/octet-stream') return byName

  if (String(sourceLabel).toLowerCase() === 'ảnh') return 'image/jpeg'
  return 'application/octet-stream'
}

const createClientMessageId = (prefix = 'msg') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const buildForwardedMessageContent = (message = {}) => {
  const text = String(message?.content || '').trim()
  const firstAttachment = Array.isArray(message?.attachments) ? message.attachments[0] : null
  const attachmentName = String(firstAttachment?.name || '').trim()

  const parts = ['[[FORWARDED]]']
  if (text) parts.push(text)
  if (attachmentName) parts.push(`📎 ${attachmentName}`)
  if (!text && !attachmentName) parts.push('[Tin nhắn không có nội dung hiển thị]')

  return parts.join('\n')
}

const normalizeForwardAttachment = (attachment) => {
  if (!attachment || typeof attachment !== 'object') return null
  const url = String(attachment?.url || attachment?.uri || '').trim()
  if (!url) return null

  const name =
    attachment?.name ||
    attachment?.fileName ||
    String(url).split('/').pop() ||
    `attachment-${Date.now()}`

  return {
    url,
    name,
    mimeType: attachment?.mimeType || inferMimeTypeFromName(name),
    size: Number(attachment?.size || 0),
  }
}

const isDirectoryLikeAsset = (asset = {}) => {
  const mimeType = String(asset?.mimeType || asset?.type || '').toLowerCase()
  const name = String(asset?.name || asset?.fileName || '').toLowerCase()

  if (!mimeType && !name) return false

  return (
    mimeType.includes('directory') ||
    mimeType === 'inode/directory' ||
    mimeType === 'application/x-directory' ||
    name.endsWith('/')
  )
}

const validateAttachmentAsset = (asset, sourceLabel = 'Tệp') => {
  if (!asset?.uri) {
    return { ok: false, error: `Không tìm thấy dữ liệu ${String(sourceLabel).toLowerCase()} để gửi` }
  }

  if (isDirectoryLikeAsset(asset)) {
    return {
      ok: false,
      error: 'Ứng dụng chưa hỗ trợ gửi thư mục trực tiếp',
      hint: 'Vui lòng nén thư mục thành file .zip rồi gửi dưới dạng tệp.',
    }
  }

  const fileSize = Number(asset?.size || asset?.fileSize || 0)
  if (Number.isFinite(fileSize) && fileSize > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      ok: false,
      error: 'Tệp vượt quá giới hạn cho phép (50MB)',
    }
  }

  return { ok: true }
}

const toDisplayName = (profile) => {
  if (!profile || typeof profile !== 'object') return ''
  return String(
    profile?.nickname ||
    profile?.displayName ||
    profile?.fullName ||
    profile?.name ||
    profile?.username ||
    ''
  ).trim()
}

const extractParticipantIds = (participants = []) => {
  if (!Array.isArray(participants)) return []
  return participants
    .map((participant) => normalizeId(participant?._id || participant?.userId || participant?.id || participant))
    .filter(Boolean)
}

const mapParticipantsWithProfiles = (participants = [], profileMap = {}) => {
  if (!Array.isArray(participants)) return []
  return participants.map((participant) => {
    const participantId = normalizeId(
      participant?._id || participant?.userId || participant?.id || participant
    )

    if (!participantId) return participant

    const profile = profileMap?.[participantId]
    if (!profile) {
      if (typeof participant === 'object' && participant) {
        return {
          ...participant,
          _id: participant?._id || participantId,
          userId: participant?.userId || participantId,
        }
      }

      return participant
    }

    return {
      ...profile,
      ...((typeof participant === 'object' && participant) ? participant : {}),
      _id: participantId,
      userId: participantId,
      name:
        participant?.name ||
        profile?.name ||
        toDisplayName(profile) ||
        'Người dùng',
    }
  })
}

const mergeParticipantRoles = (participants = [], participantRecords = []) => {
  if (!Array.isArray(participants) || participants.length === 0) return participants

  const roleMap = {}
  ;(participantRecords || []).forEach((record) => {
    const userId = normalizeId(record?.userId || record?._id || record?.id)
    if (!userId) return
    roleMap[userId] = String(record?.role || 'member').toLowerCase()
  })

  return participants.map((participant) => {
    const participantId = normalizeId(participant?._id || participant?.userId || participant)
    const role = roleMap?.[participantId]
    if (!role) return participant

    if (typeof participant === 'object' && participant) {
      return {
        ...participant,
        role,
      }
    }

    return {
      _id: participantId,
      userId: participantId,
      role,
    }
  })
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

const sortMessagesAsc = (items) =>
  [...(items || [])].sort((a, b) => {
    const tsA = parseTimestamp(a?.createdAt) || parseTimestamp(a?.updatedAt)
    const tsB = parseTimestamp(b?.createdAt) || parseTimestamp(b?.updatedAt)
    return tsA - tsB
  })

const getRequestErrorMessage = (error, fallbackMessage) => {
  const serverMessage = String(
    error?.response?.data?.error || error?.response?.data?.message || ''
  ).trim()

  if (serverMessage) return serverMessage

  if (error?.code === 'ECONNABORTED') {
    return 'Yêu cầu quá thời gian, vui lòng thử lại'
  }

  if (error?.request && !error?.response) {
    return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và cấu hình API.'
  }

  return fallbackMessage
}

const getLoginErrorMessage = (error) => {
  const status = Number(error?.response?.status || 0)
  const rawMessage = String(
    error?.response?.data?.error || error?.response?.data?.message || error?.message || ''
  )
    .trim()
    .toLowerCase()

  if (
    rawMessage.includes('invalid email or password') ||
    rawMessage.includes('email hoặc mật khẩu') ||
    rawMessage.includes('đăng nhập thất bại')
  ) {
    return 'Email hoặc mật khẩu không đúng'
  }

  if (rawMessage.includes('email') && rawMessage.includes('verified')) {
    return 'Tài khoản chưa xác thực email, vui lòng xác thực OTP trước'
  }

  if (rawMessage.includes('invalid login response')) {
    return 'Không thể đăng nhập do phản hồi máy chủ không hợp lệ'
  }

  if (status === 401) {
    return 'Email hoặc mật khẩu không đúng'
  }

  if (status === 429) {
    return 'Bạn đăng nhập quá nhanh, vui lòng thử lại sau ít phút'
  }

  return getRequestErrorMessage(error, 'Không thể đăng nhập, vui lòng thử lại')
}

const normalizeAuthPayload = (response) => {
  const payload = response?.data?.data || response?.data || {}
  const user = payload?.user
  const accessToken = payload?.accessToken
  const refreshToken = payload?.refreshToken || ''

  if (!user || !accessToken) {
    throw new Error('Invalid login response')
  }

  return {
    user: {
      ...user,
      _id: user?._id || user?.userId,
    },
    accessToken,
    refreshToken,
  }
}

export default function AppRoot() {
  const [booting, setBooting] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('')

  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [conversations, setConversations] = useState([])
  const [unreadByConversation, setUnreadByConversation] = useState({})
  const [messages, setMessages] = useState([])
  const [messagesCursor, setMessagesCursor] = useState(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [chatScrollRequestKey, setChatScrollRequestKey] = useState(0)
  const [typingByConversation, setTypingByConversation] = useState({})
  const [conversationPreferences, setConversationPreferences] = useState({})
  const [appDialog, setAppDialog] = useState({
    visible: false,
    title: '',
    message: '',
    actions: [{ text: 'OK', style: 'default' }],
  })
  const [mobileCallState, setMobileCallState] = useState({
    visible: false,
    call: null,
    phase: 'idle',
    error: '',
    isMuted: false,
    isCameraEnabled: false,
    videoTiles: [],
    activeSpeakerId: '',
    audioRoute: 'speaker',
    availableAudioRoutes: ['speaker'],
  })
  const profileCacheRef = useRef({})
  const conversationsRef = useRef([])
  const conversationPreferencesRef = useRef({})
  const navigationRef = useRef(null)
  const pushTokenRef = useRef('')
  const foregroundNotificationIdsRef = useRef(new Set())
  const incomingCallNotificationIdsRef = useRef(new Set())
  const incomingCallDialogIdsRef = useRef(new Set())
  const acceptingMobileCallIdsRef = useRef(new Set())
  const mobileCallStateRef = useRef(mobileCallState)
  const pendingMobileJoinInfoRef = useRef(null)

  const activeConversationIdRef = useRef('')
  const typingTimeoutRef = useRef(null)

  const authenticated = Boolean(user && accessToken)

  useEffect(() => {
    mobileCallStateRef.current = mobileCallState
  }, [mobileCallState])

  const showAppDialog = useCallback(({ title, message, actions }) => {
    const safeActions = Array.isArray(actions) && actions.length > 0
      ? actions
      : [{ text: 'OK', style: 'default' }]

    setAppDialog({
      visible: true,
      title: String(title || 'Thông báo'),
      message: String(message || ''),
      actions: safeActions,
    })
  }, [])

  const closeAppDialog = useCallback(() => {
    setAppDialog((prev) => ({
      ...prev,
      visible: false,
    }))
  }, [])

  const showNotice = useCallback((title, message) => {
    showAppDialog({ title, message })
  }, [showAppDialog])

  const upsertConversation = useCallback((conversationId, patch) => {
    setConversations((prev) => {
      const existing = prev.find((item) => normalizeId(item?._id || item?.conversationId) === conversationId)

      const merged = {
        ...(existing || {
          _id: conversationId,
          conversationId,
          participants: [],
          type: '1-1',
        }),
        ...patch,
      }

      const next = prev.filter((item) => normalizeId(item?._id || item?.conversationId) !== conversationId)
      return sortConversations([...next, merged])
    })
  }, [])

  const applyAuth = useCallback(async (nextAuth) => {
    await storage.setAuth(nextAuth)
    setInMemoryAuth(nextAuth)

    setUser(nextAuth.user)
    setAccessToken(nextAuth.accessToken)
    setRefreshToken(nextAuth.refreshToken || '')
    setAuthError('')
  }, [])

  const ensureUserProfiles = useCallback(async (userIds = []) => {
    const normalizedIds = [...new Set((userIds || []).map((id) => normalizeId(id)).filter(Boolean))]
    if (normalizedIds.length === 0) {
      return profileCacheRef.current
    }

    const missingIds = normalizedIds.filter((id) => !profileCacheRef.current?.[id])
    if (missingIds.length === 0) {
      return profileCacheRef.current
    }

    const profileResults = await Promise.allSettled(
      missingIds.map(async (userId) => {
        const response = await userApi.getProfile(userId)
        return {
          requestedId: userId,
          user: response?.data?.user || null,
        }
      })
    )

    const fetchedMap = {}
    profileResults.forEach((result) => {
      if (result.status !== 'fulfilled') return
      const requestedId = normalizeId(result.value?.requestedId)
      const user = result.value?.user
      if (!requestedId) return

      fetchedMap[requestedId] = {
        ...(user || {}),
        _id: normalizeId(user?._id || user?.userId || requestedId),
        userId: normalizeId(user?._id || user?.userId || requestedId),
        name: toDisplayName(user) || 'Người dùng',
      }
    })

    profileCacheRef.current = {
      ...profileCacheRef.current,
      ...fetchedMap,
    }

    return profileCacheRef.current
  }, [])

  const loadConversations = useCallback(async () => {
    if (!authenticated) return

    setLoadingConversations(true)
    try {
      const [conversationResponse, unreadResponse] = await Promise.all([
        conversationApi.getConversations(),
        messageApi.getUnreadCounts(),
      ])

      const list = conversationResponse?.data?.conversations || []
      const unreadMap = unreadResponse?.data?.unreadByConversation || {}

      const participantIds = list.flatMap((conversation) =>
        extractParticipantIds(conversation?.participants || [])
      )
      const profileMap = await ensureUserProfiles(participantIds)

      const normalized = list.map((conversation) => {
        const id = normalizeId(conversation?._id || conversation?.conversationId)
        return {
          ...conversation,
          _id: id || conversation?._id,
          conversationId: id || conversation?.conversationId,
          participants: mapParticipantsWithProfiles(conversation?.participants || [], profileMap),
          unreadCount: Number(unreadMap?.[id] || conversation?.unreadCount || 0),
          lastMessageAt:
            conversation?.latestMessage?.createdAt ||
            conversation?.lastMessageAt ||
            conversation?.updatedAt,
        }
      })

      setConversations(sortConversations(normalized))
      setUnreadByConversation(unreadMap)
    } catch (error) {
  showNotice('Lỗi', error?.response?.data?.error || 'Không tải được danh sách cuộc trò chuyện')
    } finally {
      setLoadingConversations(false)
    }
  }, [authenticated, ensureUserProfiles])

  const openConversation = useCallback(async (conversation) => {
    const conversationId = normalizeId(conversation?._id || conversation?.conversationId)
    if (!conversationId) return false

    if (activeConversationIdRef.current && activeConversationIdRef.current !== conversationId) {
      await leaveConversationRoom(activeConversationIdRef.current)
    }

    setLoadingMessages(true)
    try {
      const [conversationResp, messageResp, participantsResp] = await Promise.all([
        conversationApi.getConversation(conversationId),
        messageApi.getMessages(conversationId, 50),
        conversationApi.getParticipants(conversationId).catch(() => ({ data: { participants: [] } })),
      ])

      const fullConversation = conversationResp?.data?.conversation || conversation
      const messageList = messageResp?.data?.messages || []

      const participantIds = extractParticipantIds(fullConversation?.participants || [])
      const profileMap = await ensureUserProfiles(participantIds)
      const participantRecords = participantsResp?.data?.participants || []
      const hydratedConversation = {
        ...fullConversation,
        participants: mergeParticipantRoles(
          mapParticipantsWithProfiles(fullConversation?.participants || [], profileMap),
          participantRecords
        ),
      }

      upsertConversation(conversationId, hydratedConversation)
      setMessages(sortMessagesAsc(messageList))
      setMessagesCursor(messageResp?.data?.lastEvaluatedKey || null)
      setHasMoreMessages(Boolean(messageResp?.data?.lastEvaluatedKey))
      setChatScrollRequestKey((prev) => prev + 1)
      activeConversationIdRef.current = conversationId

      await joinConversationRoom(conversationId)
      await messageApi.markAsSeen(conversationId)

      setUnreadByConversation((prev) => ({ ...prev, [conversationId]: 0 }))
      upsertConversation(conversationId, { unreadCount: 0 })
      return true
    } catch (error) {
  showNotice('Lỗi', error?.response?.data?.error || 'Không tải được nội dung cuộc trò chuyện')
      return false
    } finally {
      setLoadingMessages(false)
    }
  }, [ensureUserProfiles, upsertConversation])

  const closeConversation = useCallback(async () => {
    const conversationId = activeConversationIdRef.current
    if (conversationId) {
      await leaveConversationRoom(conversationId).catch(() => {})
      emitTypingStop(conversationId)
    }

    activeConversationIdRef.current = ''
    setMessages([])
    setMessagesCursor(null)
    setHasMoreMessages(false)
  }, [])

  const loadOlderMessages = useCallback(async () => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId || !messagesCursor || loadingOlderMessages) return false

    setLoadingOlderMessages(true)
    try {
      const response = await messageApi.getMessages(conversationId, 50, messagesCursor)
      const olderMessages = Array.isArray(response?.data?.messages) ? response.data.messages : []
      const nextCursor = response?.data?.lastEvaluatedKey || null

      setMessages((prev) => {
        const merged = [...prev]
        olderMessages.forEach((message) => {
          const messageId = normalizeId(message?._id || message?.messageId)
          if (!messageId) return
          const exists = merged.some((item) => normalizeId(item?._id || item?.messageId) === messageId)
          if (!exists) merged.push(message)
        })
        return sortMessagesAsc(merged)
      })

      setMessagesCursor(nextCursor)
      setHasMoreMessages(Boolean(nextCursor))
      return olderMessages.length > 0
    } catch (error) {
      showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể tải thêm tin nhắn cũ'))
      return false
    } finally {
      setLoadingOlderMessages(false)
    }
  }, [loadingOlderMessages, messagesCursor, showNotice])

  const sendTextMessage = useCallback(async (content, replyTo = null, options = {}) => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId || !content?.trim()) return

    const messageType = options?.type || 'text'
    const tempMessageId = `tmp-${Date.now()}`
    const tempMessage = {
      _id: tempMessageId,
      conversationId,
      senderId: user?._id || user?.userId,
      content: content.trim(),
      type: messageType,
      replyTo: replyTo || null,
      createdAt: Date.now(),
      status: 'sending',
    }

    setMessages((prev) => sortMessagesAsc([...prev, tempMessage]))

    try {
      const response = await messageApi.sendMessage(
        conversationId,
        content.trim(),
        replyTo || null,
        {
          clientMessageId: createClientMessageId(messageType === 'emoji' ? 'emoji' : 'msg'),
          type: messageType,
        }
      )
      const sentMessage = response?.data?.data
      if (!sentMessage) return

      setMessages((prev) => {
        const sentMessageId = normalizeId(sentMessage?._id || sentMessage?.messageId)
        const alreadyExists = prev.some(
          (msg) => normalizeId(msg?._id || msg?.messageId) === sentMessageId
        )

        const withoutTemp = prev.filter((msg) => normalizeId(msg?._id || msg?.messageId) !== tempMessageId)

        if (alreadyExists) {
          return sortMessagesAsc(withoutTemp)
        }

        return sortMessagesAsc([...withoutTemp, { ...sentMessage, conversationId }])
      })

      upsertConversation(conversationId, {
        latestMessage: sentMessage,
        lastMessageAt: sentMessage?.createdAt || Date.now(),
      })
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => normalizeId(msg?._id || msg?.messageId) !== tempMessageId))
  showNotice('Lỗi', error?.response?.data?.error || 'Gửi tin nhắn thất bại')
    }
  }, [upsertConversation, user])

  const sendAttachmentMessage = useCallback(async (asset, sourceLabel = 'Tệp', replyTo = null) => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId || !asset?.uri) return

    const validation = validateAttachmentAsset(asset, sourceLabel)
    if (!validation.ok) {
      const detail = validation?.hint ? `\n${validation.hint}` : ''
  showNotice('Không thể gửi tệp', `${validation.error}${detail}`)
      return
    }

  const attachmentName = asset?.name || asset?.fileName || `${sourceLabel.toLowerCase()}-${Date.now()}`
  const attachmentMimeType = resolveAssetMimeType(asset, sourceLabel)
    const tempMessageId = `tmp-file-${Date.now()}`

    const tempMessage = {
      _id: tempMessageId,
      conversationId,
      senderId: user?._id || user?.userId,
      content: `[Đang gửi ${sourceLabel.toLowerCase()}: ${attachmentName}]`,
      createdAt: Date.now(),
      status: 'sending',
      uploadProgress: 0,
  replyTo: replyTo || null,
      attachments: [
        {
          name: attachmentName,
          mimeType: attachmentMimeType,
          type: sourceLabel.toLowerCase(),
          url: asset.uri,
        },
      ],
    }

    setMessages((prev) => sortMessagesAsc([...prev, tempMessage]))

    try {
      const uploadPayload = asset?.file
        ? asset.file
        : {
          uri: asset.uri,
          name: attachmentName,
          mimeType: attachmentMimeType,
        }

      const response = await messageApi.sendAttachment(
        conversationId,
        uploadPayload,
        '',
        replyTo || null,
        {
          clientMessageId: createClientMessageId('file'),
          onUploadProgress: ({ percentage }) => {
            setMessages((prev) =>
              prev.map((msg) => {
                const messageId = normalizeId(msg?._id || msg?.messageId)
                if (messageId !== tempMessageId) {
                  return msg
                }

                return {
                  ...msg,
                  uploadProgress: Number(percentage || 0),
                }
              })
            )
          },
        }
      )

      const sentMessage = response?.data?.data
      if (!sentMessage) return

      setMessages((prev) => {
        const sentMessageId = normalizeId(sentMessage?._id || sentMessage?.messageId)
        const alreadyExists = prev.some(
          (msg) => normalizeId(msg?._id || msg?.messageId) === sentMessageId
        )

        const withoutTemp = prev.filter((msg) => normalizeId(msg?._id || msg?.messageId) !== tempMessageId)

        if (alreadyExists) {
          return sortMessagesAsc(withoutTemp)
        }

        return sortMessagesAsc([...withoutTemp, { ...sentMessage, conversationId }])
      })

      upsertConversation(conversationId, {
        latestMessage: sentMessage,
        lastMessageAt: sentMessage?.createdAt || Date.now(),
      })
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => normalizeId(msg?._id || msg?.messageId) !== tempMessageId))
  showNotice('Lỗi', error?.response?.data?.error || 'Gửi attachment thất bại')
    }
  }, [upsertConversation, user])

  const pickImageAndSend = useCallback(async (replyTo = null) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (permission.status !== 'granted') {
  showNotice('Thiếu quyền', 'Bạn cần cấp quyền thư viện để gửi ảnh.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: IMAGE_PICKER_MEDIA_TYPES,
        quality: 0.8,
      })

      if (result.canceled || !result.assets?.length) {
        return
      }

  await sendAttachmentMessage(result.assets[0], 'Ảnh', replyTo)
    } catch (error) {
  showNotice('Lỗi', error?.message || 'Không thể chọn ảnh')
    }
  }, [sendAttachmentMessage])

  const pickFileAndSend = useCallback(async (replyTo = null) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: false,
        copyToCacheDirectory: true,
      })

      if (result.canceled || !result.assets?.length) {
        return
      }

      const selectedAsset = result.assets[0]
      if (isDirectoryLikeAsset(selectedAsset)) {
        showNotice(
          'Chưa hỗ trợ gửi thư mục',
          'Hiện tại mobile chỉ gửi tệp đơn. Bạn hãy nén thư mục thành file .zip rồi gửi.'
        )
        return
      }

  await sendAttachmentMessage(selectedAsset, 'File', replyTo)
    } catch (error) {
  showNotice('Lỗi', error?.message || 'Không thể chọn tệp')
    }
  }, [sendAttachmentMessage])

  const applyReactionOptimistic = useCallback((baseMessage, emoji, actorUserId) => {
    const nextMessage = { ...(baseMessage || {}) }
    const currentReactions = { ...(baseMessage?.reactions || {}) }
    const normalizedActorUserId = normalizeId(actorUserId)

    const currentUsers = Array.isArray(currentReactions?.[emoji])
      ? currentReactions[emoji].map((id) => normalizeId(id)).filter(Boolean)
      : []

    const hasReacted = currentUsers.includes(normalizedActorUserId)
    const nextUsers = hasReacted
      ? currentUsers.filter((id) => id !== normalizedActorUserId)
      : [...currentUsers, normalizedActorUserId]

    if (nextUsers.length > 0) {
      currentReactions[emoji] = nextUsers
    } else {
      delete currentReactions[emoji]
    }

    nextMessage.reactions = currentReactions
    return nextMessage
  }, [])

  const editCurrentMessage = useCallback(async (messageId, nextContent) => {
    const conversationId = activeConversationIdRef.current
    const normalizedMessageId = normalizeId(messageId)
    const trimmedContent = String(nextContent || '').trim()

    if (!conversationId || !normalizedMessageId || !trimmedContent) return

    const previousMessageRef = { current: null }

    setMessages((prev) =>
      prev.map((msg) => {
        const id = normalizeId(msg?._id || msg?.messageId)
        if (id !== normalizedMessageId) return msg

        previousMessageRef.current = msg
        return {
          ...msg,
          content: trimmedContent,
          isEdited: true,
          editedAt: Date.now(),
        }
      })
    )

    try {
      const response = await messageApi.editMessage(conversationId, normalizedMessageId, trimmedContent)
      const updatedMessage = response?.data?.data || null

      setMessages((prev) =>
        prev.map((msg) => {
          const id = normalizeId(msg?._id || msg?.messageId)
          if (id !== normalizedMessageId) return msg

          return {
            ...msg,
            ...(updatedMessage || {}),
            content: updatedMessage?.content || trimmedContent,
            isEdited: true,
            editedAt: updatedMessage?.editedAt || Date.now(),
          }
        })
      )
    } catch (error) {
      if (previousMessageRef.current) {
        setMessages((prev) =>
          prev.map((msg) => {
            const id = normalizeId(msg?._id || msg?.messageId)
            return id === normalizedMessageId ? previousMessageRef.current : msg
          })
        )
      }

  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể sửa tin nhắn'))
    }
  }, [])

  const deleteCurrentMessage = useCallback(async (messageId) => {
    const conversationId = activeConversationIdRef.current
    const normalizedMessageId = normalizeId(messageId)
    if (!conversationId || !normalizedMessageId) return

    let deletedSnapshot = null
    setMessages((prev) => {
      deletedSnapshot = prev.find((msg) => normalizeId(msg?._id || msg?.messageId) === normalizedMessageId) || null
      return prev.filter((msg) => normalizeId(msg?._id || msg?.messageId) !== normalizedMessageId)
    })

    try {
      await messageApi.deleteMessage(conversationId, normalizedMessageId)
      await loadConversations()
    } catch (error) {
      if (deletedSnapshot) {
        setMessages((prev) => sortMessagesAsc([...prev, deletedSnapshot]))
      }

  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể xóa tin nhắn'))
    }
  }, [loadConversations])

  const deleteMessageForAll = useCallback(async (messageId) => {
    const conversationId = activeConversationIdRef.current
    const normalizedMessageId = normalizeId(messageId)
    if (!conversationId || !normalizedMessageId) return

    let deletedSnapshot = null
    setMessages((prev) => {
      deletedSnapshot = prev.find((msg) => normalizeId(msg?._id || msg?.messageId) === normalizedMessageId) || null
      return prev.filter((msg) => normalizeId(msg?._id || msg?.messageId) !== normalizedMessageId)
    })

    try {
      await messageApi.deleteMessageForAll(conversationId, normalizedMessageId)
      await loadConversations()
    } catch (error) {
      if (deletedSnapshot) {
        setMessages((prev) => sortMessagesAsc([...prev, deletedSnapshot]))
      }

  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể xóa tin nhắn với mọi người'))
    }
  }, [loadConversations])

  const toggleMessageReaction = useCallback(async (message, emoji) => {
    const conversationId = activeConversationIdRef.current
    const messageId = normalizeId(message?._id || message?.messageId)
    const userId = normalizeId(user?._id || user?.userId)
    if (!conversationId || !messageId || !emoji || !userId) return

    const previousMessageRef = { current: null }

    setMessages((prev) =>
      prev.map((msg) => {
        const id = normalizeId(msg?._id || msg?.messageId)
        if (id !== messageId) return msg

        previousMessageRef.current = msg
        return applyReactionOptimistic(msg, emoji, userId)
      })
    )

    try {
      const currentReactions = message?.reactions || {}
      const reactedUsers = Array.isArray(currentReactions?.[emoji]) ? currentReactions[emoji] : []
      const hasReacted = reactedUsers.map((id) => normalizeId(id)).includes(userId)

      const response = hasReacted
        ? await messageApi.removeEmoji(conversationId, messageId, emoji)
        : await messageApi.addEmoji(conversationId, messageId, emoji)

      const updatedMessage = response?.data?.data
      if (!updatedMessage) return

      setMessages((prev) =>
        prev.map((msg) => {
          const id = normalizeId(msg?._id || msg?.messageId)
          return id === messageId
            ? {
              ...msg,
              reactions: updatedMessage?.reactions || {},
            }
            : msg
        })
      )
    } catch (error) {
      if (previousMessageRef.current) {
        setMessages((prev) =>
          prev.map((msg) => {
            const id = normalizeId(msg?._id || msg?.messageId)
            return id === messageId ? previousMessageRef.current : msg
          })
        )
      }

  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể cập nhật biểu cảm'))
    }
  }, [applyReactionOptimistic, user])

  const forwardMessageToConversations = useCallback(async (message, targetConversationIds = []) => {
    const senderConversationId = normalizeId(activeConversationIdRef.current)
    const targetIds = [...new Set((targetConversationIds || []).map((id) => normalizeId(id)).filter(Boolean))]
    if (!message || targetIds.length === 0) return

    const forwardedContent = buildForwardedMessageContent(message)
    const attachments = (Array.isArray(message?.attachments) ? message.attachments : [])
      .map((attachment) => normalizeForwardAttachment(attachment))
      .filter(Boolean)

    try {
      for (const targetConversationId of targetIds) {
        if (attachments.length === 0) {
          await messageApi.sendMessage(
            targetConversationId,
            forwardedContent,
            null,
            { clientMessageId: createClientMessageId('fwd') }
          )
          continue
        }

        let sentContent = false
        for (const attachment of attachments) {
          await messageApi.forwardAttachmentByUrl(
            targetConversationId,
            attachment.url,
            {
              name: attachment.name,
              mimeType: attachment.mimeType,
              size: attachment.size,
            },
            sentContent ? `[[FORWARDED]]\n📎 ${attachment.name}` : forwardedContent,
            null,
            { clientMessageId: createClientMessageId('fwd-file') }
          )
          sentContent = true
        }
      }

      await loadConversations()
      if (targetIds.includes(senderConversationId)) {
        await openConversation({ _id: senderConversationId, conversationId: senderConversationId })
      }
    } catch (error) {
  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể chuyển tiếp tin nhắn'))
    }
  }, [loadConversations, openConversation])

  const handleStartTyping = useCallback(() => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId) return

    emitTypingStart(conversationId)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop(conversationId)
    }, 1500)
  }, [])

  const handleStopTyping = useCallback(() => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId) return

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    emitTypingStop(conversationId)
  }, [])

  const handleLogout = useCallback(async () => {
    if (pushTokenRef.current) {
      await notificationApi.unregisterToken({ token: pushTokenRef.current }).catch(() => {})
      pushTokenRef.current = ''
    }

    try {
      await authApi.logout()
    } catch (_) {
      // ignore expired token
    }

    disconnectSocket()
    await storage.clearAuth()
    setInMemoryAuth({ user: null, accessToken: null, refreshToken: null })

    setUser(null)
    setAccessToken('')
    setRefreshToken('')
    setAuthError('')
    setPendingVerificationEmail('')

    setConversations([])
    setUnreadByConversation({})
    setMessages([])
    setTypingByConversation({})
    setConversationPreferences({})
    activeConversationIdRef.current = ''
  }, [])

  const updateConversationPreference = useCallback((conversationId, patch) => {
    const normalizedConversationId = normalizeId(conversationId)
    if (!normalizedConversationId || !patch || typeof patch !== 'object') return

    setConversationPreferences((prev) => {
      const currentPreference = {
        ...createDefaultConversationPreference(),
        ...(prev?.[normalizedConversationId] || {}),
      }

      return {
        ...(prev || {}),
        [normalizedConversationId]: {
          ...currentPreference,
          ...patch,
        },
      }
    })
  }, [])

  const handleLogin = useCallback(async (email, password) => {
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!normalizedEmail || !password) {
      setAuthError('Vui lòng nhập email và mật khẩu')
      return false
    }

    setAuthLoading(true)
    setAuthError('')

    try {
      const response = await authApi.login(normalizedEmail, password)
      const authData = normalizeAuthPayload(response)

      await applyAuth(authData)

      return true
    } catch (error) {
      setAuthError(getLoginErrorMessage(error))
      return false
    } finally {
      setAuthLoading(false)
    }
  }, [applyAuth])

  const handleRegister = useCallback(async (payload) => {
    setAuthLoading(true)
    setAuthError('')

    try {
      const response = await authApi.register(payload)
      const registeredEmail = response?.data?.user?.email || payload?.email
      if (!registeredEmail) {
        throw new Error('Không xác định được email để xác thực OTP')
      }

      try {
        await authApi.sendEmailVerificationOtp(registeredEmail)
      } catch (_) {
        // Account is already created successfully; let user continue to OTP screen
        // and retry sending OTP from there.
        setAuthError('Tài khoản đã tạo thành công nhưng gửi OTP thất bại. Vui lòng bấm gửi lại mã.')
      }

      setPendingVerificationEmail(registeredEmail)

      return { ok: true, email: registeredEmail }
    } catch (error) {
      const errorMsg = getRequestErrorMessage(error, 'Đăng ký thất bại')
      setAuthError(errorMsg)
      return { ok: false, error: errorMsg }
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const resendOtp = useCallback(async () => {
    if (!pendingVerificationEmail) {
      throw new Error('Không có email để gửi OTP')
    }

    await authApi.sendEmailVerificationOtp(pendingVerificationEmail)
  }, [pendingVerificationEmail])

  const verifyOtp = useCallback(async (otp) => {
    if (!pendingVerificationEmail) {
      setAuthError('Thiếu email xác thực')
      return false
    }

    setAuthLoading(true)
    setAuthError('')

    try {
      const response = await authApi.verifyEmailOtp(pendingVerificationEmail, otp)
      const authData = normalizeAuthPayload(response)

      await applyAuth(authData)

      setPendingVerificationEmail('')
      return true
    } catch (error) {
      setAuthError(getRequestErrorMessage(error, 'Xác thực OTP thất bại'))
      return false
    } finally {
      setAuthLoading(false)
    }
  }, [applyAuth, pendingVerificationEmail])

  const requestForgotPassword = useCallback(async (email) => {
    setAuthLoading(true)
    setAuthError('')

    try {
      await authApi.forgotPassword(email)
      return { ok: true }
    } catch (error) {
      const errorMsg = getRequestErrorMessage(error, 'Không thể gửi mã đặt lại mật khẩu')
      setAuthError(errorMsg)
      return { ok: false, error: errorMsg }
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const verifyForgotToken = useCallback(async (email, token) => {
    setAuthLoading(true)
    setAuthError('')

    try {
      await authApi.verifyResetToken(email, token)
      return { ok: true }
    } catch (error) {
      const errorMsg = getRequestErrorMessage(error, 'Mã xác minh không hợp lệ hoặc đã hết hạn')
      setAuthError(errorMsg)
      return { ok: false, error: errorMsg }
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const resetForgotPassword = useCallback(async (email, token, newPassword, confirmPassword) => {
    setAuthLoading(true)
    setAuthError('')

    try {
      await authApi.resetPassword(email, token, newPassword, confirmPassword)
      return { ok: true }
    } catch (error) {
      const errorMsg = getRequestErrorMessage(error, 'Không thể đặt lại mật khẩu')
      setAuthError(errorMsg)
      return { ok: false, error: errorMsg }
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const updateProfile = useCallback(async ({ displayName, bio }) => {
    setAuthLoading(true)
    setAuthError('')

    try {
      const response = await userApi.updateProfile({
        displayName,
        fullName: displayName,
        bio,
      })

      const updated = response?.data?.user
      if (!updated) {
        throw new Error('Dữ liệu hồ sơ trả về không hợp lệ')
      }

      const nextUser = {
        ...user,
        ...updated,
        _id: updated?._id || updated?.userId || user?._id,
        displayName: updated?.displayName || updated?.fullName || displayName,
        fullName: updated?.fullName || displayName,
        bio: updated?.bio || bio || '',
      }

      await applyAuth({
        user: nextUser,
        accessToken,
        refreshToken,
      })

      return { ok: true }
    } catch (error) {
      const errorMsg = getRequestErrorMessage(error, 'Không thể cập nhật hồ sơ')
      setAuthError(errorMsg)
      return { ok: false, error: errorMsg }
    } finally {
      setAuthLoading(false)
    }
  }, [applyAuth, user, accessToken, refreshToken])

  const updatePassword = useCallback(async ({ currentPassword, newPassword, confirmPassword }) => {
    setAuthLoading(true)
    setAuthError('')

    try {
      await userApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      })
      return { ok: true }
    } catch (error) {
      const errorMsg = getRequestErrorMessage(error, 'Không thể đổi mật khẩu')
      setAuthError(errorMsg)
      return { ok: false, error: errorMsg }
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const updateAvatar = useCallback(async () => {
    setAuthLoading(true)
    setAuthError('')

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (permission.status !== 'granted') {
        throw new Error('Bạn cần cấp quyền thư viện để cập nhật avatar')
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: IMAGE_PICKER_MEDIA_TYPES,
        quality: 0.8,
      })

      if (result.canceled || !result.assets?.length) {
        return { ok: false, error: 'Bạn chưa chọn ảnh nào' }
      }

      const picked = result.assets[0]
      const formData = new FormData()
      formData.append('avatar', {
        uri: picked.uri,
        name: picked.fileName || `avatar-${Date.now()}.jpg`,
        type: picked.mimeType || 'image/jpeg',
      })

      const response = await userApi.updateAvatar(formData)
      const updated = response?.data?.user
      if (!updated) {
        throw new Error('Dữ liệu avatar trả về không hợp lệ')
      }

      const nextUser = {
        ...user,
        ...updated,
        _id: updated?._id || updated?.userId || user?._id,
      }

      await applyAuth({
        user: nextUser,
        accessToken,
        refreshToken,
      })

      return { ok: true }
    } catch (error) {
      const errorMsg = getRequestErrorMessage(error, 'Không thể cập nhật avatar')
      setAuthError(errorMsg)
      return { ok: false, error: errorMsg }
    } finally {
      setAuthLoading(false)
    }
  }, [applyAuth, user, accessToken, refreshToken])

  const startConversationWithUser = useCallback(async (userId) => {
    const normalizedUserId = normalizeId(userId)
    if (!normalizedUserId) return false

    try {
      const response = await conversationApi.createConversation('1-1', [normalizedUserId])
      const conversation = response?.data?.conversation
      const candidateConversation =
        conversation ||
        conversations.find((item) => {
          const participants = Array.isArray(item?.participants) ? item.participants : []
          return participants.some((participant) => getParticipantId(participant) === normalizedUserId)
        })

      await loadConversations()

      if (!candidateConversation) return false

      return await openConversation(candidateConversation)
    } catch (error) {
  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể mở cuộc trò chuyện với người dùng này'))
      return false
    }
  }, [conversations, loadConversations, openConversation])

  const createGroupConversation = useCallback(async (participantIds, name) => {
    const normalizedParticipantIds = Array.from(
      new Set((participantIds || []).map((id) => normalizeId(id)).filter(Boolean))
    )

    if (normalizedParticipantIds.length < 2) {
      throw new Error('Nhóm cần ít nhất 2 thành viên (ngoài bạn)')
    }

    const response = await conversationApi.createConversation('group', normalizedParticipantIds, name)
    const createdConversation = response?.data?.conversation
    const createdConversationId = normalizeId(
      createdConversation?._id || createdConversation?.conversationId
    )

    await loadConversations()

    if (createdConversationId) {
      const opened = await openConversation(
        createdConversation || { _id: createdConversationId, conversationId: createdConversationId }
      )

      return {
        conversation: createdConversation,
        opened,
      }
    }

    return {
      conversation: createdConversation,
      opened: false,
    }
  }, [loadConversations, openConversation])

  const renameCurrentGroup = useCallback(async (nextName) => {
    const conversationId = activeConversationIdRef.current
    const trimmedName = String(nextName || '').trim()

    if (!conversationId || !trimmedName) return

    try {
      const response = await conversationApi.updateConversation(conversationId, {
        name: trimmedName,
      })

      const updatedConversation = response?.data?.conversation || { conversationId, name: trimmedName }
      upsertConversation(conversationId, {
        ...updatedConversation,
        name: updatedConversation?.name || trimmedName,
      })
    } catch (error) {
  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể đổi tên nhóm'))
    }
  }, [upsertConversation])

  const updateCurrentGroupAvatar = useCallback(async () => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId) return

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (permission.status !== 'granted') {
  showNotice('Thiếu quyền', 'Bạn cần cấp quyền thư viện để cập nhật ảnh nhóm')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: IMAGE_PICKER_MEDIA_TYPES,
        quality: 0.8,
      })

      if (result.canceled || !result.assets?.length) {
        return
      }

      const picked = result.assets[0]
      const formData = new FormData()
      formData.append('avatar', {
        uri: picked.uri,
        name: picked.fileName || `group-avatar-${Date.now()}.jpg`,
        type: picked.mimeType || 'image/jpeg',
      })

      const response = await conversationApi.updateConversationAvatar(conversationId, formData)
      const updatedConversation = response?.data?.conversation || {}

      upsertConversation(conversationId, {
        ...updatedConversation,
        avatar: updatedConversation?.avatar || '',
      })
    } catch (error) {
  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể cập nhật ảnh đại diện nhóm'))
    }
  }, [upsertConversation])

  const searchUsersForGroupMember = useCallback(async (keyword) => {
    const trimmedKeyword = String(keyword || '').trim()
    if (!trimmedKeyword) return []

    try {
      const response = await userApi.searchUsers(trimmedKeyword)
      return response?.data?.users || []
    } catch (error) {
  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể tìm kiếm người dùng'))
      return []
    }
  }, [])

  const addMemberToCurrentGroup = useCallback(async (participantId) => {
    const conversationId = activeConversationIdRef.current
    const normalizedParticipantId = normalizeId(participantId)
    if (!conversationId || !normalizedParticipantId) return false

    try {
      await conversationApi.addParticipant(conversationId, normalizedParticipantId)
      await loadConversations()
      await openConversation({ _id: conversationId, conversationId })
      return true
    } catch (error) {
  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể thêm thành viên vào nhóm'))
      return false
    }
  }, [loadConversations, openConversation])

  const removeMemberFromCurrentGroup = useCallback(async (participantId) => {
    const conversationId = activeConversationIdRef.current
    const normalizedParticipantId = normalizeId(participantId)
    if (!conversationId || !normalizedParticipantId) return false

    try {
      await conversationApi.removeParticipant(conversationId, normalizedParticipantId)
      await loadConversations()
      await openConversation({ _id: conversationId, conversationId })
      return true
    } catch (error) {
      showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể xóa thành viên khỏi nhóm'))
      return false
    }
  }, [loadConversations, openConversation, showNotice])

  const updateCurrentParticipantRole = useCallback(async (participantId, nextRole, oldRole = 'member') => {
    const conversationId = activeConversationIdRef.current
    const normalizedParticipantId = normalizeId(participantId)
    const normalizedNextRole = String(nextRole || '').toLowerCase()
    const normalizedOldRole = String(oldRole || 'member').toLowerCase()

    if (!conversationId || !normalizedParticipantId) return false
    if (!normalizedNextRole || normalizedNextRole === normalizedOldRole) return true

    try {
      await conversationApi.updateParticipantRole(conversationId, normalizedParticipantId, normalizedNextRole)

      const fallbackParticipants = (
        conversationsRef.current.find(
          (item) => normalizeId(item?._id || item?.conversationId) === conversationId
        )?.participants
      ) || []

      upsertConversation(conversationId, {
        participants: (Array.isArray(fallbackParticipants) ? fallbackParticipants : []).map((participant) => {
          const participantKey = normalizeId(participant?._id || participant?.userId || participant)
          if (participantKey !== normalizedParticipantId) return participant

          if (typeof participant === 'object' && participant) {
            return {
              ...participant,
              role: normalizedNextRole,
            }
          }

          return {
            _id: normalizedParticipantId,
            userId: normalizedParticipantId,
            role: normalizedNextRole,
          }
        }),
      })

      return true
    } catch (error) {
      showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể cập nhật vai trò thành viên'))
      return false
    }
  }, [showNotice, upsertConversation])

  const updateCurrentGroupSettings = useCallback(async (patch) => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId || !patch || typeof patch !== 'object') return false

    try {
      const response = await conversationApi.updateGroupSettings(conversationId, patch)
      const updatedConversation = response?.data?.conversation || {}
      upsertConversation(conversationId, {
        ...updatedConversation,
        groupSettings: updatedConversation?.groupSettings || patch,
      })
      return true
    } catch (error) {
  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể cập nhật cài đặt nhóm'))
      return false
    }
  }, [upsertConversation])

  const resetMobileCall = useCallback(async () => {
    const callId = normalizeId(mobileCallStateRef.current?.call?.callId)
    await stopMobileChimeMeeting().catch(() => {})
    if (callId) {
      incomingCallNotificationIdsRef.current.delete(callId)
      incomingCallDialogIdsRef.current.delete(callId)
      acceptingMobileCallIdsRef.current.delete(callId)
    }
    pendingMobileJoinInfoRef.current = null
    setMobileCallState({
      visible: false,
      call: null,
      phase: 'idle',
      error: '',
      isMuted: false,
      isCameraEnabled: false,
      videoTiles: [],
      activeSpeakerId: '',
      audioRoute: 'speaker',
      availableAudioRoutes: ['speaker'],
    })
  }, [])

  const joinMobileCall = useCallback(async (joinInfo) => {
    const normalizedJoinInfo = normalizeJoinInfo(joinInfo)
    if (!normalizedJoinInfo?.call) {
      setMobileCallState((prev) => ({
        ...prev,
        visible: true,
        phase: 'joining',
        error: 'Thiếu thông tin Amazon Chime để tham gia cuộc gọi',
      }))
      return
    }

    setMobileCallState((prev) => ({
      ...prev,
      visible: true,
      call: normalizedJoinInfo.call,
      phase: 'joining',
      error: '',
    }))

    try {
      const isVideoCall = String(normalizedJoinInfo.call?.callType || '').toLowerCase() === 'video'
      const availableRoutes = await getMobileChimeAudioRoutes().catch(() => ['speaker'])
      if (isVideoCall && availableRoutes.includes('speaker')) {
        await setMobileChimeAudioRoute('speaker').catch(() => {})
      }
      await startMobileChimeMeeting(normalizedJoinInfo)
      setMobileCallState((prev) => ({
        ...prev,
        visible: true,
        call: normalizedJoinInfo.call,
        phase: 'active',
        error: '',
        isMuted: false,
        isCameraEnabled: isVideoCall,
        audioRoute: isVideoCall && availableRoutes.includes('speaker') ? 'speaker' : (availableRoutes[0] || 'speaker'),
        availableAudioRoutes: availableRoutes,
      }))
    } catch (error) {
      setMobileCallState((prev) => ({
        ...prev,
        visible: true,
        call: normalizedJoinInfo.call,
        phase: 'joining',
        error: error?.message || 'Không thể join cuộc gọi trên mobile',
      }))
    }
  }, [])

  const startMobileCall = useCallback(async (callType = 'audio') => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId) return

    try {
      setMobileCallState({
        visible: true,
        call: { conversationId, callType },
        phase: 'starting',
        error: '',
        isMuted: false,
        isCameraEnabled: false,
        videoTiles: [],
        activeSpeakerId: '',
        audioRoute: 'speaker',
        availableAudioRoutes: ['speaker'],
      })
      const response = await callApi.startCall(conversationId, callType)
      pendingMobileJoinInfoRef.current = response?.data || null
      setMobileCallState((prev) => ({
        ...prev,
        visible: true,
        call: response?.data?.call || prev.call,
        phase: 'ringing',
        error: '',
      }))
    } catch (error) {
      setMobileCallState((prev) => ({
        ...prev,
        visible: true,
        phase: 'idle',
        error: getRequestErrorMessage(error, 'Không thể bắt đầu cuộc gọi'),
      }))
    }
  }, [])

  const acceptMobileCall = useCallback(async (targetCall = null) => {
    const callToAccept = normalizeId(targetCall?.callId) ? targetCall : mobileCallStateRef.current?.call
    const callId = normalizeId(callToAccept?.callId)
    if (!callId) return

    acceptingMobileCallIdsRef.current.add(callId)

    try {
      setMobileCallState((prev) => ({
        ...prev,
        visible: true,
        call: callToAccept || prev.call,
        phase: 'joining',
        error: '',
      }))
      const response = await callApi.acceptCall(callId)
      pendingMobileJoinInfoRef.current = response?.data || null
      await joinMobileCall(response?.data)
    } catch (error) {
      acceptingMobileCallIdsRef.current.delete(callId)
      setMobileCallState((prev) => ({
        ...prev,
        visible: true,
        call: callToAccept || prev.call,
        phase: 'incoming',
        error: getRequestErrorMessage(error, 'Không thể nghe máy'),
      }))
    }
  }, [joinMobileCall])

  const declineMobileCall = useCallback(async (targetCall = null) => {
    const call = normalizeId(targetCall?.callId) ? targetCall : mobileCallStateRef.current?.call
    const callId = normalizeId(call?.callId)
    if (callId) {
      await callApi.declineCall(callId).catch(() => {})
    }
    await resetMobileCall()
  }, [resetMobileCall])

  const endMobileCall = useCallback(async () => {
    const callId = normalizeId(mobileCallStateRef.current?.call?.callId)
    if (callId) {
      await callApi.endCall(callId).catch(() => {})
    }
    await resetMobileCall()
  }, [resetMobileCall])

  const toggleMobileMute = useCallback(async () => {
    const nextMuted = !mobileCallStateRef.current?.isMuted
    await setMobileChimeMuted(nextMuted).catch(() => {})
    setMobileCallState((prev) => ({ ...prev, isMuted: nextMuted }))
  }, [])

  const toggleMobileCamera = useCallback(async () => {
    const nextEnabled = !mobileCallStateRef.current?.isCameraEnabled
    await setMobileChimeCameraEnabled(nextEnabled).catch(() => {})
    setMobileCallState((prev) => ({ ...prev, isCameraEnabled: nextEnabled }))
  }, [])

  const switchMobileCamera = useCallback(async () => {
    await switchMobileChimeCamera().catch(() => {})
  }, [])

  const selectMobileAudioRoute = useCallback(async (route) => {
    const nextRoute = String(route || 'speaker')
    await setMobileChimeAudioRoute(nextRoute).catch(() => {})
    setMobileCallState((prev) => ({ ...prev, audioRoute: nextRoute }))
  }, [])

  useEffect(() => {
    const subscriptions = [
      addMobileChimeEventListener(MOBILE_CHIME_EVENTS.VIDEO_TILE_ADDED, (tile) => {
        setMobileCallState((prev) => {
          const tileId = normalizeId(tile?.tileId)
          if (!tileId) return prev
          const withoutExisting = (prev.videoTiles || []).filter((item) => normalizeId(item?.tileId) !== tileId)
          return {
            ...prev,
            videoTiles: [
              ...withoutExisting,
              {
                ...tile,
                tileId,
                hasVideo: tile?.hasVideo !== false,
              },
            ],
          }
        })
      }),
      addMobileChimeEventListener(MOBILE_CHIME_EVENTS.VIDEO_TILE_REMOVED, (tile) => {
        const tileId = normalizeId(tile?.tileId)
        if (!tileId) return
        setMobileCallState((prev) => ({
          ...prev,
          videoTiles: (prev.videoTiles || []).filter((item) => normalizeId(item?.tileId) !== tileId),
        }))
      }),
      addMobileChimeEventListener(MOBILE_CHIME_EVENTS.ACTIVE_SPEAKER_CHANGED, (payload) => {
        setMobileCallState((prev) => ({
          ...prev,
          activeSpeakerId: normalizeId(payload?.attendeeId || payload?.userId),
        }))
      }),
      addMobileChimeEventListener(MOBILE_CHIME_EVENTS.AUDIO_ROUTE_CHANGED, (payload) => {
        const route = String(payload?.route || 'speaker')
        const availableRoutes = Array.isArray(payload?.availableRoutes) && payload.availableRoutes.length > 0
          ? payload.availableRoutes
          : mobileCallStateRef.current?.availableAudioRoutes || ['speaker']
        setMobileCallState((prev) => ({
          ...prev,
          audioRoute: route,
          availableAudioRoutes: availableRoutes,
        }))
      }),
      addMobileChimeEventListener(MOBILE_CHIME_EVENTS.MEETING_ENDED, () => {
        resetMobileCall().catch(() => {})
      }),
      addMobileChimeEventListener(MOBILE_CHIME_EVENTS.MEETING_ERROR, (payload) => {
        setMobileCallState((prev) => ({
          ...prev,
          error: payload?.message || 'Cuộc gọi gặp lỗi media',
        }))
      }),
    ]

    return () => {
      subscriptions.forEach((subscription) => subscription?.remove?.())
    }
  }, [resetMobileCall])

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [cached, cachedPreferences] = await Promise.all([
          storage.getAuth(),
          storage.getConversationPreferences(),
        ])
        if (cached?.accessToken && cached?.user) {
          setInMemoryAuth(cached)
          setUser(cached.user)
          setAccessToken(cached.accessToken)
          setRefreshToken(cached.refreshToken || '')
        }

        if (cachedPreferences && typeof cachedPreferences === 'object') {
          setConversationPreferences(cachedPreferences)
        }
      } finally {
        setBooting(false)
      }
    }

    bootstrap()
  }, [])

  useEffect(() => {
    conversationsRef.current = Array.isArray(conversations) ? conversations : []
  }, [conversations])

  useEffect(() => {
    conversationPreferencesRef.current = conversationPreferences || {}
  }, [conversationPreferences])

  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = response?.notification?.request?.content?.data || {}
      const conversationId = normalizeId(data?.conversationId)
      if (!conversationId || !authenticated) return
      const notificationType = String(data?.type || '').toLowerCase()
      const callId = normalizeId(data?.callId)

      if (notificationType === 'call' && callId) {
        const currentCallId = normalizeId(mobileCallStateRef.current?.call?.callId)
        if (currentCallId === callId) {
          setMobileCallState((prev) => ({ ...prev, visible: true }))
          return
        }

        callApi.getCall(callId)
          .then((response) => {
            const call = response?.data?.call
            if (!call) return
            setMobileCallState((prev) => ({
              ...prev,
              visible: true,
              call,
              phase: String(call?.status || '').toLowerCase() === 'accepted' ? 'joining' : 'incoming',
              error: '',
            }))
          })
          .catch((error) => {
            console.warn('Cannot open call notification:', error?.message || error)
          })
        return
      }

      const matchedConversation = conversationsRef.current.find((conversation) => {
        const id = normalizeId(conversation?._id || conversation?.conversationId)
        return id === conversationId
      })

      openConversation(matchedConversation || { _id: conversationId, conversationId })
        .then((opened) => {
          if (opened) {
            navigationRef.current?.navigate?.('Chat')
          }
        })
        .catch((error) => {
          console.warn('Cannot open notification conversation:', error?.message || error)
        })
    })

    return () => {
      subscription?.remove?.()
    }
  }, [authenticated, openConversation])

  useEffect(() => {
    if (!authenticated) return

    setInMemoryAuth({ user, accessToken, refreshToken })
    storage.setAuth({ user, accessToken, refreshToken }).catch(() => {})

    const socket = connectSocket(accessToken)
    if (!socket) return

    registerForPushNotificationsAsync()
      .then((token) => {
        if (!token || pushTokenRef.current === token) return null
        pushTokenRef.current = token
        return notificationApi.registerToken({
          token,
          platform: Platform.OS,
          deviceId: token,
        })
      })
      .catch((error) => {
        console.warn('Cannot register push notification token:', error?.message || error)
      })

    const incomingHandler = buildIncomingMessageHandler(activeConversationIdRef, ({ message, isCurrentConversation }) => {
      if (!message) return

      const conversationId = normalizeId(message?.conversationId)
      if (!conversationId) return
      const currentUserId = normalizeId(user?._id || user?.userId)
      const senderId = normalizeId(message?.senderId)

      if (isCurrentConversation) {
        setMessages((prev) => {
          const exists = prev.some(
            (msg) => normalizeId(msg?._id || msg?.messageId) === normalizeId(message?._id || message?.messageId)
          )
          if (exists) return prev
          return sortMessagesAsc([...prev, message])
        })

        messageApi.markAsSeen(conversationId).catch(() => {})
      } else {
        setUnreadByConversation((prev) => ({
          ...prev,
          [conversationId]: (Number(prev?.[conversationId]) || 0) + 1,
        }))

        const preference = conversationPreferencesRef.current?.[conversationId] || {}
        const messageId = normalizeId(message?._id || message?.messageId || message?.clientMessageId)
        const alreadyNotified = messageId && foregroundNotificationIdsRef.current.has(messageId)

        if (!alreadyNotified && senderId !== currentUserId && !preference?.muted) {
          if (messageId) {
            foregroundNotificationIdsRef.current.add(messageId)
            if (foregroundNotificationIdsRef.current.size > 300) {
              const [oldestId] = foregroundNotificationIdsRef.current
              foregroundNotificationIdsRef.current.delete(oldestId)
            }
          }

          const matchedConversation = conversationsRef.current.find((conversation) => {
            const id = normalizeId(conversation?._id || conversation?.conversationId)
            return id === conversationId
          })

          scheduleMessageNotification({
            message,
            conversation: matchedConversation || { _id: conversationId, conversationId },
            currentUserId,
          }).catch((error) => {
            console.warn('Cannot show message notification:', error?.message || error)
          })
        }
      }

      upsertConversation(conversationId, {
        latestMessage: message,
        lastMessageAt: message?.createdAt || Date.now(),
      })
    })

    const stopTypingStartListener = onTypingStart((payload) => {
      const conversationId = normalizeId(payload?.conversationId)
      const typingUserId = normalizeId(payload?.userId)
      const currentUserId = normalizeId(user?._id || user?.userId)

      if (!conversationId || !typingUserId || typingUserId === currentUserId) return

      setTypingByConversation((prev) => {
        const current = new Set(prev?.[conversationId] || [])
        current.add(typingUserId)
        return {
          ...prev,
          [conversationId]: Array.from(current),
        }
      })
    })

    const stopTypingStopListener = onTypingStop((payload) => {
      const conversationId = normalizeId(payload?.conversationId)
      const typingUserId = normalizeId(payload?.userId)
      if (!conversationId || !typingUserId) return

      setTypingByConversation((prev) => {
        const current = new Set(prev?.[conversationId] || [])
        current.delete(typingUserId)
        return {
          ...prev,
          [conversationId]: Array.from(current),
        }
      })
    })

    const editedHandler = (payload) => {
      const incomingMessage = payload?.message
      const incomingMessageId = normalizeId(
        incomingMessage?._id || incomingMessage?.messageId || payload?.messageId
      )

      if (!incomingMessageId) return

      setMessages((prev) =>
        prev.map((msg) => {
          const id = normalizeId(msg?._id || msg?.messageId)
          if (id !== incomingMessageId) return msg

          if (incomingMessage) {
            return {
              ...msg,
              ...incomingMessage,
              content: incomingMessage?.content ?? msg?.content,
              isEdited: incomingMessage?.isEdited ?? true,
              editedAt: incomingMessage?.editedAt || Date.now(),
            }
          }

          return {
            ...msg,
            content: payload?.content ?? msg?.content,
            isEdited: payload?.isEdited ?? true,
            editedAt: Date.now(),
          }
        })
      )
    }

    const deletedHandler = (payload) => {
      const deletedMessageId = normalizeId(payload?.messageId || payload?._id)
      if (!deletedMessageId) return

      setMessages((prev) =>
        prev.filter((msg) => normalizeId(msg?._id || msg?.messageId) !== deletedMessageId)
      )
    }

    const emojiHandler = (payload) => {
      const incomingMessage = payload?.message
      const incomingMessageId = normalizeId(incomingMessage?._id || incomingMessage?.messageId)
      if (!incomingMessageId) return

      setMessages((prev) =>
        prev.map((msg) => {
          const id = normalizeId(msg?._id || msg?.messageId)
          if (id !== incomingMessageId) return msg

          return {
            ...msg,
            reactions: incomingMessage?.reactions || {},
          }
        })
      )
    }

    const hiddenHandler = (payload) => {
      const messageId = normalizeId(payload?.messageId)
      const conversationId = normalizeId(payload?.conversationId)
      const hiddenBy = normalizeId(payload?.hiddenBy)
      const currentUserId = normalizeId(user?._id || user?.userId)
      if (!messageId || hiddenBy !== currentUserId) return

      setMessages((prev) => prev.filter((msg) => normalizeId(msg?._id || msg?.messageId) !== messageId))
      if (conversationId) {
        loadConversations()
      }
    }

    const incomingCallHandler = (payload) => {
      const call = payload?.call || payload
      const callId = normalizeId(call?.callId)
      const conversationId = normalizeId(call?.conversationId)
      const currentUserId = normalizeId(user?._id || user?.userId)
      const participantIds = Array.isArray(call?.participantIds)
        ? call.participantIds.map((id) => normalizeId(id)).filter(Boolean)
        : []
      const callerId = normalizeId(call?.callerId)
      const status = String(call?.status || '').toLowerCase()
      if (!callId || !conversationId || status !== 'ringing') return
      if (callerId === currentUserId || !participantIds.includes(currentUserId)) return

      const currentCallId = normalizeId(mobileCallStateRef.current?.call?.callId)
      const currentPhase = String(mobileCallStateRef.current?.phase || 'idle').toLowerCase()
      if (acceptingMobileCallIdsRef.current.has(callId)) return
      if (currentCallId === callId && currentPhase !== 'idle') return

      const matchedConversation = conversationsRef.current.find((conversation) => {
        const id = normalizeId(conversation?._id || conversation?.conversationId)
        return id === conversationId
      })
      const preference = conversationPreferencesRef.current?.[conversationId] || {}

      setMobileCallState((prev) => {
        if (normalizeId(prev?.call?.callId) === callId && ['active', 'joining'].includes(prev?.phase)) {
          return prev
        }

        return {
          ...prev,
          visible: true,
          call,
          phase: 'incoming',
          error: '',
        }
      })

      if (!incomingCallNotificationIdsRef.current.has(callId) && !preference?.muted) {
        incomingCallNotificationIdsRef.current.add(callId)
        scheduleCallNotification({
          call,
          conversation: matchedConversation || { _id: conversationId, conversationId },
        }).catch((error) => {
          console.warn('Cannot show call notification:', error?.message || error)
        })
      }

      if (!incomingCallDialogIdsRef.current.has(callId)) {
        incomingCallDialogIdsRef.current.add(callId)
        const callType = String(call?.callType || '').toLowerCase() === 'video' ? 'video' : 'thoại'
        showAppDialog({
          title: 'Cuộc gọi đến',
          message: `Bạn có cuộc gọi ${callType} đến.`,
          actions: [
            {
              text: 'Nghe máy',
              style: 'default',
              onPress: () => {
                setMobileCallState((prev) => ({
                  ...prev,
                  visible: true,
                  call,
                  phase: 'incoming',
                  error: '',
                }))
                acceptMobileCall(call).catch((error) => {
                  console.warn('Cannot accept call:', error?.message || error)
                })
              },
            },
            {
              text: 'Từ chối',
              style: 'destructive',
              onPress: () => {
                declineMobileCall(call).catch((error) => {
                  console.warn('Cannot decline call:', error?.message || error)
                })
              },
            },
          ],
        })
      }
    }

    const clearIncomingCallHandler = (payload) => {
      const call = payload?.call || payload
      const callId = normalizeId(call?.callId)
      if (!callId) return
      incomingCallNotificationIdsRef.current.delete(callId)
      incomingCallDialogIdsRef.current.delete(callId)
    }

    const ringingCallHandler = (payload) => {
      const call = payload?.call || payload
      const callId = normalizeId(call?.callId)
      if (!callId) return
      const currentCallId = normalizeId(mobileCallStateRef.current?.call?.callId)
      if (currentCallId && currentCallId !== callId) return

      setMobileCallState((prev) => ({
        ...prev,
        visible: true,
        call: {
          ...(prev.call || {}),
          ...call,
        },
        phase: prev.phase === 'starting' ? 'ringing' : prev.phase,
        error: '',
      }))
    }

    const acceptedCallHandler = (payload) => {
      const call = payload?.call || payload
      const callId = normalizeId(call?.callId)
      if (!callId) return

      incomingCallNotificationIdsRef.current.delete(callId)
      incomingCallDialogIdsRef.current.delete(callId)

      const currentCallId = normalizeId(mobileCallStateRef.current?.call?.callId)
      const phase = mobileCallStateRef.current?.phase
      if (currentCallId !== callId || phase !== 'ringing') return

      const pendingJoinInfo = pendingMobileJoinInfoRef.current
      if (normalizeId(pendingJoinInfo?.call?.callId) === callId) {
        joinMobileCall({
          ...pendingJoinInfo,
          call: {
            ...pendingJoinInfo.call,
            ...call,
          },
        })
        return
      }

      callApi.getAttendee(callId)
        .then((response) => joinMobileCall(response?.data))
        .catch((error) => {
          setMobileCallState((prev) => ({
            ...prev,
            visible: true,
            call,
            error: getRequestErrorMessage(error, 'Không thể join cuộc gọi'),
          }))
        })
    }

    const terminalCallHandler = (payload) => {
      clearIncomingCallHandler(payload)
      const call = payload?.call || payload
      const callId = normalizeId(call?.callId)
      const currentCallId = normalizeId(mobileCallStateRef.current?.call?.callId)
      if (callId && currentCallId === callId) {
        resetMobileCall().catch(() => {})
      }
    }

    const participantCallHandler = (payload) => {
      const call = payload?.call || payload
      const callId = normalizeId(call?.callId)
      const currentCallId = normalizeId(mobileCallStateRef.current?.call?.callId)
      if (!callId || currentCallId !== callId) return
      setMobileCallState((prev) => ({
        ...prev,
        call: {
          ...(prev.call || {}),
          ...call,
        },
      }))
    }

    const participantRoleUpdatedHandler = async (payload) => {
      const conversationId = normalizeId(payload?.conversationId)
      const targetUserId = normalizeId(payload?.targetUserId)
      const newRole = String(payload?.newRole || '').toLowerCase()

      if (!conversationId || !targetUserId || !newRole) return

      upsertConversation(conversationId, {
        participants: (prevParticipants => {
          if (!Array.isArray(prevParticipants)) return prevParticipants
          return prevParticipants.map((participant) => {
            const participantId = normalizeId(participant?._id || participant?.userId || participant)
            if (participantId !== targetUserId) return participant

            if (typeof participant === 'object' && participant) {
              return {
                ...participant,
                role: newRole,
              }
            }

            return {
              _id: targetUserId,
              userId: targetUserId,
              role: newRole,
            }
          })
        })(
          (
            conversationsRef.current.find(
              (item) => normalizeId(item?._id || item?.conversationId) === conversationId
            )?.participants
          ) || []
        ),
      })

      // System message is now emitted and persisted by backend as a real message.
      // Frontend/mobile will receive it via message stream and keep it after reload.
    }

    socket.on('message:received', incomingHandler)
    socket.on('message:edited', editedHandler)
    socket.on('message:deleted', deletedHandler)
    socket.on('message:emoji', emojiHandler)
    socket.on('message:hidden', hiddenHandler)
    socket.on('call:incoming', incomingCallHandler)
    socket.on('call:ringing', ringingCallHandler)
    socket.on('call:accepted', acceptedCallHandler)
    socket.on('call:participant_joined', participantCallHandler)
    socket.on('call:participant_left', participantCallHandler)
    socket.on('call:declined', terminalCallHandler)
    socket.on('call:ended', terminalCallHandler)
    socket.on('call:missed', terminalCallHandler)
    socket.on('participant:role_updated', participantRoleUpdatedHandler)
    loadConversations()

    return () => {
      socket.off('message:received', incomingHandler)
      socket.off('message:edited', editedHandler)
      socket.off('message:deleted', deletedHandler)
      socket.off('message:emoji', emojiHandler)
      socket.off('message:hidden', hiddenHandler)
      socket.off('call:incoming', incomingCallHandler)
      socket.off('call:ringing', ringingCallHandler)
      socket.off('call:accepted', acceptedCallHandler)
      socket.off('call:participant_joined', participantCallHandler)
      socket.off('call:participant_left', participantCallHandler)
      socket.off('call:declined', terminalCallHandler)
      socket.off('call:ended', terminalCallHandler)
      socket.off('call:missed', terminalCallHandler)
      socket.off('participant:role_updated', participantRoleUpdatedHandler)
      stopTypingStartListener()
      stopTypingStopListener()
    }
  }, [
    authenticated,
    accessToken,
    user,
    refreshToken,
    loadConversations,
    openConversation,
    acceptMobileCall,
    joinMobileCall,
    resetMobileCall,
    showAppDialog,
    upsertConversation,
  ])

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    storage.setConversationPreferences(conversationPreferences).catch(() => {})
  }, [conversationPreferences])

  const currentConversation = useMemo(() => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId) return null

    return (
      conversations.find(
        (item) => normalizeId(item?._id || item?.conversationId) === normalizeId(conversationId)
      ) || null
    )
  }, [conversations, messages])

  const visibleConversations = useMemo(() => {
    const list = Array.isArray(conversations) ? [...conversations] : []

    const filtered = list.filter((conversation) => {
      const id = normalizeId(conversation?._id || conversation?.conversationId)
      return !conversationPreferences?.[id]?.hidden
    })

    filtered.sort((a, b) => {
      const idA = normalizeId(a?._id || a?.conversationId)
      const idB = normalizeId(b?._id || b?.conversationId)
      const pinnedA = Boolean(conversationPreferences?.[idA]?.pinned)
      const pinnedB = Boolean(conversationPreferences?.[idB]?.pinned)

      if (pinnedA !== pinnedB) {
        return pinnedA ? -1 : 1
      }

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

    return filtered
  }, [conversations, conversationPreferences])

  const currentConversationPreference = useMemo(() => {
    const conversationId = normalizeId(
      currentConversation?._id || currentConversation?.conversationId || activeConversationIdRef.current
    )

    if (!conversationId) return createDefaultConversationPreference()

    return {
      ...createDefaultConversationPreference(),
      ...(conversationPreferences?.[conversationId] || {}),
    }
  }, [currentConversation, conversationPreferences])

  const refreshCurrentConversationData = useCallback(async () => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId) return

    try {
      await loadConversations()
      const matched = conversationsRef.current.find(
        (item) => normalizeId(item?._id || item?.conversationId) === normalizeId(conversationId)
      )
      await openConversation(matched || { _id: conversationId, conversationId })
    } catch (error) {
  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể làm mới dữ liệu cuộc trò chuyện'))
    }
  }, [loadConversations, openConversation, showNotice])

  const deleteCurrentConversation = useCallback(async () => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId) return

    const activeConversation = conversations.find(
      (item) => normalizeId(item?._id || item?.conversationId) === normalizeId(conversationId)
    )

    try {
      if (String(activeConversation?.type || '').toLowerCase() === 'group') {
        const currentUserId = normalizeId(user?._id || user?.userId)
        const creatorId = normalizeId(activeConversation?.creatorId || activeConversation?.admin)

        if (creatorId && creatorId === currentUserId) {
          await conversationApi.dissolveConversation(conversationId)
        } else {
          await conversationApi.leaveConversation(conversationId)
        }
      } else {
        await conversationApi.deleteConversation(conversationId)
      }

      await closeConversation()
      await loadConversations()
    } catch (error) {
  showNotice('Lỗi', getRequestErrorMessage(error, 'Không thể xóa/rời cuộc trò chuyện'))
    }
  }, [closeConversation, conversations, loadConversations, user])

  const typingUserIdsForCurrentConversation = useMemo(() => {
    const conversationId = activeConversationIdRef.current
    if (!conversationId) return []
    return typingByConversation?.[conversationId] || []
  }, [typingByConversation, currentConversation])

  const typingUsersForCurrentConversation = useMemo(() => {
    const typingIds = typingUserIdsForCurrentConversation
    if (!typingIds.length || !currentConversation) return []

    const participants = Array.isArray(currentConversation?.participants)
      ? currentConversation.participants
      : []

    const currentUserId = normalizeId(user?._id || user?.userId)

    const typingUsers = typingIds
      .filter((typingUserId) => normalizeId(typingUserId) !== currentUserId)
      .map((typingUserId) => {
        const matchedParticipant = participants.find(
          (participant) => getParticipantId(participant) === normalizeId(typingUserId)
        )

        const participantData = matchedParticipant || typingUserId
        return {
          id: normalizeId(typingUserId),
          name: getParticipantName(participantData),
          avatar: getParticipantAvatar(matchedParticipant),
        }
      })
      .filter((typingUser) => Boolean(typingUser?.id))

    return typingUsers
  }, [typingUserIdsForCurrentConversation, currentConversation, user])

  if (booting) {
    return null
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ChatProvider>
          <UiProvider>
            <SocketProvider>
              <DialogProvider>
                <NavigationContainer ref={navigationRef}>
            <StatusBar barStyle="dark-content" />
      <Stack.Navigator
        initialRouteName={authenticated ? 'Conversations' : 'Login'}
        screenOptions={{
          headerTitleAlign: 'center',
          animation: 'slide_from_right',
        }}
      >
        {!authenticated ? (
          <>
            <Stack.Screen name="Login" options={{ headerShown: false }}>
              {({ navigation }) => (
                <AuthScreen
                  onLogin={async (email, password) => {
                    const success = await handleLogin(email, password)
                    if (success) {
                      navigation.reset({ index: 0, routes: [{ name: 'Conversations' }] })
                    }
                  }}
                  onSwitchToRegister={() => navigation.navigate('Register')}
                  onSwitchToForgot={() => navigation.navigate('ForgotPassword')}
                  loading={authLoading}
                  error={authError}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="ForgotPassword" options={{ headerShown: false }}>
              {({ navigation }) => (
                <ForgotPasswordScreen
                  loading={authLoading}
                  error={authError}
                  onRequestReset={requestForgotPassword}
                  onVerifyToken={verifyForgotToken}
                  onResetPassword={resetForgotPassword}
                  onSwitchToLogin={() => navigation.goBack()}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Register" options={{ headerShown: false }}>
              {({ navigation }) => (
                <RegisterScreen
                  loading={authLoading}
                  error={authError}
                  onSubmit={async (payload) => {
                    const result = await handleRegister(payload)
                    if (result.ok) {
                      navigation.navigate('VerifyOTP')
                    }
                  }}
                  onSwitchToLogin={() => navigation.goBack()}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="VerifyOTP" options={{ title: 'Xác thực OTP' }}>
              {({ navigation }) => (
                <VerifyOtpScreen
                  email={pendingVerificationEmail}
                  loading={authLoading}
                  error={authError}
                  onVerify={async (otp) => {
                    const success = await verifyOtp(otp)
                    if (success) {
                      navigation.reset({ index: 0, routes: [{ name: 'Conversations' }] })
                    }
                  }}
                  onResend={resendOtp}
                  onBackToLogin={() => {
                    setPendingVerificationEmail('')
                    navigation.popToTop()
                  }}
                />
              )}
            </Stack.Screen>
          </>
        ) : (
          <>
            <Stack.Screen name="Conversations" options={{ headerShown: false }}>
              {({ navigation }) => (
                <ConversationListScreen
                  user={user}
                  conversations={visibleConversations}
                  unreadByConversation={unreadByConversation}
                  loading={loadingConversations}
                  onOpenProfile={() => navigation.navigate('Profile')}
                  onOpenFriends={() => navigation.navigate('FriendHub')}
                  onOpenDiscover={() => navigation.navigate('Discover')}
                  onOpenDiary={() => navigation.navigate('Diary')}
                  onOpenUrban={() => navigation.navigate('UrbanIncidents')}
                  onOpenCalls={() => navigation.navigate('Calls')}
                  onOpenAssistant={() => navigation.navigate('Assistant')}
                  onOpenCreateGroup={() => navigation.navigate('CreateGroup')}
                  onStartConversation={async (targetUserId) => {
                    const opened = await startConversationWithUser(targetUserId)
                    if (opened) {
                      navigation.navigate('Chat')
                    }
                  }}
                  onOpenConversation={async (conversation) => {
                    const opened = await openConversation(conversation)
                    if (opened) {
                      navigation.navigate('Chat')
                    }
                  }}
                  onRefresh={loadConversations}
                  onLogout={async () => {
                    await handleLogout()
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Calls" options={{ headerShown: false }}>
              {({ navigation }) => (
                <CallsScreen
                  onOpenChats={() => navigation.navigate('Conversations')}
                  onOpenUrban={() => navigation.navigate('UrbanIncidents')}
                  onOpenAssistant={() => navigation.navigate('Assistant')}
                  onOpenProfile={() => navigation.navigate('Profile')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Assistant" options={{ headerShown: false }}>
              {({ navigation }) => (
                <AssistantScreen
                  onOpenChats={() => navigation.navigate('Conversations')}
                  onOpenCalls={() => navigation.navigate('Calls')}
                  onOpenUrban={() => navigation.navigate('UrbanIncidents')}
                  onOpenProfile={() => navigation.navigate('Profile')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="FriendHub" options={{ headerShown: false }}>
              {({ navigation }) => (
                <FriendHubScreen
                  currentUserId={user?._id || user?.userId}
                  onBack={() => navigation.goBack()}
                  onOpenConversations={() => navigation.navigate('Conversations')}
                  onOpenProfile={() => navigation.navigate('Profile')}
                  onOpenDiscover={() => navigation.navigate('Discover')}
                  onOpenDiary={() => navigation.navigate('Diary')}
                  onOpenCreateGroup={() => navigation.navigate('CreateGroup')}
                  onStartConversation={async (targetUserId) => {
                    const opened = await startConversationWithUser(targetUserId)
                    if (opened) {
                      navigation.navigate('Chat')
                    }
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Discover" options={{ headerShown: false }}>
              {({ navigation }) => (
                <DiscoverScreen
                  currentUserId={user?._id || user?.userId}
                  onBack={() => navigation.goBack()}
                  onOpenConversations={() => navigation.navigate('Conversations')}
                  onOpenProfile={() => navigation.navigate('Profile')}
                  onOpenFriends={() => navigation.navigate('FriendHub')}
                  onStartConversation={async (targetUserId) => {
                    const opened = await startConversationWithUser(targetUserId)
                    if (opened) {
                      navigation.navigate('Chat')
                    }
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Diary" options={{ headerShown: false }}>
              {({ navigation }) => (
                <DiaryScreen
                  onBack={() => navigation.goBack()}
                  onOpenConversations={() => navigation.navigate('Conversations')}
                  onOpenProfile={() => navigation.navigate('Profile')}
                  onOpenFriends={() => navigation.navigate('FriendHub')}
                  onOpenDiscover={() => navigation.navigate('Discover')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="UrbanIncidents" options={{ headerShown: false }}>
              {({ navigation }) => (
                <UrbanIncidentScreen
                  onBack={() => navigation.goBack()}
                  onOpenChats={() => navigation.navigate('Conversations')}
                  onOpenCalls={() => navigation.navigate('Calls')}
                  onOpenAssistant={() => navigation.navigate('Assistant')}
                  onOpenProfile={() => navigation.navigate('Profile')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="CreateGroup" options={{ title: 'Tạo nhóm' }}>
              {({ navigation }) => (
                <CreateGroupScreen
                  currentUserId={user?._id || user?.userId}
                  onBack={() => navigation.goBack()}
                  onShowDialog={showAppDialog}
                  onCreateGroup={async (participantIds, groupName) => {
                    const result = await createGroupConversation(participantIds, groupName)
                    if (result?.opened) {
                      navigation.replace('Chat')
                    }

                    return result
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Profile" options={{ headerShown: false }}>
              {({ navigation }) => (
                <ProfileScreen
                  user={user}
                  loading={authLoading}
                  error={authError}
                  onBack={() => navigation.goBack()}
                  onUpdateAvatar={updateAvatar}
                  onUpdateProfile={updateProfile}
                  onChangePassword={updatePassword}
                  onOpenConversations={() => navigation.navigate('Conversations')}
                  onOpenFriends={() => navigation.navigate('FriendHub')}
                  onOpenDiscover={() => navigation.navigate('Discover')}
                  onOpenDiary={() => navigation.navigate('Diary')}
                  onLogout={async () => {
                    await handleLogout()
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="Chat"
              options={{
                headerShown: false,
              }}
            >
              {({ navigation }) => (
                <ChatScreen
                  conversation={currentConversation}
                  conversations={visibleConversations}
                  messages={messages}
                  loadingOlderMessages={loadingOlderMessages}
                  hasMoreOlderMessages={hasMoreMessages}
                  onLoadOlderMessages={loadOlderMessages}
                  scrollRequestKey={chatScrollRequestKey}
                  currentUserId={user?._id || user?.userId}
                  loading={loadingMessages}
                  onBack={async () => {
                    await closeConversation()
                    navigation.goBack()
                  }}
                  onRenameGroup={renameCurrentGroup}
                  onUpdateGroupAvatar={updateCurrentGroupAvatar}
                  onAddGroupMember={addMemberToCurrentGroup}
                  onRemoveGroupMember={removeMemberFromCurrentGroup}
                  onUpdateParticipantRole={updateCurrentParticipantRole}
                  onSearchUsers={searchUsersForGroupMember}
                  onUpdateGroupSettings={updateCurrentGroupSettings}
                  onShowDialog={showAppDialog}
                  onSend={sendTextMessage}
                  onPickImage={pickImageAndSend}
                  onPickFile={pickFileAndSend}
                  onEditMessage={editCurrentMessage}
                  onDeleteMessage={deleteCurrentMessage}
                  onDeleteMessageForAll={deleteMessageForAll}
                  onReactMessage={toggleMessageReaction}
                  onForwardMessage={forwardMessageToConversations}
                  onTypingStart={handleStartTyping}
                  onTypingStop={handleStopTyping}
                  typingUsers={typingUsersForCurrentConversation}
                  preference={currentConversationPreference}
                  onUpdateConversationPreference={(patch) =>
                    updateConversationPreference(activeConversationIdRef.current, patch)
                  }
                  onDeleteConversation={deleteCurrentConversation}
                  onRefreshConversationData={refreshCurrentConversationData}
                  onStartCall={startMobileCall}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
      <MobileCallOverlay
        visible={mobileCallState.visible}
        call={mobileCallState.call}
        phase={mobileCallState.phase}
        error={mobileCallState.error}
        isMuted={mobileCallState.isMuted}
        isCameraEnabled={mobileCallState.isCameraEnabled}
        videoTiles={mobileCallState.videoTiles}
        activeSpeakerId={mobileCallState.activeSpeakerId}
        audioRoute={mobileCallState.audioRoute}
        availableAudioRoutes={mobileCallState.availableAudioRoutes}
        onAccept={() => acceptMobileCall()}
        onDecline={() => declineMobileCall()}
        onEnd={endMobileCall}
        onToggleMute={toggleMobileMute}
        onToggleCamera={toggleMobileCamera}
        onSwitchCamera={switchMobileCamera}
        onSelectAudioRoute={selectMobileAudioRoute}
      />
      <ExpoStatusBar style="dark" />
    </NavigationContainer>
              </DialogProvider>
            </SocketProvider>
          </UiProvider>
        </ChatProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
