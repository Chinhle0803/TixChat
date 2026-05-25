import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal as RNModal,
  ScrollView,
  Dimensions,
  Switch,
  Linking,
  InteractionManager,
  ActivityIndicator,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { DEFAULT_EMOJI_REACTIONS, EXPRESSION_CATEGORIES } from '../features/expressions/expressionCatalog'

const AUTO_DELETE_OPTIONS = [
  { value: 'never', label: 'Không bao giờ' },
  { value: '1d', label: 'Sau 24 giờ' },
  { value: '7d', label: 'Sau 7 ngày' },
  { value: '30d', label: 'Sau 30 ngày' },
]

const CHAT_BACKGROUND_OPTIONS = [
  { value: 'default', label: 'Mặc định', preview: ['#ffffff', '#06b6d4', '#f3f4f6'] },
  { value: 'snow', label: 'Trắng sáng', preview: ['#f8fafc', '#111827', '#e5e7eb'] },
  { value: 'mint', label: 'Mint', preview: ['#ecfeff', '#0f766e', '#cffafe'] },
  { value: 'sunset', label: 'Sunset', preview: ['#fff7ed', '#9a3412', '#fed7aa'] },
  { value: 'lavender', label: 'Lavender', preview: ['#f5f3ff', '#5b21b6', '#ddd6fe'] },
  { value: 'dark', label: 'Tối', preview: ['#0f172a', '#38bdf8', '#1e293b'] },
]

const CHAT_THEME_PRESETS = {
  default: {
    chatBackground: '#eef0f4',
    ownBubbleBackground: '#1061e8',
    ownBubbleText: '#ffffff',
    otherBubbleBackground: '#ffffff',
    otherBubbleText: '#1f2937',
  },
  snow: {
    chatBackground: '#f8fafc',
    ownBubbleBackground: '#111827',
    ownBubbleText: '#ffffff',
    otherBubbleBackground: '#e5e7eb',
    otherBubbleText: '#111827',
  },
  mint: {
    chatBackground: '#ecfeff',
    ownBubbleBackground: '#0f766e',
    ownBubbleText: '#ffffff',
    otherBubbleBackground: '#cffafe',
    otherBubbleText: '#134e4a',
  },
  sunset: {
    chatBackground: '#fff7ed',
    ownBubbleBackground: '#9a3412',
    ownBubbleText: '#ffffff',
    otherBubbleBackground: '#fed7aa',
    otherBubbleText: '#7c2d12',
  },
  lavender: {
    chatBackground: '#f5f3ff',
    ownBubbleBackground: '#5b21b6',
    ownBubbleText: '#ffffff',
    otherBubbleBackground: '#ddd6fe',
    otherBubbleText: '#4c1d95',
  },
  dark: {
    chatBackground: '#0f172a',
    ownBubbleBackground: '#38bdf8',
    ownBubbleText: '#082f49',
    otherBubbleBackground: '#1e293b',
    otherBubbleText: '#e2e8f0',
  },
}

const DEFAULT_GROUP_SETTINGS = {
  allowMemberEditGroupInfo: false,
  requiresAdminApproval: false,
  adminOnlyMessaging: false,
  newMemberHistoryVisibility: true,
}

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') return String(value._id || value.userId || value.id || '')
  return String(value)
}

const formatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatCallDuration = (totalSeconds = 0) => {
  const numericSeconds = Number(totalSeconds)
  const safeSeconds = Number.isFinite(numericSeconds) ? Math.max(0, Math.floor(numericSeconds)) : 0
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const extractLinksFromText = (text) => {
  if (!text || typeof text !== 'string') return []
  const matches = text.match(/https?:\/\/[^\s]+/g)
  return matches || []
}

const resolveAttachmentType = (attachment = {}) => {
  const rawType = String(attachment?.type || '').toLowerCase()
  if (rawType === 'image' || rawType === 'video') return 'media'
  if (rawType === 'file') return 'file'

  const mimeType = String(attachment?.mimeType || '').toLowerCase()
  if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) return 'media'
  return 'file'
}

const getDisplayName = (participant) => {
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

const isEmojiOnlyContent = (value = '') => {
  const normalized = String(value || '').trim().replace(/[\s\u200D\uFE0F]/g, '')
  return Boolean(normalized) && /^(?:\p{Extended_Pictographic})+$/u.test(normalized)
}

export default function ChatScreen({
  conversation,
  conversations = [],
  messages,
  loadingOlderMessages = false,
  hasMoreOlderMessages = false,
  onLoadOlderMessages,
  scrollRequestKey = 0,
  currentUserId,
  loading,
  onBack,
  onRenameGroup,
  onUpdateGroupAvatar,
  onAddGroupMember,
  onRemoveGroupMember,
  onUpdateParticipantRole,
  onSearchUsers,
  onUpdateGroupSettings,
  onSend,
  onPickImage,
  onPickFile,
  onEditMessage,
  onDeleteMessage,
  onDeleteMessageForAll,
  onReactMessage,
  onForwardMessage,
  onTypingStart,
  onTypingStop,
  typingUsers = [],
  preference,
  onUpdateConversationPreference,
  onDeleteConversation,
  onRefreshConversationData,
  onShowDialog,
  onStartCall,
  onJoinCall,
}) {
  const insets = useSafeAreaInsets()
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')
  const basePreviewWidth = Math.min(screenWidth - 24, 420)
  const basePreviewHeight = Math.max(260, Math.min(screenHeight * 0.75, 700))

  const [text, setText] = useState('')
  const [previewImageUri, setPreviewImageUri] = useState('')
  const [previewZoom, setPreviewZoom] = useState(1)
  const [selectedTypingUser, setSelectedTypingUser] = useState(null)
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [nextGroupName, setNextGroupName] = useState('')
  const [replyingToMessage, setReplyingToMessage] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [actionMessage, setActionMessage] = useState(null)
  const [actionModalVisible, setActionModalVisible] = useState(false)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [deleteMode, setDeleteMode] = useState('self') // 'self' | 'all'
  const [expressionPickerVisible, setExpressionPickerVisible] = useState(false)
  const [forwardModalVisible, setForwardModalVisible] = useState(false)
  const [forwardSearchText, setForwardSearchText] = useState('')
  const [forwardSelectedIds, setForwardSelectedIds] = useState([])
  const [forwarding, setForwarding] = useState(false)
  const [infoModalVisible, setInfoModalVisible] = useState(false)
  const [expandedInfoSections, setExpandedInfoSections] = useState({
    media: true,
    file: true,
    link: true,
    privacy: true,
  })
  const [autoDeleteOption, setAutoDeleteOption] = useState(preference?.autoDelete || 'never')
  const [showAutoDeleteOptions, setShowAutoDeleteOptions] = useState(false)
  const [hideConversation, setHideConversation] = useState(Boolean(preference?.hidden))
  const [chatTheme, setChatTheme] = useState(preference?.chatTheme || 'default')
  const [groupManageVisible, setGroupManageVisible] = useState(false)
  const [memberModalVisible, setMemberModalVisible] = useState(false)
  const [memberSearchText, setMemberSearchText] = useState('')
  const [memberSearchResults, setMemberSearchResults] = useState([])
  const [memberSearchLoading, setMemberSearchLoading] = useState(false)
  const [memberAddingId, setMemberAddingId] = useState('')
  const [selectedMemberForRoleAction, setSelectedMemberForRoleAction] = useState(null)
  const [groupSettings, setGroupSettings] = useState({
    ...DEFAULT_GROUP_SETTINGS,
    ...(conversation?.groupSettings || {}),
  })
  const messageListRef = useRef(null)
  const pendingInitialScrollRef = useRef(false)
  const requestingOlderMessagesRef = useRef(false)
  const conversationId = normalizeId(conversation?._id || conversation?.conversationId)

  const scrollToLatest = React.useCallback((animated = false) => {
    if (!messageListRef.current) return

    try {
      messageListRef.current.scrollToEnd?.({ animated })
    } catch (_) {}

    if (messages?.length) {
      try {
        messageListRef.current.scrollToIndex?.({
          index: Math.max(messages.length - 1, 0),
          animated,
          viewPosition: 1,
        })
      } catch (_) {}
    }
  }, [messages?.length])

  const messageMap = useMemo(() => {
    const map = {}
    ;(messages || []).forEach((message) => {
      const messageId = normalizeId(message?._id || message?.messageId)
      if (!messageId) return
      map[messageId] = message
    })
    return map
  }, [messages])

  useEffect(() => {
    setAutoDeleteOption(preference?.autoDelete || 'never')
    setHideConversation(Boolean(preference?.hidden))
    setChatTheme(preference?.chatTheme || 'default')
  }, [preference])

  useEffect(() => {
    setGroupSettings({
      ...DEFAULT_GROUP_SETTINGS,
      ...(conversation?.groupSettings || {}),
    })
  }, [conversation?.groupSettings, conversation?._id, conversation?.conversationId])

  useEffect(() => {
    pendingInitialScrollRef.current = true
  }, [conversationId, scrollRequestKey])

  useEffect(() => {
    if (!conversationId || !pendingInitialScrollRef.current || !messages?.length) return undefined

    const firstTimer = setTimeout(scrollToLatest, 50)
    const secondTimer = setTimeout(scrollToLatest, 140)
    const finalTimer = setTimeout(() => {
      scrollToLatest()
      pendingInitialScrollRef.current = false
    }, 280)

    return () => {
      clearTimeout(firstTimer)
      clearTimeout(secondTimer)
      clearTimeout(finalTimer)
    }
  }, [conversationId, messages?.length, scrollRequestKey])

  useFocusEffect(
    React.useCallback(() => {
      if (!conversationId) return undefined

      pendingInitialScrollRef.current = true
      let cancelled = false
      const interactionTask = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return

        scrollToLatest(false)
        const firstTimer = setTimeout(() => {
          if (cancelled) return
          scrollToLatest(false)
        }, 80)
        const secondTimer = setTimeout(() => {
          if (cancelled) return
          scrollToLatest(false)
          pendingInitialScrollRef.current = false
        }, 220)

        interactionTask.__chatTimers = [firstTimer, secondTimer]
      })

      return () => {
        cancelled = true
        const timers = interactionTask?.__chatTimers || []
        timers.forEach((timer) => clearTimeout(timer))
        interactionTask?.cancel?.()
      }
    }, [conversationId, scrollRequestKey, scrollToLatest])
  )

  const getConversationTitle = (item) => {
    if (!item) return 'Cuộc trò chuyện'
    if (String(item?.type || '').toLowerCase() === 'group') {
      return item?.name || 'Nhóm chat'
    }

    const currentId = normalizeId(currentUserId)
    const participants = Array.isArray(item?.participants) ? item.participants : []
    const other = participants.find(
      (participant) => normalizeId(participant?._id || participant?.userId || participant) !== currentId
    ) || participants[0]

    return getDisplayName(other) || item?.name || 'Người dùng'
  }

  const availableForwardConversations = useMemo(() => {
    const currentConversationId = normalizeId(conversation?._id || conversation?.conversationId)
    const keyword = String(forwardSearchText || '').trim().toLowerCase()

    return (conversations || [])
      .filter((item) => normalizeId(item?._id || item?.conversationId) !== currentConversationId)
      .filter((item) => {
        if (!keyword) return true
        return getConversationTitle(item).toLowerCase().includes(keyword)
      })
  }, [conversation, conversations, forwardSearchText])

  const resetComposeModes = () => {
    setReplyingToMessage(null)
    setEditingMessage(null)
  }

  const title = useMemo(() => {
    const conversationType = String(conversation?.type || '').toLowerCase()

    if (conversationType === 'group') {
      return conversation?.name || 'Nhóm chat'
    }

    const participants = Array.isArray(conversation?.participants) ? conversation.participants : []
    const otherParticipant = participants.find(
      (participant) => normalizeId(participant?._id || participant?.userId || participant) !== normalizeId(currentUserId)
    )

    const otherName = getDisplayName(otherParticipant)
    if (otherName) return otherName

    if (conversation?.name) return conversation.name
    return 'Người dùng'
  }, [conversation, currentUserId])

  const isGroupConversation = String(conversation?.type || '').toLowerCase() === 'group'
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : []
  const normalizedCurrentUserId = normalizeId(currentUserId)
  const currentParticipant = participants.find(
    (participant) => normalizeId(participant?._id || participant?.userId || participant) === normalizedCurrentUserId
  )
  const participantRole = String(
    currentParticipant?.role ||
    (normalizeId(conversation?.creatorId) === normalizedCurrentUserId ? 'admin' : 'member')
  ).toLowerCase()
  const isGroupManager = ['admin', 'moderator'].includes(participantRole)
  const canManageMemberRoles = isGroupManager
  const counterpart = participants.find(
    (participant) => normalizeId(participant?._id || participant?.userId || participant) !== normalizedCurrentUserId
  )
  const currentUserAvatar = String(
    currentParticipant?.avatar ||
    currentParticipant?.photoURL ||
    currentParticipant?.profilePicture ||
    currentParticipant?.profileImage ||
    ''
  )
  const counterpartAvatar = String(
    counterpart?.avatar || counterpart?.photoURL || counterpart?.profilePicture || conversation?.avatar || ''
  )

  const showNotice = (title, message) => {
    onShowDialog?.({ title, message })
  }

  const showConfirm = (title, message, onConfirm) => {
    onShowDialog?.({
      title,
      message,
      actions: [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xác nhận', style: 'destructive', onPress: onConfirm },
      ],
    })
  }

  const groupedMembers = useMemo(() => {
    if (!isGroupConversation) return []

    return participants
      .map((participant) => {
        const userId = normalizeId(participant?._id || participant?.userId || participant)
        if (!userId) return null

        const role = String(
          participant?.role ||
          (normalizeId(conversation?.creatorId || conversation?.admin) === userId ? 'admin' : 'member')
        ).toLowerCase()

        return {
          userId,
          role,
          isMe: userId === normalizedCurrentUserId,
          displayName: getDisplayName(participant),
          username: String(participant?.username || '').trim(),
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const rank = { admin: 0, moderator: 1, member: 2 }
        const rankDiff = (rank[a.role] ?? 9) - (rank[b.role] ?? 9)
        if (rankDiff !== 0) return rankDiff
        return a.displayName.localeCompare(b.displayName, 'vi')
      })
  }, [isGroupConversation, participants, conversation?.creatorId, conversation?.admin, normalizedCurrentUserId])

  const typingLabel = typingUsers.length > 0
    ? `${typingUsers.map((item) => item?.name).filter(Boolean).join(', ')} đang nhập...`
    : 'Vừa mới truy cập'
  const memberCount = participants.length
  const existingParticipantIds = useMemo(
    () => new Set(participants.map((participant) => normalizeId(participant?._id || participant?.userId || participant)).filter(Boolean)),
    [participants]
  )

  const groupRoleMeta = useMemo(() => {
    if (participantRole === 'admin') {
      return {
        label: 'Quản trị viên (key vàng)',
        icon: 'key-variant',
        color: '#ca8a04',
      }
    }

    if (participantRole === 'moderator') {
      return {
        label: 'Phó nhóm (key bạc)',
        icon: 'key-variant',
        color: '#94a3b8',
      }
    }

    return {
      label: 'Thành viên',
      icon: 'account-outline',
      color: '#94a3b8',
    }
  }, [participantRole])

  const sharedStorage = useMemo(() => {
    const media = []
    const files = []
    const links = []

    ;(messages || []).forEach((message) => {
      const attachments = Array.isArray(message?.attachments) ? message.attachments : []
      attachments.forEach((attachment, index) => {
        const item = {
          id: `${normalizeId(message?._id || message?.messageId) || 'msg'}-${index}`,
          name: attachment?.name || attachment?.fileName || 'Tệp đính kèm',
          url: attachment?.url || attachment?.uri || '',
          createdAt: message?.createdAt || message?.updatedAt,
        }

        if (resolveAttachmentType(attachment) === 'media') {
          media.push(item)
        } else {
          files.push(item)
        }
      })

      extractLinksFromText(message?.content || '').forEach((url, index) => {
        links.push({
          id: `${normalizeId(message?._id || message?.messageId) || 'msg'}-link-${index}`,
          url,
          createdAt: message?.createdAt || message?.updatedAt,
        })
      })
    })

    return { media, files, links }
  }, [messages])

  const selectedAutoDeleteLabel =
    AUTO_DELETE_OPTIONS.find((option) => option.value === autoDeleteOption)?.label || 'Không bao giờ'

  const chatThemeStyle = useMemo(
    () => CHAT_THEME_PRESETS[chatTheme] || CHAT_THEME_PRESETS.default,
    [chatTheme]
  )

  const toggleInfoSection = (key) => {
    setExpandedInfoSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const openChildModalFromInfo = (openModal) => {
    setInfoModalVisible(false)
    if (typeof openModal === 'function') {
      setTimeout(() => {
        openModal()
      }, 80)
    }
  }

  const showNoticeFromInfo = (title, message) => {
    openChildModalFromInfo(() => showNotice(title, message))
  }

  const showConfirmFromInfo = (title, message, onConfirm) => {
    openChildModalFromInfo(() => showConfirm(title, message, onConfirm))
  }

  const handleLeaveOrDissolveGroup = () => {
    if (!isGroupConversation) return

    const canDissolveGroup = participantRole === 'admin'
    const message = canDissolveGroup
      ? 'Bạn có chắc muốn giải tán nhóm này? Hành động này không thể hoàn tác.'
      : 'Bạn có chắc muốn rời nhóm này?'

    showConfirmFromInfo('Xác nhận', message, () => {
      onDeleteConversation?.()
    })
  }

  const returnToChatAfterAction = () => {
    setSelectedMemberForRoleAction(null)
    setMemberModalVisible(false)
    setGroupManageVisible(false)
    setRenameModalVisible(false)
    setInfoModalVisible(false)
  }

  const openRenameGroupModal = () => {
    if (!isGroupConversation) return
    setNextGroupName(String(conversation?.name || title || ''))
    setRenameModalVisible(true)
  }

  const toggleGroupSetting = async (key, value) => {
    if (!isGroupConversation || !isGroupManager) {
      showNotice('Bị khóa', 'Chỉ quản trị viên hoặc phó nhóm mới có quyền chỉnh sửa')
      return
    }

    setGroupSettings((prev) => ({
      ...prev,
      [key]: value,
    }))

    const updated = await onUpdateGroupSettings?.({ [key]: value })
    if (updated === false) {
      setGroupSettings((prev) => ({
        ...prev,
        [key]: !value,
      }))
      return
    }

    returnToChatAfterAction()
  }

  const searchMemberCandidates = async () => {
    if (!isGroupConversation) return

    const keyword = String(memberSearchText || '').trim()
    if (!keyword) {
      setMemberSearchResults([])
      return
    }

    setMemberSearchLoading(true)
    try {
      const users = await onSearchUsers?.(keyword)
      const list = Array.isArray(users) ? users : []
      setMemberSearchResults(
        list.filter((item) => {
          const id = normalizeId(item?._id || item?.userId || item?.id)
          return id && !existingParticipantIds.has(id)
        })
      )
    } finally {
      setMemberSearchLoading(false)
    }
  }

  const addMemberToGroup = async (targetUserId) => {
    const normalizedTargetId = normalizeId(targetUserId)
    if (!normalizedTargetId || !isGroupConversation) return
    if (!isGroupManager) {
      showNotice('Bị khóa', 'Chỉ quản trị viên hoặc phó nhóm mới có quyền thêm thành viên')
      return
    }

    setMemberAddingId(normalizedTargetId)
    try {
      const added = await onAddGroupMember?.(normalizedTargetId)
      if (added === false) return

      setMemberSearchResults((prev) =>
        prev.filter((item) => normalizeId(item?._id || item?.userId || item?.id) !== normalizedTargetId)
      )
      returnToChatAfterAction()
    } finally {
      setMemberAddingId('')
    }
  }

  const openRoleActionForMember = (member) => {
    if (!member || !canManageMemberRoles) {
      showNotice('Bị khóa', 'Chỉ quản trị viên (key vàng) hoặc phó nhóm (key bạc) mới có quyền quản lý vai trò')
      return
    }

    if (member.isMe || member.role === 'admin') {
      showNotice('Không khả dụng', 'Không thể thay đổi vai trò của tài khoản này')
      return
    }

    setSelectedMemberForRoleAction(member)
  }

  const removeSelectedMemberFromGroup = () => {
    if (!selectedMemberForRoleAction) return
    if (typeof onRemoveGroupMember !== 'function') {
      showNotice('Không khả dụng', 'Ứng dụng hiện chưa cấu hình thao tác xóa thành viên')
      return
    }

    const target = selectedMemberForRoleAction
    showConfirm(
      'Xóa thành viên',
      `Bạn có chắc muốn xóa ${target.displayName} khỏi nhóm?`,
      async () => {
        const removed = await onRemoveGroupMember?.(target.userId)
        if (removed === false) return

        setSelectedMemberForRoleAction(null)
      }
    )
  }

  const updateSelectedMemberRole = async (nextRole) => {
    if (!selectedMemberForRoleAction) return

    const target = selectedMemberForRoleAction
    const success = await onUpdateParticipantRole?.(target.userId, nextRole, target.role)
    if (success === false) return

    setSelectedMemberForRoleAction(null)
  }

  const send = () => {
    const trimmed = text.trim()
    if (!trimmed) return

    if (editingMessage) {
      onEditMessage?.(editingMessage?._id || editingMessage?.messageId, trimmed)
      setEditingMessage(null)
      setText('')
      onTypingStop?.()
      return
    }

    onSend(
      trimmed,
      normalizeId(replyingToMessage?._id || replyingToMessage?.messageId) || null,
      isEmojiOnlyContent(trimmed) ? { type: 'emoji' } : {}
    )
    setReplyingToMessage(null)
    onTypingStop?.()
    setText('')
  }

  const appendExpression = (emoji) => {
    const selectedEmoji = String(emoji || '').trim()
    if (!selectedEmoji) return

    setText((prev) => `${prev || ''}${selectedEmoji}`)
    onTypingStart?.()
  }

  const openMessageActions = (message) => {
    if (!message) return
    setActionMessage(message)
    setActionModalVisible(true)
  }

  const requestOlderMessages = async () => {
    if (!hasMoreOlderMessages || loadingOlderMessages || requestingOlderMessagesRef.current) return
    requestingOlderMessagesRef.current = true
    try {
      await onLoadOlderMessages?.()
    } finally {
      setTimeout(() => {
        requestingOlderMessagesRef.current = false
      }, 250)
    }
  }

  const closeMessageActions = () => {
    setActionModalVisible(false)
    setActionMessage(null)
  }

  const beginEditMessage = () => {
    if (!actionMessage) return
    setEditingMessage(actionMessage)
    setReplyingToMessage(null)
    setText(String(actionMessage?.content || ''))
    closeMessageActions()
  }

  const beginReplyMessage = () => {
    if (!actionMessage) return
    setReplyingToMessage(actionMessage)
    if (editingMessage) {
      setEditingMessage(null)
      setText('')
    }
    closeMessageActions()
  }

  const confirmDeleteMessage = () => {
    const target = actionMessage
    if (!target) return

    setDeleteMode('self')
    setDeleteConfirmVisible(true)
    setActionModalVisible(false)
  }

  const executeDeleteMessage = async () => {
    const target = actionMessage
    if (!target) {
      setDeleteConfirmVisible(false)
      return
    }

    try {
      if (deleteMode === 'all') {
        await onDeleteMessageForAll?.(target?._id || target?.messageId)
      } else {
        await onDeleteMessage?.(target?._id || target?.messageId)
      }
    } finally {
      setDeleteConfirmVisible(false)
      setActionMessage(null)
      setDeleteMode('self')
    }
  }

  const reactToActionMessage = (emoji) => {
    if (!actionMessage || !emoji) return
    onReactMessage?.(actionMessage, emoji)
  }

  const openForwardModal = () => {
    setForwardSearchText('')
    setForwardSelectedIds([])
    setForwardModalVisible(true)
    setActionModalVisible(false)
  }

  const submitForward = async () => {
    if (!actionMessage || forwardSelectedIds.length === 0 || forwarding) return

    try {
      setForwarding(true)
      await onForwardMessage?.(actionMessage, forwardSelectedIds)
      setForwardModalVisible(false)
      setForwardSelectedIds([])
      setActionMessage(null)
    } finally {
      setForwarding(false)
    }
  }

  const toggleForwardTarget = (conversationId) => {
    setForwardSelectedIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    )
  }

  const openImagePreview = (uri) => {
    if (!uri) return
    setPreviewZoom(1)
    setPreviewImageUri(uri)
  }

  const openExternalMedia = async (rawUrl) => {
    const mediaUrl = String(rawUrl || '').trim()
    if (!mediaUrl) {
      showNotice('Thông báo', 'Không tìm thấy đường dẫn video để mở')
      return
    }

    let normalizedUrl = mediaUrl
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    try {
      const supported = await Linking.canOpenURL(normalizedUrl)
      if (!supported) {
        showNotice('Không thể mở', 'Thiết bị không hỗ trợ mở đường dẫn video này')
        return
      }
      await Linking.openURL(normalizedUrl)
    } catch (_error) {
      showNotice('Không thể mở', 'Đã xảy ra lỗi khi mở video')
    }
  }

  const closeImagePreview = () => {
    setPreviewImageUri('')
    setPreviewZoom(1)
  }

  const zoomIn = () => setPreviewZoom((prev) => Math.min(4, Number((prev + 0.5).toFixed(2))))
  const zoomOut = () => setPreviewZoom((prev) => Math.max(1, Number((prev - 0.5).toFixed(2))))
  const zoomReset = () => setPreviewZoom(1)

  const Modal = ({ children, ...props }) => (
    <RNModal
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle="overFullScreen"
      {...props}
    >
      {children}
    </RNModal>
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={[styles.container, { backgroundColor: chatThemeStyle.chatBackground }]}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <MaterialCommunityIcons name="arrow-left" style={styles.backIcon} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {typingLabel}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => onStartCall?.('audio')}
          >
            <MaterialCommunityIcons name="phone-outline" style={styles.headerIcon} />
          </Pressable>
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => onStartCall?.('video')}
          >
            <MaterialCommunityIcons name="video-outline" style={styles.headerIcon} />
          </Pressable>
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => showNotice('Thông báo', 'Bạn có thể tìm nội dung trong mục Thông tin hội thoại')}
          >
            <MaterialCommunityIcons name="magnify" style={styles.headerIcon} />
          </Pressable>
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => {
              setInfoModalVisible(true)
            }}
          >
            <MaterialCommunityIcons name="menu" style={styles.headerIcon} />
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={messageListRef}
        data={messages}
        keyExtractor={(item, index) => normalizeId(item?._id || item?.messageId) || `${index}`}
        style={styles.messageListView}
        contentContainerStyle={[
          styles.messageList,
          { paddingBottom: 12 },
        ]}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{loading ? 'Đang tải tin nhắn...' : 'Chưa có tin nhắn'}</Text>
        }
        ListHeaderComponent={
          hasMoreOlderMessages ? (
            <View style={styles.olderMessagesWrap}>
              {loadingOlderMessages ? (
                <View style={styles.olderMessagesLoading}>
                  <ActivityIndicator size="small" color="#1d4ed8" />
                  <Text style={styles.olderMessagesText}>Đang tải tin nhắn cũ hơn...</Text>
                </View>
              ) : (
                <Pressable style={styles.olderMessagesBtn} onPress={requestOlderMessages}>
                  <Text style={styles.olderMessagesBtnText}>Xem thêm tin nhắn cũ</Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
        onContentSizeChange={() => {
          if (pendingInitialScrollRef.current && messages?.length) {
            scrollToLatest(false)
          }
        }}
        onLayout={() => {
          if (pendingInitialScrollRef.current && messages?.length) {
            scrollToLatest(false)
          }
        }}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            messageListRef.current?.scrollToOffset?.({ offset: Number.MAX_SAFE_INTEGER, animated: false })
            const safeIndex = Math.max(0, Math.min(index, (messages?.length || 1) - 1))
            messageListRef.current?.scrollToIndex?.({ index: safeIndex, animated: false, viewPosition: 1 })
          }, 120)
        }}
        onScroll={(event) => {
          const offsetY = Number(event?.nativeEvent?.contentOffset?.y || 0)
          if (offsetY <= 32) {
            requestOlderMessages()
          }
        }}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          const senderId = normalizeId(item?.senderId)
          const isMe = senderId === normalizeId(currentUserId)
          const messageType = String(item?.type || '').toLowerCase()
          const messageMetadata = item?.metadata || {}
          const isCallMessage = messageMetadata?.kind === 'call'
          const isSystemMessage = messageType === 'system' || item?.isSystem === true
          const isActiveGroupCallNotice =
            messageMetadata?.kind === 'group_call_active' &&
            messageMetadata?.active !== false &&
            normalizeId(messageMetadata?.callId)
          const isEmojiMessage = messageType === 'emoji'
          const itemMessageId = normalizeId(item?._id || item?.messageId)
          const nextMessage = messages?.[index + 1]
          const nextIsSystemMessage = String(nextMessage?.type || '').toLowerCase() === 'system' || nextMessage?.isSystem === true
          const nextSenderId = normalizeId(nextMessage?.senderId)
          const attachments = Array.isArray(item?.attachments) ? item.attachments : []
          const replyToId = normalizeId(item?.replyTo)
          const repliedMessage = replyToId ? messageMap?.[replyToId] : null
          const firstAttachment = attachments[0]
          const attachmentMimeType = String(firstAttachment?.mimeType || '').toLowerCase()
          const isImageAttachment =
            attachmentMimeType.startsWith('image/') ||
            String(firstAttachment?.type || '').toLowerCase() === 'image'
          const hasAttachmentPreview = Boolean(isImageAttachment && firstAttachment?.url)
          const senderParticipant = participants.find(
            (participant) => normalizeId(participant?._id || participant?.userId || participant) === senderId
          )
          const senderDisplayName =
            getDisplayName(senderParticipant) ||
            String(item?.senderName || item?.senderDisplayName || '').trim() ||
            (senderId ? `user-${senderId.slice(0, 6)}` : 'Thành viên')
          const senderAvatar = String(
            senderParticipant?.avatar ||
            senderParticipant?.photoURL ||
            senderParticipant?.profilePicture ||
            senderParticipant?.profileImage ||
            item?.senderAvatar ||
            (isMe ? currentUserAvatar : '')
          )
          const showTailAvatar =
            !isSystemMessage &&
            Boolean(senderId) &&
            (!nextMessage || nextIsSystemMessage || nextSenderId !== senderId)
          const displayText =
            item?.content ||
            (firstAttachment?.name ? `[Tệp] ${firstAttachment.name}` : attachments.length > 0 ? '[Tệp đính kèm]' : '')
          const uploadProgress = Math.max(0, Math.min(100, Number(item?.uploadProgress || 0)))
          const isUploading = item?.status === 'sending' && uploadProgress < 100

          const reactionEntries = Object.entries(item?.reactions || {})
            .map(([emoji, users]) => ({
              emoji,
              count: Array.isArray(users) ? users.length : 0,
            }))
            .filter((entry) => entry.count > 0)

          if (isCallMessage) {
            const callType = String(messageMetadata?.callType || '').toLowerCase() === 'video' ? 'video' : 'thoại'
            const displayStatus = String(messageMetadata?.displayStatus || '').toLowerCase()
            const isMissedCall =
              displayStatus === 'missed' ||
              String(displayText || '').toLowerCase().includes('nhỡ')
            const callTitle = isMissedCall ? `Cuộc gọi ${callType} nhỡ` : `Cuộc gọi ${callType}`
            const callSubtitle = isMissedCall
              ? 'Không có ai bắt máy'
              : `Thời gian gọi: ${formatCallDuration(messageMetadata?.durationSeconds)}`
            const senderInitial = String(senderDisplayName || '?').slice(0, 1).toUpperCase()

            return (
              <View style={[styles.callMessageRow, isMe ? styles.callMessageRowMe : styles.callMessageRowOther]}>
                {!isMe ? (
                  <View style={[styles.messageAvatarSlot, styles.callMessageAvatarSlot]}>
                    {senderAvatar ? (
                      <Image source={{ uri: senderAvatar }} style={styles.messageAvatar} />
                    ) : (
                      <View style={styles.messageAvatarFallback}>
                        <Text style={styles.messageAvatarFallbackText}>{senderInitial}</Text>
                      </View>
                    )}
                  </View>
                ) : null}

                <View style={styles.callMessageColumnWrap}>
                  <View
                    style={[
                      styles.callMessageCard,
                      isMissedCall ? styles.callMessageCardMissed : styles.callMessageCardCompleted,
                    ]}
                  >
                    <View style={styles.callMessageContent}>
                      <View
                        style={[
                          styles.callMessageIconWrap,
                          isMissedCall ? styles.callMessageIconWrapMissed : styles.callMessageIconWrapCompleted,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={callType === 'video' ? 'video-outline' : 'phone-outline'}
                          style={[
                            styles.callMessageIcon,
                            isMissedCall ? styles.callMessageIconMissed : styles.callMessageIconCompleted,
                          ]}
                        />
                      </View>
                      <View style={styles.callMessageCopy}>
                        <Text style={styles.callMessageTitle} numberOfLines={1}>
                          {callTitle}
                        </Text>
                        <Text style={styles.callMessageSubtitle} numberOfLines={1}>
                          {callSubtitle}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.callMessageTime}>
                      {formatTime(item?.createdAt || item?.updatedAt)}
                    </Text>
                  </View>
                </View>

                {isMe ? (
                  <View style={[styles.messageAvatarSlot, styles.messageAvatarSlotMe, styles.callMessageAvatarSlot]}>
                    {senderAvatar ? (
                      <Image source={{ uri: senderAvatar }} style={styles.messageAvatar} />
                    ) : (
                      <View style={styles.messageAvatarFallback}>
                        <Text style={styles.messageAvatarFallbackText}>{senderInitial}</Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            )
          }

          if (isSystemMessage) {
            return (
              <View style={styles.systemMessageRow}>
                <View style={styles.systemMessageChip}>
                  {isActiveGroupCallNotice ? (
                    <Pressable
                      style={styles.systemCallJoinButton}
                      onPress={() => onJoinCall?.(messageMetadata.callId)}
                    >
                      <Text style={styles.systemCallJoinButtonText}>Tham gia cuộc gọi</Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.systemMessageText}>{displayText || '[Thông báo hệ thống]'}</Text>
                </View>
              </View>
            )
          }

          return (
            <Pressable
              style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}
              onLongPress={() => openMessageActions(item)}
            >
              {!isMe ? (
                <View style={styles.messageAvatarSlot}>
                  {showTailAvatar ? (
                    senderAvatar ? (
                      <Image source={{ uri: senderAvatar }} style={styles.messageAvatar} />
                    ) : (
                      <View style={styles.messageAvatarFallback}>
                        <Text style={styles.messageAvatarFallbackText}>
                          {String(senderDisplayName || '?').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )
                  ) : (
                    <View style={styles.messageAvatarSpacer} />
                  )}
                </View>
              ) : null}

              <View style={styles.messageColumnWrap}>
                {isGroupConversation && !isMe ? (
                  <Text style={styles.senderNameText} numberOfLines={1}>
                    {senderDisplayName}
                  </Text>
                ) : null}

                <View
                  style={[
                    styles.bubble,
                    isEmojiMessage && styles.emojiBubble,
                    isMe
                      ? [styles.bubbleMe, { backgroundColor: chatThemeStyle.ownBubbleBackground }]
                      : [styles.bubbleOther, { backgroundColor: chatThemeStyle.otherBubbleBackground }],
                    isEmojiMessage && (isMe ? styles.emojiBubbleMe : styles.emojiBubbleOther),
                  ]}
                >
                {repliedMessage ? (
                  <View style={[styles.replySnippet, isMe ? styles.replySnippetMe : styles.replySnippetOther]}>
                    <Text style={[styles.replySnippetLabel, isMe ? styles.replySnippetLabelMe : styles.replySnippetLabelOther]}>Trả lời</Text>
                    <Text numberOfLines={1} style={[styles.replySnippetText, isMe ? styles.replySnippetTextMe : styles.replySnippetTextOther]}>
                      {String(repliedMessage?.content || '[Tệp đính kèm]')}
                    </Text>
                  </View>
                ) : null}

                {hasAttachmentPreview ? (
                  <Pressable onPress={() => openImagePreview(firstAttachment.url)}>
                    <Image source={{ uri: firstAttachment.url }} style={styles.attachmentImage} resizeMode="cover" />
                  </Pressable>
                ) : null}

                <Text
                  style={[
                    styles.messageText,
                    isEmojiMessage && styles.emojiMessageText,
                    isMe
                      ? [styles.messageTextMe, { color: chatThemeStyle.ownBubbleText }]
                      : [styles.messageTextOther, { color: chatThemeStyle.otherBubbleText }],
                    isEmojiMessage && { color: isMe ? chatThemeStyle.ownBubbleBackground : chatThemeStyle.otherBubbleText },
                  ]}
                >
                  {displayText || '[Tin nhắn trống]'}
                </Text>

                {isUploading ? (
                  <View style={styles.progressWrap}>
                    <View style={[styles.progressTrack, isMe ? styles.progressTrackMe : styles.progressTrackOther]}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${uploadProgress}%` },
                          isMe ? styles.progressFillMe : styles.progressFillOther,
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressText, isMe ? styles.messageTextMe : styles.messageTextOther]}>
                      {uploadProgress}%
                    </Text>
                  </View>
                ) : null}

                <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextOther]}>
                  {formatTime(item?.createdAt || item?.updatedAt)}
                  {item?.isEdited ? ' • đã sửa' : ''}
                </Text>

                {reactionEntries.length > 0 ? (
                  <View style={styles.reactionRow}>
                    {reactionEntries.map((entry) => (
                      <Pressable
                        key={`${itemMessageId}-${entry.emoji}`}
                        style={styles.reactionChip}
                        onPress={() => onReactMessage?.(item, entry.emoji)}
                      >
                        <Text style={styles.reactionChipText}>{entry.emoji} {entry.count}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                </View>
              </View>

              {isMe ? (
                <View style={[styles.messageAvatarSlot, styles.messageAvatarSlotMe]}>
                  {showTailAvatar ? (
                    senderAvatar ? (
                      <Image source={{ uri: senderAvatar }} style={styles.messageAvatar} />
                    ) : (
                      <View style={styles.messageAvatarFallback}>
                        <Text style={styles.messageAvatarFallbackText}>
                          {String(senderDisplayName || '?').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )
                  ) : (
                    <View style={styles.messageAvatarSpacer} />
                  )}
                </View>
              ) : null}
            </Pressable>
          )
        }}
      />

      <Modal
        visible={actionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMessageActions}
      >
        <Pressable style={styles.profileBackdrop} onPress={closeMessageActions}>
          <Pressable style={styles.actionCard} onPress={() => {}}>
            <Text style={styles.actionTitle}>Tùy chọn tin nhắn</Text>

            <View style={styles.quickReactionRow}>
              {DEFAULT_EMOJI_REACTIONS.map((emoji) => (
                <Pressable key={emoji} style={styles.quickReactionBtn} onPress={() => reactToActionMessage(emoji)}>
                  <Text style={styles.quickReactionText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.actionBtn} onPress={beginReplyMessage}>
              <Text style={styles.actionBtnText}>Trả lời tin nhắn</Text>
            </Pressable>

            <Pressable style={styles.actionBtn} onPress={openForwardModal}>
              <Text style={styles.actionBtnText}>Chuyển tiếp</Text>
            </Pressable>

            {normalizeId(actionMessage?.senderId) === normalizeId(currentUserId) ? (
              <Pressable style={styles.actionBtn} onPress={beginEditMessage}>
                <Text style={styles.actionBtnText}>Sửa tin nhắn</Text>
              </Pressable>
            ) : null}

            <Pressable style={styles.actionBtnDanger} onPress={confirmDeleteMessage}>
              <Text style={styles.actionBtnDangerText}>Xóa tin nhắn</Text>
            </Pressable>

            {(normalizeId(actionMessage?.senderId) === normalizeId(currentUserId) || (isGroupConversation && isGroupManager)) ? (
              <Pressable
                style={styles.actionBtnDanger}
                onPress={() => {
                  setDeleteMode('all')
                  setDeleteConfirmVisible(true)
                  setActionModalVisible(false)
                }}
              >
                <Text style={styles.actionBtnDangerText}>Xóa với mọi người</Text>
              </Pressable>
            ) : null}

            <Pressable style={styles.actionCloseBtn} onPress={closeMessageActions}>
              <Text style={styles.actionCloseText}>Đóng</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <Pressable style={styles.profileBackdrop} onPress={() => setDeleteConfirmVisible(false)}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <Text style={styles.confirmTitle}>Xóa tin nhắn</Text>
            <Text style={styles.confirmBody}>
              {deleteMode === 'all'
                ? 'Tin nhắn sẽ bị xóa với tất cả mọi người trong cuộc trò chuyện.'
                : 'Tin nhắn sẽ bị xóa chỉ với bạn.'}
            </Text>

            <View style={styles.confirmActionsRow}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setDeleteConfirmVisible(false)}>
                <Text style={styles.confirmCancelText}>Hủy</Text>
              </Pressable>
              <Pressable style={styles.confirmDeleteBtn} onPress={executeDeleteMessage}>
                <Text style={styles.confirmDeleteText}>Xóa</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={forwardModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setForwardModalVisible(false)}
      >
        <View style={styles.infoBackdrop}>
          <View style={[styles.forwardSheet, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={styles.forwardHeader}>
              <Text style={styles.forwardTitle}>Chuyển tiếp tin nhắn</Text>
              <Pressable onPress={() => setForwardModalVisible(false)}>
                <MaterialCommunityIcons name="close" style={styles.forwardCloseIcon} />
              </Pressable>
            </View>

            <View style={styles.forwardSearchWrap}>
              <TextInput
                style={styles.forwardSearchInput}
                value={forwardSearchText}
                onChangeText={setForwardSearchText}
                placeholder="Tìm cuộc trò chuyện"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <ScrollView style={styles.forwardList}>
              {availableForwardConversations.length === 0 ? (
                <Text style={styles.infoEmptyText}>Không có cuộc trò chuyện phù hợp</Text>
              ) : (
                availableForwardConversations.map((item) => {
                  const id = normalizeId(item?._id || item?.conversationId)
                  const selected = forwardSelectedIds.includes(id)
                  return (
                    <Pressable key={id} style={styles.forwardItem} onPress={() => toggleForwardTarget(id)}>
                      <Text style={styles.forwardItemTitle}>{getConversationTitle(item)}</Text>
                      <MaterialCommunityIcons
                        name={selected ? 'check-circle' : 'checkbox-blank-circle-outline'}
                        style={[styles.forwardSelectIcon, selected && styles.forwardSelectIconActive]}
                      />
                    </Pressable>
                  )
                })
              )}
            </ScrollView>

            <Pressable
              style={[styles.forwardSubmitBtn, (forwardSelectedIds.length === 0 || forwarding) && styles.buttonDisabled]}
              onPress={submitForward}
              disabled={forwardSelectedIds.length === 0 || forwarding}
            >
              <Text style={styles.forwardSubmitText}>{forwarding ? 'Đang chuyển tiếp...' : 'Chuyển tiếp'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(previewImageUri)} transparent animationType="fade" onRequestClose={closeImagePreview}>
        <View style={styles.previewBackdrop}>
          <Pressable style={styles.previewCloseBtn} onPress={closeImagePreview}>
            <Text style={styles.previewCloseText}>Đóng</Text>
          </Pressable>
          <View style={styles.previewToolbar}>
            <Pressable style={styles.previewToolbarBtn} onPress={zoomOut}>
              <Text style={styles.previewToolbarBtnText}>-</Text>
            </Pressable>
            <Text style={styles.previewZoomText}>{Math.round(previewZoom * 100)}%</Text>
            <Pressable style={styles.previewToolbarBtn} onPress={zoomIn}>
              <Text style={styles.previewToolbarBtnText}>+</Text>
            </Pressable>
            <Pressable style={styles.previewToolbarResetBtn} onPress={zoomReset}>
              <Text style={styles.previewToolbarResetText}>Reset</Text>
            </Pressable>
          </View>
          {previewImageUri ? (
            <ScrollView
              style={styles.previewScroll}
              contentContainerStyle={styles.previewScrollContent}
              maximumZoomScale={4}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              horizontal
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: previewImageUri }}
                style={{
                  width: basePreviewWidth * previewZoom,
                  height: basePreviewHeight * previewZoom,
                }}
                resizeMode="contain"
              />
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedTypingUser)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTypingUser(null)}
      >
        <Pressable style={styles.profileBackdrop} onPress={() => setSelectedTypingUser(null)}>
          <Pressable style={styles.profileCard} onPress={() => {}}>
            {selectedTypingUser?.avatar ? (
              <Image source={{ uri: selectedTypingUser.avatar }} style={styles.profileAvatarImage} />
            ) : (
              <View style={styles.profileAvatarFallback}>
                <Text style={styles.profileAvatarFallbackText}>
                  {String(selectedTypingUser?.name || '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}

            <Text style={styles.profileNameText}>{selectedTypingUser?.name || 'Người dùng'}</Text>
            <Text style={styles.profileMetaText}>ID: {selectedTypingUser?.id || 'N/A'}</Text>

            <Pressable style={styles.profileCloseBtn} onPress={() => setSelectedTypingUser(null)}>
              <Text style={styles.profileCloseBtnText}>Đóng</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <Pressable style={styles.profileBackdrop} onPress={() => setRenameModalVisible(false)}>
          <Pressable style={styles.renameCard} onPress={() => {}}>
            <Text style={styles.renameTitle}>Đổi tên nhóm</Text>
            <TextInput
              style={styles.renameInput}
              value={nextGroupName}
              onChangeText={setNextGroupName}
              placeholder="Nhập tên nhóm mới"
            />

            <View style={styles.renameActions}>
              <Pressable style={styles.renameCancelBtn} onPress={() => setRenameModalVisible(false)}>
                <Text style={styles.renameCancelText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={styles.renameSaveBtn}
                onPress={async () => {
                  const trimmed = String(nextGroupName || '').trim()
                  if (!trimmed) return
                  await onRenameGroup?.(trimmed)
                  setRenameModalVisible(false)
                }}
              >
                <Text style={styles.renameSaveText}>Lưu</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={infoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.infoBackdrop}>
          <View style={[styles.infoSheet, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoHeaderTitle}>Thông tin hội thoại</Text>
              <Pressable style={styles.infoCloseBtn} onPress={() => setInfoModalVisible(false)}>
                <MaterialCommunityIcons name="close" style={styles.infoCloseIcon} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.infoBody}>
              <View style={styles.infoProfileBlock}>
                <View style={styles.infoAvatarWrap}>
                  {counterpartAvatar ? (
                    <Image source={{ uri: counterpartAvatar }} style={styles.infoAvatar} />
                  ) : (
                    <View style={styles.infoAvatarFallback}>
                      <Text style={styles.infoAvatarFallbackText}>{String(title || '?').slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}

                  {isGroupConversation ? (
                    <Pressable
                      style={[styles.quickEditIconBtn, !isGroupManager && styles.quickEditIconBtnLocked]}
                      onPress={() => {
                        if (!isGroupManager) {
                          showNoticeFromInfo('Bị khóa', 'Chỉ quản trị viên hoặc phó nhóm mới đổi được ảnh nhóm')
                          return
                        }
                        openChildModalFromInfo(() => onUpdateGroupAvatar?.())
                      }}
                    >
                      <MaterialCommunityIcons name="camera-outline" style={styles.quickEditIcon} />
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.infoNameRow}>
                  <Text style={styles.infoName}>{title}</Text>
                  {isGroupConversation ? (
                    <Pressable
                      style={[styles.quickNameEditBtn, !isGroupManager && styles.quickNameEditBtnLocked]}
                      onPress={() => {
                        if (!isGroupManager) {
                          showNoticeFromInfo('Bị khóa', 'Chỉ quản trị viên hoặc phó nhóm mới đổi được tên nhóm')
                          return
                        }
                        openChildModalFromInfo(openRenameGroupModal)
                      }}
                    >
                      <MaterialCommunityIcons name="pencil" style={styles.quickNameEditIcon} />
                    </Pressable>
                  ) : null}
                </View>

                {isGroupConversation ? (
                  <View style={styles.groupRoleBadge}>
                    <MaterialCommunityIcons name={groupRoleMeta.icon} style={[styles.groupRoleBadgeIcon, { color: groupRoleMeta.color }]} />
                    <Text style={styles.groupRoleBadgeText}>{groupRoleMeta.label}</Text>
                  </View>
                ) : null}

                <View style={styles.quickActionRow}>
                  <Pressable
                    style={styles.quickActionItem}
                    onPress={() => {
                      const nextMuted = !Boolean(preference?.muted)
                      onUpdateConversationPreference?.({ muted: nextMuted })
                    }}
                  >
                    <MaterialCommunityIcons name="bell-outline" style={styles.quickActionIcon} />
                    <Text style={styles.quickActionLabel}>{preference?.muted ? 'Bật thông báo' : 'Tắt thông báo'}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.quickActionItem}
                    onPress={() => showNoticeFromInfo('Thông báo', 'Tính năng tìm trong hội thoại sẽ có ở bản cập nhật tới')}
                  >
                    <MaterialCommunityIcons name="magnify" style={styles.quickActionIcon} />
                    <Text style={styles.quickActionLabel}>Tìm tin nhắn</Text>
                  </Pressable>
                  <Pressable
                    style={styles.quickActionItem}
                    onPress={() => onUpdateConversationPreference?.({ pinned: !Boolean(preference?.pinned) })}
                  >
                    <MaterialCommunityIcons
                      name={preference?.pinned ? 'pin' : 'pin-outline'}
                      style={styles.quickActionIcon}
                    />
                    <Text style={styles.quickActionLabel}>{preference?.pinned ? 'Bỏ ghim' : 'Ghim'}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.quickActionItem}
                    onPress={() => {
                      if (!isGroupConversation) {
                        showNoticeFromInfo('Thông báo', 'Tạo nhóm từ chat 1-1 sẽ có ở bản cập nhật tới')
                        return
                      }

                      openChildModalFromInfo(() => setGroupManageVisible(true))
                    }}
                  >
                    <MaterialCommunityIcons name="shield-account-outline" style={styles.quickActionIcon} />
                    <Text style={styles.quickActionLabel}>{isGroupConversation ? 'Quản lý nhóm' : 'Tạo nhóm'}</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable style={styles.infoRowCard} onPress={() => onRefreshConversationData?.()}>
                <Text style={styles.infoRowTitle}>Danh sách nhắc hẹn</Text>
                <MaterialCommunityIcons name="chevron-right" style={styles.infoRowChevron} />
              </Pressable>

              {isGroupConversation ? (
                <Pressable
                  style={styles.infoRowCard}
                  onPress={() => openChildModalFromInfo(() => setMemberModalVisible(true))}
                >
                  <View style={styles.memberRowTextWrap}>
                    <Text style={styles.infoRowTitle}>Thành viên ({memberCount})</Text>
                    <Text style={styles.memberRowSubtitle}>Nhấn để xem danh sách thành viên trong nhóm</Text>
                  </View>
                  <View style={styles.memberRowActions}>
                    <Pressable
                      style={[styles.memberAddBtn, !isGroupManager && styles.memberAddBtnLocked]}
                      onPress={() => {
                        if (!isGroupManager) {
                          showNoticeFromInfo('Bị khóa', 'Chỉ quản trị viên hoặc phó nhóm mới thêm được thành viên')
                          return
                        }
                        openChildModalFromInfo(() => setMemberModalVisible(true))
                      }}
                    >
                      <MaterialCommunityIcons name="account-plus-outline" style={styles.memberAddBtnIcon} />
                      <Text style={styles.memberAddBtnText}>Thêm</Text>
                    </Pressable>
                    <MaterialCommunityIcons name="chevron-right" style={styles.infoRowChevron} />
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.infoRowCard}
                  onPress={() => {
                    showNoticeFromInfo('Thông báo', 'Chat 1-1 không có nhóm chung để hiển thị')
                  }}
                >
                  <Text style={styles.infoRowTitle}>0 nhóm chung</Text>
                  <MaterialCommunityIcons name="chevron-right" style={styles.infoRowChevron} />
                </Pressable>
              )}

              {isGroupConversation ? (
                <Pressable
                  style={[styles.infoRowCard, !isGroupManager && styles.groupLockedCard]}
                  onPress={() => openChildModalFromInfo(() => setGroupManageVisible(true))}
                >
                  <View style={styles.memberRowTextWrap}>
                    <Text style={styles.infoRowTitle}>Quản lý nhóm</Text>
                    <Text style={styles.memberRowSubtitle}>
                      {isGroupManager ? 'Bạn có thể chỉnh quyền và cài đặt nhóm' : 'Chỉ quản trị viên/phó nhóm mới được chỉnh sửa'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" style={styles.infoRowChevron} />
                </Pressable>
              ) : null}

              <View style={styles.infoSection}>
                <Pressable style={styles.infoSectionHeader} onPress={() => toggleInfoSection('media')}>
                  <Text style={styles.infoSectionTitle}>Ảnh/Video</Text>
                  <MaterialCommunityIcons
                    name={expandedInfoSections.media ? 'chevron-up' : 'chevron-down'}
                    style={styles.infoSectionChevron}
                  />
                </Pressable>
                {expandedInfoSections.media ? (
                  sharedStorage.media.length > 0 ? (
                    <View style={styles.mediaGrid}>
                      {sharedStorage.media.slice(0, 6).map((item) => {
                        const mediaUrl = String(item?.url || '')
                        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(mediaUrl) ||
                          String(item?.name || '').toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/)

                        return (
                          <Pressable
                            key={item.id}
                            style={styles.mediaThumbWrap}
                            onPress={() => {
                              if (isImage) {
                                openChildModalFromInfo(() => openImagePreview(mediaUrl))
                                return
                              }
                              openChildModalFromInfo(() => openExternalMedia(mediaUrl))
                            }}
                          >
                            {isImage ? (
                              <Image source={{ uri: mediaUrl }} style={styles.mediaThumb} />
                            ) : (
                              <View style={styles.mediaVideoFallback}>
                                <MaterialCommunityIcons name="video-outline" style={styles.mediaVideoIcon} />
                              </View>
                            )}
                            <Text style={styles.mediaThumbName} numberOfLines={1}>{item.name || 'Ảnh/Video'}</Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  ) : (
                    <Text style={styles.infoEmptyText}>Chưa có ảnh/video được chia sẻ.</Text>
                  )
                ) : null}
              </View>

              <View style={styles.infoSection}>
                <Pressable style={styles.infoSectionHeader} onPress={() => toggleInfoSection('file')}>
                  <Text style={styles.infoSectionTitle}>File</Text>
                  <MaterialCommunityIcons
                    name={expandedInfoSections.file ? 'chevron-up' : 'chevron-down'}
                    style={styles.infoSectionChevron}
                  />
                </Pressable>
                {expandedInfoSections.file ? (
                  sharedStorage.files.length > 0 ? (
                    sharedStorage.files.slice(0, 3).map((item) => (
                      <Text key={item.id} style={styles.infoItemText} numberOfLines={1}>• {item.name}</Text>
                    ))
                  ) : (
                    <Text style={styles.infoEmptyText}>Chưa có tệp đã chia sẻ.</Text>
                  )
                ) : null}
              </View>

              <View style={styles.infoSection}>
                <Pressable style={styles.infoSectionHeader} onPress={() => toggleInfoSection('link')}>
                  <Text style={styles.infoSectionTitle}>Link</Text>
                  <MaterialCommunityIcons
                    name={expandedInfoSections.link ? 'chevron-up' : 'chevron-down'}
                    style={styles.infoSectionChevron}
                  />
                </Pressable>
                {expandedInfoSections.link ? (
                  sharedStorage.links.length > 0 ? (
                    sharedStorage.links.slice(0, 3).map((item) => (
                      <Text key={item.id} style={styles.infoItemText} numberOfLines={1}>• {item.url}</Text>
                    ))
                  ) : (
                    <Text style={styles.infoEmptyText}>Chưa có liên kết đã chia sẻ.</Text>
                  )
                ) : null}
              </View>

              <View style={styles.infoSection}>
                <Pressable style={styles.infoSectionHeader} onPress={() => toggleInfoSection('privacy')}>
                  <Text style={styles.infoSectionTitle}>Thiết lập bảo mật</Text>
                  <MaterialCommunityIcons
                    name={expandedInfoSections.privacy ? 'chevron-up' : 'chevron-down'}
                    style={styles.infoSectionChevron}
                  />
                </Pressable>
                {expandedInfoSections.privacy ? (
                  <>
                    <View style={styles.privacyRow}>
                      <View style={styles.privacyTextWrap}>
                        <Text style={styles.privacyTitle}>Tin nhắn tự xóa</Text>
                        <Text style={styles.privacySubtitle}>{selectedAutoDeleteLabel}</Text>
                      </View>
                      <Pressable
                        style={styles.autoDeleteBtn}
                        onPress={() => setShowAutoDeleteOptions((prev) => !prev)}
                      >
                        <Text style={styles.autoDeleteBtnText}>{selectedAutoDeleteLabel}</Text>
                        <MaterialCommunityIcons name="chevron-down" style={styles.autoDeleteChevron} />
                      </Pressable>
                    </View>

                    {showAutoDeleteOptions ? (
                      <View style={styles.autoDeleteOptionsCard}>
                        {AUTO_DELETE_OPTIONS.map((option) => (
                          <Pressable
                            key={option.value}
                            style={styles.autoDeleteOptionRow}
                            onPress={() => {
                              setAutoDeleteOption(option.value)
                              onUpdateConversationPreference?.({ autoDelete: option.value })
                              setShowAutoDeleteOptions(false)
                            }}
                          >
                            <Text style={styles.autoDeleteOptionText}>{option.label}</Text>
                            {autoDeleteOption === option.value ? (
                              <MaterialCommunityIcons name="check" style={styles.autoDeleteOptionCheck} />
                            ) : null}
                          </Pressable>
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.privacyRow}>
                      <View style={styles.privacyTextWrap}>
                        <Text style={styles.privacyTitle}>Ẩn trò chuyện</Text>
                      </View>
                      <Switch
                        value={hideConversation}
                        onValueChange={(value) => {
                          setHideConversation(value)
                          onUpdateConversationPreference?.({ hidden: value })
                        }}
                        thumbColor={hideConversation ? '#ffffff' : '#f1f5f9'}
                        trackColor={{ false: '#cbd5e1', true: '#60a5fa' }}
                      />
                    </View>
                  </>
                ) : null}
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Tùy chỉnh nền chat</Text>
                <View style={styles.themeGrid}>
                  {CHAT_BACKGROUND_OPTIONS.map((theme) => {
                    const selected = chatTheme === theme.value
                    return (
                      <Pressable
                        key={theme.value}
                        style={[styles.themeItem, selected && styles.themeItemSelected]}
                        onPress={() => {
                          setChatTheme(theme.value)
                          onUpdateConversationPreference?.({ chatTheme: theme.value })
                        }}
                      >
                        <View style={styles.themePreviewWrap}>
                          {theme.preview.map((color, index) => (
                            <View
                              key={`${theme.value}-${index}`}
                              style={[styles.themePreviewDot, { backgroundColor: color }]}
                            />
                          ))}
                        </View>
                        <Text style={styles.themeLabel}>{theme.label}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>

              <View style={styles.dangerZone}>
                <Pressable
                  style={styles.dangerAction}
                  onPress={() => showNoticeFromInfo('Thông báo', 'Tính năng báo xấu đang phát triển')}
                >
                  <MaterialCommunityIcons name="alert-outline" style={styles.dangerIcon} />
                  <Text style={styles.dangerText}>Báo xấu</Text>
                </Pressable>
                {isGroupConversation ? (
                  <Pressable
                    style={styles.dangerAction}
                    onPress={handleLeaveOrDissolveGroup}
                  >
                    <MaterialCommunityIcons
                      name={participantRole === 'admin' ? 'delete-alert-outline' : 'logout-variant'}
                      style={[styles.dangerIcon, styles.dangerIconDelete]}
                    />
                    <Text style={styles.dangerDeleteText}>{participantRole === 'admin' ? 'Giải tán nhóm' : 'Rời nhóm'}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.dangerAction}
                  onPress={() => {
                    showConfirmFromInfo('Xác nhận', 'Bạn có chắc muốn xóa hoặc rời cuộc trò chuyện này?', () => {
                      onDeleteConversation?.()
                    })
                  }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" style={[styles.dangerIcon, styles.dangerIconDelete]} />
                  <Text style={styles.dangerDeleteText}>Xóa lịch sử trò chuyện</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={groupManageVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGroupManageVisible(false)}
      >
        <Pressable style={styles.profileBackdrop} onPress={() => setGroupManageVisible(false)}>
          <Pressable style={styles.groupManageCard} onPress={() => {}}>
            <View style={styles.groupManageHeader}>
              <Text style={styles.groupManageTitle}>Quản lý nhóm</Text>
              <Pressable onPress={() => setGroupManageVisible(false)}>
                <MaterialCommunityIcons name="close" style={styles.groupManageCloseIcon} />
              </Pressable>
            </View>

            <View style={[styles.groupManageLockBar, !isGroupManager && styles.groupManageLockBarDisabled]}>
              <MaterialCommunityIcons
                name={isGroupManager ? 'key-variant' : 'lock-outline'}
                style={styles.groupManageLockIcon}
              />
              <Text style={styles.groupManageLockText}>
                {isGroupManager
                  ? 'Tính năng chỉ dành cho quản trị viên'
                  : 'Bạn không có quyền chỉnh sửa. Cần key vàng hoặc key bạc.'}
              </Text>
            </View>

            <View style={!isGroupManager ? styles.groupManageDisabled : null}>
              <View style={styles.groupSettingRow}>
                <View style={styles.groupSettingTextWrap}>
                  <Text style={styles.groupSettingTitle}>Thay đổi tên & ảnh đại diện của nhóm</Text>
                  <Text style={styles.groupSettingSub}>Cho phép thành viên chỉnh thông tin nhóm</Text>
                </View>
                <Switch
                  value={Boolean(groupSettings?.allowMemberEditGroupInfo)}
                  onValueChange={(value) => toggleGroupSetting('allowMemberEditGroupInfo', value)}
                  disabled={!isGroupManager}
                />
              </View>

              <View style={styles.groupSettingRow}>
                <View style={styles.groupSettingTextWrap}>
                  <Text style={styles.groupSettingTitle}>Chế độ phê duyệt thành viên mới</Text>
                  <Text style={styles.groupSettingSub}>Yêu cầu quản trị viên duyệt thành viên mới</Text>
                </View>
                <Switch
                  value={Boolean(groupSettings?.requiresAdminApproval)}
                  onValueChange={(value) => toggleGroupSetting('requiresAdminApproval', value)}
                  disabled={!isGroupManager}
                />
              </View>

              <View style={styles.groupSettingRow}>
                <View style={styles.groupSettingTextWrap}>
                  <Text style={styles.groupSettingTitle}>Chỉ quản trị viên/phó nhóm được gửi tin</Text>
                  <Text style={styles.groupSettingSub}>Khóa gửi tin với thành viên thường</Text>
                </View>
                <Switch
                  value={Boolean(groupSettings?.adminOnlyMessaging)}
                  onValueChange={(value) => toggleGroupSetting('adminOnlyMessaging', value)}
                  disabled={!isGroupManager}
                />
              </View>

              <View style={styles.groupSettingRow}>
                <View style={styles.groupSettingTextWrap}>
                  <Text style={styles.groupSettingTitle}>Cho phép thành viên mới đọc tin nhắn gần nhất</Text>
                </View>
                <Switch
                  value={Boolean(groupSettings?.newMemberHistoryVisibility)}
                  onValueChange={(value) => toggleGroupSetting('newMemberHistoryVisibility', value)}
                  disabled={!isGroupManager}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={memberModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMemberModalVisible(false)}
      >
        <Pressable style={styles.profileBackdrop} onPress={() => setMemberModalVisible(false)}>
          <Pressable style={styles.memberModalCard} onPress={() => {}}>
            <View style={styles.groupManageHeader}>
              <Text style={styles.groupManageTitle}>Thành viên nhóm</Text>
              <Pressable onPress={() => setMemberModalVisible(false)}>
                <MaterialCommunityIcons name="close" style={styles.groupManageCloseIcon} />
              </Pressable>
            </View>

            <TextInput
              style={styles.memberSearchInput}
              value={memberSearchText}
              onChangeText={setMemberSearchText}
              onSubmitEditing={searchMemberCandidates}
              placeholder="Nhập tên hoặc username"
              placeholderTextColor="#94a3b8"
            />

            <Pressable style={styles.memberSearchBtn} onPress={searchMemberCandidates}>
              <Text style={styles.memberSearchBtnText}>{memberSearchLoading ? 'Đang tìm...' : 'Tìm thành viên'}</Text>
            </Pressable>

            <View style={styles.memberRoleSection}>
              <Text style={styles.memberRoleSectionTitle}>Thành viên hiện tại</Text>
              <Text style={styles.memberRoleSectionSub}>
                {canManageMemberRoles
                  ? 'Nhấn vào thành viên để bổ nhiệm, bãi chức hoặc xóa khỏi nhóm'
                  : 'Chỉ quản trị viên (key vàng) hoặc phó nhóm (key bạc) mới có thể quản lý vai trò'}
              </Text>

              <ScrollView style={styles.memberRoleList}>
                {groupedMembers.map((member) => {
                  const roleLabel =
                    member.role === 'admin'
                      ? 'Key vàng'
                      : member.role === 'moderator'
                        ? 'Key bạc'
                        : 'Thành viên'

                  return (
                    <Pressable
                      key={`member-role-${member.userId}`}
                      style={styles.memberRoleItem}
                      onPress={() => openRoleActionForMember(member)}
                    >
                      <View style={styles.memberRoleInfo}>
                        <Text style={styles.memberRoleName} numberOfLines={1}>
                          {member.displayName} {member.isMe ? '(Bạn)' : ''}
                        </Text>
                        <Text style={styles.memberRoleUsername} numberOfLines={1}>
                          @{member.username || 'unknown'}
                        </Text>
                      </View>

                      <View style={[
                        styles.memberRoleBadge,
                        member.role === 'admin' && styles.memberRoleBadgeAdmin,
                        member.role === 'moderator' && styles.memberRoleBadgeModerator,
                      ]}>
                        <Text style={styles.memberRoleBadgeText}>{roleLabel}</Text>
                      </View>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>

            <ScrollView style={styles.memberResultList}>
              {memberSearchLoading ? (
                <Text style={styles.infoEmptyText}>Đang tải...</Text>
              ) : memberSearchResults.length === 0 ? (
                <Text style={styles.infoEmptyText}>Không có kết quả phù hợp</Text>
              ) : (
                memberSearchResults.map((item) => {
                  const userId = normalizeId(item?._id || item?.userId || item?.id)
                  const displayName = getDisplayName(item)
                  const username = String(item?.username || '').trim()
                  const adding = memberAddingId === userId

                  return (
                    <View key={userId} style={styles.memberResultRow}>
                      <View style={styles.memberResultInfo}>
                        <Text style={styles.memberResultName}>{displayName}</Text>
                        <Text style={styles.memberResultSub}>@{username || 'unknown'}</Text>
                      </View>
                      <Pressable
                        style={[styles.memberResultAddBtn, adding && styles.buttonDisabled]}
                        onPress={() => addMemberToGroup(userId)}
                        disabled={adding}
                      >
                        <Text style={styles.memberResultAddBtnText}>{adding ? 'Đang thêm...' : 'Thêm'}</Text>
                      </Pressable>
                    </View>
                  )
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(selectedMemberForRoleAction)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMemberForRoleAction(null)}
      >
        <Pressable style={styles.profileBackdrop} onPress={() => setSelectedMemberForRoleAction(null)}>
          <Pressable style={styles.roleActionCard} onPress={() => {}}>
            <Text style={styles.roleActionTitle}>Quản lý vai trò thành viên</Text>
            <Text style={styles.roleActionTarget} numberOfLines={2}>
              {selectedMemberForRoleAction?.displayName || 'Thành viên'}
            </Text>

            {String(selectedMemberForRoleAction?.role || '').toLowerCase() === 'member' ? (
              <Pressable
                style={styles.roleActionBtn}
                onPress={() => updateSelectedMemberRole('moderator')}
              >
                <Text style={styles.roleActionBtnText}>Nâng lên key bạc (phó nhóm)</Text>
              </Pressable>
            ) : null}

            {String(selectedMemberForRoleAction?.role || '').toLowerCase() === 'moderator' ? (
              <Pressable
                style={[styles.roleActionBtn, styles.roleActionBtnDanger]}
                onPress={() => updateSelectedMemberRole('member')}
              >
                <Text style={[styles.roleActionBtnText, styles.roleActionBtnDangerText]}>Bãi chức về thành viên</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.roleActionBtn, styles.roleActionBtnDanger]}
              onPress={removeSelectedMemberFromGroup}
            >
              <Text style={[styles.roleActionBtnText, styles.roleActionBtnDangerText]}>Xóa khỏi nhóm</Text>
            </Pressable>

            <Pressable style={styles.roleActionCloseBtn} onPress={() => setSelectedMemberForRoleAction(null)}>
              <Text style={styles.roleActionCloseText}>Đóng</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={expressionPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setExpressionPickerVisible(false)}
      >
        <Pressable style={styles.expressionBackdrop} onPress={() => setExpressionPickerVisible(false)}>
          <Pressable
            style={[styles.expressionSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
            onPress={() => {}}
          >
            <View style={styles.expressionHeader}>
              <Text style={styles.expressionTitle}>Gửi biểu cảm</Text>
              <Pressable style={styles.expressionCloseBtn} onPress={() => setExpressionPickerVisible(false)}>
                <MaterialCommunityIcons name="close" style={styles.expressionCloseIcon} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.expressionBody}>
              {EXPRESSION_CATEGORIES.map((category) => (
                <View key={category.id} style={styles.expressionSection}>
                  <Text style={styles.expressionSectionTitle}>{category.label}</Text>
                  <View style={styles.expressionGrid}>
                    {category.items.map((emoji) => (
                      <Pressable
                        key={`${category.id}-${emoji}`}
                        style={styles.expressionItem}
                        onPress={() => appendExpression(emoji)}
                      >
                        <Text style={styles.expressionItemText}>{emoji}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.bottomDock, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {editingMessage ? (
          <View style={styles.composeHintWrap}>
            <Text style={styles.composeHintText} numberOfLines={1}>Đang sửa: {String(editingMessage?.content || '')}</Text>
            <Pressable onPress={() => { setEditingMessage(null); setText('') }}>
              <Text style={styles.composeHintClose}>Hủy</Text>
            </Pressable>
          </View>
        ) : null}

        {replyingToMessage ? (
          <View style={styles.composeHintWrap}>
            <Text style={styles.composeHintText} numberOfLines={1}>Trả lời: {String(replyingToMessage?.content || '[Tệp đính kèm]')}</Text>
            <Pressable onPress={() => setReplyingToMessage(null)}>
              <Text style={styles.composeHintClose}>Hủy</Text>
            </Pressable>
          </View>
        ) : null}

        {typingUsers.length > 0 ? (
          <View style={styles.typingWrap}>
            <View style={styles.typingRow}>
              {typingUsers.slice(0, 2).map((typingUser) => {
                const avatarUri = String(typingUser?.avatar || '')
                const fallbackLabel = String(typingUser?.name || '?').slice(0, 1).toUpperCase()

                return avatarUri ? (
                  <Pressable key={typingUser.id} onPress={() => setSelectedTypingUser(typingUser)}>
                    <Image source={{ uri: avatarUri }} style={styles.typingAvatarImage} />
                  </Pressable>
                ) : (
                  <Pressable key={typingUser.id} style={styles.typingAvatarFallback} onPress={() => setSelectedTypingUser(typingUser)}>
                    <Text style={styles.typingAvatarFallbackText}>{fallbackLabel}</Text>
                  </Pressable>
                )
              })}

              <Text style={styles.typingText}>{typingLabel}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.inputWrap}>
          <Pressable style={styles.attachBtn} onPress={() => setExpressionPickerVisible(true)}>
            <MaterialCommunityIcons name="emoticon-outline" style={styles.attachIcon} />
          </Pressable>

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(value) => {
              setText(value)
              if (value.trim()) {
                onTypingStart?.()
              } else {
                onTypingStop?.()
              }
            }}
            onBlur={() => onTypingStop?.()}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#94a3b8"
            multiline
          />

          <Pressable
            style={styles.attachBtn}
            onPress={() => onPickFile?.(normalizeId(replyingToMessage?._id || replyingToMessage?.messageId) || null)}
          >
            <MaterialCommunityIcons name="dots-horizontal" style={styles.attachIcon} />
          </Pressable>

          <Pressable
            style={styles.attachBtn}
            onPress={() => onPickImage?.(normalizeId(replyingToMessage?._id || replyingToMessage?.messageId) || null)}
          >
            <MaterialCommunityIcons name="image-outline" style={styles.attachIcon} />
          </Pressable>

          <Pressable style={styles.sendButton} onPress={send}>
            <MaterialCommunityIcons name="send" style={styles.sendIcon} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef0f4' },
  header: {
    paddingBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  backIcon: {
    fontSize: 30,
    color: '#64748b',
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: 6,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', lineHeight: 24 },
  subtitle: { marginTop: 2, fontSize: 12, color: '#64748b' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 25,
    color: '#1663e7',
  },
  messageListView: {
    flex: 1,
  },
  messageList: { paddingHorizontal: 10, paddingVertical: 12, flexGrow: 1 },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 16 },
  systemMessageRow: {
    alignItems: 'center',
    marginVertical: 6,
  },
  systemMessageChip: {
    maxWidth: '88%',
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  systemMessageText: {
    color: '#1e3a8a',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  systemCallJoinButton: {
    alignSelf: 'center',
    backgroundColor: '#1663e7',
    borderRadius: 999,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  systemCallJoinButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  callMessageRow: {
    marginVertical: 5,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  callMessageRowMe: {
    justifyContent: 'flex-end',
  },
  callMessageRowOther: {
    justifyContent: 'flex-start',
  },
  callMessageAvatarSlot: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  callMessageColumnWrap: {
    maxWidth: '76%',
    flexShrink: 1,
  },
  callMessageCard: {
    width: '100%',
    minWidth: 214,
    minHeight: 112,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  callMessageCardCompleted: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  callMessageCardMissed: {
    backgroundColor: '#fff1f2',
    borderColor: '#fca5a5',
    shadowColor: '#ef4444',
    shadowOpacity: 0.09,
  },
  callMessageContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  callMessageIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callMessageIconWrapCompleted: {
    backgroundColor: '#dbeafe',
  },
  callMessageIconWrapMissed: {
    backgroundColor: '#ffe4e6',
  },
  callMessageIcon: {
    fontSize: 24,
  },
  callMessageIconCompleted: {
    color: '#2563eb',
  },
  callMessageIconMissed: {
    color: '#ef4444',
  },
  callMessageCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  callMessageTitle: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  callMessageSubtitle: {
    marginTop: 4,
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 19,
  },
  callMessageTime: {
    marginTop: 18,
    alignSelf: 'center',
    color: '#52525b',
    fontSize: 13,
  },
  messageRow: { marginVertical: 4, flexDirection: 'row' },
  messageRowMe: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messageAvatarSlot: {
    width: 28,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginRight: 6,
  },
  messageAvatarSlotMe: {
    marginRight: 0,
    marginLeft: 6,
  },
  messageAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#cbd5e1',
  },
  messageAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAvatarFallbackText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  messageAvatarSpacer: {
    width: 24,
    height: 24,
  },
  messageColumnWrap: {
    maxWidth: '76%',
  },
  senderNameText: {
    marginLeft: 4,
    marginBottom: 4,
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMe: { backgroundColor: '#1061e8', borderBottomRightRadius: 4 },
  bubbleOther: { 
    backgroundColor: '#ffffff', 
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    // shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    // elevation for Android
    elevation: 1,
  },
  emojiBubble: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emojiBubbleMe: {
    backgroundColor: 'rgba(16,97,232,0.12)',
  },
  emojiBubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.74)',
  },
  messageText: { fontSize: 15 },
  emojiMessageText: {
    fontSize: 42,
    lineHeight: 48,
    textAlign: 'center',
  },
  messageTextMe: { color: '#fff' },
  messageTextOther: { color: '#0f172a' },
  attachmentImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#cbd5e1',
  },
  progressWrap: {
    marginTop: 6,
    gap: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressTrackMe: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  progressTrackOther: {
    backgroundColor: '#cbd5e1',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressFillMe: {
    backgroundColor: '#ffffff',
  },
  progressFillOther: {
    backgroundColor: '#1061e8',
  },
  progressText: {
    fontSize: 12,
    opacity: 0.9,
  },
  replySnippet: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  replySnippetMe: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderLeftColor: 'rgba(255,255,255,0.7)',
  },
  replySnippetOther: {
    backgroundColor: '#f1f5f9',
    borderLeftColor: '#64748b',
  },
  replySnippetLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  replySnippetLabelMe: { color: 'rgba(255,255,255,0.85)' },
  replySnippetLabelOther: { color: '#64748b' },
  replySnippetText: {
    fontSize: 12,
  },
  replySnippetTextMe: { color: '#f8fafc' },
  replySnippetTextOther: { color: '#334155' },
  timeText: { marginTop: 4, fontSize: 11 },
  timeTextMe: { color: '#cffafe', textAlign: 'right' },
  timeTextOther: { color: '#64748b', textAlign: 'right' },
  reactionRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reactionChip: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    // Shadow for better visibility
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  reactionChipText: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '700',
  },
  bottomDock: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#dbe1ea',
  },
  composeHintWrap: {
    marginTop: 8,
    marginHorizontal: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  composeHintText: {
    flex: 1,
    color: '#1e3a8a',
    fontSize: 12,
  },
  composeHintClose: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  inputWrap: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachIcon: {
    color: '#64748b',
    fontSize: 26,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#eef2f7',
    fontSize: 16,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1061e8',
  },
  sendIcon: { color: '#fff', fontSize: 24, marginLeft: 2 },
  typingWrap: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typingAvatarImage: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#cbd5e1',
  },
  typingAvatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#14b8a6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typingAvatarFallbackText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  typingText: {
    color: '#0f766e',
    fontStyle: 'italic',
    fontSize: 12,
  },
  expressionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'flex-end',
  },
  expressionSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingHorizontal: 14,
    maxHeight: '58%',
  },
  expressionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expressionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  expressionCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  expressionCloseIcon: {
    color: '#475569',
    fontSize: 22,
  },
  expressionBody: {
    paddingBottom: 8,
  },
  expressionSection: {
    marginBottom: 12,
  },
  expressionSectionTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  expressionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expressionItem: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  expressionItemText: {
    fontSize: 27,
    lineHeight: 32,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
  previewScroll: {
    width: '100%',
    maxHeight: '80%',
  },
  previewScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: '100%',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewCloseText: {
    color: '#fff',
    fontWeight: '700',
  },
  previewToolbar: {
    position: 'absolute',
    bottom: 42,
    alignSelf: 'center',
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  previewToolbarBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(148,163,184,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewToolbarBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  previewZoomText: {
    color: '#e2e8f0',
    fontWeight: '700',
    minWidth: 48,
    textAlign: 'center',
  },
  previewToolbarResetBtn: {
    backgroundColor: 'rgba(8, 145, 178, 0.85)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewToolbarResetText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  profileBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  profileCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  profileAvatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#cbd5e1',
    marginBottom: 10,
  },
  profileAvatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#14b8a6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileAvatarFallbackText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
  },
  profileNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  profileMetaText: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 13,
  },
  profileCloseBtn: {
    marginTop: 14,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  profileCloseBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  actionCard: {
    width: '92%',
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionTitle: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 10,
  },
  quickReactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  quickReactionBtn: {
    width: 44,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickReactionText: {
    fontSize: 20,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  actionBtnText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  actionBtnDanger: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  actionBtnDangerText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  actionCloseBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  actionCloseText: {
    color: '#475569',
    fontWeight: '700',
  },
  confirmCard: {
    width: '90%',
    maxWidth: 340,
    borderRadius: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  confirmBody: {
    marginTop: 8,
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActionsRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  confirmCancelBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  confirmCancelText: {
    color: '#334155',
    fontWeight: '700',
  },
  confirmDeleteBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#dc2626',
  },
  confirmDeleteText: {
    color: '#fff',
    fontWeight: '700',
  },
  renameCard: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  renameInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  renameCancelBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  renameCancelText: {
    color: '#334155',
    fontWeight: '700',
  },
  renameSaveBtn: {
    backgroundColor: '#0891b2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  renameSaveText: {
    color: '#fff',
    fontWeight: '700',
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    justifyContent: 'flex-end',
  },
  infoSheet: {
    maxHeight: '96%',
    backgroundColor: '#f5f7fb',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
  },
  forwardSheet: {
    maxHeight: '84%',
    backgroundColor: '#eef0f4',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  forwardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  forwardTitle: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 18,
  },
  forwardCloseIcon: {
    fontSize: 24,
    color: '#334155',
  },
  forwardSearchWrap: {
    marginBottom: 10,
  },
  forwardSearchInput: {
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  forwardList: {
    maxHeight: 340,
  },
  forwardItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forwardItemTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  forwardSelectIcon: {
    fontSize: 22,
    color: '#94a3b8',
  },
  forwardSelectIconActive: {
    color: '#1061e8',
  },
  forwardSubmitBtn: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#1061e8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  forwardSubmitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  infoHeader: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d8dee7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eef0f4',
  },
  infoHeaderTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: '#0f172a',
  },
  infoCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCloseIcon: {
    fontSize: 18,
    color: '#334155',
  },
  infoBody: {
    paddingBottom: 20,
    paddingHorizontal: 10,
  },
  infoProfileBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginTop: 8,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoAvatarWrap: {
    position: 'relative',
  },
  infoAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#d9dee8',
  },
  infoAvatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoAvatarFallbackText: {
    color: '#1e40af',
    fontWeight: '700',
    fontSize: 30,
  },
  quickEditIconBtn: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  quickEditIconBtnLocked: {
    backgroundColor: '#94a3b8',
  },
  quickEditIcon: {
    fontSize: 16,
    color: '#fff',
  },
  infoNameRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 36,
  },
  quickNameEditBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  quickNameEditBtnLocked: {
    opacity: 0.45,
  },
  quickNameEditIcon: {
    color: '#0f172a',
    fontSize: 16,
  },
  groupRoleBadge: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  groupRoleBadgeIcon: {
    fontSize: 15,
  },
  groupRoleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  quickActionRow: {
    marginTop: 14,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  quickActionItem: {
    alignItems: 'center',
    width: '22%',
  },
  quickActionIcon: {
    fontSize: 20,
    color: '#1e293b',
    marginBottom: 6,
  },
  quickActionLabel: {
    textAlign: 'center',
    fontSize: 11,
    color: '#111827',
  },
  infoRowCard: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  infoRowTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '500',
  },
  infoRowChevron: {
    color: '#64748b',
    fontSize: 20,
  },
  memberRowTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  memberRowSubtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12,
  },
  memberRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberAddBtn: {
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    backgroundColor: '#0f62e8',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  memberAddBtnLocked: {
    backgroundColor: '#94a3b8',
  },
  memberAddBtnIcon: {
    fontSize: 16,
    color: '#fff',
  },
  memberAddBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  groupLockedCard: {
    opacity: 0.58,
  },
  infoSection: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  infoSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoSectionTitle: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '700',
  },
  infoSectionChevron: {
    fontSize: 18,
    color: '#64748b',
  },
  infoItemText: {
    marginTop: 6,
    color: '#334155',
    fontSize: 13,
  },
  mediaGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  mediaThumbWrap: {
    width: '31%',
  },
  mediaThumb: {
    width: '100%',
    height: 82,
    borderRadius: 10,
    backgroundColor: '#cbd5e1',
    borderWidth: 1,
    borderColor: '#dbe3ee',
  },
  mediaVideoFallback: {
    width: '100%',
    height: 82,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#dbe3ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaVideoIcon: {
    fontSize: 26,
    color: '#475569',
  },
  mediaThumbName: {
    marginTop: 4,
    fontSize: 11,
    color: '#475569',
  },
  infoEmptyText: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
  },
  privacyRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  privacyTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  privacyTitle: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 14,
  },
  privacySubtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12,
  },
  autoDeleteBtn: {
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoDeleteBtnText: {
    color: '#0f172a',
    fontSize: 12,
  },
  autoDeleteChevron: {
    color: '#64748b',
    fontSize: 16,
  },
  autoDeleteOptionsCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  autoDeleteOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  autoDeleteOptionText: {
    color: '#1f2937',
    fontSize: 13,
  },
  autoDeleteOptionCheck: {
    color: '#1061e8',
    fontSize: 16,
  },
  themeGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  themeItem: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
  },
  themeItemSelected: {
    borderColor: '#0f172a',
    backgroundColor: '#ffffff',
  },
  themePreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  themePreviewDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.2)',
  },
  themeLabel: {
    color: '#1f2937',
    fontSize: 13,
    fontWeight: '500',
  },
  dangerZone: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#d8dee7',
    gap: 10,
  },
  dangerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dangerIcon: {
    fontSize: 16,
    color: '#334155',
  },
  dangerIconDelete: {
    color: '#dc2626',
  },
  dangerText: {
    color: '#334155',
    fontSize: 14,
  },
  dangerDeleteText: {
    color: '#dc2626',
    fontSize: 14,
  },
  groupManageCard: {
    width: '96%',
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  groupManageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupManageTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '700',
  },
  groupManageCloseIcon: {
    color: '#475569',
    fontSize: 24,
  },
  groupManageLockBar: {
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  groupManageLockBarDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  groupManageLockIcon: {
    color: '#1e40af',
    fontSize: 16,
  },
  groupManageLockText: {
    color: '#334155',
    fontSize: 12,
    flex: 1,
  },
  groupManageDisabled: {
    opacity: 0.45,
  },
  groupSettingRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  groupSettingTextWrap: {
    flex: 1,
  },
  groupSettingTitle: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  groupSettingSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  memberModalCard: {
    width: '96%',
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: '84%',
  },
  memberSearchInput: {
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  memberSearchBtn: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#1061e8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  memberSearchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  memberRoleSection: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    backgroundColor: '#f8fafc',
  },
  memberRoleSectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  memberRoleSectionSub: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 12,
  },
  memberRoleList: {
    marginTop: 8,
    maxHeight: 220,
  },
  memberRoleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  memberRoleInfo: {
    flex: 1,
    marginRight: 10,
  },
  memberRoleName: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  memberRoleUsername: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 11,
  },
  memberRoleBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  memberRoleBadgeAdmin: {
    borderColor: '#facc15',
    backgroundColor: '#fef9c3',
  },
  memberRoleBadgeModerator: {
    borderColor: '#94a3b8',
    backgroundColor: '#e2e8f0',
  },
  memberRoleBadgeText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  memberResultList: {
    marginTop: 10,
    maxHeight: 320,
  },
  memberResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  memberResultInfo: {
    flex: 1,
    marginRight: 8,
  },
  memberResultName: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  memberResultSub: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12,
  },
  memberResultAddBtn: {
    borderRadius: 8,
    backgroundColor: '#0f62e8',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  memberResultAddBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  roleActionCard: {
    width: '92%',
    maxWidth: 360,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  roleActionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  roleActionTarget: {
    marginTop: 6,
    color: '#334155',
    fontSize: 14,
  },
  roleActionBtn: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#1061e8',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roleActionBtnDanger: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  roleActionBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  roleActionBtnDangerText: {
    color: '#dc2626',
  },
  roleActionCloseBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  roleActionCloseText: {
    color: '#475569',
    fontWeight: '700',
  },
  olderMessagesWrap: {
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'center',
  },
  olderMessagesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  olderMessagesText: {
    marginLeft: 8,
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  olderMessagesBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
  },
  olderMessagesBtnText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700',
  },
})
