package com.tixchat.mobile.chime

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class TixChimeMeetingPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    val eventEmitter = TixChimeEventEmitter(reactContext)
    return listOf(TixChimeMeetingModule(reactContext, eventEmitter))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return listOf(TixChimeVideoViewManager())
  }
}
