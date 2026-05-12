import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { userService } from '../services/api'
import { useDialog } from '../context/DialogContext'
import '../styles/ProfilePage.css'

const ProfilePage = () => {
  const navigate = useNavigate()
  const { notify, confirm } = useDialog()
  const { user, logout, updateUser } = useAuthStore()

  // Form states
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })

  // UI states
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [profileErrors, setProfileErrors] = useState({})
  const displayNameRef = useRef(null)
  const bioRef = useRef(null)

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.fullName || user.username || '')
      setBio(user.bio || '')
      setAvatar(user.avatar || '')
      setAvatarPreview(user.avatar || '')
    }
  }, [user])

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 4000)
  }

  // Handle avatar file selection
  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showMessage('error', 'Kích thước tệp không được vượt quá 5MB')
        return
      }

      if (!file.type.startsWith('image/')) {
        showMessage('error', 'Vui lòng chọn một tệp hình ảnh')
        return
      }

      setAvatarFile(file)

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // Upload avatar
  const handleUploadAvatar = async () => {
    if (!avatarFile) {
      showMessage('error', 'Vui lòng chọn một hình ảnh')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', avatarFile)

      const response = await userService.updateAvatar(formData)
      const updatedUser = { ...user, avatar: response.data.user.avatar }
      updateUser(updatedUser)
      setAvatar(response.data.user.avatar)
      setAvatarFile(null)

      showMessage('success', 'Avatar cập nhật thành công!')
    } catch (err) {
      console.error('Avatar upload error:', err)
      showMessage('error', err.response?.data?.error || 'Lỗi khi tải avatar')
    } finally {
      setLoading(false)
    }
  }

  // Update profile info
  const handleUpdateProfile = async () => {
    const nextErrors = {}

    if (!displayName.trim()) {
      nextErrors.displayName = 'Tên hiển thị không được để trống'
    }

    if (!bio.trim()) {
      nextErrors.bio = 'Bio không được để trống'
    }

    if (Object.keys(nextErrors).length > 0) {
      setProfileErrors(nextErrors)
      const missingLabels = []
      if (nextErrors.displayName) missingLabels.push('tên hiển thị')
      if (nextErrors.bio) missingLabels.push('bio')

      const missingMessage =
        missingLabels.length > 1
          ? `Vui lòng nhập đầy đủ ${missingLabels.join(' và ')} trước khi lưu.`
          : `Vui lòng nhập ${missingLabels[0]} trước khi lưu.`

      showMessage('error', missingMessage)

      if (nextErrors.displayName) {
        displayNameRef.current?.focus()
        return
      }

      bioRef.current?.focus()
      return
    }

    setProfileErrors({})
    setLoading(true)
    try {
      const response = await userService.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
      })

      const responseUser = response.data?.user || {}
      const nextDisplayName =
        responseUser.fullName ||
        responseUser.displayName ||
        displayName.trim()
      const nextBio = responseUser.bio ?? bio.trim()
      const nextAvatar = responseUser.avatar || user?.avatar || avatar

      const updatedUser = {
        ...user,
        ...responseUser,
        displayName: responseUser.displayName || nextDisplayName,
        fullName: responseUser.fullName || nextDisplayName,
        bio: nextBio,
        avatar: nextAvatar,
      }

      updateUser(updatedUser)
      setDisplayName(nextDisplayName)
      setBio(nextBio)
      setAvatar(nextAvatar)
      setAvatarPreview(nextAvatar)

      await notify({
        title: 'Cập nhật thành công',
        message: 'Thông tin hồ sơ của bạn đã được lưu.',
        confirmText: 'Đóng',
        variant: 'success',
      })
    } catch (err) {
      console.error('Profile update error:', err)
      await notify({
        title: 'Cập nhật thất bại',
        message: err.response?.data?.error || 'Lỗi khi cập nhật hồ sơ',
        confirmText: 'Đã hiểu',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  // Change password
  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword) {
      showMessage('error', 'Vui lòng nhập mật khẩu hiện tại')
      return
    }

    if (!newPassword) {
      showMessage('error', 'Vui lòng nhập mật khẩu mới')
      return
    }

    if (newPassword.length < 6) {
      showMessage('error', 'Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }

    if (newPassword !== confirmPassword) {
      showMessage('error', 'Mật khẩu xác nhận không khớp')
      return
    }

    if (currentPassword === newPassword) {
      showMessage('error', 'Mật khẩu mới không được giống mật khẩu hiện tại')
      return
    }

    setLoading(true)
    try {
      await userService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordModal(false)
      showMessage('success', 'Mật khẩu đã được thay đổi thành công!')
    } catch (err) {
      console.error('Password change error:', err)
      showMessage('error', err.response?.data?.error || 'Lỗi khi thay đổi mật khẩu')
    } finally {
      setLoading(false)
    }
  }

  // Logout
  const handleLogout = async () => {
    const shouldLogout = await confirm({
      title: 'Xác nhận đăng xuất',
      message: 'Bạn có chắc chắn muốn đăng xuất?',
      confirmText: 'Đăng xuất',
      cancelText: 'Ở lại',
      variant: 'warning',
    })

    if (!shouldLogout) return

    await logout()
    navigate('/auth/login')
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords({
      ...showPasswords,
      [field]: !showPasswords[field],
    })
  }

  const closePasswordModal = () => {
    if (loading) return
    setShowPasswordModal(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  useEffect(() => {
    if (!showPasswordModal) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closePasswordModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showPasswordModal, loading])

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Header */}
        <div className="profile-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            Quay Về
          </button>
          <h1>Hồ Sơ Cá Nhân</h1>
        </div>

        {/* Content */}
        <div className="profile-content">
          {/* Messages */}
          {message.text && (
            <div className={`${message.type}-message`}>
              {message.text}
            </div>
          )}

          {/* Avatar Section */}
          <div className="avatar-section">
            <div className="profile-avatar-container">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" className="profile-avatar" />
              ) : (
                <div className="profile-avatar">Ảnh</div>
              )}
              <button
                className="avatar-upload-btn"
                onClick={() => document.getElementById('avatar-input').click()}
                title="Thay đổi avatar"
              >
                +
              </button>
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
              />
            </div>

            {avatarFile && (
              <div className="profile-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleUploadAvatar}
                  disabled={loading}
                >
                  {loading ? 'Đang tải...' : 'Tải Avatar'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setAvatarFile(null)
                    setAvatarPreview(avatar)
                  }}
                  disabled={loading}
                >
                  Hủy
                </button>
              </div>
            )}
          </div>

          {/* Profile Info Section */}
          <div className="profile-section">
            <h2>Thông Tin Cá Nhân</h2>

            <div className="form-group">
              <label>Tên Hiển Thị</label>
              <input
                ref={displayNameRef}
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  if (profileErrors.displayName) {
                    setProfileErrors((current) => ({ ...current, displayName: '' }))
                  }
                }}
                placeholder="Nhập tên hiển thị"
                disabled={loading}
                required
                aria-invalid={Boolean(profileErrors.displayName)}
                aria-describedby={profileErrors.displayName ? 'display-name-error' : undefined}
              />
              {profileErrors.displayName ? (
                <small id="display-name-error" className="field-error-text">{profileErrors.displayName}</small>
              ) : null}
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                style={{ backgroundColor: '#e8e8e8' }}
              />
            </div>

            <div className="form-group">
              <label>Bio</label>
              <textarea
                ref={bioRef}
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value)
                  if (profileErrors.bio) {
                    setProfileErrors((current) => ({ ...current, bio: '' }))
                  }
                }}
                placeholder="Viết một chút về bạn..."
                disabled={loading}
                maxLength={200}
                required
                aria-invalid={Boolean(profileErrors.bio)}
                aria-describedby={profileErrors.bio ? 'bio-error bio-count' : 'bio-count'}
              />
              {profileErrors.bio ? (
                <small id="bio-error" className="field-error-text">{profileErrors.bio}</small>
              ) : null}
              <small id="bio-count">{bio.length}/200</small>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleUpdateProfile}
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Đang cập nhật...' : 'Lưu Thay Đổi'}
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setShowPasswordModal(true)}
              style={{ width: '100%', marginTop: '10px' }}
            >
              Đổi Mật Khẩu
            </button>
          </div>

          {/* Logout Button */}
          <button className="logout-btn" onClick={handleLogout}>
            Đăng Xuất
          </button>
        </div>
      </div>

      {showPasswordModal && (
        <div className="profile-modal-backdrop" role="presentation" onMouseDown={closePasswordModal}>
          <div
            className="profile-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="profile-modal-header">
              <div>
                <h2 id="password-modal-title">Đổi Mật Khẩu</h2>
                <p>Cập nhật mật khẩu để giữ tài khoản an toàn.</p>
              </div>
              <button type="button" className="profile-modal-close" onClick={closePasswordModal} aria-label="Đóng">
                ×
              </button>
            </div>

            {message.text && message.type === 'error' ? (
              <div className="error-message">{message.text}</div>
            ) : null}

            <form
              className="password-form-container"
              onSubmit={(event) => {
                event.preventDefault()
                handleChangePassword()
              }}
            >
              <div className="form-group password-group">
                <label>Mật Khẩu Hiện Tại</label>
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  disabled={loading}
                  autoFocus
                />
                <button
                  className="toggle-password"
                  onClick={() => togglePasswordVisibility('current')}
                  type="button"
                >
                  {showPasswords.current ? 'Ẩn' : 'Hiện'}
                </button>
              </div>

              <div className="form-group password-group">
                <label>Mật Khẩu Mới</label>
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  disabled={loading}
                />
                <button
                  className="toggle-password"
                  onClick={() => togglePasswordVisibility('new')}
                  type="button"
                >
                  {showPasswords.new ? 'Ẩn' : 'Hiện'}
                </button>
              </div>

              <div className="form-group password-group">
                <label>Xác Nhận Mật Khẩu</label>
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  disabled={loading}
                />
                <button
                  className="toggle-password"
                  onClick={() => togglePasswordVisibility('confirm')}
                  type="button"
                >
                  {showPasswords.confirm ? 'Ẩn' : 'Hiện'}
                </button>
              </div>

              <div className="profile-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closePasswordModal} disabled={loading}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-danger" disabled={loading}>
                  {loading ? 'Đang xử lý...' : 'Xác Nhận Đổi Mật Khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfilePage
