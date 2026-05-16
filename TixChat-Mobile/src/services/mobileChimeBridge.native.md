# TixChimeMeeting Native Bridge

Mobile call media uses Amazon Chime SDK native iOS/Android through a React Native bridge.
The JavaScript app calls `NativeModules.TixChimeMeeting` from `mobileChimeBridge.js`.

Required native methods:

```ts
startMeeting(payload: {
  meeting: object
  attendee: object
  call: object
  callType: 'audio' | 'video'
}): Promise<void>

stopMeeting(): Promise<void>
setMuted(muted: boolean): Promise<void>
setCameraEnabled(enabled: boolean): Promise<void>
switchCamera(): Promise<void>
setAudioRoute(route: 'speaker' | 'earpiece' | 'wiredHeadset' | 'bluetooth'): Promise<void>
getAudioRoutes(): Promise<Array<'speaker' | 'earpiece' | 'wiredHeadset' | 'bluetooth'>>
```

Required native events:

```ts
onMeetingStarted(payload: { callId?: string }): void
onMeetingEnded(payload: { callId?: string; reason?: string }): void
onVideoTileAdded(payload: {
  tileId: number | string
  attendeeId?: string
  userId?: string
  isLocal?: boolean
  isContent?: boolean
  videoStreamContentWidth?: number
  videoStreamContentHeight?: number
}): void
onVideoTileRemoved(payload: { tileId: number | string }): void
onActiveSpeakerChanged(payload: { attendeeId?: string; userId?: string }): void
onAudioRouteChanged(payload: { route: string; availableRoutes?: string[] }): void
onMeetingError(payload: { message: string; code?: string }): void
```

Backend must continue to return Amazon Chime SDK Meetings `Meeting` and `Attendee`
objects from:

- `POST /api/calls/start`
- `POST /api/calls/:callId/accept`
- `POST /api/calls/:callId/attendee`

Expo managed builds do not include this native module by default. Run prebuild or move to
Bare React Native, then implement this bridge with Amazon Chime SDK Android/iOS.
