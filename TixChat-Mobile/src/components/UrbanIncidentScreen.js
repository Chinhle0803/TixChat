import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { postService } from '../services/api'
import { getSocket } from '../services/socket'
import { useDialog } from '../contexts/DialogContext'
import { MobileBottomTabBar } from './ui'

const categories = [
  ['electricity', 'Điện'],
  ['water', 'Nước'],
  ['traffic', 'Giao thông'],
  ['tree', 'Cây xanh'],
  ['flood', 'Ngập nước'],
  ['waste', 'Rác thải'],
  ['street_light', 'Đèn đường'],
  ['construction', 'Công trình'],
  ['other', 'Khác'],
]

const statuses = [
  ['pending', 'Chờ xử lý'],
  ['in_progress', 'Đang xử lý'],
  ['resolved', 'Đã xử lý'],
]

const severities = [
  ['low', 'Thấp'],
  ['medium', 'Trung bình'],
  ['high', 'Cao'],
  ['critical', 'Khẩn cấp'],
]

const categoryLabel = (value) => categories.find(([key]) => key === value)?.[1] || 'Khác'
const statusLabel = (value) => statuses.find(([key]) => key === value)?.[1] || 'Chờ xử lý'
const reactionCount = (post, type) => Array.isArray(post?.reactions?.[type]) ? post.reactions[type].length : 0

export default function UrbanIncidentScreen({ onBack, onOpenChats, onOpenCalls, onOpenAssistant, onOpenProfile }) {
  const { notify } = useDialog()
  const [mode, setMode] = useState('feed')
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ category: '', status: '' })
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'other',
    severity: 'medium',
    address: '',
    lat: '',
    lng: '',
    imagesText: '',
  })

  const filteredPosts = useMemo(() => posts, [posts])

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const response = await postService.listPosts({
        category: filters.category || undefined,
        status: filters.status || undefined,
      })
      setPosts(response?.data?.posts || [])
    } catch (error) {
      notify({ title: 'Lỗi', message: error?.response?.data?.error || 'Không thể tải bảng tin', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [filters, notify])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return undefined
    const upsertPost = (payload) => {
      const post = payload?.post
      if (!post?.postId) return
      setPosts((current) => [post, ...current.filter((item) => item.postId !== post.postId)])
      setSelectedPost((current) => current?.postId === post.postId ? post : current)
    }
    socket.on('post:created', upsertPost)
    socket.on('post:updated', upsertPost)
    socket.on('post:status_changed', upsertPost)
    socket.on('post:reaction_updated', upsertPost)
    socket.on('post:comment_created', upsertPost)
    return () => {
      socket.off('post:created', upsertPost)
      socket.off('post:updated', upsertPost)
      socket.off('post:status_changed', upsertPost)
      socket.off('post:reaction_updated', upsertPost)
      socket.off('post:comment_created', upsertPost)
    }
  }, [])

  const openPost = async (post) => {
    setSelectedPost(post)
    setMode('detail')
    try {
      const response = await postService.listComments(post.postId)
      setComments(response?.data?.comments || [])
    } catch {
      setComments([])
    }
  }

  const createPost = async () => {
    if (!form.content.trim()) {
      notify({ title: 'Thiếu nội dung', message: 'Vui lòng mô tả sự cố', variant: 'warning' })
      return
    }
    try {
      const images = form.imagesText.split('\n').map((item) => item.trim()).filter(Boolean)
      const content = [form.title, form.content].map((item) => item.trim()).filter(Boolean).join('\n\n')
      await postService.createPost({
        content,
        category: form.category,
        images,
        location: {
          address: form.address,
          lat: form.lat ? Number(form.lat) : null,
          lng: form.lng ? Number(form.lng) : null,
        },
      })
      setForm({ title: '', content: '', category: 'other', severity: 'medium', address: '', lat: '', lng: '', imagesText: '' })
      setMode('feed')
      await loadPosts()
    } catch (error) {
      notify({ title: 'Lỗi', message: error?.response?.data?.error || 'Không thể tạo báo cáo', variant: 'error' })
    }
  }

  const reactToPost = async (post, reactionType) => {
    const response = await postService.addReaction(post.postId, reactionType)
    const updated = response?.data?.post
    if (!updated) return
    setPosts((current) => current.map((item) => item.postId === updated.postId ? updated : item))
    setSelectedPost((current) => current?.postId === updated.postId ? updated : current)
  }

  const updateStatus = async (status) => {
    if (!selectedPost) return
    const response = await postService.updateStatus(selectedPost.postId, status)
    const updated = response?.data?.post
    setSelectedPost(updated)
    setPosts((current) => current.map((item) => item.postId === updated.postId ? updated : item))
  }

  const submitComment = async () => {
    if (!selectedPost || !commentText.trim()) return
    const response = await postService.createComment(selectedPost.postId, commentText)
    setCommentText('')
    setSelectedPost(response?.data?.post || selectedPost)
    setComments((current) => [response?.data?.comment, ...current].filter(Boolean))
  }

  const renderPost = ({ item }) => (
    <Pressable style={styles.card} onPress={() => openPost(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.category}>{categoryLabel(item.category)}</Text>
        <Text style={[styles.status, item.status === 'resolved' && styles.statusResolved]}>{statusLabel(item.status)}</Text>
      </View>
      <Text style={styles.content}>{item.content}</Text>
      {!!item.location?.address && <Text style={styles.meta}>📍 {item.location.address}</Text>}
      <View style={styles.actionRow}>
        <Pressable style={styles.actionButton} onPress={() => reactToPost(item, 'like')}>
          <MaterialCommunityIcons name="thumb-up-outline" style={styles.actionIcon} />
          <Text style={styles.actionText}>{reactionCount(item, 'like')}</Text>
        </Pressable>
        <View style={styles.actionButton}>
          <MaterialCommunityIcons name="comment-outline" style={styles.actionIcon} />
          <Text style={styles.actionText}>{item.commentCount || 0}</Text>
        </View>
      </View>
    </Pressable>
  )

  const renderFeed = () => (
    <>
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable style={[styles.filterChip, !filters.category && styles.filterChipActive]} onPress={() => setFilters({ ...filters, category: '' })}>
            <Text style={[styles.filterText, !filters.category && styles.filterTextActive]}>Tất cả</Text>
          </Pressable>
          {categories.map(([key, label]) => (
            <Pressable key={key} style={[styles.filterChip, filters.category === key && styles.filterChipActive]} onPress={() => setFilters({ ...filters, category: key })}>
              <Text style={[styles.filterText, filters.category === key && styles.filterTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {loading ? <ActivityIndicator color="#1a73e8" style={styles.loader} /> : (
        <FlatList
          data={filteredPosts}
          keyExtractor={(item) => item.postId}
          renderItem={renderPost}
          refreshing={loading}
          onRefresh={loadPosts}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có báo cáo sự cố.</Text>}
        />
      )}
    </>
  )

  const renderCreate = () => (
    <ScrollView contentContainerStyle={styles.form}>
      <TextInput style={styles.input} value={form.title} onChangeText={(title) => setForm({ ...form, title })} placeholder="Tiêu đề sự cố" />
      <TextInput style={[styles.input, styles.textarea]} multiline value={form.content} onChangeText={(content) => setForm({ ...form, content })} placeholder="Mô tả sự cố..." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {categories.map(([key, label]) => (
          <Pressable key={key} style={[styles.filterChip, form.category === key && styles.filterChipActive]} onPress={() => setForm({ ...form, category: key })}>
            <Text style={[styles.filterText, form.category === key && styles.filterTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {severities.map(([key, label]) => (
          <Pressable key={key} style={[styles.filterChip, form.severity === key && styles.filterChipActive]} onPress={() => setForm({ ...form, severity: key })}>
            <Text style={[styles.filterText, form.severity === key && styles.filterTextActive]}>Mức độ: {label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <TextInput style={styles.input} value={form.address} onChangeText={(address) => setForm({ ...form, address })} placeholder="Địa chỉ" />
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} value={form.lat} onChangeText={(lat) => setForm({ ...form, lat })} placeholder="Vĩ độ" keyboardType="decimal-pad" />
        <TextInput style={styles.input} value={form.lng} onChangeText={(lng) => setForm({ ...form, lng })} placeholder="Kinh độ" keyboardType="decimal-pad" />
      </View>
      <TextInput style={[styles.input, styles.textareaSmall]} multiline value={form.imagesText} onChangeText={(imagesText) => setForm({ ...form, imagesText })} placeholder="URL ảnh, mỗi dòng một ảnh" />
      <Pressable style={styles.primaryButton} onPress={createPost}>
        <MaterialCommunityIcons name="send-outline" style={styles.primaryIcon} />
        <Text style={styles.primaryText}>Đăng sự cố</Text>
      </Pressable>
    </ScrollView>
  )

  const renderDetail = () => (
    <ScrollView contentContainerStyle={styles.detail}>
      <Pressable style={styles.backLink} onPress={() => setMode('feed')}>
        <MaterialCommunityIcons name="arrow-left" style={styles.backIcon} />
        <Text style={styles.backText}>Quay lại bảng tin</Text>
      </Pressable>
      {selectedPost && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.category}>{categoryLabel(selectedPost.category)}</Text>
            <Text style={[styles.status, selectedPost.status === 'resolved' && styles.statusResolved]}>{statusLabel(selectedPost.status)}</Text>
          </View>
          <Text style={styles.content}>{selectedPost.content}</Text>
          {!!selectedPost.location?.address && <Text style={styles.meta}>📍 {selectedPost.location.address}</Text>}
          <View style={styles.actionRow}>
            {statuses.map(([key, label]) => (
              <Pressable key={key} style={styles.actionButton} onPress={() => updateStatus(key)}>
                <Text style={styles.actionText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      <View style={styles.commentBox}>
        <TextInput style={styles.input} value={commentText} onChangeText={setCommentText} placeholder="Bình luận..." />
        <Pressable style={styles.primaryButton} onPress={submitComment}>
          <Text style={styles.primaryText}>Gửi bình luận</Text>
        </Pressable>
      </View>
      {comments.map((item) => (
        <View key={item.commentId} style={styles.comment}>
          <Text style={styles.commentText}>{item.content}</Text>
          <Text style={styles.commentTime}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  )

  const renderMap = () => (
    <ScrollView contentContainerStyle={styles.mapList}>
      <Text style={styles.mapHint}>Bản đồ V1 hiển thị các điểm có toạ độ. Cài `react-native-maps` và `expo-location` sau để bật bản đồ native.</Text>
      {posts.filter((post) => post.location?.lat && post.location?.lng).map((post) => (
        <Pressable key={post.postId} style={styles.mapCard} onPress={() => openPost(post)}>
          <Text style={styles.mapTitle}>{categoryLabel(post.category)}</Text>
          <Text style={styles.meta}>{post.location.address || `${post.location.lat}, ${post.location.lng}`}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.headerIcon}>
          <MaterialCommunityIcons name="arrow-left" style={styles.headerIconText} />
        </Pressable>
        <View style={styles.headerMain}>
          <Text style={styles.title}>Sự cố đô thị</Text>
          <Text style={styles.subtitle}>Báo cáo và theo dõi hạ tầng quanh bạn</Text>
        </View>
        <Pressable onPress={loadPosts} style={styles.headerIcon}>
          <MaterialCommunityIcons name="refresh" style={styles.headerIconText} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {[
          ['feed', 'Bảng tin', 'view-list-outline'],
          ['create', 'Tạo', 'plus-circle-outline'],
          ['map', 'Bản đồ', 'map-marker-radius-outline'],
        ].map(([key, label, icon]) => (
          <Pressable key={key} style={[styles.tab, mode === key && styles.tabActive]} onPress={() => setMode(key)}>
            <MaterialCommunityIcons name={icon} style={[styles.tabIcon, mode === key && styles.tabIconActive]} />
            <Text style={[styles.tabText, mode === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'feed' && renderFeed()}
      {mode === 'create' && renderCreate()}
      {mode === 'detail' && renderDetail()}
      {mode === 'map' && renderMap()}
      <MobileBottomTabBar
        active="Urban"
        onNavigate={{ Chats: onOpenChats, Calls: onOpenCalls, Assistant: onOpenAssistant, Profile: onOpenProfile }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerMain: { flex: 1 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' },
  headerIconText: { fontSize: 22, color: '#1a73e8' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 2, color: '#6b7280', fontSize: 12 },
  tabs: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff' },
  tab: { flex: 1, minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: '#f3f4f6' },
  tabActive: { backgroundColor: '#1a73e8' },
  tabIcon: { fontSize: 18, color: '#64748b' },
  tabIconActive: { color: '#fff' },
  tabText: { color: '#64748b', fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#eef2ff', marginRight: 8 },
  filterChipActive: { backgroundColor: '#1a73e8' },
  filterText: { color: '#1a73e8', fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  loader: { marginTop: 24 },
  listContent: { padding: 12, paddingBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  category: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#e8f2ff', color: '#185abc', fontWeight: '800', fontSize: 12 },
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#fff4df', color: '#8a5200', fontWeight: '800', fontSize: 12 },
  statusResolved: { backgroundColor: '#e7f7ec', color: '#1d6c36' },
  content: { fontSize: 16, lineHeight: 22, color: '#111827' },
  meta: { marginTop: 8, color: '#64748b' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#eef2ff' },
  actionIcon: { fontSize: 16, color: '#1a73e8' },
  actionText: { color: '#1a73e8', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 36 },
  form: { padding: 12, gap: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  textareaSmall: { minHeight: 80, textAlignVertical: 'top' },
  twoColumn: { flexDirection: 'row', gap: 10 },
  primaryButton: { minHeight: 44, borderRadius: 10, backgroundColor: '#1a73e8', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryIcon: { color: '#fff', fontSize: 18 },
  primaryText: { color: '#fff', fontWeight: '800' },
  detail: { padding: 12, paddingBottom: 32 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backIcon: { fontSize: 18, color: '#1a73e8' },
  backText: { color: '#1a73e8', fontWeight: '700' },
  commentBox: { gap: 10, marginBottom: 12 },
  comment: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  commentText: { color: '#111827' },
  commentTime: { color: '#64748b', marginTop: 4, fontSize: 12 },
  mapList: { padding: 12, gap: 10 },
  mapHint: { color: '#64748b', lineHeight: 20 },
  mapCard: { backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#1a73e8', padding: 12 },
  mapTitle: { fontWeight: '800', color: '#111827' },
})
