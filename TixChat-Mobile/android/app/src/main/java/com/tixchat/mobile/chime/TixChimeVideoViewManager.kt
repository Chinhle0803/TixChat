package com.tixchat.mobile.chime

import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.DefaultVideoRenderView
import com.tixchat.mobile.R
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class TixChimeVideoViewManager : SimpleViewManager<DefaultVideoRenderView>() {
  override fun getName(): String = "TixChimeVideoView"

  override fun createViewInstance(reactContext: ThemedReactContext): DefaultVideoRenderView {
    return DefaultVideoRenderView(reactContext)
  }

  @ReactProp(name = "tileId", defaultInt = -1)
  fun setTileId(renderView: DefaultVideoRenderView, tileId: Int) {
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

  override fun onDropViewInstance(view: DefaultVideoRenderView) {
    val tileId = view.getTag(R.id.tix_chime_bound_tile_id) as? Int
    if (tileId != null) {
      TixChimeMeetingModule.meetingSession?.audioVideo?.unbindVideoView(tileId)
      view.setTag(R.id.tix_chime_bound_tile_id, null)
    }
    view.release()
    super.onDropViewInstance(view)
  }
}
