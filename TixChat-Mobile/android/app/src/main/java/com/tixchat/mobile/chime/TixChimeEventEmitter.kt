package com.tixchat.mobile.chime

import com.amazonaws.services.chime.sdk.meetings.audiovideo.AttendeeInfo
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.VideoTileState
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class TixChimeEventEmitter(private val reactContext: ReactApplicationContext) {
  fun send(eventName: String, payload: WritableMap? = null) {
    if (!reactContext.hasActiveReactInstance()) return
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, payload ?: Arguments.createMap())
  }

  fun sendError(message: String, code: String? = null) {
    val payload = Arguments.createMap()
    payload.putString("message", message)
    if (code != null) payload.putString("code", code)
    send(EVENT_MEETING_ERROR, payload)
  }

  fun sendVideoTile(eventName: String, tileState: VideoTileState) {
    val payload = Arguments.createMap()
    payload.putInt("tileId", tileState.tileId)
    payload.putString("attendeeId", tileState.attendeeId)
    payload.putBoolean("isLocal", tileState.isLocalTile)
    payload.putBoolean("isContent", tileState.isContent)
    payload.putInt("videoStreamContentWidth", tileState.videoStreamContentWidth)
    payload.putInt("videoStreamContentHeight", tileState.videoStreamContentHeight)
    payload.putBoolean("hasVideo", true)
    payload.putBoolean("paused", tileState.pauseState.name.lowercase() != "unpaused")
    send(eventName, payload)
  }

  fun sendActiveSpeaker(attendeeInfo: AttendeeInfo) {
    val payload = Arguments.createMap()
    payload.putString("attendeeId", attendeeInfo.attendeeId)
    payload.putString("userId", attendeeInfo.externalUserId)
    send(EVENT_ACTIVE_SPEAKER_CHANGED, payload)
  }

  companion object {
    const val EVENT_MEETING_STARTED = "onMeetingStarted"
    const val EVENT_MEETING_ENDED = "onMeetingEnded"
    const val EVENT_VIDEO_TILE_ADDED = "onVideoTileAdded"
    const val EVENT_VIDEO_TILE_REMOVED = "onVideoTileRemoved"
    const val EVENT_ACTIVE_SPEAKER_CHANGED = "onActiveSpeakerChanged"
    const val EVENT_AUDIO_ROUTE_CHANGED = "onAudioRouteChanged"
    const val EVENT_MEETING_ERROR = "onMeetingError"
  }
}
