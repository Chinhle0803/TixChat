import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
  Alert,
} from 'react-native'
import { userService, conversationService } from '../services/api'
import { useDialog } from '../contexts/DialogContext'

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') {
    return String(value._id || value.userId || value.id || value.conversationId || '')
  }
  return String(value)
}

const formatFileSize = (size = 0) => {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return date.toLocaleDateString('vi-VN')
}

const getDisplayName = (user) => {
  if (!user) return 'Người dùng'
  return String(
    user.nickname || user.displayName || user.fullName || user.username || 'Người dùng'
  ).trim()
}

const MUTE_DURATION_OPTIONS = [
  { value: '1h', label: '1 giờ', durationMs: 1 * 60 * 60 * 1000 },
  { value: '8h', label: '8 giờ', durationMs: 8 * 60 * 60 * 1000 },
  { value: '24h', label: '24 giờ', durationMs: 24 * 60 * 60 * 1000 },
  { value: '7d', label: '7 ngày', durationMs: 7 * 24 * 60 * 60 * 1000 },
  { value: 'forever', label: 'Vô thời hạn', durationMs: null },
]

const AUTO_DELETE_OPTIONS = [
  { value: 'never', label: 'Không bao giờ' },
  { value: '1d', label: 'Sau 24 giờ' },
  { value: '7d', label: 'Sau 7 ngày' },
  { value: '30d', label: 'Sau 30 ngày' },
]

const ConversationInfoPanel = ({
  visible,
  conversation,
  currentUserId,
  messages,
  onClose,
  onUpdatePreference,
  onDeleteConversation,
  onRefreshData,
  onStartConversation,
  onCreateGroupConversation,
}) => {
  const { notify, confirm, prompt } = useDialog()
  const [activeTab, setActiveTab] = useState('info')
  const [groupCandidates, setGroupCandidates] = useState([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [groupName, setGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [addMemberSearchText, setAddMemberSearchText] = useState('')
  const [participantRecords, setParticipantRecords] = useState([])
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [showMutePicker, setShowMutePicker] = useState(false)
  const [showSearchMessages, setShowSearchMessages] = useState(false)
  const [messageSearchText, setMessageSearchText] = useState('')
  const [showGroupBuilder, setShowGroupBuilder] = useState(false)
  const [groupSettings, setGroupSettings] = useState({})
  const [loadingGroupSettings, setLoadingGroupSettings] = useState(false)

  const conversationId = normalizeId(conversation?._id || conversation?.conversationId)
  const isGroupConversation = conversation?.type === 'group'
  const normalizedCurrentUserId = normalizeId(currentUserId)
  const normalizedCreatorId = normalizeId(conversation?.creatorId || conversation?.admin)

  const counterpart = useMemo(() => {
    if (isGroupConversation || !conversation?.participants) return null
    const participants = Array.isArray(conversation.participants) ? conversation.participants : []
    return participants.find((p) => normalizeId(p?._id || p?.userId || p) !== normalizedCurrentUserId)
  }, [conversation, isGroupConversation, normalizedCurrentUserId])

  const currentUserRole = useMemo(() => {
    const record = participantRecords.find(
      (p) => normalizeId(p?.userId || p?._id) === normalizedCurrentUserId
    )
    if (record) return record.role || 'member'
    if (normalizedCurrentUserId === normalizedCreatorId) return 'admin'
    return 'member'
  }, [participantRecords, normalizedCurrentUserId, normalizedCreatorId])

  const isCurrentUserAdmin = currentUserRole === 'admin' || normalizedCurrentUserId === normalizedCreatorId
  const canOperateAdminControls = isCurrentUserAdmin || currentUserRole === 'moderator'

  useEffect(() => {
    if (!visible || !isGroupConversation || !conversationId) return

    const loadGroupData = async () => {
      setLoadingParticipants(true)
      try {
        const [participantsResponse] = await Promise.all([
          conversationService.getParticipants(conversationId),
        ])
        setParticipantRecords(participantsResponse?.data?.participants || [])
      } catch (error) {
        console.error('Load group data failed:', error)
      } finally {
        setLoadingParticipants(false)
      }
    }

    loadGroupData()
  }, [visible, isGroupConversation, conversationId])

  useEffect(() => {
    if (!visible || isGroupConversation) return

    const loadCandidate = async () => {
      setLoadingCandidates(true)
      try {
        const response = await userService.getFriends()
        const friendIds = response?.data?.friends || []
        const profiles = await Promise.allSettled(
          friendIds.map(async (id) => {
            const r = await userService.getProfile(id)
            return r?.data?.user || null
          })
        )
        setGroupCandidates(profiles.filter((p) => p.status === 'fulfilled' && p.value).map((p) => p.value))
      } catch (error) {
        console.error('Load candidates failed:', error)
      } finally {
        setLoadingCandidates(false)
      }
    }

    loadCandidate()
  }, [visible, isGroupConversation])

  const mediaItems = useMemo(() => {
    const items = []
    messages?.forEach((msg) => {
      const attachments = Array.isArray(msg?.attachments) ? msg.attachments : []
      attachments.forEach((att) => {
        const type = att?.mimeType || ''
        if (type.startsWith('image/') || type.startsWith('video/')) {
          items.push({
            id: `${normalizeId(msg._id)}-${att.url}`,
            type: type.startsWith('video/') ? 'video' : 'image',
            url: att.url,
            name: att.name || 'Media',
            createdAt: msg.createdAt,
          })
        }
      })
    })
    return items.slice(0, 20)
  }, [messages])

  const fileItems = useMemo(() => {
    const items = []
    messages?.forEach((msg) => {
      const attachments = Array.isArray(msg?.attachments) ? msg.attachments : []
      attachments.forEach((att) => {
        const type = att?.mimeType || ''
        if (!type.startsWith('image/') && !type.startsWith('video/')) {
          items.push({
            id: `${normalizeId(msg._id)}-${att.url}`,
            name: att.name || 'Tệp',
            url: att.url,
            size: att.size,
            createdAt: msg.createdAt,
          })
        }
      })
    })
    return items.slice(0, 10)
  }, [messages])

  const linkItems = useMemo(() => {
    const links = []
    const unique = new Set()
    messages?.forEach((msg) => {
      const text = msg?.content || ''
      const matches = text.match(/https?:\/\/[^\s]+/g) || []
      matches.forEach((url) => {
        if (!unique.has(url)) {
          unique.add(url)
          links.push({
            id: url,
            url,
            createdAt: msg.createdAt,
          })
        }
      })
    })
    return links.slice(0, 10)
  }, [messages])

  const messageSearchResults = useMemo(() => {
    const keyword = messageSearchText.trim().toLowerCase()
    if (!keyword) return []
    return (messages || [])
      .filter((msg) => String(msg?.content || '').toLowerCase().includes(keyword))
      .slice(0, 50)
      .map((msg) => ({
        id: normalizeId(msg._id || msg.messageId),
        content: msg.content,
        createdAt: msg.createdAt,
        senderName: msg.senderName || 'Bạn',
      }))
  }, [messages, messageSearchText])

  const filteredCandidates = useMemo(() => {
    if (!addMemberSearchText.trim()) return groupCandidates
    const keyword = addMemberSearchText.toLowerCase()
    return groupCandidates.filter((c) =>
      getDisplayName(c).toLowerCase().includes(keyword) ||
      String(c.username || '').toLowerCase().includes(keyword)
    )
  }, [groupCandidates, addMemberSearchText])

  const handleRenameAlias = async () => {
    const nextAlias = await prompt({
      title: 'Đặt biệt danh',
      message: 'Nhập biệt danh cho cuộc trò chuyện này.',
      defaultValue: '',
      placeholder: 'Biệt danh mới',
      confirmText: 'Lưu',
    })
    if (nextAlias !== null) {
      onUpdatePreference?.({ alias: nextAlias.trim() })
    }
  }

  const handleToggleMute = () => {
    setShowMutePicker(true)
  }

  const handleSelectMuteDuration = (option) => {
    const nextMuteUntil = option.durationMs ? Date.now() + option.durationMs : null
    onUpdatePreference?.({
      muted: true,
      muteDuration: option.value,
      muteUntil: nextMuteUntil,
    })
    setShowMutePicker(false)
  }

  const handleTurnOnNotifications = () => {
    onUpdatePreference?.({ muted: false, muteDuration: null, muteUntil: null })
    setShowMutePicker(false)
  }

  const handleTogglePin = () => {
    onUpdatePreference?.({ pinned: !conversation?.pinned })
  }

  const handleToggleHidden = () => {
    onUpdatePreference?.({ hidden: !conversation?.hidden })
  }

  const handleChangeAutoDelete = (value) => {
    onUpdatePreference?.({ autoDelete: value })
  }

  const handleSearchMessages = () => {
    setShowSearchMessages(true)
  }

  const handleRenameGroup = async () => {
    const nextName = await prompt({
      title: 'Đổi tên nhóm',
      message: 'Nhập tên nhóm mới.',
      defaultValue: conversation?.name || '',
      placeholder: 'Tên nhóm mới',
      confirmText: 'Lưu',
    })
    if (nextName !== null && nextName.trim()) {
      try {
        await conversationService.updateConversation(conversationId, { name: nextName.trim() })
        onRefreshData?.()
        notify({ title: 'Thành công', message: 'Đã đổi tên nhóm' })
      } catch (error) {
        notify({ title: 'Lỗi', message: 'Không thể đổi tên nhóm', variant: 'error' })
      }
    }
  }

  const handleAddMembers = async () => {
    if (selectedMemberIds.length === 0) {
      notify({ title: 'Thông báo', message: 'Hãy chọn ít nhất 1 thành viên để thêm.', variant: 'warning' })
      return
    }

    try {
      for (const memberId of selectedMemberIds) {
        await conversationService.addParticipant(conversationId, memberId)
      }
      setSelectedMemberIds([])
      setShowAddMemberModal(false)
      setAddMemberSearchText('')
      onRefreshData?.()
      notify({ title: 'Thành công', message: 'Đã thêm thành viên' })
    } catch (error) {
      notify({ title: 'Lỗi', message: 'Không thể thêm thành viên', variant: 'error' })
    }
  }

  const handleRemoveMember = async (memberId, memberName) => {
    if (memberId === normalizedCreatorId) {
      notify({ title: 'Không thể xóa', message: 'Không thể xóa trưởng nhóm.', variant: 'warning' })
      return
    }

    const confirmed = await confirm({
      title: 'Xóa thành viên',
      message: `Bạn có chắc muốn xóa ${memberName} khỏi nhóm?`,
      confirmText: 'Xóa',
    })
    if (!confirmed) return

    try {
      await conversationService.removeParticipant(conversationId, memberId)
      onRefreshData?.()
      notify({ title: 'Thành công', message: `${memberName} đã được xóa khỏi nhóm.` })
    } catch (error) {
      notify({ title: 'Lỗi', message: 'Không thể xóa thành viên', variant: 'error' })
    }
  }

  const handleUpdateRole = async (memberId, newRole) => {
    try {
      await conversationService.updateParticipantRole(conversationId, memberId, newRole)
      onRefreshData?.()
      notify({ title: 'Thành công', message: 'Đã cập nhật vai trò' })
    } catch (error) {
      notify({ title: 'Lỗi', message: 'Không thể cập nhật vai trò', variant: 'error' })
    }
  }

  const handleLeaveGroup = async () => {
    const confirmed = await confirm({
      title: 'Rời nhóm',
      message: 'Bạn có chắc muốn rời nhóm này?',
      confirmText: 'Rời nhóm',
    })
    if (!confirmed) return

    try {
      await conversationService.leaveConversation(conversationId)
      onRefreshData?.()
      onClose?.()
      notify({ title: 'Thành công', message: 'Bạn đã rời nhóm.' })
    } catch (error) {
      notify({ title: 'Lỗi', message: 'Không thể rời nhóm', variant: 'error' })
    }
  }

  const handleDissolveGroup = async () => {
    if (!isCurrentUserAdmin) return

    const confirmed = await confirm({
      title: 'Giải tán nhóm',
      message: 'Hành động này sẽ xóa toàn bộ nhóm. Không thể hoàn tác.',
      confirmText: 'Giải tán',
      variant: 'warning',
    })
    if (!confirmed) return

    try {
      await conversationService.dissolveConversation(conversationId)
      onRefreshData?.()
      onClose?.()
      notify({ title: 'Thành công', message: 'Nhóm đã được giải tán.' })
    } catch (error) {
      notify({ title: 'Lỗi', message: 'Không thể giải tán nhóm', variant: 'error' })
    }
  }

  const handleDeleteHistory = async () => {
    const confirmed = await confirm({
      title: 'Xóa lịch sử',
      message: 'Bạn có chắc muốn xóa lịch sử trò chuyện này?',
      confirmText: 'Xóa',
    })
    if (!confirmed) return

    try {
      await onDeleteConversation?.()
      onClose?.()
    } catch (error) {
      notify({ title: 'Lỗi', message: 'Không thể xóa lịch sử', variant: 'error' })
    }
  }

  const handleCreateGroupWithUser = async () => {
    if (selectedMemberIds.length < 1) {
      notify({ title: 'Thông báo', message: 'Cần chọn ít nhất 1 thành viên để tạo nhóm.', variant: 'warning' })
      return
    }

    try {
      setCreatingGroup(true)
      const participantIds = [normalizeId(counterpart?._id || counterpart?.userId), ...selectedMemberIds]
      await onCreateGroupConversation?.(participantIds, groupName)
      setShowGroupBuilder(false)
      setSelectedMemberIds([])
      setGroupName('')
      onClose?.()
    } catch (error) {
      notify({ title: 'Lỗi', message: 'Không thể tạo nhóm', variant: 'error' })
    } finally {
      setCreatingGroup(false)
    }
  }

  const renderInfoTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hành động nhanh</Text>

        <TouchableOpacity style={styles.actionRow} onPress={handleToggleMute}>
          <Text style={styles.actionText}>
            {conversation?.muted ? 'Bật thông báo' : 'Tắt thông báo'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={handleSearchMessages}>
          <Text style={styles.actionText}>Tìm tin nhắn</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={handleTogglePin}>
          <Text style={styles.actionText}>
            {conversation?.pinned ? 'Bỏ ghim' : 'Ghim trò chuyện'}
          </Text>
        </TouchableOpacity>

        {!isGroupConversation && (
          <TouchableOpacity style={styles.actionRow} onPress={() => setShowGroupBuilder(true)}>
            <Text style={styles.actionText}>Tạo nhóm với người này</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.actionRow, styles.dangerRow]} onPress={handleDeleteHistory}>
          <Text style={styles.dangerText}>Xóa lịch sử trò chuyện</Text>
        </TouchableOpacity>
      </View>

      {!isGroupConversation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tùy chỉnh</Text>

          <TouchableOpacity style={styles.actionRow} onPress={handleRenameAlias}>
            <Text style={styles.actionText}>Đặt biệt danh</Text>
          </TouchableOpacity>
        </View>
      )}

      {isGroupConversation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quản lý nhóm</Text>

          {canOperateAdminControls && (
            <TouchableOpacity style={styles.actionRow} onPress={handleRenameGroup}>
              <Text style={styles.actionText}>Đổi tên nhóm</Text>
            </TouchableOpacity>
          )}

          {canOperateAdminControls && (
            <TouchableOpacity style={styles.actionRow} onPress={() => setShowAddMemberModal(true)}>
              <Text style={styles.actionText}>Thêm thành viên</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionRow} onPress={() => setActiveTab('members')}>
            <Text style={styles.actionText}>
              Thành viên ({participantRecords.length || conversation?.participants?.length || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionRow, styles.dangerRow]} onPress={isCurrentUserAdmin ? handleDissolveGroup : handleLeaveGroup}>
            <Text style={styles.dangerText}>
              {isCurrentUserAdmin ? 'Giải tán nhóm' : 'Rời nhóm'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Media & Files</Text>

        <TouchableOpacity style={styles.actionRow} onPress={() => setActiveTab('media')}>
          <Text style={styles.actionText}>Ảnh/Video ({mediaItems.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={() => setActiveTab('files')}>
          <Text style={styles.actionText}>Files ({fileItems.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={() => setActiveTab('links')}>
          <Text style={styles.actionText}>Links ({linkItems.length})</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )

  const renderMembersTab = () => (
    <FlatList
      data={participantRecords.length > 0 ? participantRecords : conversation?.participants || []}
      keyExtractor={(item) => normalizeId(item?.userId || item?._id || item)}
      renderItem={({ item }) => {
        const memberId = normalizeId(item?.userId || item?._id || item)
        const memberName = item?.name || item?.displayName || item?.fullName || item?.username || 'Thành viên'
        const memberRole = item?.role || (memberId === normalizedCreatorId ? 'admin' : 'member')
        const isCreator = memberId === normalizedCreatorId

        return (
          <View style={styles.memberItem}>
            <View style={styles.memberAvatar}>
              {item?.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{(memberName[0] || '?').toUpperCase()}</Text>
                </View>
              )}
            </View>

            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{memberName}</Text>
              <Text style={styles.memberRole}>
                {isCreator ? 'Trưởng nhóm' : memberRole === 'moderator' ? 'Phó nhóm' : 'Thành viên'}
              </Text>
            </View>

            {canOperateAdminControls && !isCreator && (
              <View style={styles.memberActions}>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => handleUpdateRole(memberId, memberRole === 'moderator' ? 'member' : 'moderator')}
                >
                  <Text style={styles.smallButtonText}>
                    {memberRole === 'moderator' ? 'Bãi nhiệm' : 'Phó nhóm'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallButton, styles.dangerSmallButton]}
                  onPress={() => handleRemoveMember(memberId, memberName)}
                >
                  <Text style={styles.smallButtonText}>Xóa</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )
      }}
      ListEmptyComponent={
        loadingParticipants ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <Text style={styles.emptyText}>Không có thành viên</Text>
        )
      }
      contentContainerStyle={styles.listContent}
    />
  )

  const renderMediaTab = () => (
    <FlatList
      data={mediaItems}
      keyExtractor={(item) => item.id}
      numColumns={3}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.mediaItem}>
          {item.type === 'video' ? (
            <View style={styles.mediaPlaceholder}>
              <Text style={styles.mediaIcon}>Video</Text>
            </View>
          ) : (
            <Image source={{ uri: item.url }} style={styles.mediaImage} />
          )}
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Chưa có ảnh/video</Text>}
      contentContainerStyle={styles.gridContent}
    />
  )

  const renderFilesTab = () => (
    <FlatList
      data={fileItems}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.fileItem}>
          <Text style={styles.fileIcon}>File</Text>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.fileMeta}>
              {formatFileSize(item.size)} - {formatDate(item.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Chưa có file</Text>}
      contentContainerStyle={styles.listContent}
    />
  )

  const renderLinksTab = () => (
    <FlatList
      data={linkItems}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.linkItem}>
          <Text style={styles.linkUrl} numberOfLines={2}>{item.url}</Text>
          <Text style={styles.linkDate}>{formatDate(item.createdAt)}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Chưa có link</Text>}
      contentContainerStyle={styles.listContent}
    />
  )

  const renderSearchMessagesModal = () => (
    <Modal visible={showSearchMessages} animationType="slide" onRequestClose={() => setShowSearchMessages(false)}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowSearchMessages(false)}>
            <Text style={styles.modalCloseText}>Đóng</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Tìm tin nhắn</Text>
          <View style={{ width: 50 }} />
        </View>

        <TextInput
          style={styles.searchInput}
          value={messageSearchText}
          onChangeText={setMessageSearchText}
          placeholder="Nhập từ khóa..."
          placeholderTextColor="#999"
        />

        <FlatList
          data={messageSearchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.searchResultItem}>
              <Text style={styles.searchResultSender}>{item.senderName}</Text>
              <Text style={styles.searchResultContent}>{item.content}</Text>
              <Text style={styles.searchResultDate}>{formatDate(item.createdAt)}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {messageSearchText.trim() ? 'Không tìm thấy tin nhắn' : 'Nhập từ khóa để tìm'}
            </Text>
          }
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </Modal>
  )

  const renderMutePicker = () => (
    <Modal visible={showMutePicker} transparent animationType="fade" onRequestClose={() => setShowMutePicker(false)}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowMutePicker(false)}>
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>Tắt thông báo trong</Text>
          {MUTE_DURATION_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.pickerOption}
              onPress={() => handleSelectMuteDuration(option)}
            >
              <Text style={styles.pickerOptionText}>{option.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.pickerOption} onPress={handleTurnOnNotifications}>
            <Text style={[styles.pickerOptionText, { color: '#007AFF' }]}>Bật thông báo ngay</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )

  const renderAddMemberModal = () => (
    <Modal visible={showAddMemberModal} animationType="slide" onRequestClose={() => setShowAddMemberModal(false)}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowAddMemberModal(false)}>
            <Text style={styles.modalCloseText}>Hủy</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Thêm thành viên</Text>
          <TouchableOpacity onPress={handleAddMembers} disabled={selectedMemberIds.length === 0}>
            <Text style={[styles.modalActionText, selectedMemberIds.length === 0 && styles.disabledText]}>
              Thêm ({selectedMemberIds.length})
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          value={addMemberSearchText}
          onChangeText={setAddMemberSearchText}
          placeholder="Tìm theo tên..."
          placeholderTextColor="#999"
        />

        <FlatList
          data={filteredCandidates}
          keyExtractor={(item) => normalizeId(item?._id || item?.userId)}
          renderItem={({ item }) => {
            const id = normalizeId(item?._id || item?.userId)
            const selected = selectedMemberIds.includes(id)
            return (
              <TouchableOpacity
                style={[styles.candidateItem, selected && styles.candidateItemSelected]}
                onPress={() => {
                  setSelectedMemberIds((prev) =>
                    prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                  )
                }}
              >
                <View style={styles.checkbox}>
                  {selected && <View style={styles.checkboxInner} />}
                </View>
                <Text>{getDisplayName(item)}</Text>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            loadingCandidates ? <ActivityIndicator /> : <Text style={styles.emptyText}>Không có bạn bè để thêm</Text>
          }
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </Modal>
  )

  const renderGroupBuilder = () => (
    <Modal visible={showGroupBuilder} animationType="slide" onRequestClose={() => setShowGroupBuilder(false)}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowGroupBuilder(false)}>
            <Text style={styles.modalCloseText}>Hủy</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Tạo nhóm</Text>
          <TouchableOpacity onPress={handleCreateGroupWithUser} disabled={creatingGroup}>
            <Text style={[styles.modalActionText, creatingGroup && styles.disabledText]}>
              {creatingGroup ? 'Đang tạo...' : 'Tạo'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.groupBuilderContent}>
          <TextInput
            style={styles.searchInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Tên nhóm (không bắt buộc)"
            placeholderTextColor="#999"
          />

          <Text style={styles.builderLabel}>Chọn thành viên:</Text>

          <FlatList
            data={groupCandidates}
            keyExtractor={(item) => normalizeId(item?._id || item?.userId)}
            renderItem={({ item }) => {
              const id = normalizeId(item?._id || item?.userId)
              const selected = selectedMemberIds.includes(id)
              return (
                <TouchableOpacity
                  style={[styles.candidateItem, selected && styles.candidateItemSelected]}
                  onPress={() => {
                    setSelectedMemberIds((prev) =>
                      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                    )
                  }}
                >
                  <View style={styles.checkbox}>
                    {selected && <View style={styles.checkboxInner} />}
                  </View>
                  <Text>{getDisplayName(item)}</Text>
                </TouchableOpacity>
              )
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>Không có bạn bè</Text>}
          />
        </View>
      </SafeAreaView>
    </Modal>
  )

  const headerName = isGroupConversation
    ? conversation?.name || 'Nhóm chat'
    : conversation?.alias || getDisplayName(counterpart) || 'Người dùng'

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Đóng</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{headerName}</Text>
          <View style={{ width: 50 }} />
        </View>

        {isGroupConversation && (
          <View style={styles.tabs}>
            {['info', 'members', 'media', 'files', 'links'].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab === 'info' ? 'Thông tin' :
                   tab === 'members' ? 'Thành viên' :
                   tab === 'media' ? 'Media' :
                   tab === 'files' ? 'Files' : 'Links'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'info' && renderInfoTab()}
        {activeTab === 'members' && renderMembersTab()}
        {activeTab === 'media' && renderMediaTab()}
        {activeTab === 'files' && renderFilesTab()}
        {activeTab === 'links' && renderLinksTab()}

        {renderSearchMessagesModal()}
        {renderMutePicker()}
        {renderAddMemberModal()}
        {renderGroupBuilder()}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 13,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  section: {
    paddingVertical: 12,
    borderBottomWidth: 8,
    borderBottomColor: '#f5f5f5',
  },
  sectionTitle: {
    fontSize: 13,
    color: '#999',
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  actionRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  actionText: {
    fontSize: 16,
    color: '#333',
  },
  dangerRow: {
    marginTop: 8,
  },
  dangerText: {
    fontSize: 16,
    color: '#ff3b30',
  },
  listContent: {
    padding: 16,
  },
  gridContent: {
    padding: 4,
  },
  loadingIndicator: {
    marginTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontSize: 14,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  memberAvatar: {
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
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  memberRole: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 6,
  },
  smallButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dangerSmallButton: {
    backgroundColor: '#ff3b30',
  },
  mediaItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaIcon: {
    fontSize: 12,
    color: '#999',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  fileIcon: {
    fontSize: 12,
    color: '#007AFF',
    marginRight: 10,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    color: '#333',
  },
  fileMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  linkItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  linkUrl: {
    fontSize: 14,
    color: '#007AFF',
  },
  linkDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  modalActionText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  disabledText: {
    color: '#ccc',
  },
  searchInput: {
    height: 44,
    margin: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  candidateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  candidateItemSelected: {
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
  groupBuilderContent: {
    flex: 1,
  },
  builderLabel: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchResultItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  searchResultSender: {
    fontSize: 12,
    color: '#999',
  },
  searchResultContent: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  searchResultDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerOption: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
})

export default ConversationInfoPanel
