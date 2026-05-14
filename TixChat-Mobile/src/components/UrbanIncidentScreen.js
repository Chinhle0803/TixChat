import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { getSocket } from '../services/socket'
import { postService, userService } from '../services/api'
import { useDialog } from '../contexts/DialogContext'
import { Button, Card, Chip, EmptyState, IconButton, Input, MobileBottomTabBar, Screen } from './ui'
import UrbanInteractiveMap from './UrbanInteractiveMap'
import { useAppTheme } from '../theme'
import { useAuthStore } from '../stores/authStore'

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

const urbanTabs = [
  ['feed', 'post-outline', 'Bảng tin'],
  ['map', 'map-outline', 'Bản đồ'],
  ['search', 'magnify', 'Tìm kiếm'],
]
const MAP_PREVIEW_HEIGHT = Math.round(Dimensions.get('window').height * 0.4)
const DEFAULT_FEED_PROVINCE = 'Thành phố Hồ Chí Minh'

const categoryLabel = (value) => categories.find(([key]) => key === value)?.[1] || 'Khác'
const statusLabel = (value) => statuses.find(([key]) => key === value)?.[1] || 'Chờ xử lý'
const severityLabel = (value) => severities.find(([key]) => key === value)?.[1] || 'Trung bình'
const reactionCount = (post, type) => Array.isArray(post?.reactions?.[type]) ? post.reactions[type].length : 0
const getPostImages = (post) => Array.isArray(post?.images) ? post.images.filter(Boolean) : []
const getCurrentUserId = (user) => String(user?.userId || user?._id || user?.id || '')
const toComparableRegion = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
const toRegionKey = (value = '') => {
  const comparable = toComparableRegion(value)
  if (!comparable) return ''
  if (
    comparable.includes('ho chi minh') ||
    comparable.includes('sai gon') ||
    comparable === 'hcm' ||
    comparable === 'tphcm' ||
    comparable === 'tp hcm'
  ) return 'ho chi minh'
  if (comparable.includes('ha noi')) return 'ha noi'
  const districtNumber = comparable.match(/^(q|quan)\s*(\d{1,2})$/)
  if (districtNumber) return `quan ${districtNumber[2]}`
  if (comparable.includes('thu duc')) return 'thu duc'
  return comparable
}
const getFeedRegion = (user) => ({
  province: String(user?.province || user?.location?.province || DEFAULT_FEED_PROVINCE).trim(),
  district: String(user?.district || user?.location?.district || '').trim(),
})
const rankPostForRegion = (post, region) => {
  const userProvince = toRegionKey(region?.province)
  const userDistrict = toRegionKey(region?.district)
  const postProvince = toRegionKey(post?.location?.province)
  const postDistrict = toRegionKey(post?.location?.district)
  if (userDistrict && userProvince && userDistrict === postDistrict && userProvince === postProvince) return 0
  if (userProvince && userProvince === postProvince) return 1
  return 2
}
const compareCreatedAtDesc = (a, b) => {
  const createdAtA = Date.parse(a?.createdAt || '')
  const createdAtB = Date.parse(b?.createdAt || '')
  const hasCreatedAtA = Number.isFinite(createdAtA)
  const hasCreatedAtB = Number.isFinite(createdAtB)

  if (hasCreatedAtA && hasCreatedAtB && createdAtA !== createdAtB) {
    return createdAtB - createdAtA
  }
  if (hasCreatedAtA !== hasCreatedAtB) {
    return hasCreatedAtB ? 1 : -1
  }
  return String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''))
}
const sortPostsForFeed = (posts, region) => {
  return [...posts].sort((a, b) => {
    const regionDiff = rankPostForRegion(a, region) - rankPostForRegion(b, region)
    if (regionDiff !== 0) return regionDiff
    return compareCreatedAtDesc(a, b)
  })
}
const getAuthorId = (item) => String(item?.authorId || item?.user?._id || item?.user?.userId || item?.user?.id || '')
const getProfileDisplayName = (profile) => (
  profile?.nickname ||
  profile?.displayName ||
  profile?.fullName ||
  profile?.username ||
  ''
)
const hasReacted = (post, type, userId) => {
  if (!userId) return false
  return (post?.reactions?.[type] || []).map(String).includes(String(userId))
}
const getTotalReactionCount = (post) => Object.values(post?.reactions || {}).reduce(
  (total, users) => total + (Array.isArray(users) ? users.length : 0),
  0
)
const groupComments = (comments = []) => {
  const byId = new Map()
  const roots = []

  comments.forEach((item) => {
    if (item?.commentId) {
      byId.set(item.commentId, { ...item, replies: [] })
    }
  })

  comments.forEach((item) => {
    const node = byId.get(item?.commentId)
    if (!node) return
    const parent = item?.parentCommentId ? byId.get(item.parentCommentId) : null
    if (parent) {
      parent.replies.unshift(node)
      return
    }
    roots.push(node)
  })

  return roots
}

const getPostCoordinates = (post) => {
  const lat = Number(post?.location?.lat)
  const lng = Number(post?.location?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

const getAuthorLabel = (item, profileMap = {}, currentUser = null) => {
  const authorId = getAuthorId(item)
  if (authorId && authorId === getCurrentUserId(currentUser)) {
    const currentUserName = getProfileDisplayName(currentUser)
    if (currentUserName) return currentUserName
  }
  const profileName = getProfileDisplayName(profileMap[authorId])
  return String(
    item?.authorName ||
    item?.user?.displayName ||
    item?.user?.fullName ||
    item?.user?.username ||
    profileName ||
    'Cư dân đô thị'
  )
}

const getAuthorAvatar = (item, profileMap = {}, currentUser = null) => {
  const authorId = getAuthorId(item)
  if (authorId && authorId === getCurrentUserId(currentUser)) {
    return String(currentUser?.avatar || currentUser?.photoURL || currentUser?.profilePicture || '')
  }
  return String(
    item?.user?.avatar ||
    item?.user?.photoURL ||
    item?.user?.profilePicture ||
    profileMap[authorId]?.avatar ||
    profileMap[authorId]?.photoURL ||
    profileMap[authorId]?.profilePicture ||
    ''
  )
}

const getInitial = (item, profileMap = {}, currentUser = null) =>
  getAuthorLabel(item, profileMap, currentUser).charAt(0).toUpperCase()

const formatPostTime = (value) => {
  if (!value) return 'Vừa xong'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Vừa xong'

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ`
  return date.toLocaleDateString('vi-VN')
}

const getMarkerTone = (status) => {
  if (status === 'resolved') return 'resolved'
  if (status === 'in_progress') return 'progress'
  return 'pending'
}

export default function UrbanIncidentScreen({
  onOpenChats,
  onOpenFriends,
  onOpenAssistant,
  onOpenProfile,
  friendRequestCount = 0,
}) {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const c = theme.colors
  const { notify } = useDialog()
  const currentUser = useAuthStore((state) => state.user)
  const currentUserId = useMemo(() => getCurrentUserId(currentUser), [currentUser])
  const feedRegion = useMemo(() => getFeedRegion(currentUser), [currentUser])

  const [mode, setMode] = useState('feed')
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [focusedMapPost, setFocusedMapPost] = useState(null)
  const [mapPreviewVisible, setMapPreviewVisible] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [submittingCreate, setSubmittingCreate] = useState(false)
  const [expandedComments, setExpandedComments] = useState({})
  const [commentsByPost, setCommentsByPost] = useState({})
  const [loadingCommentsByPost, setLoadingCommentsByPost] = useState({})
  const [profileMap, setProfileMap] = useState({})
  const [commentDraftByPost, setCommentDraftByPost] = useState({})
  const [replyingToByPost, setReplyingToByPost] = useState({})
  const [replyDraftByPost, setReplyDraftByPost] = useState({})
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
  const mapPreviewTranslateY = useRef(new Animated.Value(MAP_PREVIEW_HEIGHT + 32)).current
  const loadingProfileIdsRef = useRef(new Set())

  const mapPosts = useMemo(
    () => posts.filter((post) => getPostCoordinates(post)),
    [posts]
  )

  const searchedPosts = useMemo(() => {
    const keyword = String(searchQuery || '').trim().toLowerCase()
    if (!keyword) return posts
    return posts.filter((post) => {
      const haystack = [
        post?.title,
        post?.content,
        post?.location?.address,
        categoryLabel(post?.category),
        getAuthorLabel(post, profileMap, currentUser),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(keyword)
    })
  }, [currentUser, posts, profileMap, searchQuery])

  const quickSearchOptions = useMemo(() => ([
    { key: 'ngập nước', label: 'Ngập nước' },
    { key: 'giao thông', label: 'Giao thông' },
    { key: 'đèn đường', label: 'Đèn đường' },
    { key: 'rác thải', label: 'Rác thải' },
    { key: 'đang xử lý', label: 'Đang xử lý' },
    { key: 'đã xử lý', label: 'Đã xử lý' },
  ]), [])

  const commentThreadsByPost = useMemo(() => {
    return Object.fromEntries(
      Object.entries(commentsByPost).map(([postId, comments]) => [postId, groupComments(comments)])
    )
  }, [commentsByPost])

  const missingAuthorIds = useMemo(() => {
    const ids = new Set()
    const collectAuthorId = (item) => {
      const authorId = getAuthorId(item)
      if (!authorId || profileMap[authorId] || loadingProfileIdsRef.current.has(authorId) || authorId === currentUserId) return
      ids.add(authorId)
    }

    posts.forEach(collectAuthorId)
    comments.forEach(collectAuthorId)
    Object.values(commentsByPost).flat().forEach(collectAuthorId)
    if (selectedPost) collectAuthorId(selectedPost)

    return Array.from(ids)
  }, [comments, commentsByPost, currentUserId, posts, profileMap, selectedPost])

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const response = await postService.listPosts({
        province: feedRegion.province || undefined,
        district: feedRegion.district || undefined,
        fallbackProvince: DEFAULT_FEED_PROVINCE,
      })
      setPosts(sortPostsForFeed(response?.data?.posts || [], feedRegion))
    } catch (error) {
      notify({ title: 'Lỗi', message: error?.response?.data?.error || 'Không thể tải bảng tin', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [feedRegion, notify])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  useEffect(() => {
    let isCancelled = false

    const fetchAuthorProfiles = async () => {
      if (!missingAuthorIds.length) return

      missingAuthorIds.forEach((authorId) => loadingProfileIdsRef.current.add(authorId))
      const responses = await Promise.allSettled(
        missingAuthorIds.map(async (authorId) => {
          const response = await userService.getProfile(authorId)
          return { authorId, profile: response?.data?.user || null }
        })
      )

      if (isCancelled) return

      const nextProfiles = {}
      responses.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.profile) {
          nextProfiles[result.value.authorId] = result.value.profile
        }
      })

      if (Object.keys(nextProfiles).length) {
        setProfileMap((current) => ({ ...current, ...nextProfiles }))
      }
      missingAuthorIds.forEach((authorId) => loadingProfileIdsRef.current.delete(authorId))
    }

    fetchAuthorProfiles()

    return () => {
      isCancelled = true
    }
  }, [missingAuthorIds])

  useEffect(() => {
    if (!mapPosts.length) {
      setFocusedMapPost(null)
      setMapPreviewVisible(false)
      return
    }

    setFocusedMapPost((current) => {
      if (current?.postId) {
        const refreshed = mapPosts.find((post) => post.postId === current.postId)
        if (refreshed) return refreshed
      }
      return mapPosts[0]
    })
  }, [mapPosts])

  useEffect(() => {
    if (mode !== 'map') {
      setMapPreviewVisible(false)
    }
  }, [mode])

  useEffect(() => {
    Animated.spring(mapPreviewTranslateY, {
      toValue: mapPreviewVisible && focusedMapPost ? 0 : MAP_PREVIEW_HEIGHT + 32,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.9,
    }).start()
  }, [focusedMapPost, mapPreviewTranslateY, mapPreviewVisible])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return undefined

    const upsertPost = (payload) => {
      const post = payload?.post
      if (!post?.postId) return
      setPosts((current) => sortPostsForFeed([post, ...current.filter((item) => item.postId !== post.postId)], feedRegion))
      setSelectedPost((current) => current?.postId === post.postId ? post : current)
      setFocusedMapPost((current) => current?.postId === post.postId ? post : current)
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
  }, [feedRegion])

  const openPost = useCallback(async (post) => {
    setSelectedPost(post)
    try {
      const response = await postService.listComments(post.postId)
      setComments(response?.data?.comments || [])
    } catch (_) {
      setComments([])
    }
  }, [])

  const loadCommentsForPost = useCallback(async (postId) => {
    if (!postId) return
    setLoadingCommentsByPost((current) => ({ ...current, [postId]: true }))
    try {
      const response = await postService.listComments(postId)
      setCommentsByPost((current) => ({ ...current, [postId]: response?.data?.comments || [] }))
    } catch (_) {
      setCommentsByPost((current) => ({ ...current, [postId]: [] }))
    } finally {
      setLoadingCommentsByPost((current) => ({ ...current, [postId]: false }))
    }
  }, [])

  const toggleInlineComments = useCallback(async (postId) => {
    const nextExpanded = !expandedComments[postId]
    setExpandedComments((current) => ({ ...current, [postId]: nextExpanded }))
    if (nextExpanded && !commentsByPost[postId]) {
      await loadCommentsForPost(postId)
    }
  }, [commentsByPost, expandedComments, loadCommentsForPost])

  const closePostDetail = () => {
    setSelectedPost(null)
    setComments([])
    setCommentText('')
  }

  const focusPostOnMap = useCallback((post) => {
    if (!post) return
    const coordinates = getPostCoordinates(post)
    if (!coordinates) {
      notify({
        title: 'Chưa có tọa độ',
        message: 'Bài viết này chưa có vị trí trên bản đồ.',
        variant: 'warning',
      })
      return
    }

    setSelectedPost(null)
    setComments([])
    setCommentText('')
    setFocusedMapPost(post)
    setMapPreviewVisible(true)
    setMode('map')
  }, [notify])

  const openMapPostDetail = useCallback(async () => {
    if (!focusedMapPost) return
    setMapPreviewVisible(false)
    await openPost(focusedMapPost)
  }, [focusedMapPost, openPost])

  const createPost = async () => {
    if (!form.content.trim()) {
      notify({ title: 'Thiếu nội dung', message: 'Vui lòng mô tả sự cố', variant: 'warning' })
      return
    }

    setSubmittingCreate(true)
    try {
      const images = form.imagesText.split('\n').map((item) => item.trim()).filter(Boolean)
      const content = [form.title, form.content].map((item) => item.trim()).filter(Boolean).join('\n\n')
      await postService.createPost({
        content,
        category: form.category,
        severity: form.severity,
        images,
        location: {
          address: form.address,
          lat: form.lat ? Number(form.lat) : null,
          lng: form.lng ? Number(form.lng) : null,
          fallbackProvince: feedRegion.province || DEFAULT_FEED_PROVINCE,
          fallbackDistrict: feedRegion.district || undefined,
        },
      })
      setForm({ title: '', content: '', category: 'other', severity: 'medium', address: '', lat: '', lng: '', imagesText: '' })
      setShowCreateModal(false)
      await loadPosts()
    } catch (error) {
      notify({ title: 'Lỗi', message: error?.response?.data?.error || 'Không thể tạo báo cáo', variant: 'error' })
    } finally {
      setSubmittingCreate(false)
    }
  }

  const reactToPost = async (post, reactionType, isActive = false) => {
    const response = isActive
      ? await postService.removeReaction(post.postId, reactionType)
      : await postService.addReaction(post.postId, reactionType)
    const updated = response?.data?.post
    if (!updated) return
    setPosts((current) => current.map((item) => item.postId === updated.postId ? updated : item))
    setSelectedPost((current) => current?.postId === updated.postId ? updated : current)
    setFocusedMapPost((current) => current?.postId === updated.postId ? updated : current)
  }

  const updateStatus = async (status) => {
    if (!selectedPost) return
    const response = await postService.updateStatus(selectedPost.postId, status)
    const updated = response?.data?.post
    if (!updated) return
    setSelectedPost(updated)
    setPosts((current) => current.map((item) => item.postId === updated.postId ? updated : item))
    setFocusedMapPost((current) => current?.postId === updated.postId ? updated : current)
  }

  const submitComment = async () => {
    if (!selectedPost || !commentText.trim()) return
    const response = await postService.createComment(selectedPost.postId, commentText)
    setCommentText('')
    setSelectedPost(response?.data?.post || selectedPost)
    setComments((current) => [response?.data?.comment, ...current].filter(Boolean))
  }

  const submitInlineComment = async (postId) => {
    const draft = String(commentDraftByPost[postId] || '').trim()
    if (!draft) return
    const response = await postService.createComment(postId, { content: draft })
    const nextComment = response?.data?.comment
    if (nextComment) {
      setCommentsByPost((current) => ({
        ...current,
        [postId]: [nextComment, ...(current[postId] || [])],
      }))
      setCommentDraftByPost((current) => ({ ...current, [postId]: '' }))
    }
    const nextPost = response?.data?.post
    if (nextPost) {
      setPosts((current) => current.map((item) => item.postId === nextPost.postId ? nextPost : item))
      setSelectedPost((current) => current?.postId === nextPost.postId ? nextPost : current)
    }
  }

  const submitReply = async (postId, parentCommentId) => {
    const draft = String(replyDraftByPost[postId] || '').trim()
    if (!draft || !parentCommentId) return
    const response = await postService.createComment(postId, {
      content: draft,
      parentCommentId,
    })
    const nextComment = response?.data?.comment
    if (nextComment) {
      setCommentsByPost((current) => ({
        ...current,
        [postId]: [nextComment, ...(current[postId] || [])],
      }))
      setReplyDraftByPost((current) => ({ ...current, [postId]: '' }))
      setReplyingToByPost((current) => ({ ...current, [postId]: '' }))
    }
    const nextPost = response?.data?.post
    if (nextPost) {
      setPosts((current) => current.map((item) => item.postId === nextPost.postId ? nextPost : item))
      setSelectedPost((current) => current?.postId === nextPost.postId ? nextPost : current)
    }
  }

  const renderCommentTree = (postId, items = [], depth = 0) => {
    return items.map((item) => {
      const isReplying = replyingToByPost[postId] === item.commentId
      return (
        <View key={item.commentId} style={[styles.commentTreeItem, depth > 0 && styles.commentTreeReply]}>
          <View style={styles.commentBubble}>
            <View style={styles.commentRow}>
              <View style={styles.commentAvatar}>
                {getAuthorAvatar(item, profileMap, currentUser) ? (
                  <Image source={{ uri: getAuthorAvatar(item, profileMap, currentUser) }} style={styles.commentAvatarImage} />
                ) : (
                  <Text style={styles.commentAvatarText}>{getInitial(item, profileMap, currentUser)}</Text>
                )}
              </View>
              <View style={styles.commentBody}>
                <View style={styles.commentHead}>
                  <Text style={styles.commentAuthor}>{getAuthorLabel(item, profileMap, currentUser)}</Text>
                  <Text style={styles.commentTimeInline}>{new Date(item.createdAt).toLocaleString('vi-VN')}</Text>
                </View>
                <Text style={styles.commentText}>{item.content}</Text>
              </View>
            </View>
          </View>
          <View style={styles.commentActionRow}>
            <Pressable
              style={styles.commentActionButton}
              onPress={() => setReplyingToByPost((current) => ({ ...current, [postId]: item.commentId }))}
            >
              <Text style={styles.commentActionText}>Trả lời</Text>
            </Pressable>
          </View>
          {isReplying ? (
            <View style={styles.replyComposer}>
              <View style={styles.inputWithSend}>
                <Input
                  style={styles.inputWithSendField}
                  value={replyDraftByPost[postId] || ''}
                  onChangeText={(value) => setReplyDraftByPost((current) => ({ ...current, [postId]: value }))}
                  placeholder={`Trả lời ${getAuthorLabel(item, profileMap, currentUser)}...`}
                />
                <Pressable style={styles.sendIconButton} onPress={() => submitReply(postId, item.commentId)}>
                  <MaterialCommunityIcons name="send" style={styles.sendIcon} />
                </Pressable>
              </View>
              <View style={styles.replyComposerActions}>
                <Button size="sm" variant="secondary" onPress={() => {
                  setReplyingToByPost((current) => ({ ...current, [postId]: '' }))
                  setReplyDraftByPost((current) => ({ ...current, [postId]: '' }))
                }}>Hủy</Button>
              </View>
            </View>
          ) : null}
          {Array.isArray(item.replies) && item.replies.length > 0 ? renderCommentTree(postId, item.replies, depth + 1) : null}
        </View>
      )
    })
  }

  const renderPostImages = (post, compact = false) => {
    const images = getPostImages(post)
    if (!images.length) return null

    const preview = images.slice(0, compact ? 1 : 3)
    return (
      <View style={[styles.imageGrid, compact && styles.imageGridCompact]}>
        {preview.map((url, index) => (
          <View key={`${url}-${index}`} style={[styles.imageFrame, compact && styles.imageFrameCompact]}>
            <Image source={{ uri: url }} style={styles.image} />
            {index === preview.length - 1 && images.length > preview.length ? (
              <View style={styles.imageMoreOverlay}>
                <Text style={styles.imageMoreText}>+{images.length - preview.length}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    )
  }

  const renderPostLocation = (post) => {
    const coordinates = getPostCoordinates(post)
    const address = String(post?.location?.address || '').trim()
    const label = address || (coordinates ? 'Vị trí đã chọn trên bản đồ' : '')
    if (!label) return null

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở vị trí sự cố trên bản đồ"
        style={({ pressed }) => [
          styles.postLocationButton,
          pressed && styles.postLocationButtonPressed,
        ]}
        onPress={() => focusPostOnMap(post)}
      >
        <MaterialCommunityIcons name="map-marker-radius-outline" style={styles.postLocationIcon} />
        <Text numberOfLines={2} style={styles.postLocation}>{label}</Text>
      </Pressable>
    )
  }

  const renderPostCard = (post, compact = false) => (
    <Card key={post.postId} style={[styles.postCard, compact && styles.postCardCompact]}>
      <View style={styles.postAuthorRow}>
        <View style={styles.postAvatar}>
          {getAuthorAvatar(post, profileMap, currentUser) ? (
            <Image source={{ uri: getAuthorAvatar(post, profileMap, currentUser) }} style={styles.postAvatarImage} />
          ) : (
            <Text style={styles.postAvatarText}>{getInitial(post, profileMap, currentUser)}</Text>
          )}
        </View>
        <View style={styles.postAuthorCopy}>
          <Text style={styles.postAuthor}>{getAuthorLabel(post, profileMap, currentUser)}</Text>
          <Text style={styles.postMeta}>{formatPostTime(post.createdAt)}</Text>
        </View>
        <View style={styles.postAuthorTags}>
          <Chip style={styles.categoryChip}>{categoryLabel(post.category)}</Chip>
          <Chip style={[styles.statusChip, styles[`statusChip_${getMarkerTone(post.status)}`]]}>{statusLabel(post.status)}</Chip>
        </View>
      </View>

      <Pressable onPress={() => openPost(post)}>
        {renderPostImages(post, compact)}
        {!!post?.title && <Text style={styles.postTitle}>{post.title}</Text>}
        <Text numberOfLines={compact ? 3 : undefined} style={styles.postContent}>{post.content}</Text>
      </Pressable>
      {renderPostLocation(post)}

      <View style={styles.postStatsRow}>
        <Text style={styles.postStatsText}>{getTotalReactionCount(post)} lượt quan tâm</Text>
        <Text style={styles.postStatsText}>{post.commentCount || 0} bình luận</Text>
      </View>

      <View style={styles.postFooter}>
        <Pressable
          style={[styles.socialAction, hasReacted(post, 'like', currentUserId) && styles.socialActionActive]}
          onPress={() => reactToPost(post, 'like', hasReacted(post, 'like', currentUserId))}
        >
          <MaterialCommunityIcons
            name="thumb-up-outline"
            style={[styles.socialActionIcon, hasReacted(post, 'like', currentUserId) && styles.socialActionIconActive]}
          />
          <Text style={[styles.socialActionText, hasReacted(post, 'like', currentUserId) && styles.socialActionTextActive]}>
            Like {reactionCount(post, 'like') || ''}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.socialAction, expandedComments[post.postId] && styles.socialActionActive]}
          onPress={() => toggleInlineComments(post.postId)}
        >
          <MaterialCommunityIcons name="comment-outline" style={styles.socialActionIcon} />
          <Text style={styles.socialActionText}>Bình luận {post.commentCount || ''}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.socialAction,
            styles.socialActionImportant,
            hasReacted(post, 'urgent', currentUserId) && styles.socialActionActive,
          ]}
          onPress={() => reactToPost(post, 'urgent', hasReacted(post, 'urgent', currentUserId))}
        >
          <MaterialCommunityIcons
            name="alert-outline"
            style={[styles.socialActionIcon, hasReacted(post, 'urgent', currentUserId) && styles.socialActionIconActive]}
          />
          <Text style={[styles.socialActionText, hasReacted(post, 'urgent', currentUserId) && styles.socialActionTextActive]}>
            Quan trọng {reactionCount(post, 'urgent') || ''}
          </Text>
        </Pressable>
      </View>
      {expandedComments[post.postId] ? (
        <View style={styles.inlineCommentsWrap}>
          <View style={styles.inlineCommentComposer}>
            <View style={styles.inputWithSend}>
              <Input
                style={styles.inputWithSendField}
                value={commentDraftByPost[post.postId] || ''}
                onChangeText={(value) => setCommentDraftByPost((current) => ({ ...current, [post.postId]: value }))}
                placeholder="Nhập bình luận..."
              />
              <Pressable style={styles.sendIconButton} onPress={() => submitInlineComment(post.postId)}>
                <MaterialCommunityIcons name="send" style={styles.sendIcon} />
              </Pressable>
            </View>
          </View>
          {loadingCommentsByPost[post.postId] ? (
            <ActivityIndicator color={c.primary} style={styles.inlineCommentLoader} />
          ) : null}
          {!loadingCommentsByPost[post.postId] && !(commentThreadsByPost[post.postId] || []).length ? (
            <Text style={styles.inlineCommentEmpty}>Chưa có bình luận nào.</Text>
          ) : null}
          {!loadingCommentsByPost[post.postId] ? renderCommentTree(post.postId, commentThreadsByPost[post.postId] || []) : null}
        </View>
      ) : null}
    </Card>
  )

  const renderFeed = () => (
    <View style={styles.sectionWrap}>
      {loading ? <ActivityIndicator color={c.primary} style={styles.loader} /> : null}
      {!loading && posts.length === 0 ? (
        <EmptyState icon="post-outline" title="Chưa có báo cáo" description="Kéo xuống để làm mới hoặc tạo báo cáo mới bằng nút ở góc dưới." />
      ) : null}
      {!loading ? posts.map((post) => renderPostCard(post, false)) : null}
    </View>
  )

  const mapPreviewPanHandlers = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
    onPanResponderMove: (_, gestureState) => {
      mapPreviewTranslateY.setValue(Math.max(-72, gestureState.dy))
    },
    onPanResponderRelease: async (_, gestureState) => {
      if (gestureState.dy < -56) {
        mapPreviewTranslateY.setValue(0)
        await openMapPostDetail()
        return
      }
      if (gestureState.dy > 92) {
        setMapPreviewVisible(false)
        return
      }
      Animated.spring(mapPreviewTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
        mass: 0.9,
      }).start()
    },
  }), [mapPreviewTranslateY, openMapPostDetail])

  const renderTabs = (floating = false) => (
    <View style={[styles.stickyTabsWrap, floating && styles.stickyTabsWrapFloating]}>
      <View style={[styles.stickyTabs, floating && styles.stickyTabsFloating]}>
        {urbanTabs.map(([key, icon, label]) => {
          const active = mode === key
          return (
            <Pressable
              key={key}
              accessibilityLabel={label}
              style={[styles.stickyTab, active && styles.stickyTabActive]}
              onPress={() => setMode(key)}
            >
              <MaterialCommunityIcons name={icon} style={[styles.stickyTabIcon, active && styles.stickyTabIconActive]} />
            </Pressable>
          )
        })}
      </View>
    </View>
  )

  const renderMap = () => (
    <View style={styles.mapScreen}>
      <UrbanInteractiveMap
        posts={mapPosts.map((post) => ({
          ...post,
          categoryLabel: categoryLabel(post.category),
        }))}
        selectedPostId={focusedMapPost?.postId || null}
        onSelectPost={(postId) => {
          const nextPost = mapPosts.find((post) => post.postId === postId)
          if (!nextPost) return
          if (focusedMapPost?.postId === postId && mapPreviewVisible) {
            openMapPostDetail()
            return
          }
          setFocusedMapPost(nextPost)
          setMapPreviewVisible(true)
        }}
        style={styles.mapCanvasFull}
      />

      <View pointerEvents="box-none" style={styles.mapOverlayTop}>
        {renderTabs(true)}
      </View>

      {focusedMapPost ? (
        <Animated.View
          style={[
            styles.mapPreviewSheet,
            { transform: [{ translateY: mapPreviewTranslateY }] },
          ]}
        >
          <View {...mapPreviewPanHandlers.panHandlers} style={styles.mapPreviewHandleWrap}>
            <View style={styles.mapPreviewHandle} />
          </View>
          <View style={styles.mapPreviewContent}>
            <View style={styles.mapSelectedHead}>
              <View style={styles.mapPreviewTitleWrap}>
                <Text style={styles.mapSelectedTitle}>{categoryLabel(focusedMapPost.category)}</Text>
                <Text style={styles.mapSelectedMeta}>{focusedMapPost.location?.address || 'Không có địa chỉ cụ thể'}</Text>
              </View>
              <Chip style={[styles.statusChip, styles[`statusChip_${getMarkerTone(focusedMapPost.status)}`]]}>{statusLabel(focusedMapPost.status)}</Chip>
            </View>
            {!!focusedMapPost.title && <Text style={styles.mapPreviewPostTitle}>{focusedMapPost.title}</Text>}
            <Text numberOfLines={4} style={styles.mapSelectedContent}>{focusedMapPost.content}</Text>
            <Text style={styles.mapPreviewHint}>Vuốt lên hoặc chạm lại ghim để xem chi tiết.</Text>
            <View style={styles.postFooter}>
              <Pressable
                style={[styles.socialAction, hasReacted(focusedMapPost, 'like', currentUserId) && styles.socialActionActive]}
                onPress={() => reactToPost(focusedMapPost, 'like', hasReacted(focusedMapPost, 'like', currentUserId))}
              >
                <MaterialCommunityIcons
                  name="thumb-up-outline"
                  style={[styles.socialActionIcon, hasReacted(focusedMapPost, 'like', currentUserId) && styles.socialActionIconActive]}
                />
                <Text style={[styles.socialActionText, hasReacted(focusedMapPost, 'like', currentUserId) && styles.socialActionTextActive]}>
                  Like {reactionCount(focusedMapPost, 'like') || ''}
                </Text>
              </Pressable>
              <Pressable style={styles.socialAction} onPress={() => setMapPreviewVisible(false)}>
                <MaterialCommunityIcons name="map-marker-off-outline" style={styles.socialActionIcon} />
                <Text style={styles.socialActionText}>Ẩn thẻ</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  )

  const renderSearch = () => (
    <View style={styles.sectionWrap}>
      <Card style={styles.searchCard}>
        <Text style={styles.searchTitle}>Tìm kiếm nhanh</Text>
        <Text style={styles.searchSubtitle}>Chọn một gợi ý phổ biến hoặc nhập từ khóa để lọc bài báo cáo.</Text>
        <View style={styles.quickSearchGrid}>
          {quickSearchOptions.map((option) => (
            <Pressable
              key={option.key}
              style={[styles.quickSearchButton, searchQuery === option.key && styles.quickSearchButtonActive]}
              onPress={() => setSearchQuery(option.key)}
            >
              <Text style={[styles.quickSearchButtonText, searchQuery === option.key && styles.quickSearchButtonTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm theo nội dung, địa chỉ, hạng mục..."
        />
      </Card>
      {loading ? <ActivityIndicator color={c.primary} style={styles.loader} /> : null}
      {!loading && searchedPosts.length === 0 ? (
        <EmptyState icon="magnify" title="Không có kết quả" description="Thử từ khóa khác hoặc kéo xuống để làm mới dữ liệu." />
      ) : null}
      {!loading ? searchedPosts.map((post) => renderPostCard(post, true)) : null}
    </View>
  )

  return (
    <Screen style={styles.container}>
      {mode === 'map' ? (
        renderMap()
      ) : (
        <ScrollView
          style={styles.scroll}
          stickyHeaderIndices={[0]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPosts} tintColor={c.primary} />}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderTabs()}

          {mode === 'feed' ? renderFeed() : null}
          {mode === 'search' ? renderSearch() : null}
        </ScrollView>
      )}

      {mode === 'feed' ? (
        <Pressable style={styles.fab} onPress={() => setShowCreateModal(true)}>
          <MaterialCommunityIcons name="plus" style={styles.fabIcon} />
          <Text style={styles.fabText}>Báo cáo</Text>
        </Pressable>
      ) : null}

      <MobileBottomTabBar
        active="Urban"
        badges={{ Friends: friendRequestCount }}
        onNavigate={{
          Chats: onOpenChats,
          Friends: onOpenFriends,
          Assistant: onOpenAssistant,
          Profile: onOpenProfile,
        }}
      />

      <Modal visible={showCreateModal} animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <Screen style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Báo cáo sự cố</Text>
            <IconButton icon="close" onPress={() => setShowCreateModal(false)} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Input value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="Tiêu đề sự cố" />
            <Input
              style={styles.modalTextarea}
              multiline
              value={form.content}
              onChangeText={(content) => setForm((current) => ({ ...current, content }))}
              placeholder="Mô tả sự cố..."
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {categories.map(([key, label]) => (
                <Chip key={key} active={form.category === key} onPress={() => setForm((current) => ({ ...current, category: key }))}>
                  {label}
                </Chip>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {severities.map(([key, label]) => (
                <Chip key={key} active={form.severity === key} onPress={() => setForm((current) => ({ ...current, severity: key }))}>
                  {label}
                </Chip>
              ))}
            </ScrollView>
            <Input value={form.address} onChangeText={(address) => setForm((current) => ({ ...current, address }))} placeholder="Địa chỉ" />
            <View style={styles.coordinateRow}>
              <Input
                style={styles.coordinateInput}
                value={form.lat}
                onChangeText={(lat) => setForm((current) => ({ ...current, lat }))}
                placeholder="Vĩ độ"
                keyboardType="decimal-pad"
              />
              <Input
                style={styles.coordinateInput}
                value={form.lng}
                onChangeText={(lng) => setForm((current) => ({ ...current, lng }))}
                placeholder="Kinh độ"
                keyboardType="decimal-pad"
              />
            </View>
            <Input
              style={styles.modalTextareaSmall}
              multiline
              value={form.imagesText}
              onChangeText={(imagesText) => setForm((current) => ({ ...current, imagesText }))}
              placeholder="URL ảnh, mỗi dòng một ảnh"
            />
            <Button loading={submittingCreate} onPress={createPost}>Đăng sự cố</Button>
          </ScrollView>
        </Screen>
      </Modal>

      <Modal visible={Boolean(selectedPost)} transparent animationType="slide" onRequestClose={closePostDetail}>
        <View style={styles.detailBackdrop}>
          <Pressable style={styles.detailBackdropDismiss} onPress={closePostDetail} />
          <View style={styles.detailSheet}>
            <View style={styles.detailSheetHeader}>
              <Text style={styles.detailSheetTitle}>Chi tiết sự cố</Text>
              <IconButton icon="close" onPress={closePostDetail} />
            </View>
            {selectedPost ? (
              <ScrollView contentContainerStyle={styles.detailContent}>
                <View style={styles.postPillRow}>
                  <Chip style={styles.categoryChip}>{categoryLabel(selectedPost.category)}</Chip>
                  <Chip style={[styles.statusChip, styles[`statusChip_${getMarkerTone(selectedPost.status)}`]]}>{statusLabel(selectedPost.status)}</Chip>
                </View>
                <View style={styles.postAuthorRow}>
                  <View style={styles.postAvatar}>
                    {getAuthorAvatar(selectedPost, profileMap, currentUser) ? (
                      <Image source={{ uri: getAuthorAvatar(selectedPost, profileMap, currentUser) }} style={styles.postAvatarImage} />
                    ) : (
                      <Text style={styles.postAvatarText}>{getInitial(selectedPost, profileMap, currentUser)}</Text>
                    )}
                  </View>
                  <View style={styles.postAuthorCopy}>
                    <Text style={styles.postAuthor}>{getAuthorLabel(selectedPost, profileMap, currentUser)}</Text>
                    <Text style={styles.postMeta}>{formatPostTime(selectedPost.createdAt)} · {severityLabel(selectedPost.severity)}</Text>
                  </View>
                </View>
                {renderPostImages(selectedPost, false)}
                <Text style={styles.postTitle}>{selectedPost.title || categoryLabel(selectedPost.category)}</Text>
                <Text style={styles.postContent}>{selectedPost.content}</Text>
                {renderPostLocation(selectedPost)}

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {statuses.map(([key, label]) => (
                    <Chip key={key} active={selectedPost.status === key} onPress={() => updateStatus(key)}>
                      {label}
                    </Chip>
                  ))}
                </ScrollView>

                <View style={styles.commentComposer}>
                  <View style={styles.inputWithSend}>
                    <Input
                      style={styles.inputWithSendField}
                      value={commentText}
                      onChangeText={setCommentText}
                      placeholder="Bình luận..."
                    />
                    <Pressable style={styles.sendIconButton} onPress={submitComment}>
                      <MaterialCommunityIcons name="send" style={styles.sendIcon} />
                    </Pressable>
                  </View>
                </View>

                {comments.length ? comments.map((item) => (
                  <Card key={item.commentId} style={styles.commentCard}>
                    <View style={styles.commentRow}>
                      <View style={styles.commentAvatar}>
                        {getAuthorAvatar(item, profileMap, currentUser) ? (
                          <Image source={{ uri: getAuthorAvatar(item, profileMap, currentUser) }} style={styles.commentAvatarImage} />
                        ) : (
                          <Text style={styles.commentAvatarText}>{getInitial(item, profileMap, currentUser)}</Text>
                        )}
                      </View>
                      <View style={styles.commentBody}>
                        <View style={styles.commentHead}>
                          <Text style={styles.commentAuthor}>{getAuthorLabel(item, profileMap, currentUser)}</Text>
                          <Text style={styles.commentTimeInline}>{new Date(item.createdAt).toLocaleString('vi-VN')}</Text>
                        </View>
                        <Text style={styles.commentText}>{item.content}</Text>
                      </View>
                    </View>
                  </Card>
                )) : (
                  <EmptyState icon="comment-outline" title="Chưa có bình luận" description="Hãy để lại thông tin bổ sung cho sự cố này." />
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const createStyles = (theme) => {
  const c = theme.colors

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: theme.spacing[3],
      paddingBottom: 120,
    },
    stickyTabsWrap: {
      backgroundColor: c.background,
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[3],
    },
    stickyTabs: {
      minHeight: 56,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: theme.spacing[2],
      ...theme.shadows.sm,
    },
    stickyTab: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stickyTabActive: {
      backgroundColor: c.accent,
    },
    stickyTabIcon: {
      fontSize: 22,
      color: c.neutral500,
    },
    stickyTabIconActive: {
      color: c.primary,
    },
    sectionWrap: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[5],
      gap: theme.spacing[3],
    },
    mapScreen: {
      flex: 1,
      backgroundColor: '#EAF3FB',
    },
    mapOverlayTop: {
      position: 'absolute',
      top: theme.spacing[4],
      left: 0,
      right: 0,
    },
    chipRow: {
      gap: theme.spacing[2],
      paddingRight: theme.spacing[4],
    },
    loader: {
      marginTop: theme.spacing[3],
    },
    postCard: {
      padding: 0,
      overflow: 'hidden',
      backgroundColor: c.surfaceTint,
    },
    postCardCompact: {
      backgroundColor: c.surface,
    },
    postPillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing[2],
    },
    categoryChip: {
      backgroundColor: c.accent,
    },
    statusChip: {
      backgroundColor: c.muted,
    },
    statusChip_pending: {
      backgroundColor: c.warningSoft,
    },
    statusChip_progress: {
      backgroundColor: c.infoSoft,
    },
    statusChip_resolved: {
      backgroundColor: c.successSoft,
    },
    postAuthorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
    },
    postAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    postAvatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    postAvatarText: {
      color: c.primary,
      fontWeight: '800',
      fontSize: theme.type.base,
    },
    postAuthorCopy: {
      flex: 1,
      minWidth: 0,
    },
    postAuthor: {
      color: c.neutral900,
      fontWeight: '800',
      fontSize: theme.type.sm,
    },
    postAuthorTags: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: theme.spacing[2],
      flexShrink: 1,
      maxWidth: '50%',
    },
    postMeta: {
      marginTop: 2,
      color: c.neutral500,
      fontSize: theme.type.xs,
    },
    imageGrid: {
      marginTop: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      flexDirection: 'row',
      gap: theme.spacing[2],
    },
    imageGridCompact: {
      gap: 0,
    },
    imageFrame: {
      flex: 1,
      minHeight: 132,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      backgroundColor: c.muted,
    },
    imageFrameCompact: {
      minHeight: 112,
    },
    image: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    imageMoreOverlay: {
      position: 'absolute',
      inset: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(9, 9, 11, 0.56)',
    },
    imageMoreText: {
      color: '#fff',
      fontSize: theme.type.xl,
      fontWeight: '800',
    },
    postTitle: {
      marginTop: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      color: c.neutral900,
      fontSize: theme.type.base,
      fontWeight: '800',
    },
    postContent: {
      marginTop: theme.spacing[2],
      paddingHorizontal: theme.spacing[4],
      color: c.neutral900,
      fontSize: theme.type.sm,
      lineHeight: 21,
    },
    postLocationButton: {
      marginTop: theme.spacing[2],
      paddingHorizontal: theme.spacing[4],
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    postLocationButtonPressed: {
      opacity: 0.72,
    },
    postLocationIcon: {
      color: c.primary,
      fontSize: 18,
    },
    postLocation: {
      flex: 1,
      color: c.neutral500,
      fontSize: theme.type.sm,
      fontWeight: '700',
    },
    postStatsRow: {
      marginTop: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    postStatsText: {
      color: c.neutral500,
      fontSize: theme.type.xs,
    },
    postFooter: {
      marginTop: theme.spacing[3],
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: theme.spacing[2],
      paddingVertical: theme.spacing[2],
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    socialAction: {
      minHeight: 40,
      paddingHorizontal: theme.spacing[2],
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    socialActionActive: {
      backgroundColor: c.accent,
    },
    socialActionImportant: {
      backgroundColor: c.warningSoft,
    },
    socialActionIcon: {
      fontSize: 18,
      color: c.neutral500,
    },
    socialActionIconActive: {
      color: c.primary,
    },
    socialActionText: {
      color: c.neutral500,
      fontWeight: '700',
      fontSize: theme.type.sm,
    },
    socialActionTextActive: {
      color: c.primary,
    },
    inlineCommentsWrap: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[3],
      paddingBottom: theme.spacing[4],
      gap: theme.spacing[3],
      backgroundColor: c.surface,
    },
    inlineCommentComposer: {
      gap: theme.spacing[2],
    },
    inputWithSend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    inputWithSendField: {
      flex: 1,
    },
    sendIconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
      flexShrink: 0,
    },
    sendIcon: {
      fontSize: 20,
      color: c.primary,
    },
    inlineCommentLoader: {
      marginTop: theme.spacing[2],
    },
    inlineCommentEmpty: {
      color: c.neutral500,
      fontSize: theme.type.sm,
    },
    commentTreeItem: {
      gap: theme.spacing[1],
    },
    commentTreeReply: {
      marginLeft: theme.spacing[4],
      paddingLeft: theme.spacing[3],
      borderLeftWidth: 2,
      borderLeftColor: c.border,
    },
    commentBubble: {
      width: '100%',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: theme.radius.lg,
      backgroundColor: c.muted,
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[3],
    },
    commentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing[3],
    },
    commentAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    },
    commentAvatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    commentAvatarText: {
      color: c.primary,
      fontWeight: '800',
      fontSize: theme.type.sm,
    },
    commentBody: {
      flex: 1,
      minWidth: 0,
    },
    commentHead: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      gap: theme.spacing[2],
      marginBottom: 4,
    },
    commentAuthor: {
      color: c.neutral900,
      fontWeight: '800',
      fontSize: theme.type.sm,
    },
    commentTimeInline: {
      color: c.neutral500,
      fontSize: theme.type.xs,
    },
    commentActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      marginLeft: theme.spacing[2],
    },
    commentActionButton: {
      minHeight: 28,
      paddingHorizontal: theme.spacing[2],
      borderRadius: theme.radius.sm,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    commentActionText: {
      color: c.primary,
      fontWeight: '700',
      fontSize: theme.type.xs,
    },
    replyComposer: {
      gap: theme.spacing[2],
      marginLeft: theme.spacing[2],
    },
    replyComposerActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing[2],
    },
    mapShell: {
      borderRadius: theme.radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      ...theme.shadows.sm,
    },
    mapCanvas: {
      height: 340,
      backgroundColor: '#EAF3FB',
    },
    mapCanvasFull: {
      flex: 1,
      backgroundColor: '#EAF3FB',
    },
    mapLegend: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[3],
      backgroundColor: c.surfaceTint,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendDot_pending: {
      backgroundColor: '#F59E0B',
    },
    legendDot_progress: {
      backgroundColor: '#0EA5E9',
    },
    legendDot_resolved: {
      backgroundColor: '#22C55E',
    },
    legendText: {
      color: c.neutral500,
      fontSize: theme.type.xs,
      fontWeight: '700',
    },
    mapSelectedCard: {
      backgroundColor: c.surfaceTint,
    },
    mapPreviewSheet: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 82,
      height: MAP_PREVIEW_HEIGHT,
      borderRadius: theme.radius.xl,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      ...theme.shadows.lg,
    },
    mapPreviewHandleWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: theme.spacing[3],
      paddingBottom: theme.spacing[2],
      backgroundColor: c.surface,
    },
    mapPreviewHandle: {
      width: 46,
      height: 5,
      borderRadius: 999,
      backgroundColor: c.border,
    },
    mapPreviewContent: {
      flex: 1,
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[3],
    },
    mapPreviewTitleWrap: {
      flex: 1,
      paddingRight: theme.spacing[2],
    },
    mapPreviewPostTitle: {
      marginTop: theme.spacing[3],
      color: c.neutral900,
      fontSize: theme.type.base,
      fontWeight: '800',
    },
    mapPreviewHint: {
      marginTop: theme.spacing[3],
      color: c.neutral500,
      fontSize: theme.type.xs,
      fontWeight: '700',
    },
    mapSelectedHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing[3],
      alignItems: 'flex-start',
    },
    mapSelectedTitle: {
      color: c.neutral900,
      fontSize: theme.type.base,
      fontWeight: '800',
    },
    mapSelectedMeta: {
      marginTop: 4,
      color: c.neutral500,
      fontSize: theme.type.sm,
    },
    mapSelectedContent: {
      marginTop: theme.spacing[3],
      color: c.neutral900,
      lineHeight: 21,
    },
    searchCard: {
      backgroundColor: c.surfaceTint,
      gap: theme.spacing[3],
    },
    searchTitle: {
      color: c.neutral900,
      fontSize: theme.type.base,
      fontWeight: '800',
    },
    searchSubtitle: {
      color: c.neutral500,
      lineHeight: 20,
    },
    quickSearchGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing[2],
    },
    quickSearchButton: {
      minHeight: 38,
      paddingHorizontal: theme.spacing[3],
      borderRadius: theme.radius.pill,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    quickSearchButtonActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    quickSearchButtonText: {
      color: c.primary,
      fontWeight: '700',
    },
    quickSearchButtonTextActive: {
      color: c.primaryForeground,
    },
    stickyTabsWrapFloating: {
      backgroundColor: 'transparent',
      paddingBottom: 0,
    },
    stickyTabsFloating: {
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderColor: 'rgba(226,232,240,0.92)',
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 92,
      minHeight: 52,
      paddingHorizontal: 18,
      borderRadius: 26,
      backgroundColor: c.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      ...theme.shadows.lg,
    },
    fabIcon: {
      fontSize: 20,
      color: c.primaryForeground,
    },
    fabText: {
      color: c.primaryForeground,
      fontWeight: '800',
      fontSize: theme.type.sm,
    },
    modalScreen: {
      flex: 1,
      backgroundColor: c.background,
    },
    modalHeader: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      paddingBottom: theme.spacing[3],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalTitle: {
      color: c.neutral900,
      fontSize: theme.type.lg,
      fontWeight: '800',
    },
    modalContent: {
      padding: theme.spacing[4],
      gap: theme.spacing[3],
      paddingBottom: 120,
    },
    modalTextarea: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    coordinateRow: {
      flexDirection: 'row',
      gap: theme.spacing[3],
    },
    coordinateInput: {
      flex: 1,
    },
    modalTextareaSmall: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    detailBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(2, 6, 23, 0.34)',
      justifyContent: 'flex-end',
    },
    detailBackdropDismiss: {
      flex: 1,
    },
    detailSheet: {
      maxHeight: '84%',
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    detailSheetHeader: {
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    detailSheetTitle: {
      color: c.neutral900,
      fontSize: theme.type.base,
      fontWeight: '800',
    },
    detailContent: {
      padding: theme.spacing[4],
      gap: theme.spacing[3],
      paddingBottom: 48,
    },
    commentComposer: {
      gap: theme.spacing[2],
    },
    commentCard: {
      backgroundColor: c.surfaceTint,
    },
    commentText: {
      color: c.neutral900,
      lineHeight: 20,
    },
    commentTime: {
      marginTop: 6,
      color: c.neutral500,
      fontSize: theme.type.xs,
    },
  })
}
