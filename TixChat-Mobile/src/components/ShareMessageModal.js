import React, { useEffect, useState, useCallback } from 'react'
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

const buildMessagePreview = (message) => {
  if (!message) return ''

  const text = String(message?.content || '').trim()
  const attachment = Array.isArray(message?.attachments) ? message.attachments[0] : null
  const attachmentName = attachment?.name || ''

  if (text && attachmentName) {
    return `${text} - Tệp: ${attachmentName}`
  }

  if (text) return text
  if (attachmentName) return `Tệp đính kèm: ${attachmentName}`

  return 'Tin nhắn chia sẻ'
}

const ShareMessageModal = ({
  visible,
  onClose,
  message,
  currentUserId,
  onShare,
  conversationService,
}) => {
  const { notify } = useDialog()
  const [friendUsers, setFriendUsers] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!visible) return

    let isCancelled = false

    const loadFriends = async () => {
      setLoading(true)
      try {
        const response = await userService.getFriends()
        if (isCancelled) return

        const friendIds = (response?.data?.friends || [])
          .map((id) => normalizeId(id))
          .filter((id) => id && id !== normalizeId(currentUserId))

        const profileResults = await Promise.allSettled(
          friendIds.map(async (friendId) => {
            const profileResponse = await userService.getProfile(friendId)
            return profileResponse?.data?.user || null
          })
        )

        if (isCancelled) return

        const users = profileResults
          .filter((item) => item.status === 'fulfilled' && item.value)
          .map((item) => item.value)

        setFriendUsers(users)
      } catch (error) {
        console.error('Load friends for share failed:', error)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    setSelectedIds([])
    setSearch('')
    loadFriends()

    return () => {
      isCancelled = true
    }
  }, [visible, currentUserId])

  const filteredUsers = React.useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return friendUsers

    return friendUsers.filter((user) => {
      const displayName = getDisplayName(user).toLowerCase()
      const username = String(user?.username || '').toLowerCase()
      return displayName.includes(keyword) || username.includes(keyword)
    })
  }, [friendUsers, search])

  const toggleUser = useCallback((userId) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }, [])

  const handleShare = async () => {
    if (selectedIds.length === 0) {
      await notify({
        title: 'Thiếu người nhận',
        message: 'Vui lòng chọn ít nhất 1 bạn để chia sẻ.',
        confirmText: 'Đã hiểu',
        variant: 'warning',
      })
      return
    }

    try {
      setSharing(true)
      await onShare?.(selectedIds)
      onClose?.()
    } catch (error) {
      await notify({
        title: 'Chia sẻ thất bại',
        message: error?.response?.data?.error || error?.message || 'Chia sẻ tin nhắn thất bại',
        confirmText: 'Đã hiểu',
        variant: 'error',
      })
    } finally {
      setSharing(false)
    }
  }

  const renderUserItem = ({ item }) => {
    const userId = normalizeId(item?.userId || item?._id)
    const checked = selectedIds.includes(userId)

    return (
      <TouchableOpacity
        style={[styles.userItem, checked && styles.userItemSelected]}
        onPress={() => toggleUser(userId)}
        activeOpacity={0.7}
      >
        <View style={styles.checkbox}>
          {checked && <View style={styles.checkboxInner} />}
        </View>

        <View style={styles.userAvatar}>
          {item?.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(getDisplayName(item)[0] || '?').toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{getDisplayName(item)}</Text>
          <Text style={styles.userSubtext}>@{item?.username || 'unknown'}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Hủy</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Chia sẻ tin nhắn</Text>

          <TouchableOpacity
            style={[styles.shareButton, selectedIds.length === 0 && styles.shareButtonDisabled]}
            onPress={handleShare}
            disabled={sharing || selectedIds.length === 0}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.shareButtonText}>
                Gửi ({selectedIds.length})
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>Tin nhắn:</Text>
          <Text style={styles.previewText} numberOfLines={2}>
            {buildMessagePreview(message)}
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm bạn bè..."
            placeholderTextColor="#999"
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Đang tải danh sách bạn bè...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => normalizeId(item?.userId || item?._id)}
            renderItem={renderUserItem}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {search.trim() ? 'Không tìm thấy bạn bè phù hợp.' : 'Không có bạn bè để chia sẻ.'}
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  shareButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  shareButtonDisabled: {
    backgroundColor: '#ccc',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  previewContainer: {
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  previewLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  searchContainer: {
    padding: 12,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  listContent: {
    padding: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  userItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f7ff',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  userAvatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
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

export default ShareMessageModal
