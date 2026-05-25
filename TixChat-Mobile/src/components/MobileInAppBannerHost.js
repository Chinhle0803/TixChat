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

const getBannerTypeLabel = (type = '') => {
  if (type === 'call') return 'Cuộc gọi'
  if (type === 'message') return 'Tin nhắn'
  return 'Thông báo'
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
        const isMessageBanner = banner?.type === 'message'
        const isJoinCallBanner = isCallBanner && banner?.data?.action === 'join'
        const cardStyle = [
          styles.card,
          isCallBanner ? styles.cardCall : null,
          isMessageBanner ? styles.cardMessage : null,
        ]
        const stripeStyle = [
          styles.typeStripe,
          isCallBanner ? styles.typeStripeCall : null,
          isMessageBanner ? styles.typeStripeMessage : null,
        ]
        const iconWrapStyle = [
          styles.iconWrap,
          isCallBanner ? styles.iconWrapCall : null,
          isMessageBanner ? styles.iconWrapMessage : null,
        ]
        const iconStyle = [
          styles.icon,
          isCallBanner ? styles.iconCall : null,
          isMessageBanner ? styles.iconMessage : null,
        ]
        const badgeStyle = [
          styles.badge,
          isCallBanner ? styles.badgeCall : null,
          isMessageBanner ? styles.badgeMessage : null,
        ]
        const badgeTextStyle = [
          styles.badgeText,
          isCallBanner ? styles.badgeTextCall : null,
          isMessageBanner ? styles.badgeTextMessage : null,
        ]
        return (
          <View key={banner.id} style={cardStyle}>
            <View style={stripeStyle} />
            <Pressable style={styles.main} onPress={() => onOpenBanner?.(banner)}>
              <View style={iconWrapStyle}>
                <MaterialCommunityIcons name={getBannerIcon(banner?.type)} style={iconStyle} />
              </View>
              <View style={styles.copy}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>{banner?.title || 'Thông báo'}</Text>
                  <View style={badgeStyle}>
                    <Text style={badgeTextStyle}>{getBannerTypeLabel(banner?.type)}</Text>
                  </View>
                </View>
                <Text style={styles.body} numberOfLines={2}>{banner?.body || ''}</Text>
              </View>
            </Pressable>

            <View style={styles.actions}>
              {isCallBanner ? (
                <>
                  <Pressable style={[styles.actionButton, styles.callDeclineAction]} onPress={() => onDeclineCall?.(banner)}>
                    <Text style={styles.callActionText}>{isJoinCallBanner ? 'Ẩn' : 'Từ chối'}</Text>
                  </Pressable>
                  <Pressable style={[styles.actionButton, styles.callAcceptAction]} onPress={() => onAcceptCall?.(banner)}>
                    <Text style={styles.callActionText}>{isJoinCallBanner ? 'Tham gia' : 'Nghe máy'}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={[styles.actionButton, styles.messageOpenAction]} onPress={() => onOpenBanner?.(banner)}>
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
    cardMessage: {
      borderColor: 'rgba(37, 99, 235, 0.22)',
      backgroundColor: '#f8fbff',
      shadowColor: '#2563eb',
      shadowOpacity: 0.16,
    },
    cardCall: {
      borderColor: 'rgba(225, 29, 72, 0.28)',
      backgroundColor: '#fff7f8',
      shadowColor: '#e11d48',
      shadowOpacity: 0.2,
    },
    typeStripe: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 5,
      backgroundColor: c.primary,
    },
    typeStripeMessage: {
      backgroundColor: '#2563eb',
    },
    typeStripeCall: {
      backgroundColor: '#e11d48',
    },
    main: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingLeft: 18,
      paddingRight: 14,
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
    iconWrapMessage: {
      backgroundColor: '#dbeafe',
    },
    iconWrapCall: {
      backgroundColor: '#ffe4e6',
    },
    icon: {
      fontSize: 20,
      color: c.primary,
    },
    iconMessage: {
      color: '#2563eb',
    },
    iconCall: {
      color: '#e11d48',
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      color: c.neutral900,
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontWeight: '900',
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: c.muted,
    },
    badgeMessage: {
      backgroundColor: '#dbeafe',
    },
    badgeCall: {
      backgroundColor: '#ffe4e6',
    },
    badgeText: {
      color: c.neutral600,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    badgeTextMessage: {
      color: '#1d4ed8',
    },
    badgeTextCall: {
      color: '#be123c',
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
    messageOpenAction: {
      backgroundColor: '#2563eb',
    },
    callAcceptAction: {
      backgroundColor: '#16a34a',
    },
    callDeclineAction: {
      backgroundColor: '#dc2626',
    },
    primaryActionText: {
      color: c.primaryForeground,
      fontWeight: '800',
      fontSize: 12,
    },
    callActionText: {
      color: '#ffffff',
      fontWeight: '900',
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
