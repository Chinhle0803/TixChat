import React from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { theme } from '../../theme'

const c = theme.colors

const variantAlias = { default: 'primary', destructive: 'danger', outline: 'ghost' }

export const Button = ({ variant = 'primary', size = 'md', icon, loading, children, style, textStyle, ...props }) => {
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
    {loading ? <ActivityIndicator color={resolvedVariant === 'ghost' ? c.primary : '#fff'} /> : icon ? icon : null}
    {children ? <Text style={[styles.buttonText, styles[`buttonText_${resolvedVariant}`], size === 'sm' && styles.buttonText_sm, textStyle]}>{children}</Text> : null}
  </Pressable>
  )
}

export const Input = ({ style, ...props }) => <TextInput style={[styles.input, style]} placeholderTextColor={c.neutral500} {...props} />

export const SearchBar = ({ style, ...props }) => (
  <View style={[styles.searchBar, style]}>
    <MaterialCommunityIcons name="magnify" style={styles.searchIcon} />
    <TextInput style={styles.searchInput} placeholderTextColor={c.neutral500} {...props} />
  </View>
)

export const Avatar = ({ uri, name = 'TixChat', size = 44, online, group }) => {
  const initials = String(name || 'TC').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'TC'
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: group ? theme.radius.lg : size / 2 }]}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: group ? theme.radius.lg : size / 2 }} /> : <Text style={styles.avatarText}>{initials}</Text>}
      {online ? <View style={styles.onlineDot} /> : null}
    </View>
  )
}

export const Badge = ({ tone = 'neutral', children, style, textStyle }) => (
  <View style={[styles.badge, styles[`badge_${tone}`], style]}>
    <Text style={[styles.badgeText, styles[`badgeText_${tone}`], textStyle]}>{children}</Text>
  </View>
)

export const EmptyState = ({ icon = 'chat-outline', title, description }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconWrap}>
      <MaterialCommunityIcons name={icon} style={styles.emptyIcon} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {!!description && <Text style={styles.emptyDescription}>{description}</Text>}
  </View>
)

export const Skeleton = ({ style }) => <View style={[styles.skeleton, style]} />

export const MobileBottomTabBar = ({ active = 'Chats', onNavigate = {} }) => {
  const tabs = [
    ['Chats', 'message-text-outline', 'Chats'],
    ['Calls', 'phone-outline', 'Calls'],
    ['Urban', 'map-marker-radius-outline', 'Urban'],
    ['Assistant', 'robot-outline', 'Assistant'],
    ['Profile', 'account-outline', 'Profile'],
  ]

  return (
    <View style={styles.bottomTabs}>
      {tabs.map(([key, icon, label]) => {
        const isActive = active === key
        return (
          <Pressable key={key} style={styles.tabItem} onPress={onNavigate[key]}>
            <MaterialCommunityIcons name={icon} style={[styles.tabIcon, isActive && styles.tabIconActive]} />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
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
  buttonText: { color: '#fff', fontWeight: '800', fontSize: theme.type.sm },
  buttonText_sm: { fontSize: theme.type.xs },
  buttonText_secondary: { color: c.neutral900 },
  buttonText_ghost: { color: c.neutral700 },
  buttonText_danger: { color: '#fff' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: c.border,
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
  badge: { minHeight: 22, borderRadius: theme.radius.pill, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  badge_neutral: { backgroundColor: c.neutral100 },
  badge_success: { backgroundColor: '#DCFCE7' },
  badge_warning: { backgroundColor: '#FEF3C7' },
  badge_danger: { backgroundColor: '#FEE2E2' },
  badge_info: { backgroundColor: '#E0F2FE' },
  badgeText: { fontSize: theme.type.xs, fontWeight: '800', color: c.neutral700 },
  badgeText_success: { color: c.success },
  badgeText_warning: { color: '#92400E' },
  badgeText_danger: { color: c.danger },
  badgeText_info: { color: c.info },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: theme.spacing[8], gap: theme.spacing[2] },
  emptyIconWrap: { width: 52, height: 52, borderRadius: theme.radius.lg, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 26, color: c.primary },
  emptyTitle: { fontSize: theme.type.lg, color: c.neutral900, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { fontSize: theme.type.sm, color: c.neutral500, textAlign: 'center' },
  skeleton: { height: 14, borderRadius: theme.radius.pill, backgroundColor: c.neutral100 },
  bottomTabs: {
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: theme.spacing[2],
  },
  tabItem: { alignItems: 'center', flex: 1, gap: 2 },
  tabIcon: { fontSize: 22, color: c.neutral500 },
  tabIconActive: { color: c.primary },
  tabLabel: { fontSize: theme.type.xs, color: c.neutral500, fontWeight: '700' },
  tabLabelActive: { color: c.primary },
})
