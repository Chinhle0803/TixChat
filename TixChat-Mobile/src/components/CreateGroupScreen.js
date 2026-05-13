import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native'
import { userApi } from '../services/api'

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') {
    return String(value._id || value.userId || value.id || '')
  }
  return String(value)
}

const getDisplayName = (user) => {
  if (!user) return 'Người dùng'
  return user.nickname || user.displayName || user.fullName || user.username || 'Người dùng'
}

const getErrorMessage = (error, fallback) =>
  String(error?.response?.data?.error || error?.response?.data?.message || fallback)

export default function CreateGroupScreen({ currentUserId, onBack, onCreateGroup, onShowDialog }) {
  const [groupName, setGroupName] = useState('')
  const [search, setSearch] = useState('')
  const [friendUsers, setFriendUsers] = useState([])
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  React.useEffect(() => {
    let cancelled = false

    const loadFriends = async () => {
      setLoadingFriends(true)
      setError('')

      try {
        const response = await userApi.getFriends()
        const friendIds = (response?.data?.friends || [])
          .map((id) => normalizeId(id))
          .filter((id) => id && id !== normalizeId(currentUserId))

        const profileResults = await Promise.allSettled(
          friendIds.map(async (friendId) => {
            const profileResponse = await userApi.getProfile(friendId)
            return profileResponse?.data?.user || null
          })
        )

        if (cancelled) return

        const next = profileResults
          .filter((item) => item.status === 'fulfilled' && item.value)
          .map((item) => item.value)

        setFriendUsers(next)
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, 'Không tải được danh sách bạn bè'))
        }
      } finally {
        if (!cancelled) {
          setLoadingFriends(false)
        }
      }
    }

    loadFriends()

    return () => {
      cancelled = true
    }
  }, [currentUserId])

  const filteredFriendUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return friendUsers

    return friendUsers.filter((friendUser) => {
      const displayName = getDisplayName(friendUser).toLowerCase()
      const username = String(friendUser?.username || '').toLowerCase()
      return displayName.includes(keyword) || username.includes(keyword)
    })
  }, [friendUsers, search])

  const toggleSelection = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const submitCreateGroup = async () => {
    if (selectedUserIds.length < 2) {
      setError('Vui lòng chọn ít nhất 2 bạn để tạo nhóm')
      return
    }

    setCreating(true)
    setError('')

    try {
      const result = await onCreateGroup?.(selectedUserIds, groupName)

      if (result && result?.opened === false) {
        throw new Error('Đã tạo nhóm nhưng không thể mở cuộc trò chuyện, vui lòng thử lại')
      }

      onShowDialog?.({
        title: 'Thành công',
        message: 'Nhóm mới đã được tạo và mở trong màn hình chat.',
      })
    } catch (createError) {
      setError(getErrorMessage(createError, 'Không thể tạo nhóm chat'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.backText}>← Quay lại</Text>
        </Pressable>
        <Text style={styles.title}>Tạo nhóm chat</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Tên nhóm (không bắt buộc)</Text>
        <TextInput
          style={styles.input}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Ví dụ: Team Mobile"
        />

        <Text style={styles.label}>Tìm bạn bè</Text>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo tên hoặc username"
        />

        <Text style={styles.selectedMeta}>Đã chọn: {selectedUserIds.length} thành viên</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Chọn thành viên nhóm</Text>
        {loadingFriends ? (
          <Text style={styles.emptyText}>Đang tải danh sách bạn bè...</Text>
        ) : filteredFriendUsers.length === 0 ? (
          <Text style={styles.emptyText}>Không có bạn bè phù hợp để chọn</Text>
        ) : (
          filteredFriendUsers.map((friendUser) => {
            const userId = normalizeId(friendUser?.userId || friendUser?._id)
            const isSelected = selectedUserIds.includes(userId)

            return (
              <Pressable
                key={userId}
                style={[styles.friendRow, isSelected && styles.friendRowSelected]}
                onPress={() => toggleSelection(userId)}
              >
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{getDisplayName(friendUser)}</Text>
                  <Text style={styles.friendSub}>@{friendUser?.username || 'unknown'}</Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                  <Text style={styles.checkboxText}>{isSelected ? '✓' : ''}</Text>
                </View>
              </Pressable>
            )
          })
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={[styles.createButton, (creating || selectedUserIds.length < 2) && styles.buttonDisabled]}
        onPress={submitCreateGroup}
        disabled={creating || selectedUserIds.length < 2}
      >
        <Text style={styles.createButtonText}>{creating ? 'Đang tạo...' : 'Tạo nhóm'}</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#f8fafc',
  },
  header: {
    marginBottom: 12,
  },
  backText: {
    color: '#0f766e',
    fontWeight: '600',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  label: {
    color: '#334155',
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  selectedMeta: {
    color: '#0f766e',
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748b',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  friendRowSelected: {
    borderColor: '#0ea5e9',
    backgroundColor: '#f0f9ff',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontWeight: '700',
    color: '#0f172a',
  },
  friendSub: {
    color: '#64748b',
    marginTop: 2,
    fontSize: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  checkboxText: {
    color: '#fff',
    fontWeight: '700',
  },
  createButton: {
    backgroundColor: '#0891b2',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 8,
  },
})
