import React from 'react'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import AppRoot from './src/AppRoot'

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <AppRoot />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
