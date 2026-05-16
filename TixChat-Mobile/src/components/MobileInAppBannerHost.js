import React from 'react'
import { Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useAppTheme } from '../theme'

const getTopInset = () => {
  if (Platform.OS === 'android') {
    return Math.max(Number(StatusBar.currentHeight || 0), 10) + 10
  }

  return 54
}

const getBannerIcon = (type = '') => {
  if (type === 'call') return 'phone-in-talk'
  if (type === 'message') return 'message-text-outline'
  return 'bell-outline'
}

export default function MobileInAppBannerHost({
  banners = [],
  onOpenBanner,
  onAcceptCall,
  onDeclineCall,
  onDismiss,
}) {
  const theme = useAppTheme()
  const styles = React.useMemo(() => createStyles(theme), [theme])

  if (!Array.isArray(banners) || banners.length === 0) {
    return null
  }

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {banners.map((banner) => {
        const isCallBanner = banner?.type === 'call'
        return (
          <View key={banner.id} style={[styles.card, isCallBanner ? styles.cardCall : null]}>
            <Pressable style={styles.main} onPress={() => onOpenBanner?.(banner)}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name={getBannerIcon(banner?.type)} style={styles.icon} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.title} numberOfLines={1}>{banner?.title || 'Thông báo'}</Text>
                <Text style={styles.body} numberOfLines={2}>{banner?.body || ''}</Text>
              </View>
            </Pressable>

            <View style={styles.actions}>
              {isCallBanner ? (
                <>
                  <Pressable style={[styles.actionButton, styles.secondaryAction]} onPress={() => onDeclineCall?.(banner)}>
                    <Text style={styles.secondaryActionText}>Từ chối</Text>
                  </Pressable>
                  <Pressable style={[styles.actionButton, styles.primaryAction]} onPress={() => onAcceptCall?.(banner)}>
                    <Text style={styles.primaryActionText}>Nghe máy</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={[styles.actionButton, styles.primaryAction]} onPress={() => onOpenBanner?.(banner)}>
                  <Text style={styles.primaryActionText}>Mở chat</Text>
                </Pressable>
              )}

              <Pressable style={styles.dismissButton} onPress={() => onDismiss?.(banner?.id)}>
                <MaterialCommunityIcons name="close" style={styles.dismissIcon} />
              </Pressable>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const createStyles = (theme) => {
  const c = theme.colors

  return StyleSheet.create({
    host: {
      position: 'absolute',
      top: getTopInset(),
      left: 12,
      right: 12,
      zIndex: 60,
      gap: 10,
    },
    card: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(15, 23, 42, 0.08)',
      backgroundColor: 'rgba(255,255,255,0.97)',
      shadowColor: '#0f172a',
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 14,
      overflow: 'hidden',
    },
    cardCall: {
      borderColor: 'rgba(37, 99, 235, 0.2)',
    },
    main: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 12,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      fontSize: 20,
      color: c.primary,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: c.neutral900,
      fontSize: 14,
      fontWeight: '900',
    },
    body: {
      marginTop: 4,
      color: c.neutral600,
      fontSize: 12,
      lineHeight: 18,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingBottom: 14,
      flexWrap: 'wrap',
    },
    actionButton: {
      minHeight: 34,
      borderRadius: 999,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryAction: {
      backgroundColor: c.primary,
    },
    secondaryAction: {
      backgroundColor: c.muted,
    },
    primaryActionText: {
      color: c.primaryForeground,
      fontWeight: '800',
      fontSize: 12,
    },
    secondaryActionText: {
      color: c.neutral900,
      fontWeight: '800',
      fontSize: 12,
    },
    dismissButton: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: c.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 'auto',
    },
    dismissIcon: {
      fontSize: 18,
      color: c.neutral600,
    },
  })
}
