import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import TixChimeVideoView from './TixChimeVideoView'

const MAX_VISIBLE_TILES = 6

const formatDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Number(seconds || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const rest = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'object') return String(value._id || value.userId || value.id || '')
  return String(value)
}

const getRouteLabel = (route) => {
  const map = {
    speaker: 'Loa ngoài',
    earpiece: 'Loa trong',
    wiredHeadset: 'Tai nghe',
    bluetooth: 'Bluetooth',
    unknown: 'Không rõ',
  }
  return map[route] || route || 'Loa ngoài'
}

const getParticipantName = (participant) => {
  if (!participant || typeof participant === 'string') return 'Người dùng'
  return (
    participant.nickname ||
    participant.displayName ||
    participant.fullName ||
    participant.name ||
    participant.username ||
    'Người dùng'
  )
}

const buildVisibleTiles = ({ call, videoTiles, activeSpeakerId, isCameraEnabled }) => {
  const normalizedTiles = Array.isArray(videoTiles) ? videoTiles : []
  const participantIds = Array.isArray(call?.participantIds) ? call.participantIds.map(normalizeId).filter(Boolean) : []
  const callerId = normalizeId(call?.callerId)
  const calleeId = normalizeId(call?.calleeId)
  const fallbackIds = [...new Set([callerId, calleeId, ...participantIds].filter(Boolean))]

  const tiles = normalizedTiles.length > 0
    ? normalizedTiles
    : fallbackIds.map((userId, index) => ({
      tileId: `placeholder-${userId || index}`,
      userId,
      attendeeId: userId,
      isLocal: index === 0,
      hasVideo: index === 0 ? Boolean(isCameraEnabled) : false,
    }))

  return [...tiles]
    .sort((a, b) => {
      const aActive = normalizeId(a.attendeeId || a.userId) === normalizeId(activeSpeakerId)
      const bActive = normalizeId(b.attendeeId || b.userId) === normalizeId(activeSpeakerId)
      if (a.isLocal && !b.isLocal) return -1
      if (!a.isLocal && b.isLocal) return 1
      if (aActive && !bActive) return -1
      if (!aActive && bActive) return 1
      if (a.hasVideo && !b.hasVideo) return -1
      if (!a.hasVideo && b.hasVideo) return 1
      return 0
    })
    .slice(0, MAX_VISIBLE_TILES)
}

function VideoTileGrid({ call, videoTiles, activeSpeakerId, isCameraEnabled }) {
  const visibleTiles = useMemo(
    () => buildVisibleTiles({ call, videoTiles, activeSpeakerId, isCameraEnabled }),
    [activeSpeakerId, call, isCameraEnabled, videoTiles]
  )

  const gridStyle = visibleTiles.length <= 1
    ? styles.gridOne
    : visibleTiles.length === 2
      ? styles.gridTwo
      : styles.gridMany

  if (visibleTiles.length === 0) {
    return (
      <View style={[styles.videoGrid, styles.gridOne]}>
        <View style={styles.emptyTile}>
          <MaterialCommunityIcons name="video-outline" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>Đang chờ video</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.videoGrid, gridStyle]}>
      {visibleTiles.map((tile) => {
        const tileId = normalizeId(tile.tileId || tile.attendeeId || tile.userId)
        const isActive = normalizeId(tile.attendeeId || tile.userId) === normalizeId(activeSpeakerId)
        const hasVideo = tile.hasVideo !== false && !tile.paused
        return (
          <View
            key={tileId}
            style={[
              styles.videoTile,
              visibleTiles.length <= 2 ? styles.videoTileLarge : styles.videoTileCompact,
              isActive ? styles.activeTile : null,
            ]}
          >
            {hasVideo ? (
              <View style={styles.nativeVideoPlaceholder}>
                <TixChimeVideoView tileId={tile.tileId} style={styles.nativeVideoView} />
                <View style={styles.tileBadge}>
                  <Text style={styles.tileBadgeText}>{tile.isLocal ? 'Bạn' : 'Video'}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.avatarTile}>
                <MaterialCommunityIcons name="account" style={styles.avatarIcon} />
                <Text style={styles.tileText}>{tile.isLocal ? 'Camera tắt' : 'Chưa bật camera'}</Text>
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

function AudioCallPanel({ call, phase, activeSpeakerId, isMuted }) {
  const participantIds = Array.isArray(call?.participantIds) ? call.participantIds.map(normalizeId).filter(Boolean) : []
  const ids = [...new Set([call?.callerId, call?.calleeId, ...participantIds].map(normalizeId).filter(Boolean))]
  const activeId = normalizeId(activeSpeakerId)

  return (
    <View style={styles.audioPanel}>
      <View style={[styles.audioAvatar, isMuted ? styles.audioAvatarMuted : null]}>
        <MaterialCommunityIcons name={isMuted ? 'microphone-off' : 'phone-in-talk'} style={styles.audioHeroIcon} />
      </View>
      <Text style={styles.audioTitle}>
        {phase === 'active' ? 'Đang kết nối âm thanh' : 'Đang chuẩn bị cuộc gọi'}
      </Text>
      <Text style={styles.audioSubtitle}>
        {ids.length > 1 ? `${ids.length} người tham gia` : getParticipantName(call?.callee || call?.caller)}
      </Text>
      {activeId ? (
        <View style={styles.speakerPill}>
          <MaterialCommunityIcons name="volume-high" style={styles.speakerIcon} />
          <Text style={styles.speakerText}>{activeId.slice(0, 12)}</Text>
        </View>
      ) : null}
    </View>
  )
}

function ParticipantStrip({ call, activeSpeakerId }) {
  const participantIds = Array.isArray(call?.participantIds) ? call.participantIds.map(normalizeId).filter(Boolean) : []
  const ids = [...new Set([call?.callerId, call?.calleeId, ...participantIds].map(normalizeId).filter(Boolean))]
  if (ids.length <= MAX_VISIBLE_TILES) return null

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.participantStrip}>
      {ids.slice(MAX_VISIBLE_TILES).map((id) => {
        const active = id === normalizeId(activeSpeakerId)
        return (
          <View key={id} style={[styles.participantChip, active ? styles.activeParticipantChip : null]}>
            <MaterialCommunityIcons name="account-circle" style={styles.participantIcon} />
            <Text style={styles.participantText} numberOfLines={1}>{id.slice(0, 8)}</Text>
          </View>
        )
      })}
    </ScrollView>
  )
}

export default function MobileCallOverlay({
  visible,
  call,
  phase,
  error,
  isMuted,
  isCameraEnabled,
  videoTiles = [],
  activeSpeakerId = '',
  audioRoute = 'speaker',
  availableAudioRoutes = ['speaker'],
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onSelectAudioRoute,
}) {
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!visible || phase !== 'active') {
      setDuration(0)
      return undefined
    }

    const acceptedAt = Number(call?.acceptedAt || call?.answeredAt || Date.now())
    const update = () => {
      setDuration(Math.max(0, Math.floor((Date.now() - acceptedAt) / 1000)))
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [call?.acceptedAt, call?.answeredAt, phase, visible])

  const callType = String(call?.callType || '').toLowerCase() === 'video' ? 'video' : 'thoại'
  const isVideoCall = callType === 'video'
  const title = useMemo(() => {
    if (phase === 'incoming') return `Cuộc gọi ${callType} đến`
    if (phase === 'ringing') return `Đang gọi ${callType}`
    if (phase === 'joining') return 'Đang kết nối'
    if (phase === 'starting') return 'Đang bắt đầu cuộc gọi'
    if (phase === 'active') return `Đang gọi ${callType}`
    return 'Cuộc gọi'
  }, [callType, phase])

  return (
    <Modal transparent={false} visible={Boolean(visible)} animationType="slide" statusBarTranslucent>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {phase === 'active' ? formatDuration(duration) : 'Amazon Chime SDK Meetings'}
            </Text>
          </View>
          <View style={styles.routePill}>
            <MaterialCommunityIcons name="volume-high" style={styles.routeIcon} />
            <Text style={styles.routeText}>{getRouteLabel(audioRoute)}</Text>
          </View>
        </View>

        {phase === 'incoming' ? (
          <View style={styles.incomingPanel}>
            <View style={styles.incomingIconCircle}>
              <MaterialCommunityIcons name={isVideoCall ? 'video-outline' : 'phone-outline'} style={styles.heroIcon} />
            </View>
            <Text style={styles.incomingTitle}>{title}</Text>
            <Text style={styles.incomingSubtitle}>{getParticipantName(call?.caller)}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.incomingActions}>
              <Pressable style={[styles.actionButton, styles.acceptButton]} onPress={onAccept}>
                <MaterialCommunityIcons name="phone" style={styles.actionIcon} />
                <Text style={styles.actionText}>Nghe máy</Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.endButton]} onPress={onDecline}>
                <MaterialCommunityIcons name="phone-hangup" style={styles.actionIcon} />
                <Text style={styles.actionText}>Từ chối</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {isVideoCall ? (
              <>
                <VideoTileGrid
                  call={call}
                  videoTiles={videoTiles}
                  activeSpeakerId={activeSpeakerId}
                  isCameraEnabled={isCameraEnabled}
                />
                <ParticipantStrip call={call} activeSpeakerId={activeSpeakerId} />
              </>
            ) : (
              <AudioCallPanel
                call={call}
                phase={phase}
                activeSpeakerId={activeSpeakerId}
                isMuted={isMuted}
              />
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.audioRoutes}>
              {availableAudioRoutes.map((route) => (
                <Pressable
                  key={route}
                  style={[styles.audioRouteButton, route === audioRoute ? styles.audioRouteActive : null]}
                  onPress={() => onSelectAudioRoute?.(route)}
                >
                  <Text style={[styles.audioRouteText, route === audioRoute ? styles.audioRouteTextActive : null]}>
                    {getRouteLabel(route)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.controls}>
              <Pressable style={styles.roundButton} onPress={onToggleMute} disabled={phase !== 'active'}>
                <MaterialCommunityIcons name={isMuted ? 'microphone-off' : 'microphone'} style={styles.roundIcon} />
              </Pressable>
              {isVideoCall ? (
                <>
                  <Pressable style={styles.roundButton} onPress={onToggleCamera} disabled={phase !== 'active'}>
                    <MaterialCommunityIcons name={isCameraEnabled ? 'video' : 'video-off'} style={styles.roundIcon} />
                  </Pressable>
                  <Pressable style={styles.roundButton} onPress={onSwitchCamera} disabled={phase !== 'active'}>
                    <MaterialCommunityIcons name="camera-switch" style={styles.roundIcon} />
                  </Pressable>
                </>
              ) : null}
              <Pressable style={[styles.roundButton, styles.endRoundButton]} onPress={onEnd}>
                <MaterialCommunityIcons name="phone-hangup" style={styles.roundIconEnd} />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 28,
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    color: '#cbd5e1',
    fontSize: 13,
  },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  routeIcon: {
    color: '#bfdbfe',
    fontSize: 16,
  },
  routeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  videoGrid: {
    flex: 1,
    marginTop: 18,
    gap: 10,
  },
  gridOne: {
    flexDirection: 'column',
  },
  gridTwo: {
    flexDirection: 'column',
  },
  gridMany: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'stretch',
  },
  videoTile: {
    borderRadius: 8,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  videoTileLarge: {
    flex: 1,
  },
  videoTileCompact: {
    width: '48.5%',
    minHeight: 148,
    flexGrow: 1,
  },
  activeTile: {
    borderColor: '#38bdf8',
    borderWidth: 2,
  },
  nativeVideoPlaceholder: {
    flex: 1,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
  },
  nativeVideoView: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#020617',
  },
  tileBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tileBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  avatarTile: {
    flex: 1,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
  },
  emptyTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  emptyIcon: {
    color: '#93c5fd',
    fontSize: 38,
  },
  emptyText: {
    marginTop: 8,
    color: '#dbeafe',
    fontSize: 14,
    fontWeight: '700',
  },
  tileIcon: {
    color: '#93c5fd',
    fontSize: 34,
  },
  avatarIcon: {
    color: '#cbd5e1',
    fontSize: 42,
  },
  tileText: {
    marginTop: 8,
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  tileSubText: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 11,
  },
  participantStrip: {
    maxHeight: 52,
    marginTop: 10,
  },
  participantChip: {
    height: 42,
    maxWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    marginRight: 8,
    gap: 6,
  },
  activeParticipantChip: {
    backgroundColor: '#075985',
  },
  participantIcon: {
    color: '#dbeafe',
    fontSize: 18,
  },
  participantText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  audioPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  audioAvatar: {
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#38bdf8',
  },
  audioAvatarMuted: {
    backgroundColor: '#fee2e2',
    borderColor: '#f87171',
  },
  audioHeroIcon: {
    color: '#075985',
    fontSize: 52,
  },
  audioTitle: {
    marginTop: 20,
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
  audioSubtitle: {
    marginTop: 7,
    color: '#cbd5e1',
    fontSize: 14,
    textAlign: 'center',
  },
  speakerPill: {
    marginTop: 14,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  speakerIcon: {
    color: '#bfdbfe',
    fontSize: 16,
  },
  speakerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  audioRoutes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
  },
  audioRouteButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  audioRouteActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#dbeafe',
  },
  audioRouteText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  audioRouteTextActive: {
    color: '#0f172a',
  },
  controls: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  roundButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endRoundButton: {
    backgroundColor: '#dc2626',
  },
  roundIcon: {
    color: '#0f172a',
    fontSize: 24,
  },
  roundIconEnd: {
    color: '#ffffff',
    fontSize: 24,
  },
  incomingPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingIconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    color: '#0369a1',
    fontSize: 42,
  },
  incomingTitle: {
    marginTop: 18,
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  incomingSubtitle: {
    marginTop: 6,
    color: '#cbd5e1',
    fontSize: 14,
    textAlign: 'center',
  },
  incomingActions: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  actionButton: {
    minWidth: 118,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#16a34a',
  },
  endButton: {
    backgroundColor: '#dc2626',
  },
  actionIcon: {
    color: '#ffffff',
    fontSize: 22,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  error: {
    marginTop: 12,
    color: '#fecaca',
    backgroundColor: 'rgba(127, 29, 29, 0.55)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    lineHeight: 19,
    textAlign: 'center',
  },
})
