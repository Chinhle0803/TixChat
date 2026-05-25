import React, { useEffect, useRef } from 'react'
import { Animated, Image, StyleSheet, Text, View } from 'react-native'
import { theme } from '../theme'

const colors = theme.colors

const STATUS_MESSAGES = [
  'Đang khởi động hệ thống...',
  'Đang kết nối máy chủ...',
  'Đang tải dữ liệu...',
  'Sắp hoàn tất...',
]

export default function AppLoadingScreen({ statusMessage, isDataLoaded }) {
  const progressAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(0.6)).current
  const statusIndex = useRef(0)
  const [statusText, setStatusText] = React.useState(
    statusMessage || STATUS_MESSAGES[0]
  )

  useEffect(() => {
    // Animated progress bar — fills to ~85% over 2 seconds (minimum loading time)
    Animated.timing(progressAnim, {
      toValue: 0.85,
      duration: 2000,
      useNativeDriver: false,
    }).start()

    // Pulse effect on logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    ).start()

    // Rotate status messages
    const statusTimer = setInterval(() => {
      statusIndex.current =
        (statusIndex.current + 1) % STATUS_MESSAGES.length
      setStatusText(STATUS_MESSAGES[statusIndex.current])
    }, 2500)

    return () => clearInterval(statusTimer)
  }, [])

  useEffect(() => {
    if (statusMessage) {
      setStatusText(statusMessage)
    }
  }, [statusMessage])

  useEffect(() => {
    if (isDataLoaded) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start()
    }
  }, [isDataLoaded, progressAnim])

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <View style={styles.container}>
      {/* Decorative circuit lines */}
      <View style={styles.circuitTopRight}>
        <View style={styles.circuitLine} />
        <View style={styles.circuitDot} />
        <View style={styles.circuitLineV} />
        <View style={styles.circuitDotSmall} />
      </View>
      <View style={styles.circuitBottomLeft}>
        <View style={styles.circuitLine} />
        <View style={styles.circuitDot} />
      </View>

      {/* Logo */}
      <Animated.View
        style={[styles.logoContainer, { opacity: pulseAnim }]}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Status text */}
      <Text style={styles.statusText}>{statusText}</Text>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, { width: progressWidth }]}
        />
        <Animated.View
          style={[
            styles.progressGlow,
            { width: progressWidth, opacity: pulseAnim },
          ]}
        />
      </View>

      {/* Footer branding */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Hệ thống giao tiếp và trợ lý</Text>
        <Text style={styles.footerHighlight}>ĐÔ THỊ THÔNG MINH</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  circuitTopRight: {
    position: 'absolute',
    top: 60,
    right: 30,
    alignItems: 'flex-end',
  },
  circuitBottomLeft: {
    position: 'absolute',
    bottom: 120,
    left: 30,
  },
  circuitLine: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    borderRadius: 1,
  },
  circuitLineV: {
    width: 2,
    height: 40,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    borderRadius: 1,
    alignSelf: 'flex-end',
    marginTop: -2,
  },
  circuitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  circuitDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.info,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  logoContainer: {
    width: 176,
    height: 176,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  logo: {
    width: 136,
    height: 136,
    borderRadius: 24,
  },
  statusText: {
    color: colors.neutral700,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0,
  },
  progressTrack: {
    width: '80%',
    height: 6,
    maxWidth: 320,
    backgroundColor: colors.muted,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressGlow: {
    position: 'absolute',
    top: -2,
    left: 0,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  footerText: {
    color: colors.neutral500,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  footerHighlight: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 4,
    textTransform: 'uppercase',
  },
})
