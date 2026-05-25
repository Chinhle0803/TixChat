import React, { useMemo } from 'react'
import { ActivityIndicator, Image, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppTheme } from '../../theme'

const variantAlias = { default: 'primary', destructive: 'danger', outline: 'ghost' }

export const Screen = ({ children, style, includeTopInset = false }) => {
  const theme = useAppTheme()
  const insets = useSafeAreaInsets()
  return (
    <SafeAreaView
      style={[
        { flex: 1, backgroundColor: theme.colors.background, paddingTop: includeTopInset ? insets.top : 0 },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  )
}

export const TopBar = ({ title, subtitle, leftAction, rightAction, style }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])

  return (
    <View style={[styles.topBar, style]}>
      <View style={styles.topBarSide}>{leftAction}</View>
      <View style={styles.topBarMain}>
        {!!title && <Text style={styles.topBarTitle}>{title}</Text>}
        {!!subtitle && <Text style={styles.topBarSubtitle}>{subtitle}</Text>}
      </View>
      <View style={[styles.topBarSide, styles.topBarSideRight]}>{rightAction}</View>
    </View>
  )
}

export const IconButton = ({ icon, tone = 'default', style, iconStyle, ...props }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  return (
    <Pressable
      style={({ pressed }) => [
        styles.iconButton,
        tone === 'accent' && styles.iconButtonAccent,
        tone === 'danger' && styles.iconButtonDanger,
        pressed && styles.pressed,
        props.disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      <MaterialCommunityIcons
        name={icon}
        style={[
          styles.iconButtonIcon,
          tone === 'danger' && styles.iconButtonIconDanger,
          iconStyle,
        ]}
      />
    </Pressable>
  )
}

export const Button = ({ variant = 'primary', size = 'md', icon, loading, children, style, textStyle, ...props }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const c = theme.colors
  const resolvedVariant = variantAlias[variant] || variant

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        styles[`button_${resolvedVariant}`],
        size === 'sm' && styles.button_sm,
        pressed && !props.disabled && styles.pressed,
        props.disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={resolvedVariant === 'ghost' ? c.primary : c.primaryForeground} />
      ) : icon ? (
        icon
      ) : null}
      {children ? (
        <Text
          style={[
            styles.buttonText,
            styles[`buttonText_${resolvedVariant}`],
            size === 'sm' && styles.buttonText_sm,
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : null}
    </Pressable>
  )
}

export const Input = ({ style, ...props }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  return <TextInput style={[styles.input, style]} placeholderTextColor={theme.colors.neutral500} {...props} />
}

export const SearchBar = ({ style, ...props }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  return (
    <View style={[styles.searchBar, style]}>
      <MaterialCommunityIcons name="magnify" style={styles.searchIcon} />
      <TextInput style={styles.searchInput} placeholderTextColor={theme.colors.neutral500} {...props} />
    </View>
  )
}

export const Card = ({ children, style }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  return <View style={[styles.card, style]}>{children}</View>
}

export const ListItem = ({ leading, title, subtitle, trailing, onPress, style }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])

  return (
    <Pressable style={({ pressed }) => [styles.listItem, pressed && styles.pressed, style]} onPress={onPress}>
      {leading ? <View style={styles.listItemLeading}>{leading}</View> : null}
      <View style={styles.listItemBody}>
        <Text style={styles.listItemTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.listItemSubtitle}>{subtitle}</Text>}
      </View>
      {trailing ? <View style={styles.listItemTrailing}>{trailing}</View> : null}
    </Pressable>
  )
}

export const Avatar = ({ uri, name = 'TixChat', size = 44, online, group }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const initials = String(name || 'TC')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'TC'

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: group ? theme.radius.lg : size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: group ? theme.radius.lg : size / 2 }} />
      ) : (
        <Text style={styles.avatarText}>{initials}</Text>
      )}
      {online ? <View style={styles.onlineDot} /> : null}
    </View>
  )
}

export const Badge = ({ tone = 'neutral', children, style, textStyle }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  return (
    <View style={[styles.badge, styles[`badge_${tone}`], style]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`], textStyle]}>{children}</Text>
    </View>
  )
}

export const Chip = ({ active, children, style, textStyle, ...props }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  return (
    <Pressable style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed, style]} {...props}>
      <Text style={[styles.chipText, active && styles.chipTextActive, textStyle]}>{children}</Text>
    </Pressable>
  )
}

export const EmptyState = ({ icon = 'chat-outline', title, description }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <MaterialCommunityIcons name={icon} style={styles.emptyIcon} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!description && <Text style={styles.emptyDescription}>{description}</Text>}
    </View>
  )
}

export const LoadingState = ({ label = 'Đang tải...' }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  return (
    <View style={styles.stateWrap}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  )
}

export const ErrorState = ({ label = 'Đã có lỗi xảy ra' }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  return (
    <View style={styles.stateWrap}>
      <MaterialCommunityIcons name="alert-circle-outline" style={styles.errorIcon} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  )
}

export const Skeleton = ({ style }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  return <View style={[styles.skeleton, style]} />
}

export const MobileBottomTabBar = ({ active = 'Chats', onNavigate = {}, extraInset = 0, badges = {} }) => {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const insets = useSafeAreaInsets()
  const bottomInset = Math.max(insets.bottom, 8) + extraInset
  const tabs = [
    ['Chats', 'message-text-outline', 'Tin nhắn'],
    ['Friends', 'card-account-details-outline', 'Danh bạ'],
    ['Urban', 'map-marker-radius-outline', 'Đô thị'],
    ['Assistant', 'robot-outline', 'Trợ lý'],
    ['Profile', 'account-outline', 'Hồ sơ'],
  ]

  return (
    <View style={[styles.bottomTabs, { paddingBottom: bottomInset }]}>
      {tabs.map(([key, icon, label]) => {
        const isActive = active === key
        return (
          <Pressable key={key} style={[styles.tabItem, isActive && styles.tabItemActive]} onPress={onNavigate[key]}>
            <MaterialCommunityIcons name={icon} style={[styles.tabIcon, isActive && styles.tabIconActive]} />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
            {Number(badges?.[key]) > 0 ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{Number(badges[key]) > 99 ? '99+' : String(badges[key])}</Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

export const AppBottomTabBar = MobileBottomTabBar

const createStyles = (theme) => {
  const c = theme.colors

  return StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    topBarSide: {
      width: 44,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    topBarSideRight: {
      alignItems: 'flex-end',
    },
    topBarMain: {
      flex: 1,
    },
    topBarTitle: {
      color: c.neutral900,
      fontSize: theme.type.xl,
      fontWeight: '800',
    },
    topBarSubtitle: {
      marginTop: 2,
      color: c.neutral500,
      fontSize: theme.type.sm,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent,
    },
    iconButtonAccent: {
      backgroundColor: c.primarySoft,
    },
    iconButtonDanger: {
      backgroundColor: c.dangerSoft,
    },
    iconButtonIcon: {
      fontSize: 22,
      color: c.primary,
    },
    iconButtonIconDanger: {
      color: c.danger,
    },
    button: {
      minHeight: 42,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing[4],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing[2],
    },
    button_sm: { minHeight: 34, paddingHorizontal: theme.spacing[3] },
    button_primary: { backgroundColor: c.primary },
    button_secondary: { backgroundColor: c.secondary },
    button_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
    button_danger: { backgroundColor: c.danger },
    pressed: { opacity: 0.86 },
    disabled: { opacity: 0.55 },
    buttonText: { color: c.primaryForeground, fontWeight: '800', fontSize: theme.type.sm },
    buttonText_sm: { fontSize: theme.type.xs },
    buttonText_secondary: { color: c.secondaryForeground },
    buttonText_ghost: { color: c.neutral700 },
    buttonText_danger: { color: '#FFFFFF' },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: c.input,
      borderRadius: theme.radius.md,
      backgroundColor: c.surface,
      color: c.neutral900,
      paddingHorizontal: theme.spacing[3],
      fontSize: theme.type.base,
    },
    searchBar: {
      minHeight: 44,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: theme.spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    searchIcon: { color: c.neutral500, fontSize: 22 },
    searchInput: { flex: 1, color: c.neutral900, fontSize: theme.type.base, paddingVertical: 0 },
    card: {
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      padding: theme.spacing[4],
      ...theme.shadows.sm,
    },
    listItem: {
      minHeight: 64,
      borderRadius: theme.radius.lg,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    listItemLeading: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    listItemBody: {
      flex: 1,
    },
    listItemTitle: {
      color: c.neutral900,
      fontSize: theme.type.base,
      fontWeight: '700',
    },
    listItemSubtitle: {
      marginTop: 2,
      color: c.neutral500,
      fontSize: theme.type.sm,
    },
    listItemTrailing: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    avatar: {
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: c.primary, fontWeight: '900' },
    onlineDot: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.success,
      borderWidth: 2,
      borderColor: c.surface,
    },
    badge: {
      minHeight: 22,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge_neutral: { backgroundColor: c.muted },
    badge_success: { backgroundColor: c.successSoft },
    badge_warning: { backgroundColor: c.warningSoft },
    badge_danger: { backgroundColor: c.dangerSoft },
    badge_info: { backgroundColor: c.infoSoft },
    badgeText: { fontSize: theme.type.xs, fontWeight: '800', color: c.neutral700 },
    badgeText_success: { color: c.success },
    badgeText_warning: { color: c.warning },
    badgeText_danger: { color: c.danger },
    badgeText_info: { color: c.info },
    chip: {
      minHeight: 38,
      paddingHorizontal: theme.spacing[3],
      borderRadius: theme.radius.pill,
      backgroundColor: c.accent,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    chipText: {
      color: c.primary,
      fontWeight: '700',
    },
    chipTextActive: {
      color: c.primaryForeground,
    },
    emptyState: { alignItems: 'center', justifyContent: 'center', padding: theme.spacing[8], gap: theme.spacing[2] },
    emptyIconWrap: { width: 52, height: 52, borderRadius: theme.radius.lg, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
    emptyIcon: { fontSize: 26, color: c.primary },
    emptyTitle: { fontSize: theme.type.lg, color: c.neutral900, fontWeight: '800', textAlign: 'center' },
    emptyDescription: { fontSize: theme.type.sm, color: c.neutral500, textAlign: 'center' },
    stateWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing[6],
      gap: theme.spacing[2],
    },
    stateText: {
      color: c.neutral500,
      fontSize: theme.type.sm,
      textAlign: 'center',
    },
    errorIcon: {
      fontSize: 24,
      color: c.danger,
    },
    skeleton: { height: 14, borderRadius: theme.radius.pill, backgroundColor: c.neutral100 },
    bottomTabs: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 40,
      elevation: 18,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: 'rgba(226, 232, 240, 0.86)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingTop: theme.spacing[2],
      minHeight: 64,
      shadowColor: '#0F172A',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: -6 },
    },
    tabItem: {
      alignItems: 'center',
      flex: 1,
      gap: 2,
      position: 'relative',
      marginHorizontal: 4,
      paddingVertical: 6,
      borderRadius: theme.radius.pill,
    },
    tabItemActive: {
      backgroundColor: c.primarySoft,
    },
    tabIcon: { fontSize: 22, color: c.neutral500 },
    tabIconActive: { color: c.primary },
    tabLabel: { fontSize: theme.type.xs, color: c.neutral500, fontWeight: '700', lineHeight: 15 },
    tabLabelActive: { color: c.primary, fontWeight: '900' },
    tabBadge: {
      position: 'absolute',
      top: -2,
      right: '26%',
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.surface,
    },
    tabBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
    },
  })
}
