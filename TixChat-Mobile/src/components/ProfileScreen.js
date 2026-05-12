import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const getDisplayName = (user) => {
  if (!user) return 'Người dùng'
  return user?.nickname || user?.displayName || user?.fullName || user?.name || user?.username || 'Người dùng'
}

const getUserHandle = (user) => {
  const handle = String(user?.username || '').trim()
  if (!handle) return '@UNKNOWN'
  return `@${handle.toUpperCase()}`
}

export default function ProfileScreen({
  user,
  loading,
  error,
  onBack,
  onUpdateProfile,
  onChangePassword,
  onUpdateAvatar,
  onLogout,
  onOpenConversations,
  onOpenFriends,
  onOpenDiscover,
  onOpenDiary,
}) {
  const insets = useSafeAreaInsets()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [localMessage, setLocalMessage] = useState('')
  const [localError, setLocalError] = useState('')

  const bottomInset = Math.max(insets.bottom, 8)
  const tabBarHeight = 70 + bottomInset

  const resolvedDisplayName = useMemo(() => getDisplayName(user), [user])
  const resolvedHandle = useMemo(() => getUserHandle(user), [user])
  const avatarInitial = String(resolvedDisplayName).slice(0, 1).toUpperCase()

  useEffect(() => {
    setDisplayName(user?.displayName || user?.fullName || user?.username || '')
    setBio(user?.bio || '')
  }, [user])

  const submitProfile = async () => {
    if (!displayName.trim()) {
      setLocalError('Tên hiển thị không được để trống')
      return
    }

    setLocalError('')
    const result = await onUpdateProfile({ displayName: displayName.trim(), bio: bio.trim() })

    if (result?.ok) {
      setLocalMessage('Cập nhật hồ sơ thành công')
    } else if (result?.error) {
      setLocalError(result.error)
    }
  }

  const submitPassword = async () => {
    if (!currentPassword) {
      setLocalError('Vui lòng nhập mật khẩu hiện tại')
      return
    }

    if (newPassword.length < 6) {
      setLocalError('Mật khẩu mới tối thiểu 6 ký tự')
      return
    }

    if (newPassword !== confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp')
      return
    }

    if (currentPassword === newPassword) {
      setLocalError('Mật khẩu mới không được giống mật khẩu hiện tại')
      return
    }

    setLocalError('')
    const result = await onChangePassword({ currentPassword, newPassword, confirmPassword })

    if (result?.ok) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
  setShowPasswordForm(false)
      setLocalMessage('Đổi mật khẩu thành công')
    } else if (result?.error) {
      setLocalError(result.error)
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable style={styles.headerIconBtn} onPress={onBack}>
          <MaterialCommunityIcons name="arrow-left" style={styles.headerIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>Hồ sơ cá nhân</Text>
        <Pressable style={styles.headerIconBtn} onPress={() => setShowPasswordForm(true)}>
          <MaterialCommunityIcons name="cog" style={styles.headerIcon} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: tabBarHeight + 24 }]}>
        {!!(localError || error) && <Text style={styles.error}>{localError || error}</Text>}
        {!!localMessage && <Text style={styles.success}>{localMessage}</Text>}

        <View style={styles.profileTopWrap}>
          <View style={styles.avatarWrap}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{avatarInitial}</Text>
              </View>
            )}

            <Pressable
              style={[styles.avatarCameraBtn, loading && styles.buttonDisabled]}
              onPress={async () => {
                setLocalError('')
                const result = await onUpdateAvatar?.()
                if (result?.ok) {
                  setLocalMessage('Cập nhật avatar thành công')
                } else if (result?.error) {
                  setLocalError(result.error)
                }
              }}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <MaterialCommunityIcons name="camera-plus" style={styles.avatarCameraIcon} />
              )}
            </Pressable>
          </View>

          <Text style={styles.profileName}>{resolvedDisplayName}</Text>
          <Text style={styles.profileHandle}>{resolvedHandle}</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>TÊN HIỂN THỊ</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />

          <Text style={styles.fieldLabel}>TÊN ĐĂNG NHẬP</Text>
          <TextInput style={[styles.input, styles.inputDisabled]} value={String(user?.username || '')} editable={false} />

          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput style={[styles.input, styles.inputDisabled]} value={String(user?.email || '')} editable={false} />

          <Text style={styles.fieldLabel}>BIO</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            multiline
            maxLength={250}
            onChangeText={setBio}
            placeholder="Viết vài dòng giới thiệu về bạn"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <Pressable style={[styles.primaryButton, loading && styles.buttonDisabled]} onPress={submitProfile} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>LƯU THAY ĐỔI</Text>}
        </Pressable>

        <Pressable style={styles.outlineButton} onPress={() => setShowPasswordForm(true)}>
          <MaterialCommunityIcons name="lock" style={styles.outlineButtonIcon} />
          <Text style={styles.outlineButtonText}>ĐỔI MẬT KHẨU</Text>
        </Pressable>

        <Pressable style={styles.dangerOutlineButton} onPress={onLogout}>
          <MaterialCommunityIcons name="logout" style={styles.dangerOutlineIcon} />
          <Text style={styles.dangerOutlineText}>ĐĂNG XUẤT</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.bottomTabBar, { height: tabBarHeight, paddingBottom: bottomInset }]}>
        <Pressable style={styles.tabItem} onPress={onOpenConversations || onBack}>
          <MaterialCommunityIcons name="message-text-outline" style={styles.tabIcon} />
          <Text style={styles.tabLabel}>Tin nhắn</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={onOpenFriends}>
          <MaterialCommunityIcons name="card-account-details-outline" style={styles.tabIcon} />
          <Text style={styles.tabLabel}>Danh bạ</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={onOpenDiscover}>
          <MaterialCommunityIcons name="compass-outline" style={styles.tabIcon} />
          <Text style={styles.tabLabel}>Khám phá</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={onOpenDiary}>
          <MaterialCommunityIcons name="book-open-page-variant-outline" style={styles.tabIcon} />
          <Text style={styles.tabLabel}>Nhật ký</Text>
        </Pressable>

        <Pressable style={styles.tabItem}>
          <MaterialCommunityIcons name="account" style={[styles.tabIcon, styles.tabIconActive]} />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Cá nhân</Text>
        </Pressable>
      </View>

      <Modal visible={showPasswordForm} transparent animationType="fade" onRequestClose={() => setShowPasswordForm(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPasswordForm(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Đổi mật khẩu</Text>

            <Text style={styles.modalLabel}>Mật khẩu hiện tại</Text>
            <TextInput
              style={styles.modalInput}
              secureTextEntry
              autoComplete="password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <Text style={styles.modalLabel}>Mật khẩu mới</Text>
            <TextInput
              style={styles.modalInput}
              secureTextEntry
              autoComplete="new-password"
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <Text style={styles.modalLabel}>Xác nhận mật khẩu</Text>
            <TextInput
              style={styles.modalInput}
              secureTextEntry
              autoComplete="new-password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setShowPasswordForm(false)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable style={[styles.modalSaveBtn, loading && styles.buttonDisabled]} onPress={submitPassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSaveText}>Lưu</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eceef2',
  },
  header: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 27,
    color: '#1663e7',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 21,
    fontWeight: '700',
    color: '#121826',
    marginHorizontal: 6,
  },
  container: {
    padding: 16,
    backgroundColor: '#eceef2',
  },
  profileTopWrap: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 22,
  },
  avatarWrap: {
    marginBottom: 12,
  },
  avatarImage: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: '#dbe3f0',
  },
  avatarFallback: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: '#155eaf',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#fff',
    fontSize: 58,
    fontWeight: '700',
  },
  avatarCameraBtn: {
    position: 'absolute',
    right: -4,
    bottom: 4,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1663e7',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCameraIcon: {
    color: '#fff',
    fontSize: 23,
  },
  profileName: {
    fontSize: 46,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  profileHandle: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 36,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#6b7280',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 9,
    marginLeft: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#edf0f4',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 2,
    backgroundColor: '#f8fafc',
    color: '#111827',
  },
  inputDisabled: {
    backgroundColor: '#f5f6f8',
    color: '#64748b',
  },
  bioInput: {
    minHeight: 128,
    textAlignVertical: 'top',
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#1663e7',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 16,
  },
  outlineButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#dbe0e8',
    backgroundColor: '#f4f6f9',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  outlineButtonIcon: {
    color: '#151b27',
    fontSize: 18,
  },
  outlineButtonText: {
    color: '#151b27',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 16,
  },
  dangerOutlineButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f1c5c5',
    backgroundColor: '#f8f8f9',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  dangerOutlineIcon: {
    color: '#cd2323',
    fontSize: 18,
  },
  dangerOutlineText: {
    color: '#cd2323',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  error: {
    color: '#dc2626',
    marginBottom: 10,
    textAlign: 'center',
  },
  success: {
    color: '#0f766e',
    marginBottom: 10,
    textAlign: 'center',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  modalLabel: {
    marginTop: 8,
    marginBottom: 6,
    color: '#475569',
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  modalActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '700',
  },
  modalSaveBtn: {
    backgroundColor: '#1663e7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  modalSaveText: {
    color: '#fff',
    fontWeight: '700',
  },
})
