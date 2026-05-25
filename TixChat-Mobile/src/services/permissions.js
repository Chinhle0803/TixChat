import AsyncStorage from '@react-native-async-storage/async-storage'
import { PermissionsAndroid, Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ensureLocationPermission as ensureNativeLocationPermission } from './location'

const PROMPT_KEYS = {
  mediaLibrary: 'tixchat:permissions:mediaLibraryPrompted',
  callMedia: 'tixchat:permissions:callMediaPrompted',
  bluetoothConnect: 'tixchat:permissions:bluetoothConnectPrompted',
  initialAppPermissions: 'tixchat:permissions:initialAppPermissionsPrompted',
}

const MEDIA_LIBRARY_SETTINGS_MESSAGE = 'Quyền thư viện đã bị từ chối trước đó. Hãy bật lại trong Cài đặt để tiếp tục.'

const createPermissionError = (message, code) => {
  const error = new Error(message)
  error.code = code
  return error
}

const wasPromptedBefore = async (key) => {
  try {
    return (await AsyncStorage.getItem(key)) === '1'
  } catch (_) {
    return false
  }
}

const markPrompted = async (key) => {
  try {
    await AsyncStorage.setItem(key, '1')
  } catch (_) {
    // Ignore persistence failures so permission requests still work.
  }
}

const isMediaLibraryPermissionGranted = (permission = {}) =>
  permission?.granted === true ||
  permission?.status === 'granted' ||
  permission?.accessPrivileges === 'limited'

export const ensureMediaLibraryPermission = async ({
  deniedMessage = 'Bạn cần cấp quyền thư viện ảnh để tiếp tục.',
} = {}) => {
  const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync()
  if (isMediaLibraryPermissionGranted(currentPermission)) {
    return currentPermission
  }

  const promptedBefore = await wasPromptedBefore(PROMPT_KEYS.mediaLibrary)
  if (currentPermission?.canAskAgain === false || promptedBefore) {
    throw createPermissionError(MEDIA_LIBRARY_SETTINGS_MESSAGE, 'MEDIA_LIBRARY_PERMISSION_DENIED')
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  await markPrompted(PROMPT_KEYS.mediaLibrary)

  if (!isMediaLibraryPermissionGranted(permission)) {
    throw createPermissionError(deniedMessage, 'MEDIA_LIBRARY_PERMISSION_DENIED')
  }

  return permission
}

export const ensureLocationPermission = async (options = {}) =>
  ensureNativeLocationPermission(options)

const isAndroidPermissionGranted = (value) => value === PermissionsAndroid.RESULTS.GRANTED

export const ensureBluetoothConnectPermission = async () => {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) {
    return true
  }

  const permissionName = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
  if (!permissionName) return true

  const granted = await PermissionsAndroid.check(permissionName)
  if (granted) return true

  const promptedBefore = await wasPromptedBefore(PROMPT_KEYS.bluetoothConnect)
  if (promptedBefore) {
    throw createPermissionError(
      'Quyền kết nối Bluetooth đã bị từ chối trước đó. Hãy bật lại trong Cài đặt để tiếp tục.',
      'BLUETOOTH_CONNECT_PERMISSION_DENIED'
    )
  }

  const result = await PermissionsAndroid.request(permissionName)
  await markPrompted(PROMPT_KEYS.bluetoothConnect)

  if (!isAndroidPermissionGranted(result)) {
    throw createPermissionError(
      'Bạn cần cấp quyền Bluetooth để sử dụng thiết bị âm thanh khi gọi.',
      'BLUETOOTH_CONNECT_PERMISSION_DENIED'
    )
  }

  return true
}

export const ensureCallMediaPermissions = async ({ audio = true, video = false } = {}) => {
  if (Platform.OS !== 'android') {
    return true
  }

  const permissions = []
  if (audio) permissions.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
  if (video) permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA)

  const uniquePermissions = [...new Set(permissions.filter(Boolean))]
  if (uniquePermissions.length === 0) {
    return true
  }

  const missingPermissions = []
  for (const permission of uniquePermissions) {
    const granted = await PermissionsAndroid.check(permission)
    if (!granted) missingPermissions.push(permission)
  }

  if (missingPermissions.length === 0) {
    return true
  }

  const promptedBefore = await wasPromptedBefore(PROMPT_KEYS.callMedia)
  if (promptedBefore) {
    throw createPermissionError(
      video
        ? 'Quyền camera và micro đã bị từ chối trước đó. Hãy bật lại trong Cài đặt để tiếp tục.'
        : 'Quyền micro đã bị từ chối trước đó. Hãy bật lại trong Cài đặt để tiếp tục.',
      'CALL_MEDIA_PERMISSION_DENIED'
    )
  }

  const result = await PermissionsAndroid.requestMultiple(missingPermissions)
  await markPrompted(PROMPT_KEYS.callMedia)

  const deniedPermission = missingPermissions.find((permission) => !isAndroidPermissionGranted(result?.[permission]))

  if (deniedPermission) {
    throw createPermissionError(
      video
        ? 'Bạn cần cấp quyền camera và micro để sử dụng cuộc gọi video.'
        : 'Bạn cần cấp quyền micro để sử dụng cuộc gọi.',
      'CALL_MEDIA_PERMISSION_DENIED'
    )
  }

  return true
}

export const requestInitialAppPermissions = async ({ requestNotifications } = {}) => {
  if (await wasPromptedBefore(PROMPT_KEYS.initialAppPermissions)) {
    return { skipped: true, results: [] }
  }

  await markPrompted(PROMPT_KEYS.initialAppPermissions)

  const tasks = [
    {
      key: 'location',
      run: () => ensureLocationPermission({
        deniedMessage: 'Bạn cần cấp quyền định vị để sử dụng đầy đủ tính năng của TixChat.',
      }),
    },
    {
      key: 'mediaLibrary',
      run: () => ensureMediaLibraryPermission({
        deniedMessage: 'Bạn cần cấp quyền thư viện ảnh để gửi và cập nhật hình ảnh.',
      }),
    },
    {
      key: 'callMedia',
      run: () => ensureCallMediaPermissions({ audio: true, video: true }),
    },
    {
      key: 'bluetoothConnect',
      run: () => ensureBluetoothConnectPermission(),
    },
    {
      key: 'notifications',
      run: () => (typeof requestNotifications === 'function'
        ? requestNotifications()
        : Promise.resolve(null)),
    },
  ]

  const results = []
  for (const task of tasks) {
    try {
      await task.run()
      results.push({ key: task.key, status: 'fulfilled' })
    } catch (error) {
      results.push({
        key: task.key,
        status: 'rejected',
        code: error?.code || '',
        message: error?.message || String(error || ''),
      })
    }
  }

  return { skipped: false, results }
}
