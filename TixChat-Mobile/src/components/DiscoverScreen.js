import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
} from 'react-native'
import { userService } from '../services/api'
import { useDialog } from '../contexts/DialogContext'

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') {
    return String(value._id || value.userId || value.id || '')
  }
  return String(value)
}

const getDisplayName = (user) => {
  if (!user) return 'Người dùng'
  return String(
    user.nickname || user.displayName || user.fullName || user.username || 'Người dùng'
  ).trim()
}

const DiscoverScreen = ({
  currentUserId,
  onBack,
  onStartConversation,
  onOpenConversations,
  onOpenProfile,
  onOpenFriends,
}) => {
  const { notify, confirm } = useDialog()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [suggestedUsers, setSuggestedUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [activeTab, setActiveTab] = useState('online')

  const friendSet = new Set(friends.map((id) => normalizeId(id)))
  const pendingSet = new Set(pendingRequests.map((id) => normalizeId(id)))
  const sentSet = new Set(sentRequests.map((id) => normalizeId(id)))

  const loadInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [friendsRes, requestsRes, profileRes, onlineRes] = await Promise.all([
        userService.getFriends(),
        userService.getFriendRequests(),
        userService.getCurrentProfile(),
        userService.getOnlineUsers(),
      ])

      setFriends(friendsRes?.data?.friends || [])
      setPendingRequests(requestsRes?.data?.requests || [])
      setSentRequests(profileRes?.data?.user?.friendRequestsSent || [])
      setOnlineUsers(onlineRes?.data?.users || [])

      const suggested = (onlineRes?.data?.users || []).filter(
        (u) => normalizeId(u?._id || u?.userId) !== normalizeId(currentUserId) && !friendSet.has(normalizeId(u?._id || u?.userId))
      )
      setSuggestedUsers(suggested.slice(0, 10))
    } catch (error) {
      console.error('Load discover data failed:', error)
    } finally {
      setLoading(false)
    }
  }, [currentUserId])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const handleSearch = async () => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const response = await userService.searchUsers(trimmed)
      const users = response?.data?.users || []
      setSearchResults(
        users.filter((u) => normalizeId(u.userId || u._id) !== normalizeId(currentUserId))
      )
    } catch (error) {
      console.error('Search failed:', error)
      notify({ title: 'Lỗi', message: 'Không thể tìm kiếm', variant: 'error' })
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
      await userService.sendFriendRequest(userId)
      await loadInitialData()
    })
  }

  const handleAcceptRequest = async (userId) => {
    await withActionLoading(`accept-${userId}`, async () => {
      await userService.acceptFriendRequest(userId)
      await loadInitialData()
      await onStartConversation?.(userId)
    })
  }

  const handleRejectRequest = async (userId) => {
    await withActionLoading(`reject-${userId}`, async () => {
      await userService.rejectFriendRequest(userId)
      await loadInitialData()
    })
  }

  const handleStartConversation = async (userId) => {
    await withActionLoading(`chat-${userId}`, async () => {
      await onStartConversation?.(userId)
    })
  }

  const handleRemoveFriend = async (userId) => {
    const confirmed = await confirm({
      title: 'Xác nhận hủy kết bạn',
      message: 'Bạn có chắc muốn hủy kết bạn?',
      confirmText: 'Hủy kết bạn',
      variant: 'warning',
    })
    if (!confirmed) return

    await withActionLoading(`unfriend-${userId}`, async () => {
      await userService.removeFriend(userId)
      await loadInitialData()
    })
  }

  const renderUserCard = (user, userId, isFriend, isPending, isSent) => {
    const loadingChat = actionLoading[`chat-${userId}`]
    const loadingSend = actionLoading[`send-${userId}`]
    const loadingAccept = actionLoading[`accept-${userId}`]
    const loadingReject = actionLoading[`reject-${userId}`]
    const loadingUnfriend = actionLoading[`unfriend-${userId}`]

    return (
      <View key={userId} style={styles.userCard}>
        <View style={styles.userAvatar}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(getDisplayName(user)[0] || '?').toUpperCase()}
              </Text>
            </View>
          )}
          {onlineUsers.some((u) => normalizeId(u?._id || u?.userId) === userId) && (
            <View style={styles.onlineIndicator} />
          )}
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{getDisplayName(user)}</Text>
          <Text style={styles.userSubtext}>
            {onlineUsers.some((u) => normalizeId(u?._id || u?.userId) === userId)
              ? 'Đang hoạt động'
              : `@${user?.username || 'unknown'}`}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          {isFriend ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                disabled={loadingChat}
                onPress={() => handleStartConversation(userId)}
              >
                {loadingChat ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Nhắn tin</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                disabled={loadingUnfriend}
                onPress={() => handleRemoveFriend(userId)}
              >
                {loadingUnfriend ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Hủy</Text>
                )}
              </TouchableOpacity>
            </>
          ) : isPending ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                disabled={loadingAccept}
                onPress={() => handleAcceptRequest(userId)}
              >
                {loadingAccept ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Xác nhận</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                disabled={loadingReject}
                onPress={() => handleRejectRequest(userId)}
              >
                {loadingReject ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Từ chối</Text>
                )}
              </TouchableOpacity>
            </>
          ) : isSent ? (
            <View style={[styles.button, styles.disabledButton]}>
              <Text style={[styles.buttonText, styles.disabledButtonText]}>Đã gửi</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              disabled={loadingSend}
              onPress={() => handleSendRequest(userId)}
            >
              {loadingSend ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Kết bạn</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  const renderOnlineTab = () => {
    const onlineFriends = onlineUsers.filter(
      (u) => friendSet.has(normalizeId(u?._id || u?.userId)) && normalizeId(u?._id || u?.userId) !== normalizeId(currentUserId)
    )

    return (
      <FlatList
        data={onlineFriends}
        keyExtractor={(item) => normalizeId(item?._id || item?.userId)}
        renderItem={({ item }) => {
          const userId = normalizeId(item?._id || item?.userId)
          return renderUserCard(item, userId, true, false, false)
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'Đang tải...' : 'Không có bạn bè online'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadInitialData}
      />
    )
  }

  const renderSuggestionsTab = () => (
    <FlatList
      data={suggestedUsers}
      keyExtractor={(item) => normalizeId(item?._id || item?.userId)}
      renderItem={({ item }) => {
        const userId = normalizeId(item?._id || item?.userId)
        return renderUserCard(item, userId, false, false, sentSet.has(userId))
      }}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {loading ? 'Đang tải...' : 'Không có gợi ý nào'}
          </Text>
        </View>
      }
      contentContainerStyle={styles.listContent}
      refreshing={loading}
      onRefresh={loadInitialData}
    />
  )

  const renderRequestsTab = () => {
    const pendingUsers = pendingRequests.map((id) => {
      const user = suggestedUsers.find((u) => normalizeId(u?._id || u?.userId) === normalizeId(id))
      return user || { userId: id, _id: id }
    })

    return (
      <FlatList
        data={pendingUsers}
        keyExtractor={(item) => normalizeId(item?.userId || item?._id)}
        renderItem={({ item }) => {
          const userId = normalizeId(item?.userId || item?._id)
          return renderUserCard(item, userId, false, true, false)
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'Đang tải...' : 'Không có lời mời kết bạn'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadInitialData}
      />
    )
  }

  const renderSearchResults = () => (
    <FlatList
      data={searchResults}
      keyExtractor={(item) => normalizeId(item?.userId || item?._id)}
      renderItem={({ item }) => {
        const userId = normalizeId(item?.userId || item?._id)
        const isFriend = friendSet.has(userId)
        const isPending = pendingSet.has(userId)
        const isSent = sentSet.has(userId)
        return renderUserCard(item, userId, isFriend, isPending, isSent)
      }}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searching
              ? 'Đang tìm...'
              : searchQuery.trim()
              ? 'Không tìm thấy kết quả'
              : 'Nhập từ khóa để tìm kiếm'}
          </Text>
        </View>
      }
      contentContainerStyle={styles.listContent}
    />
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>Quay lại</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Khám phá</Text>

        <View style={{ width: 60 }} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          placeholder="Tìm kiếm người dùng..."
          placeholderTextColor="#999"
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={searching}
        >
          {searching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchButtonText}>Tìm</Text>
          )}
        </TouchableOpacity>
      </View>

      {searchQuery.trim() ? (
        renderSearchResults()
      ) : (
        <View style={styles.tabsContainer}>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'online' && styles.activeTab]}
              onPress={() => setActiveTab('online')}
            >
              <Text style={[styles.tabText, activeTab === 'online' && styles.activeTabText]}>
                Online ({onlineUsers.filter((u) => friendSet.has(normalizeId(u?._id || u?.userId))).length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'suggestions' && styles.activeTab]}
              onPress={() => setActiveTab('suggestions')}
            >
              <Text style={[styles.tabText, activeTab === 'suggestions' && styles.activeTabText]}>
                Gợi ý
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
              onPress={() => setActiveTab('requests')}
            >
              <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                Lời mời ({pendingRequests.length})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabContent}>
            {activeTab === 'online' && renderOnlineTab()}
            {activeTab === 'suggestions' && renderSuggestionsTab()}
            {activeTab === 'requests' && renderRequestsTab()}
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  searchButton: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabsContainer: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  listContent: {
    padding: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  userAvatar: {
    marginRight: 12,
    position: 'relative',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#999',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  userSubtext: {
    fontSize: 13,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  dangerButton: {
    backgroundColor: '#ff3b30',
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#999',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
})

export default DiscoverScreen
