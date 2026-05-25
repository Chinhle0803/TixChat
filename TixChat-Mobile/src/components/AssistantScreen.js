import React, { useEffect, useState } from 'react'
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Input, MobileBottomTabBar, Screen } from './ui'
import { useAppTheme } from '../theme'
import { assistantService } from '../services/api'
import { useAuthStore } from '../stores/authStore'

const fallbackSuggestions = [
  'Khu vực gần tôi đang có sự cố gì?',
  'Có báo cáo ngập nước mới nào không?',
  'Điểm nóng giao thông hôm nay là ở đâu?',
  'Tôi nên mở bài báo cáo nào để theo dõi tiếp?',
]

const createMessage = (role, content, extra = {}) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  ...extra,
})

const extractErrorMessage = (error) =>
  String(error?.response?.data?.error || error?.message || 'Không thể kết nối trợ lý đô thị lúc này.')

const createAssistantMessage = (payload) =>
  createMessage('assistant', payload?.answer || 'Mình chưa có đủ dữ liệu để trả lời.', {
    relatedPosts: Array.isArray(payload?.relatedPosts) ? payload.relatedPosts : [],
    showIncidentCards: payload?.showIncidentCards === true,
    actions: Array.isArray(payload?.actions) ? payload.actions : [],
    disclaimer: payload?.disclaimer || '',
  })

const buildHistoryPayload = (messages = []) =>
  messages
    .slice(-6)
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || '').trim(),
    }))
    .filter((message) => message.content)

const buildAssistantLocation = (user = {}) => {
  const location = user?.location && typeof user.location === 'object' ? user.location : {}
  const lat = Number(location?.lat)
  const lng = Number(location?.lng)
  const payload = {
    address: String(location?.address || '').trim(),
    province: String(location?.province || user?.province || '').trim(),
    district: String(location?.district || user?.district || '').trim(),
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    payload.lat = lat
    payload.lng = lng
  }

  return Object.values(payload).some((value) => value !== '')
    ? payload
    : null
}

export default function AssistantScreen({ onOpenChats, onOpenFriends, onOpenUrban, onOpenProfile, onOpenProfileLocation, friendRequestCount = 0 }) {
  const user = useAuthStore((state) => state.user)
  const theme = useAppTheme()
  const insets = useSafeAreaInsets()
  const c = theme.colors
  const styles = createStyles(theme)
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const [suggestions, setSuggestions] = useState(fallbackSuggestions)
  const [errorMessage, setErrorMessage] = useState('')
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const bottomTabHeight = 64 + Math.max(insets.bottom, 8)
  const composerBottomSpace = keyboardVisible ? Math.max(insets.bottom, 8) : bottomTabHeight

  useEffect(() => {
    let active = true

    const loadSuggestions = async () => {
      try {
        const response = await assistantService.getUrbanSuggestions()
        const nextSuggestions = response?.data?.suggestions
        if (!active) return
        if (Array.isArray(nextSuggestions) && nextSuggestions.length > 0) {
          setSuggestions(nextSuggestions)
        }
      } catch (_) {
        if (active) {
          setSuggestions(fallbackSuggestions)
        }
      } finally {
        if (active) {
          setLoadingSuggestions(false)
        }
      }
    }

    loadSuggestions()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [])

  const openUrbanAction = () => {
    onOpenUrban?.()
  }

  const handleActionPress = (action = {}) => {
    const target = String(action?.target || '').trim()
    if (action?.kind === 'profile_location') {
      onOpenProfileLocation?.()
      return
    }
    if (target.startsWith('/profile')) {
      onOpenProfile?.()
      return
    }
    if (target.startsWith('/urban')) {
      onOpenUrban?.()
      return
    }
    onOpenUrban?.()
  }

  const ask = async (value = text) => {
    const question = String(value || '').trim()
    if (!question || loading) return

    const userMessage = createMessage('user', question)
    const requestHistory = buildHistoryPayload([...messages, userMessage])

    setMessages((current) => [...current, userMessage])
    setText('')
    setLoading(true)
    setErrorMessage('')

    try {
      const payload = {
        question,
        history: requestHistory,
      }
      const assistantLocation = buildAssistantLocation(user)
      if (assistantLocation) {
        payload.location = assistantLocation
      }

      const response = await assistantService.urbanChat(payload)
      setMessages((current) => [...current, createAssistantMessage(response?.data)])
    } catch (error) {
      setErrorMessage(extractErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.content, { paddingBottom: composerBottomSpace }]}>
          <Card style={styles.header}>
            <View style={styles.aiIcon}>
              <MaterialCommunityIcons name="robot-outline" style={styles.aiIconText} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Trợ lý thành phố</Text>
              <Text style={styles.title}>Trợ lý đô thị</Text>
              <Text style={styles.subtitle}>Hỏi nhanh về giao thông, hạ tầng và cảnh báo khu vực từ dữ liệu cộng đồng.</Text>
            </View>
          </Card>

          {messages.length === 0 ? (
            <View style={styles.welcome}>
              {(loadingSuggestions ? fallbackSuggestions : suggestions).map((item) => (
                <Pressable key={item} style={styles.suggestion} onPress={() => ask(item)}>
                  <Text style={styles.suggestionText}>{item}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <FlatList
              style={styles.threadList}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.thread}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                  <Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>{item.content}</Text>

                  {!!item.disclaimer && item.role === 'assistant' ? (
                    <Text style={styles.disclaimerText}>{item.disclaimer}</Text>
                  ) : null}

                  {item.showIncidentCards && Array.isArray(item.relatedPosts) && item.relatedPosts.length > 0 ? (
                    <View style={styles.relatedWrap}>
                      {item.relatedPosts.map((post) => (
                        <Pressable key={post.postId || post.title} style={styles.relatedCard} onPress={openUrbanAction}>
                          <Text style={styles.relatedTitle}>{post.title}</Text>
                          <Text style={styles.relatedMeta}>{post.status} · {post.location}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  {Array.isArray(item.actions) && item.actions.length > 0 ? (
                    <View style={styles.actionsRow}>
                      {item.actions.slice(0, 3).map((action) => (
                        <Button
                          key={`${action.kind}-${action.target}`}
                          variant="ghost"
                          size="sm"
                          style={styles.actionButton}
                          textStyle={styles.actionButtonText}
                          onPress={() => handleActionPress(action)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
              ListFooterComponent={
                <>
                  {loading ? <Text style={styles.loadingText}>Trợ lý đang phân tích dữ liệu đô thị...</Text> : null}
                  {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                </>
              }
            />
          )}

          <View style={styles.composer}>
            <Input
              value={text}
              onChangeText={setText}
              placeholder="Nhập câu hỏi..."
              style={styles.input}
            />
            <Button onPress={() => ask()} disabled={!text.trim() || loading} loading={loading}>Gửi</Button>
          </View>
        </View>
      </KeyboardAvoidingView>

      {!keyboardVisible ? (
        <MobileBottomTabBar
          active="Assistant"
          badges={{ Friends: friendRequestCount }}
          onNavigate={{ Chats: onOpenChats, Friends: onOpenFriends, Urban: onOpenUrban, Profile: onOpenProfile }}
        />
      ) : null}
    </Screen>
  )
}

const createStyles = (theme) => {
  const c = theme.colors

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    content: { flex: 1 },
    header: { margin: 16, flexDirection: 'row', gap: 12 },
    aiIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
    aiIconText: { fontSize: 28, color: c.primary },
    headerCopy: { flex: 1 },
    eyebrow: { color: c.secondaryForeground, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
    title: { color: c.neutral900, fontSize: 24, fontWeight: '900', marginTop: 3 },
    subtitle: { color: c.neutral500, fontSize: 14, marginTop: 4 },
    welcome: { flex: 1, paddingHorizontal: 16, gap: 10, justifyContent: 'center' },
    suggestion: { minHeight: 46, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: 'center', paddingHorizontal: 16 },
    suggestionText: { color: c.neutral700, fontWeight: '800' },
    threadList: { flex: 1 },
    thread: { padding: 16, gap: 10, paddingBottom: 16 },
    bubble: { maxWidth: '92%', borderRadius: theme.radius.lg, padding: 12 },
    userBubble: { alignSelf: 'flex-end', backgroundColor: c.primary },
    assistantBubble: { alignSelf: 'flex-start', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    bubbleText: { color: c.neutral900, fontSize: 15, lineHeight: 21 },
    userBubbleText: { color: c.primaryForeground },
    disclaimerText: { marginTop: 8, color: c.neutral500, fontSize: 12, lineHeight: 18 },
    relatedWrap: { marginTop: 10, gap: 8 },
    relatedCard: { borderRadius: theme.radius.md, borderWidth: 1, borderColor: c.border, padding: 10, backgroundColor: c.muted },
    relatedTitle: { color: c.neutral900, fontWeight: '700', fontSize: 13 },
    relatedMeta: { marginTop: 4, color: c.neutral500, fontSize: 12 },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    actionButton: { minHeight: 32, paddingHorizontal: 10 },
    actionButtonText: { fontSize: 12 },
    loadingText: { marginTop: 10, color: c.neutral500, fontWeight: '700' },
    errorText: { marginTop: 10, color: c.danger, fontWeight: '700' },
    composer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
    input: { flex: 1, borderRadius: theme.radius.pill, backgroundColor: c.muted },
  })
}
