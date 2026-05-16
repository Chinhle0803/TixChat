import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, IconButton, Input, MobileBottomTabBar, Screen, TopBar } from './ui'
import { useAppTheme } from '../theme'
import {
  extractLocationFromReverseGeocode as extractFormattedLocationFromReverseGeocode,
  formatLocationLabel,
  normalizeProfileLocation as normalizeFormattedProfileLocation,
} from '../utils/addressFormat'

const NativeWebView = Platform.OS === 'web' ? null : require('react-native-webview').WebView
const DEFAULT_PROFILE_LOCATION = { lat: 10.776889, lng: 106.700806 }

const toCoordinateNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const formatCoordinates = (location = {}) => {
  const lat = toCoordinateNumber(location.lat)
  const lng = toCoordinateNumber(location.lng)
  if (lat === null || lng === null) return ''
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

const createProfileLocationMapHtml = (location = {}) => {
  const lat = toCoordinateNumber(location.lat)
  const lng = toCoordinateNumber(location.lng)
  const hasLocation = lat !== null && lng !== null
  const center = hasLocation ? { lat, lng } : DEFAULT_PROFILE_LOCATION

  return `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #dbeafe; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .leaflet-control-zoom { border: none !important; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18) !important; overflow: hidden; border-radius: 16px !important; }
      .leaflet-control-zoom a { width: 42px !important; height: 42px !important; line-height: 42px !important; font-size: 22px !important; color: #0f172a !important; }
      .leaflet-control-current-location { border: none !important; border-radius: 16px !important; overflow: hidden; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18) !important; }
      .leaflet-control-current-location button { width: 42px; height: 42px; border: 0; background: #ffffff; color: #2563eb; font-size: 22px; font-weight: 900; line-height: 42px; text-align: center; cursor: pointer; }
      .selected-pin { width: 22px; height: 22px; border-radius: 999px; background: #2563eb; border: 4px solid #fff; box-shadow: 0 0 0 9px rgba(37, 99, 235, 0.18), 0 10px 24px rgba(15, 23, 42, 0.22); }
      .selected-marker { background: transparent; border: none; }
      .map-help { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 500; padding: 9px 12px; border-radius: 999px; background: rgba(255,255,255,0.92); color: #334155; font-size: 12px; font-weight: 700; text-align: center; box-shadow: 0 8px 22px rgba(15, 23, 42, 0.14); }
    </style>
    <script>
      window.__sendMessage = function(type, payload) {
        var message = JSON.stringify({ type: type, payload: payload });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
        if (window.parent && window.parent !== window && window.parent.postMessage) window.parent.postMessage(message, '*');
      };
      window.__setMarker = function(lat, lng) {
        if (!window.mapInstance || !window.L) return;
        var point = [lat, lng];
        var icon = window.L.divIcon({
          className: 'selected-marker',
          html: '<div class="selected-pin"></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        if (window.selectedMarker) window.selectedMarker.setLatLng(point);
        else window.selectedMarker = window.L.marker(point, { icon: icon, draggable: true }).addTo(window.mapInstance);
        window.selectedMarker.off('dragend');
        window.selectedMarker.on('dragend', function() {
          var p = window.selectedMarker.getLatLng();
          window.__sendMessage('location_pick', { lat: p.lat, lng: p.lng });
        });
      };
      window.__pick = function(lat, lng) {
        window.__setMarker(lat, lng);
        window.mapInstance.flyTo([lat, lng], Math.max(window.mapInstance.getZoom(), 15), { animate: true, duration: 0.45 });
        window.__sendMessage('location_pick', { lat: lat, lng: lng });
      };
      window.__locate = function(button) {
        if (!navigator.geolocation) {
          alert('Thiết bị chưa hỗ trợ lấy vị trí hiện tại.');
          return;
        }
        button.disabled = true;
        button.textContent = '…';
        navigator.geolocation.getCurrentPosition(
          function(position) {
            button.disabled = false;
            button.textContent = '⌖';
            window.__pick(position.coords.latitude, position.coords.longitude);
          },
          function() {
            button.disabled = false;
            button.textContent = '⌖';
            alert('Không thể lấy vị trí hiện tại. Hãy cấp quyền vị trí rồi thử lại.');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
        );
      };
    </script>
  </head>
  <body>
    <div id="map"></div>
    <div class="map-help">Chạm vào bản đồ để chọn khu vực hồ sơ</div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      (function boot() {
        if (!window.L) {
          setTimeout(boot, 50);
          return;
        }
        window.mapInstance = window.L.map('map', { zoomControl: false, attributionControl: false }).setView([${center.lat}, ${center.lng}], ${hasLocation ? 15 : 12});
        window.L.control.zoom({ position: 'bottomright' }).addTo(window.mapInstance);
        var CurrentLocationControl = window.L.Control.extend({
          options: { position: 'bottomright' },
          onAdd: function() {
            var container = window.L.DomUtil.create('div', 'leaflet-bar leaflet-control-current-location');
            var button = window.L.DomUtil.create('button', '', container);
            button.type = 'button';
            button.title = 'Vị trí hiện tại';
            button.textContent = '⌖';
            window.L.DomEvent.disableClickPropagation(container);
            window.L.DomEvent.on(button, 'click', function(event) {
              window.L.DomEvent.stop(event);
              window.__locate(button);
            });
            return container;
          },
        });
        new CurrentLocationControl().addTo(window.mapInstance);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: ['a', 'b', 'c'] }).addTo(window.mapInstance);
        window.mapInstance.on('click', function(event) { window.__pick(event.latlng.lat, event.latlng.lng); });
        ${hasLocation ? `window.__setMarker(${lat}, ${lng});` : ''}
        window.__sendMessage('map_ready', {});
      })();
    </script>
  </body>
</html>`
}

function ProfileLocationMap({ value, onPick, style }) {
  const webViewRef = React.useRef(null)
  const iframeRef = React.useRef(null)
  const html = React.useMemo(() => createProfileLocationMapHtml(value), [value])

  const handleMessage = React.useCallback((event) => {
    try {
      const data = JSON.parse(event?.nativeEvent?.data || '{}')
      if (data?.type !== 'location_pick') return
      const lat = Number(data?.payload?.lat)
      const lng = Number(data?.payload?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      onPick?.({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) })
    } catch (_) {
      // Ignore malformed bridge messages.
    }
  }, [onPick])

  React.useEffect(() => {
    if (Platform.OS !== 'web') return undefined
    const handleWindowMessage = (event) => {
      if (typeof event?.data !== 'string') return
      handleMessage({ nativeEvent: { data: event.data } })
    }
    window.addEventListener('message', handleWindowMessage)
    return () => window.removeEventListener('message', handleWindowMessage)
  }, [handleMessage])

  return (
    <View style={style}>
      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          title="Chọn khu vực hồ sơ"
          srcDoc={html}
          style={{ width: '100%', height: '100%', borderWidth: 0 }}
          allow="geolocation"
        />
      ) : (
        <NativeWebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html }}
          style={{ flex: 1, backgroundColor: '#dbeafe' }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          scrollEnabled={false}
          overScrollMode="never"
        />
      )}
    </View>
  )
}

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
  openLocationPickerToken = 0,
  onBack,
  onUpdateProfile,
  onChangePassword,
  onUpdateAvatar,
  onLogout,
  onOpenConversations,
  onOpenFriends,
  onOpenDiscover,
  onOpenDiary,
  onOpenCalls,
  onOpenUrban,
  onOpenAssistant,
}) {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const c = theme.colors
  const insets = useSafeAreaInsets()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [profileLocation, setProfileLocation] = useState(() => normalizeFormattedProfileLocation())
  const [draftProfileLocation, setDraftProfileLocation] = useState(() => normalizeFormattedProfileLocation())
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [resolvingLocation, setResolvingLocation] = useState(false)
  const [locationPickerError, setLocationPickerError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [localMessage, setLocalMessage] = useState('')
  const [localError, setLocalError] = useState('')

  const bottomInset = Math.max(insets.bottom, 8)
  const tabBarHeight = 64 + bottomInset

  const resolvedDisplayName = useMemo(() => getDisplayName(user), [user])
  const resolvedHandle = useMemo(() => getUserHandle(user), [user])
  const avatarInitial = String(resolvedDisplayName).slice(0, 1).toUpperCase()

  useEffect(() => {
    setDisplayName(user?.displayName || user?.fullName || user?.username || '')
    setBio(user?.bio || '')
    setProvince(user?.province || '')
    setDistrict(user?.district || '')
    const nextLocation = normalizeFormattedProfileLocation(user?.location, user)
    setProfileLocation(nextLocation)
    setDraftProfileLocation(nextLocation)
  }, [user])

  useEffect(() => {
    if (openLocationPickerToken) {
      setDraftProfileLocation(profileLocation)
      setShowLocationPicker(true)
    }
  }, [openLocationPickerToken, profileLocation])

  const submitProfile = async () => {
    if (!displayName.trim()) {
      setLocalError('Tên hiển thị không được để trống')
      return
    }

    setLocalError('')
    const result = await onUpdateProfile({
      displayName: displayName.trim(),
      bio: bio.trim(),
      province: profileLocation.province || province.trim(),
      district: profileLocation.district || district.trim(),
      location: profileLocation,
    })

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

  const handleProfileLocationPick = async ({ lat, lng }) => {
    setResolvingLocation(true)
    setLocationPickerError('')
    try {
      const resolvedLocation = await reverseGeocodeLocation({ lat, lng })
      setDraftProfileLocation(normalizeFormattedProfileLocation(resolvedLocation))
    } catch (err) {
      setDraftProfileLocation((current) => normalizeFormattedProfileLocation({
        ...current,
        lat,
        lng,
        address: `Vị trí đã chọn (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      }))
      setLocationPickerError(err?.message || 'Không thể nhận diện khu vực từ vị trí đã chọn')
    } finally {
      setResolvingLocation(false)
    }
  }

  const confirmProfileLocation = () => {
    const nextLocation = normalizeFormattedProfileLocation(draftProfileLocation, {
      province,
      district,
    })
    setProfileLocation(nextLocation)
    setProvince(nextLocation.province || '')
    setDistrict(nextLocation.district || '')
    setShowLocationPicker(false)
    setLocationPickerError('')
  }

  return (
    <Screen style={styles.screen}>
      <TopBar
        title="Hồ sơ cá nhân"
        leftAction={<IconButton icon="arrow-left" onPress={onBack} />}
        style={{ paddingTop: insets.top + 4 }}
      />

      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: tabBarHeight + 24 }]}>
        {!!(localError || error) && <Text style={styles.error}>{localError || error}</Text>}
        {!!localMessage && <Text style={styles.success}>{localMessage}</Text>}

        <Card style={styles.profileTopWrap}>
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
                  setLocalMessage('Cập nhật ảnh đại diện thành công')
                } else if (result?.error) {
                  setLocalError(result.error)
                }
              }}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={c.primaryForeground} size="small" />
              ) : (
                <MaterialCommunityIcons name="camera-plus" style={styles.avatarCameraIcon} />
              )}
            </Pressable>
          </View>

          <Text style={styles.profileName}>{resolvedDisplayName}</Text>
          <Text style={styles.profileHandle}>{resolvedHandle}</Text>
        </Card>

        <Card style={styles.formSection}>
          <Text style={styles.fieldLabel}>TÊN HIỂN THỊ</Text>
          <Input style={styles.input} value={displayName} onChangeText={setDisplayName} />

          <Text style={styles.fieldLabel}>EMAIL</Text>
          <Input style={[styles.input, styles.inputDisabled]} value={String(user?.email || '')} editable={false} />

          <Text style={styles.fieldLabel}>GIỚI THIỆU</Text>
          <Input
            style={[styles.input, styles.bioInput]}
            value={bio}
            multiline
            maxLength={250}
            onChangeText={setBio}
            placeholder="Viết vài dòng giới thiệu về bạn"
          />

          <Text style={styles.fieldLabel}>TỈNH/THÀNH PHỐ</Text>
          <Input
            style={styles.input}
            value={province}
            onChangeText={setProvince}
            placeholder="Ví dụ: Thành phố Hồ Chí Minh"
          />

          <Text style={styles.fieldLabel}>QUẬN/HUYỆN</Text>
          <Input
            style={styles.input}
            value={district}
            onChangeText={setDistrict}
            placeholder="Ví dụ: Quận 1"
          />

          <Text style={styles.fieldLabel}>KHU VỰC HIỆN TẠI</Text>
          <Pressable
            style={styles.locationPickerButton}
            onPress={() => {
              setDraftProfileLocation(profileLocation)
              setShowLocationPicker(true)
            }}
          >
            <View style={styles.locationPickerTextWrap}>
              <Text style={styles.locationPickerTitle}>{formatLocationLabel(profileLocation)}</Text>
              <Text style={styles.locationPickerSubtitle}>
                {formatCoordinates(profileLocation) || 'Chọn trên bản đồ để cập nhật vị trí nhanh'}
              </Text>
            </View>
            <MaterialCommunityIcons name="map-marker-radius-outline" style={styles.locationPickerIcon} />
          </Pressable>
        </Card>

        <Button style={styles.primaryButton} loading={loading} onPress={submitProfile} disabled={loading}>
          Lưu thay đổi
        </Button>

        <Pressable style={styles.outlineButton} onPress={() => setShowPasswordForm(true)}>
          <Text style={styles.outlineButtonText}>Đổi mật khẩu</Text>
        </Pressable>

        <Pressable style={styles.dangerOutlineButton} onPress={onLogout}>
          <Text style={styles.dangerOutlineText}>Đăng xuất</Text>
        </Pressable>
      </ScrollView>

      <MobileBottomTabBar
        active="Profile"
        badges={{ Friends: 0 }}
        onNavigate={{
          Chats: onOpenConversations || onBack,
          Friends: onOpenFriends,
          Urban: onOpenUrban,
          Assistant: onOpenAssistant,
        }}
      />

      <Modal visible={showPasswordForm} transparent animationType="fade" onRequestClose={() => setShowPasswordForm(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPasswordForm(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Đổi mật khẩu</Text>

            <Text style={styles.modalLabel}>Mật khẩu hiện tại</Text>
            <Input
              style={styles.modalInput}
              secureTextEntry
              autoComplete="password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <Text style={styles.modalLabel}>Mật khẩu mới</Text>
            <Input
              style={styles.modalInput}
              secureTextEntry
              autoComplete="new-password"
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <Text style={styles.modalLabel}>Xác nhận mật khẩu</Text>
            <Input
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
                {loading ? <ActivityIndicator color={c.primaryForeground} size="small" /> : <Text style={styles.modalSaveText}>Lưu</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showLocationPicker} transparent animationType="fade" onRequestClose={() => setShowLocationPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLocationPicker(false)}>
          <Pressable style={styles.locationModalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Cập nhật vị trí nhanh</Text>
            <Text style={styles.locationHelpText}>Chọn trên bản đồ hoặc dùng vị trí hiện tại để assistant hỗ trợ các câu hỏi gần bạn chính xác hơn.</Text>

            <View style={styles.locationMapWrap}>
              <ProfileLocationMap
                value={draftProfileLocation}
                onPick={handleProfileLocationPick}
                style={styles.locationMap}
              />
            </View>

            <Text style={styles.locationPreviewTitle}>{formatLocationLabel(draftProfileLocation)}</Text>
            <Text style={styles.locationPreviewSubtitle}>
              {resolvingLocation ? 'Đang nhận diện khu vực...' : (formatCoordinates(draftProfileLocation) || 'Chưa có tọa độ')}
            </Text>
            {!!locationPickerError && <Text style={styles.error}>{locationPickerError}</Text>}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setShowLocationPicker(false)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable style={[styles.modalSaveBtn, resolvingLocation && styles.buttonDisabled]} onPress={confirmProfileLocation} disabled={resolvingLocation}>
                {resolvingLocation ? <ActivityIndicator color={c.primaryForeground} size="small" /> : <Text style={styles.modalSaveText}>Xác nhận</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  )
}

const createStyles = (theme) => {
  const c = theme.colors

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    container: {
      padding: 16,
      backgroundColor: c.background,
      gap: 12,
    },
    profileTopWrap: {
      alignItems: 'center',
      marginTop: 8,
    },
    avatarWrap: {
      marginBottom: 12,
    },
    avatarImage: {
      width: 128,
      height: 128,
      borderRadius: 64,
      borderWidth: 4,
      borderColor: c.surface,
      backgroundColor: c.muted,
    },
    avatarFallback: {
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: c.primary,
      borderWidth: 4,
      borderColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      color: c.primaryForeground,
      fontSize: 44,
      fontWeight: '700',
    },
    avatarCameraBtn: {
      position: 'absolute',
      right: -4,
      bottom: 4,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.primary,
      borderWidth: 4,
      borderColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarCameraIcon: {
      color: c.primaryForeground,
      fontSize: 22,
    },
    profileName: {
      fontSize: theme.type['2xl'],
      fontWeight: '700',
      color: c.neutral900,
      textAlign: 'center',
    },
    profileHandle: {
      marginTop: 4,
      color: c.neutral500,
      fontSize: theme.type.lg,
      fontWeight: '600',
    },
    formSection: {},
    fieldLabel: {
      color: c.neutral500,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 8,
      marginTop: 12,
    },
    input: {
      marginBottom: 2,
    },
    inputDisabled: {
      backgroundColor: c.muted,
      color: c.neutral500,
    },
    bioInput: {
      minHeight: 128,
      textAlignVertical: 'top',
    },
    primaryButton: {
      borderRadius: 999,
    },
    outlineButton: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: 999,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineButtonText: {
      color: c.neutral900,
      fontWeight: '700',
      fontSize: 16,
    },
    dangerOutlineButton: {
      borderWidth: 1,
      borderColor: c.dangerSoft,
      backgroundColor: c.surface,
      borderRadius: 999,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerOutlineText: {
      color: c.danger,
      fontWeight: '700',
      fontSize: 16,
    },
    locationPickerButton: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      backgroundColor: c.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    locationPickerTextWrap: {
      flex: 1,
      paddingRight: 12,
    },
    locationPickerTitle: {
      color: c.neutral900,
      fontWeight: '700',
      fontSize: 15,
    },
    locationPickerSubtitle: {
      marginTop: 4,
      color: c.neutral500,
      fontSize: 12,
      lineHeight: 18,
    },
    locationPickerIcon: {
      color: c.primary,
      fontSize: 22,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    error: {
      color: c.danger,
      textAlign: 'center',
    },
    success: {
      color: c.success,
      textAlign: 'center',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.isDark ? 'rgba(2, 6, 23, 0.78)' : 'rgba(2, 6, 23, 0.6)',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    modalCard: {
      backgroundColor: c.surfaceElevated,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.neutral900,
      marginBottom: 10,
    },
    modalLabel: {
      marginTop: 8,
      marginBottom: 6,
      color: c.neutral700,
      fontWeight: '600',
    },
    modalInput: {
      marginBottom: 2,
    },
    modalActions: {
      marginTop: 14,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    modalCancelBtn: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: c.muted,
    },
    modalCancelText: {
      color: c.neutral700,
      fontWeight: '700',
    },
    modalSaveBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    modalSaveText: {
      color: c.primaryForeground,
      fontWeight: '700',
    },
    locationModalCard: {
      backgroundColor: c.surfaceElevated,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      maxHeight: '85%',
    },
    locationHelpText: {
      color: c.neutral500,
      lineHeight: 20,
      marginBottom: 12,
    },
    locationMapWrap: {
      height: 320,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: '#dbeafe',
      marginBottom: 12,
    },
    locationMap: {
      flex: 1,
    },
    locationPreviewTitle: {
      color: c.neutral900,
      fontWeight: '700',
      fontSize: 15,
    },
    locationPreviewSubtitle: {
      marginTop: 4,
      color: c.neutral500,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 12,
    },
  })
}
