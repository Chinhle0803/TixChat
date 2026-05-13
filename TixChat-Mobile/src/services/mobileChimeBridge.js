import { NativeEventEmitter, NativeModules, Platform } from 'react-native'

const nativeBridge = NativeModules?.TixChimeMeeting || null
const nativeEmitter = nativeBridge ? new NativeEventEmitter(nativeBridge) : null

export const isMobileChimeBridgeAvailable = () =>
  Boolean(
    nativeBridge &&
    typeof nativeBridge.startMeeting === 'function' &&
    typeof nativeBridge.stopMeeting === 'function'
  )

const createMissingBridgeError = () => {
  const platformLabel = Platform.OS === 'ios' ? 'iOS' : 'Android'
  return new Error(
    `Thiếu native Amazon Chime SDK bridge cho ${platformLabel}. Cần prebuild/Bare React Native và module TixChimeMeeting để join media call.`
  )
}

export const startMobileChimeMeeting = async ({ meeting, attendee, call }) => {
  if (!isMobileChimeBridgeAvailable()) {
    throw createMissingBridgeError()
  }

  return nativeBridge.startMeeting({
    meeting,
    attendee,
    call,
    callType: call?.callType || 'audio',
  })
}

export const stopMobileChimeMeeting = async () => {
  if (!nativeBridge || typeof nativeBridge.stopMeeting !== 'function') return
  return nativeBridge.stopMeeting()
}

export const setMobileChimeMuted = async (muted) => {
  if (!nativeBridge || typeof nativeBridge.setMuted !== 'function') return
  return nativeBridge.setMuted(Boolean(muted))
}

export const setMobileChimeCameraEnabled = async (enabled) => {
  if (!nativeBridge || typeof nativeBridge.setCameraEnabled !== 'function') return
  return nativeBridge.setCameraEnabled(Boolean(enabled))
}

export const switchMobileChimeCamera = async () => {
  if (!nativeBridge || typeof nativeBridge.switchCamera !== 'function') return
  return nativeBridge.switchCamera()
}

export const setMobileChimeAudioRoute = async (route) => {
  if (!nativeBridge || typeof nativeBridge.setAudioRoute !== 'function') return
  return nativeBridge.setAudioRoute(String(route || 'speaker'))
}

export const getMobileChimeAudioRoutes = async () => {
  if (!nativeBridge || typeof nativeBridge.getAudioRoutes !== 'function') {
    return ['speaker']
  }

  const routes = await nativeBridge.getAudioRoutes()
  return Array.isArray(routes) && routes.length > 0 ? routes : ['speaker']
}

export const addMobileChimeEventListener = (eventName, handler) => {
  if (!nativeEmitter || typeof handler !== 'function') {
    return { remove: () => {} }
  }

  return nativeEmitter.addListener(eventName, handler)
}

export const MOBILE_CHIME_EVENTS = {
  MEETING_STARTED: 'onMeetingStarted',
  MEETING_ENDED: 'onMeetingEnded',
  VIDEO_TILE_ADDED: 'onVideoTileAdded',
  VIDEO_TILE_REMOVED: 'onVideoTileRemoved',
  ACTIVE_SPEAKER_CHANGED: 'onActiveSpeakerChanged',
  AUDIO_ROUTE_CHANGED: 'onAudioRouteChanged',
  MEETING_ERROR: 'onMeetingError',
}
