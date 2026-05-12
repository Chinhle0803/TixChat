import React, { useMemo, useState } from 'react'
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

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') return String(value._id || value.userId || value.id || '')
  return String(value)
}

const getConversationName = (conversation, currentUserId) => {
  if (conversation?.name) return conversation.name

  if (conversation?.type === '1-1') {
    const participants = conversation?.participants || []
    const other = participants.find((p) => normalizeId(p?._id || p?.userId || p) !== normalizeId(currentUserId))

    if (typeof other === 'object') {
      return (
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
  if (conversation?.type === '1-1') {
    return (
      participants.find((p) => normalizeId(p?._id || p?.userId || p) !== normalizeId(currentUserId)) ||
      participants[0] ||
      null
    )
  }

  return participants[0] || null
}

const getAvatarUri = (conversation, currentUserId) => {
  if (conversation?.avatar) return String(conversation.avatar)
  const participant = getParticipantObject(conversation, currentUserId)
  if (participant && typeof participant === 'object') {
    return String(participant?.avatar || participant?.photoURL || participant?.profilePicture || '')
  }
  return ''
}

const getInitials = (name) => {
  const cleaned = String(name || '').trim()
  if (!cleaned) return 'TC'
  const parts = cleaned.split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('')
}

const getPreviewText = (conversation, currentUserId) => {
  const latest = conversation?.latestMessage || conversation?.lastMessage || null
  if (!latest) return 'Chưa có tin nhắn'

  const senderId = normalizeId(latest?.sender?._id || latest?.senderId || latest?.sender)
  const senderName =
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
  const stories = [
    {
      id: 'my-story',
      label: 'Tin của bạn',
      isAdd: true,
      avatar: '',
      conversation: null,
    },
  ]

  const seen = new Set(['my-story'])
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

  const listData = loading ? [] : filteredConversations

  return (
    <View style={styles.container}>
  <View style={[styles.headerRow, { paddingTop: insets.top + 4 }]}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm kiếm"
            placeholderTextColor="#5b87e6"
            autoCapitalize="none"
          />
        </View>

        <Pressable style={styles.headerIconButton} onPress={onOpenFriends}>
          <MaterialCommunityIcons name="account-plus-outline" style={styles.headerIconText} />
        </Pressable>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => normalizeId(item?._id || item?.conversationId)}
        onRefresh={onRefresh}
        refreshing={loading}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 36 }]}
        ListHeaderComponent={
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
                    <View style={styles.storyAvatarRing}>{renderAvatar(item.label, item.avatar, 58)}</View>
                  )}

                  <Text numberOfLines={1} style={styles.storyLabel}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        }
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

          return (
            <Pressable style={styles.itemRow} onPress={() => onOpenConversation(item)}>
              {renderAvatar(title, avatarUri, 52)}

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

      <Pressable style={[styles.fabButton, { bottom: tabBarHeight + 18 }]} onPress={() => setShowNewConversation(true)}>
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

      <View style={[styles.bottomTabBar, { height: tabBarHeight, paddingBottom: bottomInset }]}>
        <MobileBottomTabBar
          active="Chats"
          onNavigate={{
            Calls: onOpenCalls,
            Urban: onOpenUrban,
            Assistant: onOpenAssistant,
            Profile: onOpenProfile,
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  headerRow: {
    paddingBottom: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f8f9fb',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 22,
    height: 42,
    paddingHorizontal: 14,
  },
  searchIcon: {
    color: '#0f5ed7',
    fontSize: 22,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#0f5ed7',
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 0,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    color: '#0f5ed7',
    fontSize: 20,
  },
  storyWrap: {
    backgroundColor: '#f8f9fb',
    paddingBottom: 12,
  },
  storyContent: {
    paddingHorizontal: 8,
    gap: 8,
  },
  storyItem: {
    width: 84,
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
  storyAvatarRing: {
    borderWidth: 2,
    borderColor: '#0f5ed7',
    borderRadius: 999,
    padding: 2,
  },
  storyLabel: {
    marginTop: 8,
    color: '#1f2937',
    fontSize: 14,
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
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#fff',
    alignItems: 'flex-start',
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
  itemMain: {
    flex: 1,
    marginLeft: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eff1f5',
    paddingBottom: 10,
  },
  itemTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemBottomLine: {
    marginTop: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#101828', flex: 1, marginRight: 8 },
  itemMessage: { color: '#3f3f46', fontSize: 15, flex: 1, marginRight: 8 },
  itemMessageUnread: { fontWeight: '500', color: '#111827' },
  itemTime: { color: '#9ca3af', fontSize: 12 },
  itemTimeActive: { color: '#165de8', fontWeight: '600' },
  unreadBadge: {
    minWidth: 22,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#d31e1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  pinIcon: { fontSize: 16, color: '#2558bd' },
  seenIcon: { color: '#9ca3af', fontSize: 15 },
  fabButton: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0f5ed7',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 32,
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
