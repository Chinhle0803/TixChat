import React from 'react'
import { Platform, requireNativeComponent, View } from 'react-native'

const NativeTixChimeVideoView =
  Platform.OS === 'android' ? requireNativeComponent('TixChimeVideoView') : null

export default function TixChimeVideoView({ tileId, style }) {
  const numericTileId = Number(tileId)
  if (!NativeTixChimeVideoView || !Number.isFinite(numericTileId) || numericTileId < 0) {
    return <View style={style} />
  }

  return <NativeTixChimeVideoView style={style} tileId={numericTileId} />
}
