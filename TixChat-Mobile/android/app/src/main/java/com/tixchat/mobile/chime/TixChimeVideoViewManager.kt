package com.tixchat.mobile.chime

import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.gl.TextureRenderView
import com.tixchat.mobile.R
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class TixChimeVideoViewManager : SimpleViewManager<TextureRenderView>() {
  override fun getName(): String = "TixChimeVideoView"

  override fun createViewInstance(reactContext: ThemedReactContext): TextureRenderView {
    return TextureRenderView(reactContext).apply {
      setOpaque(false)
    }
  }

  override fun setBackgroundColor(view: TextureRenderView, backgroundColor: Int) {
    // TextureView cannot display a background drawable; keep color on the React wrapper instead.
  }

  @ReactProp(name = "tileId", defaultInt = -1)
  fun setTileId(renderView: TextureRenderView, tileId: Int) {
    val audioVideo = TixChimeMeetingModule.meetingSession?.audioVideo ?: return
    val previousTileId = renderView.getTag(R.id.tix_chime_bound_tile_id) as? Int
    if (previousTileId != null && previousTileId != tileId) {
      audioVideo.unbindVideoView(previousTileId)
      renderView.setTag(R.id.tix_chime_bound_tile_id, null)
    }
    if (tileId < 0) return
    audioVideo.bindVideoView(renderView, tileId)
    renderView.setTag(R.id.tix_chime_bound_tile_id, tileId)
  }

  override fun onDropViewInstance(view: TextureRenderView) {
    val tileId = view.getTag(R.id.tix_chime_bound_tile_id) as? Int
    if (tileId != null) {
      TixChimeMeetingModule.meetingSession?.audioVideo?.unbindVideoView(tileId)
      view.setTag(R.id.tix_chime_bound_tile_id, null)
    }
    view.release()
    super.onDropViewInstance(view)
  }
}
