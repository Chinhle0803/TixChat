package com.tixchat.mobile.chime

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.amazonaws.services.chime.sdk.meetings.audiovideo.AttendeeInfo
import com.amazonaws.services.chime.sdk.meetings.audiovideo.AudioVideoObserver
import com.amazonaws.services.chime.sdk.meetings.audiovideo.SignalUpdate
import com.amazonaws.services.chime.sdk.meetings.audiovideo.VolumeUpdate
import com.amazonaws.services.chime.sdk.meetings.audiovideo.audio.activespeakerdetector.ActiveSpeakerObserver
import com.amazonaws.services.chime.sdk.meetings.audiovideo.audio.activespeakerpolicy.DefaultActiveSpeakerPolicy
import com.amazonaws.services.chime.sdk.meetings.device.DeviceChangeObserver
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.RemoteVideoSource
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.VideoTileObserver
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.VideoTileState
import com.amazonaws.services.chime.sdk.meetings.device.MediaDevice
import com.amazonaws.services.chime.sdk.meetings.device.MediaDeviceType
import com.amazonaws.services.chime.sdk.meetings.realtime.RealtimeObserver
import com.amazonaws.services.chime.sdk.meetings.session.DefaultMeetingSession
import com.amazonaws.services.chime.sdk.meetings.session.MeetingSession
import com.amazonaws.services.chime.sdk.meetings.session.MeetingSessionConfiguration
import com.amazonaws.services.chime.sdk.meetings.session.MeetingSessionCredentials
import com.amazonaws.services.chime.sdk.meetings.session.MeetingSessionStatus
import com.amazonaws.services.chime.sdk.meetings.session.MeetingSessionURLs
import com.amazonaws.services.chime.sdk.meetings.session.defaultUrlRewriter
import com.amazonaws.services.chime.sdk.meetings.utils.logger.ConsoleLogger
import com.amazonaws.services.chime.sdk.meetings.utils.logger.LogLevel
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class TixChimeMeetingModule(
  reactContext: ReactApplicationContext,
  private val eventEmitter: TixChimeEventEmitter
) : ReactContextBaseJavaModule(reactContext), PermissionListener, AudioVideoObserver,
  VideoTileObserver, RealtimeObserver, ActiveSpeakerObserver, DeviceChangeObserver {

  private val logger = ConsoleLogger(LogLevel.INFO)
  private var pendingStartPromise: Promise? = null
  private var pendingStartVideo = false
  private var currentCallId = ""

  override fun getName(): String = "TixChimeMeeting"

  @ReactMethod
  fun startMeeting(payload: ReadableMap, promise: Promise) {
    try {
      val meeting = payload.getMap("meeting")
        ?: throw IllegalArgumentException("meeting is required")
      val attendee = payload.getMap("attendee")
        ?: throw IllegalArgumentException("attendee is required")
      val call = payload.getMap("call")
      val callType = if (payload.hasKey("callType")) payload.getString("callType") ?: "audio" else "audio"
      currentCallId = call?.getStringOrEmpty("callId") ?: ""
      pendingStartVideo = callType.lowercase() == "video"

      stopMeetingInternal()
      meetingSession = DefaultMeetingSession(
        createSessionConfiguration(meeting, attendee),
        logger,
        reactApplicationContext.applicationContext
      )

      if (!hasPermissionsAlready()) {
        pendingStartPromise = promise
        val activity = reactApplicationContext.currentActivity as? PermissionAwareActivity
          ?: throw IllegalStateException("Current activity cannot request permissions")
        activity.requestPermissions(requiredPermissions(), WEBRTC_PERMISSION_REQUEST_CODE, this)
        return
      }

      startAudioVideo()
      promise.resolve(null)
    } catch (error: Exception) {
      eventEmitter.sendError(error.message ?: "Cannot start Chime meeting", "START_MEETING_FAILED")
      promise.reject("START_MEETING_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun stopMeeting(promise: Promise) {
    stopMeetingInternal()
    promise.resolve(null)
  }

  @ReactMethod
  fun setMuted(muted: Boolean, promise: Promise) {
    if (muted) {
      meetingSession?.audioVideo?.realtimeLocalMute()
    } else {
      meetingSession?.audioVideo?.realtimeLocalUnmute()
    }
    promise.resolve(null)
  }

  @ReactMethod
  fun setCameraEnabled(enabled: Boolean, promise: Promise) {
    if (enabled) {
      meetingSession?.audioVideo?.startLocalVideo()
    } else {
      meetingSession?.audioVideo?.stopLocalVideo()
    }
    promise.resolve(null)
  }

  @ReactMethod
  fun switchCamera(promise: Promise) {
    meetingSession?.audioVideo?.switchCamera()
    promise.resolve(null)
  }

  @ReactMethod
  fun setAudioRoute(route: String, promise: Promise) {
    val audioVideo = meetingSession?.audioVideo
    if (audioVideo == null) {
      promise.resolve(null)
      return
    }

    val target = audioVideo.listAudioDevices()
      .firstOrNull { routeFromDevice(it) == route }

    if (target != null && target.type != MediaDeviceType.OTHER) {
      audioVideo.chooseAudioDevice(target)
      emitAudioRoute()
    }

    promise.resolve(null)
  }

  @ReactMethod
  fun getAudioRoutes(promise: Promise) {
    val array = Arguments.createArray()
    val routes = audioRoutes()
    routes.forEach { array.pushString(it) }
    promise.resolve(array)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by NativeEventEmitter.
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<String>,
    grantResults: IntArray
  ): Boolean {
    if (requestCode != WEBRTC_PERMISSION_REQUEST_CODE) return false

    val missingPermission = grantResults?.isEmpty() != false ||
      grantResults.any { it != PackageManager.PERMISSION_GRANTED }

    val promise = pendingStartPromise
    pendingStartPromise = null

    if (missingPermission) {
      val message = "Camera/microphone/audio permissions are required for calls"
      eventEmitter.sendError(message, "PERMISSION_DENIED")
      promise?.reject("PERMISSION_DENIED", message)
      return true
    }

    startAudioVideo()
    promise?.resolve(null)
    return true
  }

  private fun startAudioVideo() {
    val session = meetingSession ?: return
    val audioVideo = session.audioVideo
    audioVideo.addRealtimeObserver(this)
    audioVideo.addVideoTileObserver(this)
    audioVideo.addAudioVideoObserver(this)
    audioVideo.addActiveSpeakerObserver(DefaultActiveSpeakerPolicy(), this)
    audioVideo.addDeviceChangeObserver(this)
    audioVideo.start()
    audioVideo.startRemoteVideo()
    if (pendingStartVideo) {
      audioVideo.startLocalVideo()
    }
    chooseDefaultSpeakerForVideo()
    emitAudioRoute()
  }

  private fun stopMeetingInternal() {
    meetingSession?.audioVideo?.let { audioVideo ->
      audioVideo.removeRealtimeObserver(this)
      audioVideo.removeVideoTileObserver(this)
      audioVideo.removeAudioVideoObserver(this)
      audioVideo.removeActiveSpeakerObserver(this)
      audioVideo.removeDeviceChangeObserver(this)
      audioVideo.stopLocalVideo()
      audioVideo.stopRemoteVideo()
      audioVideo.stop()
    }
    meetingSession = null
    pendingStartPromise = null
    pendingStartVideo = false
  }

  private fun createSessionConfiguration(meeting: ReadableMap, attendee: ReadableMap): MeetingSessionConfiguration {
    val mediaPlacement = meeting.getMap("MediaPlacement")
      ?: throw IllegalArgumentException("meeting.MediaPlacement is required")

    val meetingId = meeting.getStringOrEmpty("MeetingId")
    val externalMeetingId = meeting.getStringOrEmpty("ExternalMeetingId")
    val attendeeId = attendee.getStringOrEmpty("AttendeeId")
    val externalUserId = attendee.getStringOrEmpty("ExternalUserId")
    val joinToken = attendee.getStringOrEmpty("JoinToken")

    val urls = MeetingSessionURLs(
      mediaPlacement.getStringOrEmpty("AudioFallbackUrl"),
      mediaPlacement.getStringOrEmpty("AudioHostUrl"),
      mediaPlacement.getStringOrEmpty("TurnControlUrl"),
      mediaPlacement.getStringOrEmpty("SignalingUrl"),
      ::defaultUrlRewriter,
      mediaPlacement.getStringOrEmpty("EventIngestionUrl").ifBlank { null }
    )

    return MeetingSessionConfiguration(
      meetingId,
      externalMeetingId.ifBlank { null },
      MeetingSessionCredentials(attendeeId, externalUserId, joinToken),
      urls
    )
  }

  private fun requiredPermissions(): Array<String> {
    val permissions = mutableListOf(
      Manifest.permission.MODIFY_AUDIO_SETTINGS,
      Manifest.permission.RECORD_AUDIO
    )
    if (pendingStartVideo) {
      permissions.add(Manifest.permission.CAMERA)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
    }
    return permissions.toTypedArray()
  }

  private fun hasPermissionsAlready(): Boolean {
    val activity = reactApplicationContext.currentActivity ?: return false
    return requiredPermissions().all {
      ContextCompat.checkSelfPermission(activity, it) == PackageManager.PERMISSION_GRANTED
    }
  }

  private fun chooseDefaultSpeakerForVideo() {
    if (!pendingStartVideo) return
    val audioVideo = meetingSession?.audioVideo ?: return
    val speaker = audioVideo.listAudioDevices()
      .firstOrNull { it.type == MediaDeviceType.AUDIO_BUILTIN_SPEAKER }
    if (speaker != null) {
      audioVideo.chooseAudioDevice(speaker)
    }
  }

  private fun audioRoutes(): List<String> {
    val routes = meetingSession?.audioVideo?.listAudioDevices()
      ?.map { routeFromDevice(it) }
      ?.filter { it != "unknown" }
      ?.distinct()
      ?: emptyList()
    return routes.ifEmpty { listOf("speaker") }
  }

  private fun routeFromDevice(device: MediaDevice): String {
    return when (device.type) {
      MediaDeviceType.AUDIO_BUILTIN_SPEAKER -> "speaker"
      MediaDeviceType.AUDIO_HANDSET -> "earpiece"
      MediaDeviceType.AUDIO_WIRED_HEADSET,
      MediaDeviceType.AUDIO_USB_HEADSET -> "wiredHeadset"
      MediaDeviceType.AUDIO_BLUETOOTH -> "bluetooth"
      else -> "unknown"
    }
  }

  private fun emitAudioRoute() {
    val payload = Arguments.createMap()
    val routes = audioRoutes()
    val active = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      meetingSession?.audioVideo?.getActiveAudioDevice()
    } else {
      null
    }
    val route = active?.let { routeFromDevice(it) }?.takeIf { it != "unknown" } ?: routes.firstOrNull() ?: "speaker"
    val availableRoutes = Arguments.createArray()
    routes.forEach { availableRoutes.pushString(it) }
    payload.putString("route", route)
    payload.putArray("availableRoutes", availableRoutes)
    eventEmitter.send(TixChimeEventEmitter.EVENT_AUDIO_ROUTE_CHANGED, payload)
  }

  override fun onAudioSessionStarted(reconnecting: Boolean) {
    val payload = Arguments.createMap()
    payload.putString("callId", currentCallId)
    payload.putBoolean("reconnecting", reconnecting)
    eventEmitter.send(TixChimeEventEmitter.EVENT_MEETING_STARTED, payload)
    emitAudioRoute()
  }

  override fun onAudioSessionStopped(sessionStatus: MeetingSessionStatus) {
    val payload = Arguments.createMap()
    payload.putString("callId", currentCallId)
    payload.putString("reason", sessionStatus.statusCode?.name ?: "unknown")
    eventEmitter.send(TixChimeEventEmitter.EVENT_MEETING_ENDED, payload)
  }

  override fun onVideoTileAdded(tileState: VideoTileState) {
    eventEmitter.sendVideoTile(TixChimeEventEmitter.EVENT_VIDEO_TILE_ADDED, tileState)
  }

  override fun onVideoTileRemoved(tileState: VideoTileState) {
    eventEmitter.sendVideoTile(TixChimeEventEmitter.EVENT_VIDEO_TILE_REMOVED, tileState)
  }

  override fun onVideoTilePaused(tileState: VideoTileState) {
    eventEmitter.sendVideoTile(TixChimeEventEmitter.EVENT_VIDEO_TILE_ADDED, tileState)
  }

  override fun onVideoTileResumed(tileState: VideoTileState) {
    eventEmitter.sendVideoTile(TixChimeEventEmitter.EVENT_VIDEO_TILE_ADDED, tileState)
  }

  override fun onVideoTileSizeChanged(tileState: VideoTileState) {
    eventEmitter.sendVideoTile(TixChimeEventEmitter.EVENT_VIDEO_TILE_ADDED, tileState)
  }

  override fun onActiveSpeakerDetected(attendeeInfo: Array<AttendeeInfo>) {
    attendeeInfo.firstOrNull()?.let { eventEmitter.sendActiveSpeaker(it) }
  }

  override val scoreCallbackIntervalMs: Int? get() = null
  override fun onActiveSpeakerScoreChanged(scores: Map<AttendeeInfo, Double>) {}
  override fun onAudioSessionCancelledReconnect() {}
  override fun onAudioSessionDropped() {}
  override fun onAudioSessionStartedConnecting(reconnecting: Boolean) {}
  override fun onCameraSendAvailabilityUpdated(available: Boolean) {}
  override fun onConnectionBecamePoor() {}
  override fun onConnectionRecovered() {}
  override fun onVideoSessionStarted(sessionStatus: MeetingSessionStatus) {}
  override fun onVideoSessionStartedConnecting() {}
  override fun onVideoSessionStopped(sessionStatus: MeetingSessionStatus) {}
  override fun onRemoteVideoSourceAvailable(sources: List<RemoteVideoSource>) {}
  override fun onRemoteVideoSourceUnavailable(sources: List<RemoteVideoSource>) {}
  override fun onAttendeesJoined(attendeeInfo: Array<AttendeeInfo>) {}
  override fun onAttendeesLeft(attendeeInfo: Array<AttendeeInfo>) {}
  override fun onAttendeesDropped(attendeeInfo: Array<AttendeeInfo>) {}
  override fun onAttendeesMuted(attendeeInfo: Array<AttendeeInfo>) {}
  override fun onAttendeesUnmuted(attendeeInfo: Array<AttendeeInfo>) {}
  override fun onSignalStrengthChanged(signalUpdates: Array<SignalUpdate>) {}
  override fun onVolumeChanged(volumeUpdates: Array<VolumeUpdate>) {}
  override fun onAudioDeviceChanged(freshAudioDeviceList: List<MediaDevice>) {
    emitAudioRoute()
  }

  companion object {
    private const val WEBRTC_PERMISSION_REQUEST_CODE = 9201
    var meetingSession: MeetingSession? = null
  }
}

private fun ReadableMap.getStringOrEmpty(key: String): String {
  return if (hasKey(key) && !isNull(key)) getString(key) ?: "" else ""
}
