import React from 'react'
import { SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { EmptyState, MobileBottomTabBar } from './ui'
import { theme } from '../theme'

const c = theme.colors

export default function CallsScreen({ onOpenChats, onOpenUrban, onOpenAssistant, onOpenProfile }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Realtime calls</Text>
        <Text style={styles.title}>Cuộc gọi</Text>
        <Text style={styles.subtitle}>Theo dõi cuộc gọi audio/video và trạng thái kết nối.</Text>
      </View>

      <View style={styles.cards}>
        <View style={styles.card}>
          <MaterialCommunityIcons name="phone-outline" style={styles.cardIcon} />
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Không có cuộc gọi đang hoạt động</Text>
            <Text style={styles.cardText}>Bắt đầu cuộc gọi từ màn hình chat để mở overlay Chime.</Text>
          </View>
        </View>
        <View style={styles.card}>
          <MaterialCommunityIcons name="video-outline" style={styles.cardIcon} />
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Video tile responsive</Text>
            <Text style={styles.cardText}>Active call screen dùng control rõ ràng, nút kết thúc tách màu nguy hiểm.</Text>
          </View>
        </View>
      </View>

      <EmptyState
        icon="clock-outline"
        title="Chưa có lịch sử cuộc gọi"
        description="Call history sẽ hiển thị khi backend cung cấp endpoint recent/missed calls."
      />

      <MobileBottomTabBar
        active="Calls"
        onNavigate={{ Chats: onOpenChats, Urban: onOpenUrban, Assistant: onOpenAssistant, Profile: onOpenProfile }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: { margin: 16, padding: 16, borderRadius: theme.radius.xl, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, ...theme.shadows.sm },
  eyebrow: { color: c.secondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  title: { marginTop: 4, color: c.neutral900, fontSize: 26, fontWeight: '900' },
  subtitle: { marginTop: 4, color: c.neutral500, fontSize: 14 },
  cards: { paddingHorizontal: 16, gap: 12 },
  card: { borderRadius: theme.radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14, flexDirection: 'row', gap: 12, ...theme.shadows.sm },
  cardIcon: { width: 42, height: 42, borderRadius: theme.radius.md, backgroundColor: c.primarySoft, color: c.primary, fontSize: 24, textAlign: 'center', textAlignVertical: 'center', lineHeight: 42 },
  cardCopy: { flex: 1 },
  cardTitle: { color: c.neutral900, fontWeight: '900', fontSize: 16 },
  cardText: { color: c.neutral500, marginTop: 4, lineHeight: 19 },
})
