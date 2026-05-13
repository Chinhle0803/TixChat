import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
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

const NewConversationModal = ({
  visible,
  onClose,
  currentUserId,
  onStartConversation,
  onPendingRequestsChange,
  conversationService,
}) => {
  const { confirm } = useDialog()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [friendIds, setFriendIds] = useState([])
  const [friendUsers, setFriendUsers] = useState([])
  const [pendingRequestIds, setPendingRequestIds] = useState([])
  const [pendingRequestUsers, setPendingRequestUsers] = useState([])
  const [sentRequestIds, setSentRequestIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  const [activeTab, setActiveTab] = useState('friends')

  const friendSet = new Set(friendIds.map((id) => normalizeId(id)))
  const pendingSet = new Set(pendingRequestIds.map((id) => normalizeId(id)))
  const sentSet = new Set(sentRequestIds.map((id) => normalizeId(id)))

  const refreshData = useCallback(async () => {
    setLoading(true)
    try {
      const [friendsResponse, requestsResponse, profileResponse] = await Promise.all([
        userService.getFriends(),
        userService.getFriendRequests(),
        userService.getCurrentProfile(),
      ])

      const nextFriends = friendsResponse?.data?.friends || []
      const nextRequests = requestsResponse?.data?.requests || []
      const nextSent = profileResponse?.data?.user?.friendRequestsSent || []

      setFriendIds(nextFriends)
      setPendingRequestIds(nextRequests)
      setSentRequestIds(nextSent)
      onPendingRequestsChange?.(nextRequests.length)

      const pendingProfileResults = await Promise.allSettled(
        nextRequests.map(async (userId) => {
          const response = await userService.getProfile(userId)
          return response?.data?.user || null
        })
      )

      setPendingRequestUsers(
        pendingProfileResults
          .filter((item) => item.status === 'fulfilled' && item.value)
          .map((item) => item.value)
      )

      const friendProfileResults = await Promise.allSettled(
        nextFriends.map(async (userId) => {
          const response = await userService.getProfile(userId)
          return response?.data?.user || null
        })
      )

      setFriendUsers(
        friendProfileResults
          .filter((item) => item.status === 'fulfilled' && item.value)
          .map((item) => item.value)
      )
    } catch (error) {
      console.error('Failed to load modal data:', error)
    } finally {
      setLoading(false)
    }
  }, [onPendingRequestsChange])

  useEffect(() => {
    if (!visible) return
    setQuery('')
    setSearchResults([])
    refreshData()
  }, [visible, refreshData])

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim()
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
      console.error('Failed to search users:', error)
    } finally {
      setSearching(false)
    }
  }, [query, currentUserId])

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
      await refreshData()
    })
  }

  const handleAcceptRequest = async (userId) => {
    await withActionLoading(`accept-${userId}`, async () => {
      await userService.acceptFriendRequest(userId)
      await refreshData()
      await onStartConversation?.(userId)
      onClose?.()
    })
  }

  const handleRejectRequest = async (userId) => {
    await withActionLoading(`reject-${userId}`, async () => {
      await userService.rejectFriendRequest(userId)
      await refreshData()
    })
  }

  const handleStartConversation = async (userId) => {
    await withActionLoading(`chat-${userId}`, async () => {
      await onStartConversation?.(userId)
      onClose?.()
    })
  }

  const handleRemoveFriend = async (userId) => {
    const confirmed = await confirm({
      title: 'Xác nhận hủy kết bạn',
      message: 'Bạn có chắc muốn hủy kết bạn với người này không?',
      confirmText: 'Hủy kết bạn',
      cancelText: 'Giữ lại',
      variant: 'warning',
    })
    if (!confirmed) return

    await withActionLoading(`unfriend-${userId}`, async () => {
      await userService.removeFriend(userId)
      await refreshData()
    })
  }

  const renderUserItem = (user, userId, isFriend, isPending, isSent) => {
    const key = userId
    const loadingAccept = actionLoading[`accept-${key}`]
    const loadingReject = actionLoading[`reject-${key}`]
    const loadingChat = actionLoading[`chat-${key}`]
    const loadingSend = actionLoading[`send-${key}`]
    const loadingUnfriend = actionLoading[`unfriend-${key}`]

    return (
      <View key={key} style={styles.userItem}>
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
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{getDisplayName(user)}</Text>
          <Text style={styles.userSubtext}>@{user?.username || 'unknown'}</Text>
        </View>

        <View style={styles.userActions}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            disabled={loadingChat || loadingSend}
            onPress={() => {
              if (isFriend) {
                handleStartConversation(key)
              } else {
                handleSendRequest(key)
              }
            }}
          >
            {loadingChat ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : loadingSend ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : isFriend ? (
              <Text style={styles.buttonText}>Nhắn tin</Text>
            ) : isSent ? (
              <Text style={styles.buttonTextSmall}>Đã gửi</Text>
            ) : (
              <Text style={styles.buttonText}>Kết bạn</Text>
            )}
          </TouchableOpacity>

          {isFriend && (
            <TouchableOpacity
              style={[styles.button, styles.dangerButton]}
              disabled={loadingUnfriend}
              onPress={() => handleRemoveFriend(key)}
            >
              {loadingUnfriend ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Hủy</Text>
              )}
            </TouchableOpacity>
          )}

          {isPending && (
            <>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                disabled={loadingAccept}
                onPress={() => handleAcceptRequest(key)}
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
                onPress={() => handleRejectRequest(key)}
              >
                {loadingReject ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Từ chối</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    )
  }

  const renderFriendsList = () => (
    <FlatList
      data={friendUsers}
      keyExtractor={(item) => normalizeId(item.userId || item._id)}
      renderItem={({ item }) => {
        const userId = normalizeId(item.userId || item._id)
        return renderUserItem(item, userId, true, false, false)
      }}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {loading ? 'Đang tải...' : 'Bạn chưa có bạn bè nào'}
          </Text>
        </View>
      }
      contentContainerStyle={styles.listContent}
    />
  )

  const renderPendingRequests = () => (
    <FlatList
      data={pendingRequestUsers}
      keyExtractor={(item) => normalizeId(item.userId || item._id)}
      renderItem={({ item }) => {
        const userId = normalizeId(item.userId || item._id)
        return renderUserItem(item, userId, false, true, false)
      }}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {loading ? 'Đang tải...' : 'Không có lời mời kết bạn'}
          </Text>
        </View>
      }
      contentContainerStyle={styles.listContent}
    />
  )

  const renderSearchResults = () => (
    <FlatList
      data={searchResults}
      keyExtractor={(item) => normalizeId(item.userId || item._id)}
      renderItem={({ item }) => {
        const userId = normalizeId(item.userId || item._id)
        const isFriend = friendSet.has(userId)
        const isPending = pendingSet.has(userId)
        const isSent = sentSet.has(userId)
        return renderUserItem(item, userId, isFriend, isPending, isSent)
      }}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searching
              ? 'Đang tìm...'
              : query.trim()
              ? 'Không tìm thấy kết quả'
              : 'Nhập từ khóa để tìm kiếm'}
          </Text>
        </View>
      }
      contentContainerStyle={styles.listContent}
    />
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tìm bạn & tạo cuộc trò chuyện</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              placeholder="Tìm theo username hoặc tên..."
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

          {query.trim() ? (
            <View style={styles.resultsContainer}>{renderSearchResults()}</View>
          ) : (
            <View style={styles.tabsContainer}>
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
                  onPress={() => setActiveTab('friends')}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === 'friends' && styles.activeTabText,
                    ]}
                  >
                    Bạn bè ({friendUsers.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
                  onPress={() => setActiveTab('requests')}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === 'requests' && styles.activeTabText,
                    ]}
                  >
                    Lời mời ({pendingRequestUsers.length})
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.tabContent}>
                {activeTab === 'friends' ? renderFriendsList() : renderPendingRequests()}
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
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
    fontSize: 16,
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
  resultsContainer: {
    flex: 1,
  },
  listContent: {
    padding: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userAvatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  userSubtext: {
    fontSize: 13,
    color: '#999',
  },
  userActions: {
    flexDirection: 'row',
    gap: 6,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
  },
  dangerButton: {
    backgroundColor: '#ff3b30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonTextSmall: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
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

export default NewConversationModal
