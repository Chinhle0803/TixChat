import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { NativeModules, Platform } from 'react-native'

const normalizeUrl = (value, fallback) => {
  const next = String(value || fallback || '').trim()
  return next.replace(/\/$/, '')
}

const extractHost = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const withoutProtocol = raw.replace(/^\w+:\/\//, '')
  const withoutPath = withoutProtocol.split('/')[0]
  return withoutPath.split(':')[0]
}

const isLoopbackHost = (value) => /^(?:127\.0\.0\.1|localhost)$/i.test(String(value || '').trim())

const resolveRuntimeHost = () => {
  const candidates = [
    Constants?.expoConfig?.hostUri,
    Constants?.manifest2?.extra?.expoClient?.hostUri,
    Constants?.manifest?.hostUri,
    Constants?.manifest?.debuggerHost,
    Constants?.experienceUrl,
    Constants?.linkingUri,
    NativeModules?.SourceCode?.scriptURL,
    NativeModules?.SourceCode?.bundleURL,
  ]

  for (const candidate of candidates) {
    const host = extractHost(candidate)
    if (host) {
      return host
    }
  }

  return ''
}

const runtimeHost = resolveRuntimeHost()
const isAndroidEmulator = __DEV__ && Platform.OS === 'android' && Device.isDevice === false
const emulatorHost = isAndroidEmulator ? '127.0.0.1' : ''
const preferredRuntimeHost = emulatorHost || runtimeHost
const runtimeApiFallback = preferredRuntimeHost ? `http://${preferredRuntimeHost}:5000/api` : ''
const runtimeSocketFallback = preferredRuntimeHost ? `http://${preferredRuntimeHost}:5000` : ''

const replaceUrlHost = (value, nextHost) => {
  const raw = String(value || '').trim()
  if (!raw || !nextHost) return raw

  try {
    const parsed = new URL(raw)
    parsed.hostname = nextHost
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return raw
  }
}

const normalizeDevUrl = (value, fallback) => {
  const normalized = normalizeUrl(value, fallback)

  if (!normalized) return normalized

  const host = extractHost(normalized)

  if (!isAndroidEmulator && runtimeHost && isLoopbackHost(host)) {
    return replaceUrlHost(normalized, runtimeHost)
  }

  if (!isAndroidEmulator) return normalized

  return normalized
    .replace(/^http:\/\/(?:10\.0\.2\.2|localhost|172\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+):5000\/api$/, 'http://127.0.0.1:5000/api')
    .replace(/^http:\/\/(?:10\.0\.2\.2|localhost|172\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+):5000$/, 'http://127.0.0.1:5000')
}

export const API_URL = normalizeDevUrl(
  process.env.EXPO_PUBLIC_API_URL,
  runtimeApiFallback || 'http://localhost:5000/api'
)

export const SOCKET_URL = normalizeDevUrl(
  process.env.EXPO_PUBLIC_SOCKET_URL,
  runtimeSocketFallback || 'http://localhost:5000'
)

export const APP_NAME = 'TixChat Mobile'

if (__DEV__) {
  const envApi = String(process.env.EXPO_PUBLIC_API_URL || '').trim()
  const envSocket = String(process.env.EXPO_PUBLIC_SOCKET_URL || '').trim()
  const runtimeHint = runtimeHost ? `runtimeHost=${runtimeHost}` : 'runtimeHost=unknown'
  const deviceHint = isAndroidEmulator ? 'androidEmulator=true' : 'androidEmulator=false'

  console.log(`[env] API_URL=${API_URL} SOCKET_URL=${SOCKET_URL} (${runtimeHint}, ${deviceHint})`)

  if (runtimeHost && envApi && !envApi.includes(runtimeHost) && !isLoopbackHost(extractHost(envApi))) {
    console.warn(
      `[env] EXPO_PUBLIC_API_URL (${envApi}) khác host runtime (${runtimeHost}). ` +
        'Nếu đổi Wi-Fi/IP, hãy cập nhật .env và restart Expo với --clear.'
    )
  }

  if (runtimeHost && envSocket && !envSocket.includes(runtimeHost) && !isLoopbackHost(extractHost(envSocket))) {
    console.warn(
      `[env] EXPO_PUBLIC_SOCKET_URL (${envSocket}) khác host runtime (${runtimeHost}). ` +
        'Nếu đổi Wi-Fi/IP, hãy cập nhật .env và restart Expo với --clear.'
    )
  }
}
