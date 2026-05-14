import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { conversationApi, userApi } from '../services/api'
import { MobileBottomTabBar } from './ui'

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') {
    return String(value._id || value.userId || value.id || '')
  }
  return String(value)
}

const getDisplayName = (user) => {
  if (!user) return 'Người dùng'
  return user.nickname || user.displayName || user.fullName || user.name || user.username || 'Người dùng'
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

  return values.find((item) => typeof item === 'string' && item.trim()) || ''
}

const getAvatarUri = (user) => String(getAvatarValue(user))

const userMatchesKeyword = (user, keyword) => {
  const text = [
    user?.nickname,
    user?.displayName,
    user?.fullName,
    user?.name,
    user?.username,
    user?.email,
    user?.phone,
    user?.phoneNumber,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return text.includes(String(keyword || '').trim().toLowerCase())
}

const getConversationCounterpart = (conversation, currentUserId) => {
  const participants = conversation?.participants || []
  return participants.find((participant) => (
    normalizeId(participant?.userId || participant?._id || participant?.id || participant) !== normalizeId(currentUserId)
  )) || null
}

const buildSearchUserFromConversation = (conversation, currentUserId) => {
  const counterpart = getConversationCounterpart(conversation, currentUserId)
  if (!counterpart || typeof counterpart !== 'object') return null

  return {
    ...counterpart,
    isFriend: true,
    relationStatus: 'friend',
    existingConversationId: normalizeId(conversation?._id || conversation?.conversationId),
  }
}

const dedupeUsers = (users) => {
  const seen = new Set()
  const result = []

  ;(users || []).forEach((user) => {
    const userId = normalizeId(user?.userId || user?._id || user?.id)
    if (!userId || seen.has(userId)) return
    seen.add(userId)
    result.push(user)
  })

  return result
}

const getStatusLabel = (user) => {
  if (user?.isOnline) return 'Đang hoạt động'
  if (user?.lastSeenAt) {
    const date = new Date(user.lastSeenAt)
    if (!Number.isNaN(date.getTime())) {
      return `Hoạt động ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
    }
  }
  return 'Vừa mới truy cập'
}

const getErrorMessage = (error, fallback) =>
  String(error?.response?.data?.error || error?.response?.data?.message || fallback)

const Avatar = ({ user, size = 54, showOnlineDot = false }) => {
  const avatarUri = getAvatarUri(user)
  const displayName = getDisplayName(user)

  if (avatarUri) {
    return (
      <View style={styles.avatarWrap}>
        <Image source={{ uri: avatarUri }} style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]} />
        {showOnlineDot ? <View style={styles.onlineDot} /> : null}
      </View>
    )
  }

  return (
    <View style={styles.avatarWrap}>
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.avatarFallbackText}>{String(displayName).slice(0, 1).toUpperCase()}</Text>
      </View>
      {showOnlineDot ? <View style={styles.onlineDot} /> : null}
    </View>
  )
}

export default function FriendHubScreen({
  currentUserId,
  onStartConversation,
  onOpenConversations,
  onOpenUrban,
  onOpenAssistant,
  onOpenProfile,
}) {
  const insets = useSafeAreaInsets()

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [friendUsers, setFriendUsers] = useState([])
  const [friendIds, setFriendIds] = useState([])
  const [pendingRequestIds, setPendingRequestIds] = useState([])
  const [pendingRequestUsers, setPendingRequestUsers] = useState([])
  const [sentRequestIds, setSentRequestIds] = useState([])
  const [showingSuggestedUsers, setShowingSuggestedUsers] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  const [error, setError] = useState('')
  const searchInputRef = useRef(null)

  const friendSet = useMemo(() => new Set(friendIds.map((id) => normalizeId(id))), [friendIds])
  const pendingSet = useMemo(() => new Set(pendingRequestIds.map((id) => normalizeId(id))), [pendingRequestIds])
  const sentSet = useMemo(() => new Set(sentRequestIds.map((id) => normalizeId(id))), [sentRequestIds])

  const refreshData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [friendsResponse, requestsResponse, profileResponse] = await Promise.all([
        userApi.getFriends(),
        userApi.getFriendRequests(),
        userApi.getCurrentProfile(),
      ])

      const nextFriends = friendsResponse?.data?.friends || []
      const nextRequests = requestsResponse?.data?.requests || []
      const nextSent = profileResponse?.data?.user?.friendRequestsSent || []

      setFriendIds(nextFriends)
      setPendingRequestIds(nextRequests)
      setSentRequestIds(nextSent)

      const [pendingProfiles, friendProfiles] = await Promise.all([
        Promise.allSettled(
          nextRequests.map(async (userId) => {
            const response = await userApi.getProfile(userId)
            return response?.data?.user || null
          })
        ),
        Promise.allSettled(
          nextFriends.map(async (userId) => {
            const response = await userApi.getProfile(userId)
            return response?.data?.user || null
          })
        ),
      ])

      setPendingRequestUsers(
        pendingProfiles
          .filter((item) => item.status === 'fulfilled' && item.value)
          .map((item) => item.value)
      )

      setFriendUsers(
        friendProfiles
          .filter((item) => item.status === 'fulfilled' && item.value)
          .map((item) => item.value)
      )
    } catch (refreshError) {
      setError(getErrorMessage(refreshError, 'Không tải được dữ liệu bạn bè'))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refreshData()
  }, [refreshData])

  const handleQueryChange = (value) => {
    setQuery(value)
    if (!String(value || '').trim()) {
      setSearchResults([])
      setShowingSuggestedUsers(false)
      setHasSearched(false)
    }
  }

  const handleSearch = async () => {
    const keyword = query.trim()
    if (!keyword) {
      setSearchResults([])
      setShowingSuggestedUsers(false)
      setHasSearched(false)
      return
    }

    setSearching(true)
    setError('')
    setHasSearched(true)
    try {
      const response = await conversationApi.searchConversations(keyword)
      const users = response?.data?.users || []
      const suggestions = response?.data?.suggestions || []
      const conversationUsers = (response?.data?.conversations || [])
        .map((conversation) => buildSearchUserFromConversation(conversation, currentUserId))
        .filter(Boolean)
      const localFriendMatches = friendUsers
        .filter((friendUser) => userMatchesKeyword(friendUser, keyword))
        .map((friendUser) => ({
          ...friendUser,
          isFriend: true,
          relationStatus: 'friend',
        }))

      const directMatches = dedupeUsers([
        ...conversationUsers,
        ...users,
        ...localFriendMatches,
      ]).filter((u) => normalizeId(u.userId || u._id || u.id) !== normalizeId(currentUserId))

      const shouldShowSuggestions = directMatches.length === 0 && suggestions.length > 0
      const nextResults = shouldShowSuggestions
        ? suggestions.filter((u) => normalizeId(u.userId || u._id || u.id) !== normalizeId(currentUserId))
        : directMatches

      setShowingSuggestedUsers(shouldShowSuggestions)
      setSearchResults(nextResults)
    } catch (searchError) {
      setError(getErrorMessage(searchError, 'Không thể tìm kiếm người dùng'))
      setSearchResults([])
      setShowingSuggestedUsers(false)
    } finally {
      setSearching(false)
    }
  }

  const withActionLoading = async (key, action) => {
    setActionLoading((prev) => ({ ...prev, [key]: true }))
    try {
      await action()
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleSendRequest = async (userId) => {
    await withActionLoading(`send-${userId}`, async () => {
      await userApi.sendFriendRequest(userId)
      await refreshData()
    })
  }

  const handleAcceptRequest = async (userId) => {
    await withActionLoading(`accept-${userId}`, async () => {
      await userApi.acceptFriendRequest(userId)
      await refreshData()
      await onStartConversation?.(userId)
    })
  }

  const handleRejectRequest = async (userId) => {
    await withActionLoading(`reject-${userId}`, async () => {
      await userApi.rejectFriendRequest(userId)
      await refreshData()
    })
  }

  const handleRemoveFriend = async (userId) => {
    await withActionLoading(`unfriend-${userId}`, async () => {
      await userApi.removeFriend(userId)
      await refreshData()
    })
  }

  const firstInvitation = pendingRequestUsers[0] || null

  return (
    <View style={styles.screen}>
      <View style={[styles.topHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={[styles.searchInputWrap, styles.headerSearchInputWrap]}
          onPress={() => searchInputRef.current?.focus?.()}
        >
          <MaterialCommunityIcons name="magnify" style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Tìm bạn bè theo tên hoặc số điện thoại"
            placeholderTextColor="#667085"
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <Pressable style={styles.searchAction} onPress={handleSearch} disabled={searching}>
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchActionText}>Tìm</Text>
            )}
          </Pressable>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {searchResults.length > 0 || hasSearched ? (
          <View style={styles.searchResultWrap}>
            <Text style={styles.searchResultTitle}>{showingSuggestedUsers ? 'Gợi ý kết bạn' : 'Kết quả tìm kiếm'}</Text>
            {searching ? <ActivityIndicator color="#0f5ed7" /> : null}
            {searchResults.map((user) => {
              const userId = normalizeId(user.userId || user._id || user.id)
              const isFriend = Boolean(user?.isFriend || user?.relationStatus === 'friend' || friendSet.has(userId))
              const isPending = Boolean(user?.requestReceived || user?.relationStatus === 'request_received' || pendingSet.has(userId))
              const isSent = Boolean(user?.requestSent || user?.relationStatus === 'request_sent' || sentSet.has(userId))

              return (
                <View key={userId} style={styles.searchResultRow}>
                  <Avatar user={user} />
                  <View style={styles.friendInfo}>
                    <Text numberOfLines={1} style={styles.friendName}>{getDisplayName(user)}</Text>
                    <Text numberOfLines={2} style={styles.friendStatus}>
                      {isFriend
                        ? user?.existingConversationId
                          ? 'Đã kết bạn • Mở cuộc trò chuyện cũ'
                          : 'Đã kết bạn • Tạo cuộc trò chuyện mới'
                        : isPending
                          ? 'Đã nhận lời mời kết bạn'
                          : isSent
                            ? 'Đã gửi lời mời kết bạn'
                            : 'Chưa là bạn bè • Gửi lời mời kết bạn'}
                    </Text>
                  </View>

                  {isFriend ? (
                    <Pressable style={styles.acceptBtn} onPress={() => onStartConversation?.(userId)}>
                      <Text style={styles.acceptBtnText}>Nhắn tin</Text>
                    </Pressable>
                  ) : isPending ? (
                    <Pressable style={styles.acceptBtn} onPress={() => handleAcceptRequest(userId)}>
                      <Text style={styles.acceptBtnText}>Đồng ý</Text>
                    </Pressable>
                  ) : isSent ? (
                    <View style={styles.sentBtn}>
                      <Text style={styles.sentBtnText}>Đã gửi</Text>
                    </View>
                  ) : (
                    <Pressable style={styles.acceptBtn} onPress={() => handleSendRequest(userId)}>
                      <Text style={styles.acceptBtnText}>Kết bạn</Text>
                    </Pressable>
                  )}
                </View>
              )
            })}
            {!searching && searchResults.length === 0 ? (
              <Text style={styles.emptyText}>Không có gợi ý phù hợp</Text>
            ) : null}
          </View>
        ) : null}


        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Lời mời kết bạn</Text>
          <Pressable onPress={refreshData}>
            <Text style={styles.sectionAction}>Xem tất cả</Text>
          </Pressable>
        </View>

        <View style={styles.invitationCard}>
          {loading ? (
            <ActivityIndicator color="#0f5ed7" />
          ) : firstInvitation ? (
            <View style={styles.invitationContent}>
              <Avatar user={firstInvitation} size={76} />
              <View style={styles.invitationInfo}>
                <Text numberOfLines={1} style={styles.invitationName}>{getDisplayName(firstInvitation)}</Text>
                <Text style={styles.invitationMeta}>TỪ GỢI Ý KẾT BẠN</Text>
              </View>
              <Pressable
                style={styles.acceptBtn}
                onPress={() => handleAcceptRequest(normalizeId(firstInvitation.userId || firstInvitation._id))}
                disabled={Boolean(actionLoading[`accept-${normalizeId(firstInvitation.userId || firstInvitation._id)}`])}
              >
                <Text style={styles.acceptBtnText}>Đồng ý</Text>
              </Pressable>
              <Pressable
                style={styles.removeBtn}
                onPress={() => handleRejectRequest(normalizeId(firstInvitation.userId || firstInvitation._id))}
                disabled={Boolean(actionLoading[`reject-${normalizeId(firstInvitation.userId || firstInvitation._id)}`])}
              >
                <Text style={styles.removeBtnText}>Xóa</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.emptyText}>Không có lời mời kết bạn</Text>
          )}
        </View>

        <View style={[styles.sectionHeaderRow, styles.friendTitleRow]}>
          <Text style={styles.sectionTitle}>Danh sách bạn bè</Text>
          <View style={styles.friendHeaderActions}>
            <MaterialCommunityIcons name="sort-alphabetical-ascending" style={styles.smallHeaderIcon} />
            <MaterialCommunityIcons name="filter-variant" style={styles.smallHeaderIcon} />
          </View>
        </View>

        <View style={styles.friendListWrap}>
          {loading ? (
            <ActivityIndicator color="#0f5ed7" />
          ) : friendUsers.length === 0 ? (
            <Text style={styles.emptyText}>Bạn chưa có bạn bè nào</Text>
          ) : (
            friendUsers.map((friendUser) => {
              const userId = normalizeId(friendUser.userId || friendUser._id)
              return (
                <View key={userId} style={styles.friendRow}>
                  <Avatar user={friendUser} showOnlineDot={Boolean(friendUser?.isOnline)} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{getDisplayName(friendUser)}</Text>
                    <Text style={styles.friendStatus}>{getStatusLabel(friendUser)}</Text>
                  </View>

                  <Pressable style={styles.roundActionBtn} onPress={() => onStartConversation?.(userId)}>
                    <MaterialCommunityIcons name="message-text-outline" style={styles.roundActionIcon} />
                  </Pressable>

                  <Pressable
                    style={styles.roundActionBtn}
                    onPress={() => handleRemoveFriend(userId)}
                    disabled={Boolean(actionLoading[`unfriend-${userId}`])}
                  >
                    <MaterialCommunityIcons name="account-minus-outline" style={styles.roundActionIcon} />
                  </Pressable>
                </View>
              )
            })
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <MobileBottomTabBar
        active="Friends"
        badges={{ Friends: pendingRequestIds.length }}
        onNavigate={{
          Chats: onOpenConversations,
          Urban: onOpenUrban,
          Assistant: onOpenAssistant,
          Profile: onOpenProfile,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f2f4f7',
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e8edf4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 100,
  },
  searchInputWrap: {
    backgroundColor: '#e9edf3',
    borderRadius: 16,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 22,
    gap: 10,
  },
  headerSearchInputWrap: {
    flex: 1,
    minHeight: 48,
    marginBottom: 0,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
  },
  searchIcon: {
    fontSize: 28,
    color: '#69738a',
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#111827',
  },
  searchAction: {
    backgroundColor: '#0f5ed7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchActionText: {
    color: '#fff',
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    color: '#111827',
    fontWeight: '700',
  },
  sectionAction: {
    fontSize: 17,
    color: '#0f5ed7',
    fontWeight: '700',
  },
  invitationCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ecf0f5',
  },
  invitationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationName: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '700',
  },
  invitationMeta: {
    marginTop: 3,
    fontSize: 12,
    color: '#7b8398',
    letterSpacing: 0.4,
  },
  acceptBtn: {
    backgroundColor: '#0f5ed7',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  removeBtn: {
    backgroundColor: '#e4e7ec',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  removeBtnText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  sentBtn: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sentBtnText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '700',
  },
  friendTitleRow: {
    marginBottom: 6,
  },
  friendHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  smallHeaderIcon: {
    fontSize: 28,
    color: '#667085',
  },
  friendListWrap: {
    marginBottom: 20,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
  },
  friendInfo: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  friendStatus: {
    marginTop: 3,
    color: '#667085',
    fontSize: 16,
  },
  roundActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e7ebf0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundActionIcon: {
    fontSize: 22,
    color: '#1f2937',
  },
  searchResultWrap: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#ecf0f5',
  },
  searchResultTitle: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 17,
    marginBottom: 8,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImage: {
    backgroundColor: '#dbe4f1',
  },
  avatarFallback: {
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 18,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    paddingVertical: 2,
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 8,
  },
  bottomTabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#dfe5ee',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 6,
  },
  tabItem: {
    width: '20%',
    alignItems: 'center',
  },
  tabIcon: {
    color: '#94a3b8',
    fontSize: 22,
  },
  tabIconActive: {
    color: '#0f5ed7',
  },
  tabLabel: {
    marginTop: 2,
    color: '#94a3b8',
    fontSize: 12,
  },
  tabLabelActive: {
    color: '#0f5ed7',
    fontWeight: '700',
  },
})
