import * as Location from 'expo-location'
import {
  extractLocationFromReverseGeocode,
  normalizeProfileLocation,
} from '../utils/addressFormat'

const createLocationError = (message, code) => {
  const error = new Error(message)
  error.code = code
  return error
}

export const ensureLocationPermission = async ({
  deniedMessage = 'Bạn cần cấp quyền định vị để sử dụng tính năng này.',
} = {}) => {
  const currentPermission = await Location.getForegroundPermissionsAsync()
  if (currentPermission?.granted || currentPermission?.status === 'granted') {
    return currentPermission
  }

  if (currentPermission?.canAskAgain === false) {
    throw createLocationError(
      'Quyền định vị đã bị từ chối trước đó. Hãy bật lại trong Cài đặt để tiếp tục.',
      'LOCATION_PERMISSION_DENIED'
    )
  }

  const permission = await Location.requestForegroundPermissionsAsync()
  if (!permission?.granted && permission?.status !== 'granted') {
    throw createLocationError(deniedMessage, 'LOCATION_PERMISSION_DENIED')
  }

  return permission
}

export const getCurrentDeviceLocation = async ({
  deniedMessage,
  unavailableMessage = 'Dịch vụ định vị đang tắt hoặc không khả dụng trên thiết bị này.',
} = {}) => {
  await ensureLocationPermission({ deniedMessage })

  const servicesEnabled = await Location.hasServicesEnabledAsync()
  if (!servicesEnabled) {
    throw createLocationError(unavailableMessage, 'LOCATION_SERVICES_DISABLED')
  }

  const lastKnownLocation = await Location.getLastKnownPositionAsync({
    maxAge: 60 * 1000,
    requiredAccuracy: 200,
  }).catch(() => null)

  const location = lastKnownLocation || await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
    mayShowUserSettingsDialog: true,
  })

  const lat = Number(location?.coords?.latitude)
  const lng = Number(location?.coords?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw createLocationError('Không thể đọc tọa độ hiện tại.', 'LOCATION_UNAVAILABLE')
  }

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    accuracy: Number(location?.coords?.accuracy || 0),
  }
}

export const reverseGeocodeLocation = async ({ lat, lng }) => {
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw createLocationError('Tọa độ không hợp lệ.', 'LOCATION_INVALID_COORDINATES')
  }

  const results = await Location.reverseGeocodeAsync({ latitude, longitude })
  const address = results?.[0] || {}
  const formatted = extractLocationFromReverseGeocode({
    address: {
      house_number: address.streetNumber || '',
      road: address.street || address.name || '',
      city_district: address.district || address.subregion || '',
      district: address.district || address.subregion || '',
      city: address.city || '',
      state: address.region || '',
      province: address.region || '',
    },
  }, { lat: latitude, lng: longitude })

  return normalizeProfileLocation({
    ...formatted,
    lat: Number(latitude.toFixed(6)),
    lng: Number(longitude.toFixed(6)),
  })
}
