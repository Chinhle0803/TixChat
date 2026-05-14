import React, { useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Button, Card, Input, MobileBottomTabBar, Screen } from './ui'
import { useAppTheme } from '../theme'

const suggestions = [
  'Tình hình giao thông gần tôi thế nào?',
  'Có sự cố hạ tầng nào mới không?',
  'Tôi muốn báo cáo ngập nước',
  'Khu vực này có cảnh báo gì không?',
]

export default function AssistantScreen({ onOpenChats, onOpenFriends, onOpenUrban, onOpenProfile, friendRequestCount = 0 }) {
  const theme = useAppTheme()
  const c = theme.colors
  const styles = createStyles(theme)
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const ask = (value = text) => {
    const question = String(value || '').trim()
    if (!question || loading) return

    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: 'user', content: question }])
    setText('')
    setLoading(true)
    setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: 'Mình đã sẵn sàng kết nối AI/RAG backend. Hiện tại bạn có thể mở Urban Feed để xem dữ liệu sự cố mới nhất hoặc tạo báo cáo nhanh.',
          sources: 'Urban Incident Feed',
        },
      ])
      setLoading(false)
    }, 600)
  }

  return (
    <Screen style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Card style={styles.header}>
          <View style={styles.aiIcon}>
            <MaterialCommunityIcons name="robot-outline" style={styles.aiIconText} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Smart City Assistant</Text>
            <Text style={styles.title}>Trợ lý đô thị</Text>
            <Text style={styles.subtitle}>Hỏi nhanh về giao thông, hạ tầng và cảnh báo khu vực.</Text>
          </View>
        </Card>

        {messages.length === 0 ? (
          <View style={styles.welcome}>
            {suggestions.map((item) => (
              <Pressable key={item} style={styles.suggestion} onPress={() => ask(item)}>
                <Text style={styles.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.thread}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                <Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>{item.content}</Text>
                {!!item.sources && <Text style={styles.sourceText}>Nguồn: {item.sources}</Text>}
              </View>
            )}
            ListFooterComponent={loading ? <Text style={styles.loadingText}>Assistant đang phân tích dữ liệu đô thị...</Text> : null}
          />
        )}

        <View style={styles.composer}>
          <Input
            value={text}
            onChangeText={setText}
            placeholder="Nhập câu hỏi..."
            style={styles.input}
          />
          <Button onPress={() => ask()} disabled={!text.trim() || loading}>Gửi</Button>
        </View>
      </KeyboardAvoidingView>

      <MobileBottomTabBar
        active="Assistant"
        badges={{ Friends: friendRequestCount }}
        onNavigate={{ Chats: onOpenChats, Friends: onOpenFriends, Urban: onOpenUrban, Profile: onOpenProfile }}
      />
    </Screen>
  )
}

const createStyles = (theme) => {
  const c = theme.colors

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    header: { margin: 16, flexDirection: 'row', gap: 12 },
    aiIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
    aiIconText: { fontSize: 28, color: c.primary },
    headerCopy: { flex: 1 },
    eyebrow: { color: c.secondaryForeground, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
    title: { color: c.neutral900, fontSize: 24, fontWeight: '900', marginTop: 3 },
    subtitle: { color: c.neutral500, fontSize: 14, marginTop: 4 },
    welcome: { paddingHorizontal: 16, gap: 10 },
    suggestion: { minHeight: 46, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: 'center', paddingHorizontal: 16 },
    suggestionText: { color: c.neutral700, fontWeight: '800' },
    thread: { padding: 16, gap: 10, paddingBottom: 120 },
    bubble: { maxWidth: '86%', borderRadius: theme.radius.lg, padding: 12 },
    userBubble: { alignSelf: 'flex-end', backgroundColor: c.primary },
    assistantBubble: { alignSelf: 'flex-start', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    bubbleText: { color: c.neutral900, fontSize: 15, lineHeight: 21 },
    userBubbleText: { color: c.primaryForeground },
    sourceText: { marginTop: 8, color: c.neutral500, fontSize: 12 },
    loadingText: { marginTop: 10, color: c.neutral500, fontWeight: '700' },
    composer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
    input: { flex: 1, borderRadius: theme.radius.pill, backgroundColor: c.muted },
  })
}
