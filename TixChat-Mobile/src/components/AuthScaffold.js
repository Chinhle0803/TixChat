import React from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

export const authPalette = {
  background: '#F4F8FB',
  card: '#FFFFFE',
  surfaceTint: '#FBFDFF',
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primarySoft: '#EAF2FF',
  text: '#18181B',
  textMuted: '#71717A',
  border: '#E4E4E7',
  success: '#16A34A',
  successSoft: 'rgba(22, 163, 74, 0.10)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.10)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220, 38, 38, 0.10)',
  shadow: '#0F172A',
  decorationPrimary: 'rgba(37, 99, 235, 0.08)',
  decorationInfo: 'rgba(14, 165, 233, 0.08)',
}

export default function AuthScaffold({
  title = 'TixChat',
  subtitle = '',
  icon = 'message',
  children,
  headerExtra = null,
  maxWidth = 430,
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={[styles.decoration, styles.decorationLeft]} />
        <View style={[styles.decoration, styles.decorationTopRight]} />
        <View style={[styles.decoration, styles.decorationBottomRight]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { maxWidth }]}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <MaterialCommunityIcons name={icon} style={styles.brandIcon} />
              <Text style={styles.title}>{title}</Text>
            </View>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>

          {headerExtra}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: authPalette.background,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  decoration: {
    position: 'absolute',
    borderRadius: 999,
  },
  decorationLeft: {
    width: 240,
    height: 240,
    left: -90,
    top: 80,
    backgroundColor: authPalette.decorationPrimary,
  },
  decorationTopRight: {
    width: 180,
    height: 180,
    right: -50,
    top: 44,
    backgroundColor: authPalette.decorationInfo,
  },
  decorationBottomRight: {
    width: 220,
    height: 220,
    right: -100,
    bottom: 80,
    backgroundColor: authPalette.decorationPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    backgroundColor: authPalette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: authPalette.border,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: authPalette.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  header: {
    marginBottom: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  brandIcon: {
    fontSize: 28,
    color: authPalette.text,
  },
  title: {
    color: authPalette.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: authPalette.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
})
