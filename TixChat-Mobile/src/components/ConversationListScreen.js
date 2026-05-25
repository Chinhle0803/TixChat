import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import NewConversationModal from './NewConversationModal'
import { MobileBottomTabBar } from './ui'
import { conversationService, userService } from '../services/api'
import { getSocket } from '../services/socket'

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') return String(value._id || value.userId || value.id || '')
  return String(value)
}

const getAvatarValue = (source) => {
  if (!source) return ''

  const values = [
    source?.avatar?.url,
    source?.avatar?.src,
    source?.avatar,
    source?.avatarUrl,
    source?.photoURL,
    source?.profilePicture?.url,
    source?.profilePicture,
    source?.profileImage?.url,
    source?.profileImage,
    source?.profileImageUrl,
    source?.picture?.url,
    source?.picture,
    source?.imageUrl,
    source?.image,
    source?.photo,
  ]

  const value = values.find((item) => typeof item === 'string' && item.trim())
  return value || ''
}

const getConversationName = (conversation, currentUserId) => {
  if (conversation?.name) return conversation.name

  if (conversation?.type === '1-1' || conversation?.type === 'direct') {
    const participants = conversation?.participants || []
    const other = participants.find((p) => normalizeId(p?._id || p?.userId || p) !== normalizeId(currentUserId))

    if (typeof other === 'object') {
      return (
        other.name ||
        other.nickname ||
        other.displayName ||
        other.fullName ||
        other.username ||
        'Người dùng'
      )
    }

    return 'Người dùng'
  }

  return 'Đoạn chat'
}

const getLatestMessage = (conversation) => {
  const latest = conversation?.latestMessage || conversation?.lastMessage || null
  if (!latest) return 'Chưa có tin nhắn'
  const content = latest?.content || latest?.text || latest?.message || ''
  return content || '[Tệp đính kèm]'
}

const getLatestTimestamp = (conversation) => {
  const latest = conversation?.latestMessage || conversation?.lastMessage || null
  return latest?.createdAt || latest?.updatedAt || conversation?.lastMessageAt || conversation?.updatedAt || ''
}

const formatTimeLabel = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  const dayDiff = Math.floor((now.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) / 86400000)
  if (dayDiff === 1) return 'Hôm qua'

  if (dayDiff > 1 && dayDiff < 7) {
    return date.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('.', '')
  }

  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

const getParticipantObject = (conversation, currentUserId) => {
  const participants = conversation?.participants || []
  if (conversation?.type === '1-1' || conversation?.type === 'direct') {
    return (
      participants.find((p) => normalizeId(p?._id || p?.userId || p) !== normalizeId(currentUserId)) ||
      participants[0] ||
      null
    )
  }

  return participants[0] || null
}

const getParticipantPresenceSources = (conversation, currentUserId) => {
  const participants = Array.isArray(conversation?.participants)
    ? conversation.participants.filter((participant) => participant && typeof participant === 'object')
    : []
  if (participants.length === 0) return []

  const currentId = normalizeId(currentUserId)
  const others = participants.filter((participant) =>
    normalizeId(participant?._id || participant?.userId || participant?.id) !== currentId
  )

  return others.length > 0 ? others : participants
}

const parsePresenceTimestamp = (value) => {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const numericValue = Number(value)
  if (Number.isFinite(numericValue) && String(value).trim() !== '') return numericValue

  const date = new Date(value)
  const timestamp = date.getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const isPresenceOnline = (source) => {
  if (!source || typeof source !== 'object') return false
  const status = String(source?.status || source?.presence || source?.presenceStatus || '').toLowerCase()
  return source?.isOnline === true || source?.online === true || status === 'online' || status === 'active'
}

const getLastSeenTimestamp = (source) => parsePresenceTimestamp(
  source?.lastSeen ||
  source?.lastSeenAt ||
  source?.lastActiveAt ||
  source?.lastOnlineAt ||
  source?.offlineAt
)

const getPresenceState = (source, nowMs = Date.now()) => {
  const sources = (Array.isArray(source) ? source : [source])
    .filter((item) => item && typeof item === 'object')
  if (sources.length === 0) return null

  if (sources.some(isPresenceOnline)) {
    return { type: 'online' }
  }

  const lastSeen = sources.reduce((latest, item) => {
    const timestamp = getLastSeenTimestamp(item)
    return timestamp > latest ? timestamp : latest
  }, 0)

  if (!lastSeen) return null

  const minutes = Math.max(1, Math.floor((nowMs - lastSeen) / 60000))
  if (minutes < 60) {
    return { type: 'recent', minutes }
  }

  return null
}

const buildPresencePatch = (payload, onlineOverride) => {
  const userPayload = payload?.user || payload?.profile || {}
  const userId = normalizeId(payload?.userId || userPayload?._id || userPayload?.userId || userPayload?.id)
  const status = String(payload?.status || userPayload?.status || '').toLowerCase()
  const isOnline = onlineOverride ?? (status ? ['online', 'active'].includes(status) : Boolean(payload?.isOnline || userPayload?.isOnline))
  const receivedLastSeen =
    payload?.lastSeen ||
    payload?.lastSeenAt ||
    userPayload?.lastSeen ||
    userPayload?.lastSeenAt ||
    null
  const lastSeen = isOnline ? receivedLastSeen : (receivedLastSeen || Date.now())

  return {
    userId,
    patch: {
      ...userPayload,
      isOnline,
      ...(lastSeen ? { lastSeen, lastSeenAt: lastSeen } : {}),
    },
  }
}

const updatePresenceForConversation = (item, userId, patch = {}) => {
  const conversation = item?.conversation || item
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : []
  let changed = false

  const nextParticipants = participants.map((participant) => {
    const participantId = normalizeId(participant?._id || participant?.userId || participant?.id || participant)
    if (participantId !== userId) return participant
    changed = true

    if (participant && typeof participant === 'object') {
      return {
        ...participant,
        ...patch,
        _id: participant?._id || userId,
        userId: participant?.userId || userId,
      }
    }

    return {
      ...patch,
      _id: userId,
      userId,
    }
  })

  if (!changed) return item

  const nextConversation = {
    ...conversation,
    participants: nextParticipants,
  }

  if (item?.conversation) {
    return {
      ...item,
      conversation: nextConversation,
    }
  }

  return nextConversation
}

const updatePresenceForUsers = (users = [], userId, patch = {}) => (
  (users || []).map((item) => {
    const itemId = normalizeId(item?.userId || item?._id || item?.id)
    return itemId === userId ? { ...item, ...patch, _id: item?._id || userId, userId: item?.userId || userId } : item
  })
)

const getAvatarUri = (conversation, currentUserId) => {
  const conversationAvatar = getAvatarValue(conversation)
  if (conversationAvatar) return String(conversationAvatar)
  const participant = getParticipantObject(conversation, currentUserId)
  if (participant && typeof participant === 'object') {
    const participantAvatar = getAvatarValue(participant)
    return participantAvatar ? String(participantAvatar) : ''
  }
  return ''
}

const getInitials = (name) => {
  const cleaned = String(name || '').trim()
  if (!cleaned) return 'TC'
  const parts = cleaned.split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('')
}

const getUserDisplayName = (user) => {
  if (!user) return 'Người dùng'
  return String(user?.nickname || user?.displayName || user?.fullName || user?.username || 'Người dùng')
}

const getUserAvatarUri = (user) => {
  const avatar = getAvatarValue(user)
  return avatar ? String(avatar) : ''
}

const getDirectConversationByUserId = (conversations, currentUserId, targetUserId) => {
  const normalizedTargetUserId = normalizeId(targetUserId)
  return (conversations || []).find((conversation) => {
    if (conversation?.type !== '1-1' && conversation?.type !== 'direct') return false
    const participant = getParticipantObject(conversation, currentUserId)
    return normalizeId(participant?._id || participant?.userId || participant) === normalizedTargetUserId
  }) || null
}

const getPreviewText = (conversation, currentUserId) => {
  const latest = conversation?.latestMessage || conversation?.lastMessage || null
  if (!latest) return 'Chưa có tin nhắn'

  const senderId = normalizeId(latest?.sender?._id || latest?.senderId || latest?.sender)
  const senderName =
    latest?.sender?.name ||
    latest?.sender?.nickname ||
    latest?.sender?.displayName ||
    latest?.sender?.fullName ||
    latest?.sender?.username ||
    ''

  const isMine = senderId && senderId === normalizeId(currentUserId)
  const content = latest?.content || latest?.text || latest?.message || ''
  const hasAttachment = Array.isArray(latest?.attachments)
    ? latest.attachments.length > 0
    : Boolean(latest?.fileUrl || latest?.attachmentUrl)

  const body = content || (hasAttachment ? 'Đã gửi một file đính kèm' : '[Tệp đính kèm]')

  if (isMine) return `Bạn: ${body}`
  if (senderName && conversation?.type !== '1-1') return `${senderName}: ${body}`
  return body
}

const buildStories = (conversations, currentUserId) => {
  const stories = []

  const seen = new Set()
  for (const conversation of conversations || []) {
    const participant = getParticipantObject(conversation, currentUserId)
    const participantId = normalizeId(participant?._id || participant?.userId || participant)
    if (!participantId || seen.has(participantId)) continue

    seen.add(participantId)
    stories.push({
      id: participantId,
      label: getConversationName(conversation, currentUserId),
      isAdd: false,
      avatar: getAvatarUri(conversation, currentUserId),
      conversation,
      presenceSources: getParticipantPresenceSources(conversation, currentUserId),
    })

    if (stories.length >= 6) break
  }

  return stories
}

export default function ConversationListScreen({
  user,
  conversations,
  unreadByConversation,
  loading,
  onOpenConversation,
  onRefresh,
  onOpenProfile,
  onOpenFriends,
  onOpenUrban,
  onOpenCalls,
  onOpenAssistant,
  onOpenCreateGroup,
  onLogout,
  onStartConversation,
  friendRequestCount,
}) {
  const insets = useSafeAreaInsets()
  const [searchText, setSearchText] = useState('')
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [searchResults, setSearchResults] = useState({ conversations: [], users: [], suggestions: [] })
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [searchActionLoading, setSearchActionLoading] = useState({})
  const [presenceNow, setPresenceNow] = useState(() => Date.now())
  const bottomInset = Math.max(insets.bottom, 8)
  const tabBarHeight = 64 + bottomInset

  const filteredConversations = useMemo(() => {
    const keyword = String(searchText || '').trim().toLowerCase()
    if (!keyword) return conversations

    return (conversations || []).filter((conversation) => {
      const name = getConversationName(conversation, user?._id || user?.userId).toLowerCase()
      const latest = getLatestMessage(conversation).toLowerCase()
      return name.includes(keyword) || latest.includes(keyword)
    })
  }, [conversations, searchText, user])

  const stories = useMemo(
    () => buildStories(conversations, user?._id || user?.userId),
    [conversations, user]
  )

  const keyword = String(searchText || '').trim()
  const showingSearchResults = Boolean(keyword)
  const matchedConversations = useMemo(
    () => searchResults?.conversations || [],
    [searchResults]
  )
  const visibleSearchUsers = useMemo(() => {
    const directUsers = Array.isArray(searchResults?.users) ? searchResults.users : []
    if (directUsers.length > 0) return directUsers
    return Array.isArray(searchResults?.suggestions) ? searchResults.suggestions : []
  }, [searchResults])
  const showingSuggestedUsers = !searchResults?.users?.length && Boolean(searchResults?.suggestions?.length)

  useEffect(() => {
    let cancelled = false
    if (!keyword) {
      setSearchResults({ conversations: [], users: [], suggestions: [] })
      setSearchingUsers(false)
      return undefined
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true)
      try {
        const response = await conversationService.searchConversations(keyword)
        if (cancelled) return
        setSearchResults({
          conversations: response?.data?.conversations || [],
          users: response?.data?.users || [],
          suggestions: response?.data?.suggestions || [],
        })
      } catch (_) {
        if (!cancelled) {
          setSearchResults({ conversations: [], users: [], suggestions: [] })
        }
      } finally {
        if (!cancelled) setSearchingUsers(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [keyword])

  useEffect(() => {
    const timer = setInterval(() => setPresenceNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return undefined

    const applyPresence = (payload, onlineOverride) => {
      const { userId, patch } = buildPresencePatch(payload, onlineOverride)
      if (!userId) return

      setSearchResults((current) => ({
        conversations: (current?.conversations || []).map((item) => updatePresenceForConversation(item, userId, patch)),
        users: updatePresenceForUsers(current?.users || [], userId, patch),
        suggestions: updatePresenceForUsers(current?.suggestions || [], userId, patch),
      }))
      setPresenceNow(Date.now())
    }

    const handleOnline = (payload) => applyPresence(payload, true)
    const handleOffline = (payload) => applyPresence(payload, false)
    const handlePresence = (payload) => applyPresence(payload)

    socket.on('user:online', handleOnline)
    socket.on('user:offline', handleOffline)
    socket.on('user:presence', handlePresence)

    return () => {
      socket.off('user:online', handleOnline)
      socket.off('user:offline', handleOffline)
      socket.off('user:presence', handlePresence)
    }
  }, [])

  const renderAvatar = (name, avatarUri, size = 54) => {
    if (avatarUri) {
      return <Image source={{ uri: avatarUri }} style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]} />
    }

    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarFallbackText, { fontSize: size > 42 ? 16 : 12 }]}>{getInitials(name)}</Text>
      </View>
    )
  }

  const renderPresenceBadge = (source, badgeStyle) => {
    const presence = getPresenceState(source, presenceNow)
    if (!presence) return null

    if (presence.type === 'online') {
      return <View style={[styles.presenceOnlineDot, badgeStyle]} />
    }

    return (
      <View style={[styles.presenceMinutesBadge, badgeStyle]}>
        <Text style={styles.presenceMinutesText}>{presence.minutes}p</Text>
      </View>
    )
  }

  const listData = loading ? [] : filteredConversations

  const withSearchActionLoading = useCallback(async (key, action) => {
    setSearchActionLoading((current) => ({ ...current, [key]: true }))
    try {
      await action()
    } finally {
      setSearchActionLoading((current) => ({ ...current, [key]: false }))
    }
  }, [])

  const renderSearchUserItem = ({ item }) => {
    const targetUserId = normalizeId(item?.userId || item?._id)
    const isFriend = Boolean(item?.isFriend || item?.relationStatus === 'friend')
    const existingConversation = getDirectConversationByUserId(conversations, user?._id || user?.userId, targetUserId)
    const hasConversation = existingConversation || item?.existingConversationId
    const requestSent = Boolean(item?.requestSent || item?.relationStatus === 'request_sent')
    const requestReceived = Boolean(item?.requestReceived || item?.relationStatus === 'request_received')
    const actionKey = `user-${targetUserId}`

    return (
      <View style={styles.searchResultUserRow}>
        <View style={styles.searchAvatarWrap}>
          {renderAvatar(getUserDisplayName(item), getUserAvatarUri(item), 48)}
          {renderPresenceBadge(item, styles.searchPresenceBadge)}
        </View>
        <View style={styles.searchResultUserMain}>
          <Text numberOfLines={1} style={styles.searchResultUserName}>{getUserDisplayName(item)}</Text>
          <Text numberOfLines={1} style={styles.searchResultUserMeta}>
            {isFriend
              ? hasConversation
                ? 'Đã kết bạn • Mở cuộc trò chuyện cũ'
                : 'Đã kết bạn • Tạo cuộc trò chuyện mới'
              : requestReceived
                ? 'Đã nhận lời mời • Mở danh bạ để phản hồi'
                : requestSent
                  ? 'Đã gửi lời mời kết bạn'
                  : 'Chưa là bạn bè • Gửi lời mời kết bạn'}
          </Text>
        </View>
        <Pressable
          style={[styles.searchActionButton, !isFriend && styles.searchActionButtonSecondary]}
          disabled={searchActionLoading[actionKey] || requestSent}
          onPress={() => withSearchActionLoading(actionKey, async () => {
            if (isFriend) {
              if (existingConversation) {
                onOpenConversation?.(existingConversation)
                return
              }
              await onStartConversation?.(targetUserId)
              return
            }
            if (requestReceived) {
              onOpenFriends?.()
              return
            }
            await userService.sendFriendRequest(targetUserId)
            setSearchResults((current) => ({
              ...current,
              users: (current.users || []).map((userItem) => (
                normalizeId(userItem?.userId || userItem?._id) === targetUserId
                  ? { ...userItem, requestSent: true, relationStatus: 'request_sent' }
                  : userItem
              )),
              suggestions: (current.suggestions || []).map((userItem) => (
                normalizeId(userItem?.userId || userItem?._id) === targetUserId
                  ? { ...userItem, requestSent: true, relationStatus: 'request_sent' }
                  : userItem
              )),
            }))
          })}
        >
          {searchActionLoading[actionKey] ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchActionButtonText}>
              {isFriend ? (hasConversation ? 'Mở chat' : 'Nhắn tin') : (requestReceived ? 'Danh bạ' : (requestSent ? 'Đã gửi' : 'Kết bạn'))}
            </Text>
          )}
        </Pressable>
      </View>
    )
  }

  const renderSearchConversationItem = ({ item }) => {
    const conversation = item?.conversation || item
    const title = getConversationName(conversation, user?._id || user?.userId)
    const previewText = getPreviewText(conversation, user?._id || user?.userId)
    const avatarUri = getAvatarUri(conversation, user?._id || user?.userId)
    const matchCount = Number(item?.matchCount || conversation?.matchCount || 1)
    const presenceSources = getParticipantPresenceSources(conversation, user?._id || user?.userId)

    return (
      <Pressable
        style={({ pressed }) => [styles.searchConversationRow, pressed && styles.rowPressed]}
        onPress={() => onOpenConversation?.(conversation)}
      >
        <View style={styles.searchAvatarWrap}>
          {renderAvatar(title, avatarUri, 48)}
          {renderPresenceBadge(presenceSources, styles.searchPresenceBadge)}
        </View>
        <View style={styles.searchConversationMain}>
          <View style={styles.searchConversationHead}>
            <Text numberOfLines={1} style={styles.searchConversationTitle}>{title}</Text>
            <View style={styles.searchMatchBadge}>
              <Text style={styles.searchMatchBadgeText}>{matchCount} khớp</Text>
            </View>
          </View>
          <Text numberOfLines={2} style={styles.searchConversationMeta}>{previewText}</Text>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 4 }]}>
        <View style={styles.appBrandRow}>
          <View style={styles.appBrandMark}>
            <Text style={styles.appBrandMarkText}>T</Text>
          </View>
          <Text numberOfLines={1} style={styles.appBrandName}>TixChat</Text>
        </View>

        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm kiếm"
            placeholderTextColor="#7A8BA8"
            autoCapitalize="none"
          />
        </View>
      </View>

      {showingSearchResults ? (
        <FlatList
          data={visibleSearchUsers}
          keyExtractor={(item) => normalizeId(item?.userId || item?._id)}
          contentContainerStyle={[styles.listContent, styles.searchContent, { paddingBottom: tabBarHeight + 36 }]}
          ListHeaderComponent={
            <View style={styles.searchSectionStack}>
              <View style={styles.searchSection}>
                <Text style={styles.searchSectionTitle}>Tin nhắn và cuộc trò chuyện</Text>
                <Text style={styles.searchSectionSubtitle}>
                  {matchedConversations.length
                    ? `${matchedConversations.length} cuộc trò chuyện có nội dung khớp`
                    : 'Chưa có cuộc trò chuyện nào khớp từ khóa'}
                </Text>
                {matchedConversations.map((item, index) => {
                  const conversation = item?.conversation || item
                  const conversationId = normalizeId(conversation?._id || conversation?.conversationId)
                  return (
                    <View key={conversationId || `search-conversation-${index}`}>
                      {renderSearchConversationItem({ item })}
                    </View>
                  )
                })}
              </View>

              <View style={styles.searchSection}>
                <Text style={styles.searchSectionTitle}>{showingSuggestedUsers ? 'Gợi ý kết bạn' : 'Người dùng'}</Text>
                <Text style={styles.searchSectionSubtitle}>
                  {showingSuggestedUsers
                    ? 'Không thấy kết quả khớp, đây là vài người bạn có thể kết bạn'
                    : 'Mở chat cũ, tạo chat mới hoặc kết bạn'}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            (matchedConversations.length || visibleSearchUsers.length) ? null : (
              <View style={styles.emptyWrap}>
                {searchingUsers ? (
                  <ActivityIndicator size="large" color="#1a73e8" />
                ) : (
                  <Text style={styles.emptyText}>Không tìm thấy kết quả phù hợp</Text>
                )}
              </View>
            )
          }
          renderItem={renderSearchUserItem}
          ListFooterComponent={searchingUsers ? <ActivityIndicator style={styles.searchLoader} color="#1a73e8" /> : null}
        />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => normalizeId(item?._id || item?.conversationId)}
          onRefresh={onRefresh}
          refreshing={loading}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 36 }]}
          ListHeaderComponent={stories.length > 0 ? (
            <View style={styles.storyWrap}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={stories}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.storyContent}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.storyItem}
                    onPress={() => {
                      if (item.isAdd) {
                        onOpenCreateGroup?.()
                        return
                      }

                      if (item.conversation) {
                        onOpenConversation?.(item.conversation)
                      }
                    }}
                  >
                    {item.isAdd ? (
                      <View style={styles.addStoryCircle}>
                        <Text style={styles.addStoryPlus}>＋</Text>
                      </View>
                    ) : (
                      <View style={styles.storyAvatarShell}>
                        <View style={styles.storyAvatarRing}>{renderAvatar(item.label, item.avatar, 58)}</View>
                        {renderPresenceBadge(item.presenceSources, styles.storyPresenceBadge)}
                      </View>
                    )}

                    <Text numberOfLines={1} style={styles.storyLabel}>
                      {item.label}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          ) : null}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyWrap}>
                <ActivityIndicator size="large" color="#1a73e8" />
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>Chưa có cuộc trò chuyện</Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const conversationId = normalizeId(item?._id || item?.conversationId)
            const unreadCount = Number(unreadByConversation?.[conversationId] || item?.unreadCount || 0)
            const title = getConversationName(item, user?._id || user?.userId)
            const previewText = getPreviewText(item, user?._id || user?.userId)
            const timeLabel = formatTimeLabel(getLatestTimestamp(item))
            const avatarUri = getAvatarUri(item, user?._id || user?.userId)
            const isPinned = Boolean(item?.isPinned || item?.pinnedAt)
            const presenceSources = getParticipantPresenceSources(item, user?._id || user?.userId)

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.itemRow,
                  unreadCount > 0 && styles.itemRowUnread,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => onOpenConversation(item)}
              >
                <View style={styles.itemAvatarWrap}>
                  {renderAvatar(title, avatarUri, 54)}
                  {renderPresenceBadge(presenceSources, styles.itemPresenceBadge)}
                </View>

                <View style={styles.itemMain}>
                  <View style={styles.itemTopLine}>
                    <Text numberOfLines={1} style={styles.itemTitle}>
                      {title}
                    </Text>
                    <Text style={[styles.itemTime, unreadCount > 0 && styles.itemTimeActive]}>{timeLabel}</Text>
                  </View>

                  <View style={styles.itemBottomLine}>
                    <Text numberOfLines={1} style={[styles.itemMessage, unreadCount > 0 && styles.itemMessageUnread]}>
                      {previewText}
                    </Text>

                    {unreadCount > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </View>
                    ) : isPinned ? (
                      <MaterialCommunityIcons name="pin-outline" style={styles.pinIcon} />
                    ) : (
                      <MaterialCommunityIcons name="check-all" style={styles.seenIcon} />
                    )}
                  </View>
                </View>
              </Pressable>
            )
          }}
        />
      )}

      <Pressable style={[styles.fabButton, { bottom: tabBarHeight + 18 }]} onPress={() => setShowNewConversation(true)}>
        <View style={styles.fabSheen} />
        <MaterialCommunityIcons name="plus" style={styles.fabIcon} />
      </Pressable>

      <NewConversationModal
        visible={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        currentUserId={user?._id || user?.userId}
        onStartConversation={async (targetUserId) => {
          setShowNewConversation(false)
          await onStartConversation?.(targetUserId)
        }}
        onPendingRequestsChange={(count) => {}}
      />

      <MobileBottomTabBar
        active="Chats"
        badges={{ Friends: friendRequestCount }}
        onNavigate={{
          Friends: onOpenFriends,
          Urban: onOpenUrban,
          Assistant: onOpenAssistant,
          Profile: onOpenProfile,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  headerRow: {
    paddingBottom: 14,
    paddingHorizontal: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.72)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  appBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  appBrandMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0f5ed7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    shadowColor: '#0f5ed7',
    shadowOpacity: 0.26,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  appBrandMarkText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  appBrandName: {
    flex: 1,
    color: '#101828',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  searchBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 22,
    height: 46,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#edf2f7',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  searchIcon: {
    color: '#5783d8',
    fontSize: 21,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#172033',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
  },
  storyWrap: {
    backgroundColor: '#fff',
    paddingTop: 14,
    paddingBottom: 14,
  },
  storyContent: {
    paddingHorizontal: 14,
    gap: 12,
  },
  storyItem: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  addStoryCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#bcc7da',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStoryPlus: {
    fontSize: 28,
    color: '#5a6476',
    fontWeight: '300',
    marginTop: -4,
  },
  storyAvatarShell: {
    padding: 3,
    borderRadius: 999,
    backgroundColor: '#eaf2ff',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  storyAvatarRing: {
    borderWidth: 2,
    borderColor: '#2f80ed',
    borderRadius: 999,
    padding: 2,
    backgroundColor: '#fff',
  },
  presenceOnlineDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  presenceMinutesBadge: {
    position: 'absolute',
    minWidth: 25,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: '#eaf2ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  presenceMinutesText: {
    color: '#1d4ed8',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
  storyPresenceBadge: {
    right: 0,
    bottom: 4,
  },
  storyLabel: {
    marginTop: 9,
    color: '#263244',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { backgroundColor: '#fff', flexGrow: 1 },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 56,
  },
  emptyText: { color: '#6b7280' },
  searchContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  searchSectionStack: {
    gap: 14,
    paddingBottom: 8,
  },
  searchSection: {
    gap: 8,
  },
  searchSectionTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  searchSectionSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
  },
  searchConversationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchConversationMain: {
    flex: 1,
    minWidth: 0,
  },
  searchConversationHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchConversationTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  searchConversationMeta: {
    marginTop: 4,
    color: '#667085',
    fontSize: 14,
    lineHeight: 19,
  },
  searchMatchBadge: {
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  searchMatchBadgeText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700',
  },
  searchResultUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eff1f5',
  },
  searchAvatarWrap: {
    borderRadius: 999,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchPresenceBadge: {
    right: -2,
    bottom: 1,
  },
  searchResultUserMain: {
    flex: 1,
    minWidth: 0,
  },
  searchResultUserName: {
    color: '#101828',
    fontSize: 15,
    fontWeight: '700',
  },
  searchResultUserMeta: {
    marginTop: 3,
    color: '#667085',
    fontSize: 13,
  },
  searchActionButton: {
    minHeight: 36,
    minWidth: 82,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#0f5ed7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchActionButtonSecondary: {
    backgroundColor: '#2563eb',
  },
  searchActionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  searchLoader: {
    marginTop: 12,
  },
  itemRow: {
    flexDirection: 'row',
    marginHorizontal: 10,
    marginVertical: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemRowUnread: {
    backgroundColor: '#fff8f8',
    borderColor: '#fee2e2',
    shadowColor: '#ef4444',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  rowPressed: {
    backgroundColor: '#f3f7ff',
    transform: [{ scale: 0.99 }],
  },
  avatarImage: {
    backgroundColor: '#dbe3f0',
  },
  avatarFallback: {
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  itemAvatarWrap: {
    borderRadius: 999,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  itemPresenceBadge: {
    right: -3,
    bottom: 1,
  },
  itemMain: {
    flex: 1,
    marginLeft: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    minHeight: 56,
  },
  itemTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemBottomLine: {
    marginTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: { fontSize: 16, fontWeight: '800', color: '#111827', flex: 1, marginRight: 8 },
  itemMessage: { color: '#667085', fontSize: 14, lineHeight: 19, flex: 1, marginRight: 8 },
  itemMessageUnread: { fontWeight: '700', color: '#27364a' },
  itemTime: { color: '#98a2b3', fontSize: 12, fontWeight: '600' },
  itemTimeActive: { color: '#dc2626', fontWeight: '800' },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    paddingHorizontal: 6,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  pinIcon: { fontSize: 16, color: '#2558bd' },
  seenIcon: { color: '#9ca3af', fontSize: 15 },
  fabButton: {
    position: 'absolute',
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0f5ed7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#0f5ed7',
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  fabSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  fabIcon: {
    color: '#fff',
    fontSize: 31,
  },
  bottomTabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    zIndex: 40,
    elevation: 16,
  },
  tabItem: {
    alignItems: 'center',
    width: '20%',
  },
  tabIcon: {
    fontSize: 21,
    color: '#94a3b8',
  },
  tabIconActive: {
    color: '#0f5ed7',
  },
  tabLabel: {
    marginTop: 3,
    color: '#94a3b8',
    fontSize: 12,
  },
  tabLabelActive: {
    color: '#0f5ed7',
    fontWeight: '600',
  },
})
