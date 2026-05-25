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
import * as ImagePicker from 'expo-image-picker'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { getSocket } from '../services/socket'
import { postService, userService } from '../services/api'
import { ensureMediaLibraryPermission } from '../services/permissions'
import { getCurrentDeviceLocation } from '../services/location'
import { API_URL } from '../config/env'
import { useDialog } from '../contexts/DialogContext'
import { Button, Card, Chip, EmptyState, IconButton, Input, MobileBottomTabBar, Screen } from './ui'
import UrbanInteractiveMap from './UrbanInteractiveMap'
import { useAppTheme } from '../theme'
import { useAuthStore } from '../stores/authStore'
import { formatLocationLabel, getLocationInputPlaceholder } from '../utils/addressFormat'

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
const getMarkerTone = (status) => {
  if (status === 'resolved') return 'positive'
  if (status === 'in_progress') return 'warning'
  return 'danger'
}
const extractWikimediaFileName = (value) => {
  const match = String(value || '').trim().match(/commons\.wikimedia\.org\/wiki\/Special:FilePath\/(.+)$/i)
  return match ? decodeURIComponent(match[1]) : ''
}

const md5 = (value) => {
  const rotateLeft = (number, amount) => (number << amount) | (number >>> (32 - amount))
  const addUnsigned = (left, right) => {
    const left4 = left & 0x40000000
    const right4 = right & 0x40000000
    const left8 = left & 0x80000000
    const right8 = right & 0x80000000
    const result = (left & 0x3fffffff) + (right & 0x3fffffff)

    if (left4 & right4) return result ^ 0x80000000 ^ left8 ^ right8
    if (left4 | right4) {
      if (result & 0x40000000) return result ^ 0xc0000000 ^ left8 ^ right8
      return result ^ 0x40000000 ^ left8 ^ right8
    }
    return result ^ left8 ^ right8
  }
  const basic = (fn, a, b, c, d, x, s, ac) => addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(fn(b, c, d), addUnsigned(x, ac))), s), b)
  const f = (x, y, z) => (x & y) | (~x & z)
  const g = (x, y, z) => (x & z) | (y & ~z)
  const h = (x, y, z) => x ^ y ^ z
  const i = (x, y, z) => y ^ (x | ~z)
  const toWordArray = (input) => {
    const words = []
    const length = input.length
    let index = 0

    while (index < length) {
      const wordIndex = (index - (index % 4)) / 4
      const byteIndex = (index % 4) * 8
      words[wordIndex] = words[wordIndex] || 0
      words[wordIndex] |= input.charCodeAt(index) << byteIndex
      index += 1
    }

    const wordIndex = (index - (index % 4)) / 4
    const byteIndex = (index % 4) * 8
    words[wordIndex] = words[wordIndex] || 0
    words[wordIndex] |= 0x80 << byteIndex
    words[(((index + 8) - ((index + 8) % 64)) / 64) * 16 + 14] = length * 8
    return words
  }
  const toHex = (valueToConvert) => {
    let output = ''
    for (let index = 0; index <= 3; index += 1) {
      const byte = (valueToConvert >>> (index * 8)) & 255
      output += `0${byte.toString(16)}`.slice(-2)
    }
    return output
  }

  const words = toWordArray(unescape(encodeURIComponent(String(value || ''))))
  let a = 0x67452301
  let b = 0xefcdab89
  let c = 0x98badcfe
  let d = 0x10325476

  for (let index = 0; index < words.length; index += 16) {
    const savedA = a
    const savedB = b
    const savedC = c
    const savedD = d

    a = basic(f, a, b, c, d, words[index + 0], 7, 0xd76aa478)
    d = basic(f, d, a, b, c, words[index + 1], 12, 0xe8c7b756)
    c = basic(f, c, d, a, b, words[index + 2], 17, 0x242070db)
    b = basic(f, b, c, d, a, words[index + 3], 22, 0xc1bdceee)
    a = basic(f, a, b, c, d, words[index + 4], 7, 0xf57c0faf)
    d = basic(f, d, a, b, c, words[index + 5], 12, 0x4787c62a)
    c = basic(f, c, d, a, b, words[index + 6], 17, 0xa8304613)
    b = basic(f, b, c, d, a, words[index + 7], 22, 0xfd469501)
    a = basic(f, a, b, c, d, words[index + 8], 7, 0x698098d8)
    d = basic(f, d, a, b, c, words[index + 9], 12, 0x8b44f7af)
    c = basic(f, c, d, a, b, words[index + 10], 17, 0xffff5bb1)
    b = basic(f, b, c, d, a, words[index + 11], 22, 0x895cd7be)
    a = basic(f, a, b, c, d, words[index + 12], 7, 0x6b901122)
    d = basic(f, d, a, b, c, words[index + 13], 12, 0xfd987193)
    c = basic(f, c, d, a, b, words[index + 14], 17, 0xa679438e)
    b = basic(f, b, c, d, a, words[index + 15], 22, 0x49b40821)

    a = basic(g, a, b, c, d, words[index + 1], 5, 0xf61e2562)
    d = basic(g, d, a, b, c, words[index + 6], 9, 0xc040b340)
    c = basic(g, c, d, a, b, words[index + 11], 14, 0x265e5a51)
    b = basic(g, b, c, d, a, words[index + 0], 20, 0xe9b6c7aa)
    a = basic(g, a, b, c, d, words[index + 5], 5, 0xd62f105d)
    d = basic(g, d, a, b, c, words[index + 10], 9, 0x02441453)
    c = basic(g, c, d, a, b, words[index + 15], 14, 0xd8a1e681)
    b = basic(g, b, c, d, a, words[index + 4], 20, 0xe7d3fbc8)
    a = basic(g, a, b, c, d, words[index + 9], 5, 0x21e1cde6)
    d = basic(g, d, a, b, c, words[index + 14], 9, 0xc33707d6)
    c = basic(g, c, d, a, b, words[index + 3], 14, 0xf4d50d87)
    b = basic(g, b, c, d, a, words[index + 8], 20, 0x455a14ed)
    a = basic(g, a, b, c, d, words[index + 13], 5, 0xa9e3e905)
    d = basic(g, d, a, b, c, words[index + 2], 9, 0xfcefa3f8)
    c = basic(g, c, d, a, b, words[index + 7], 14, 0x676f02d9)
    b = basic(g, b, c, d, a, words[index + 12], 20, 0x8d2a4c8a)

    a = basic(h, a, b, c, d, words[index + 5], 4, 0xfffa3942)
    d = basic(h, d, a, b, c, words[index + 8], 11, 0x8771f681)
    c = basic(h, c, d, a, b, words[index + 11], 16, 0x6d9d6122)
    b = basic(h, b, c, d, a, words[index + 14], 23, 0xfde5380c)
    a = basic(h, a, b, c, d, words[index + 1], 4, 0xa4beea44)
    d = basic(h, d, a, b, c, words[index + 4], 11, 0x4bdecfa9)
    c = basic(h, c, d, a, b, words[index + 7], 16, 0xf6bb4b60)
    b = basic(h, b, c, d, a, words[index + 10], 23, 0xbebfbc70)
    a = basic(h, a, b, c, d, words[index + 13], 4, 0x289b7ec6)
    d = basic(h, d, a, b, c, words[index + 0], 11, 0xeaa127fa)
    c = basic(h, c, d, a, b, words[index + 3], 16, 0xd4ef3085)
    b = basic(h, b, c, d, a, words[index + 6], 23, 0x04881d05)
    a = basic(h, a, b, c, d, words[index + 9], 4, 0xd9d4d039)
    d = basic(h, d, a, b, c, words[index + 12], 11, 0xe6db99e5)
    c = basic(h, c, d, a, b, words[index + 15], 16, 0x1fa27cf8)
    b = basic(h, b, c, d, a, words[index + 2], 23, 0xc4ac5665)

    a = basic(i, a, b, c, d, words[index + 0], 6, 0xf4292244)
    d = basic(i, d, a, b, c, words[index + 7], 10, 0x432aff97)
    c = basic(i, c, d, a, b, words[index + 14], 15, 0xab9423a7)
    b = basic(i, b, c, d, a, words[index + 5], 21, 0xfc93a039)
    a = basic(i, a, b, c, d, words[index + 12], 6, 0x655b59c3)
    d = basic(i, d, a, b, c, words[index + 3], 10, 0x8f0ccc92)
    c = basic(i, c, d, a, b, words[index + 10], 15, 0xffeff47d)
    b = basic(i, b, c, d, a, words[index + 1], 21, 0x85845dd1)
    a = basic(i, a, b, c, d, words[index + 8], 6, 0x6fa87e4f)
    d = basic(i, d, a, b, c, words[index + 15], 10, 0xfe2ce6e0)
    c = basic(i, c, d, a, b, words[index + 6], 15, 0xa3014314)
    b = basic(i, b, c, d, a, words[index + 13], 21, 0x4e0811a1)
    a = basic(i, a, b, c, d, words[index + 4], 6, 0xf7537e82)
    d = basic(i, d, a, b, c, words[index + 11], 10, 0xbd3af235)
    c = basic(i, c, d, a, b, words[index + 2], 15, 0x2ad7d2bb)
    b = basic(i, b, c, d, a, words[index + 9], 21, 0xeb86d391)

    a = addUnsigned(a, savedA)
    b = addUnsigned(b, savedB)
    c = addUnsigned(c, savedC)
    d = addUnsigned(d, savedD)
  }

  return `${toHex(a)}${toHex(b)}${toHex(c)}${toHex(d)}`
}

const buildWikimediaThumbUrl = (fileName) => {
  const normalizedFileName = String(fileName || '').trim()
  if (!normalizedFileName) return ''
  const hash = md5(normalizedFileName)
  const encodedFileName = encodeURIComponent(normalizedFileName)
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${hash[0]}/${hash.slice(0, 2)}/${encodedFileName}/1280px-${encodedFileName}`
}

const buildBackendMediaProxyUrl = (sourceUrl) => {
  try {
    const apiBase = new URL(API_URL)
    const proxyUrl = new URL('/api/media/image', apiBase.origin)
    proxyUrl.searchParams.set('url', sourceUrl)
    return proxyUrl.toString()
  } catch {
    return sourceUrl
  }
}

const resolveImageUrl = (url) => {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('data:image/')) return trimmed
  if (/^(?:https?:)?\/\//i.test(trimmed)) {
    const wikimediaFileName = extractWikimediaFileName(trimmed)
    if (wikimediaFileName) {
      return buildBackendMediaProxyUrl(buildWikimediaThumbUrl(wikimediaFileName))
    }
    return trimmed
  }

  try {
    const backendOrigin = new URL(API_URL).origin
    return new URL(trimmed.replace(/^\/+/, ''), `${backendOrigin}/`).toString()
  } catch {
    return ''
  }
}

const normalizePostImageValue = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return resolveImageUrl(value)
  if (typeof value === 'object') {
    return resolveImageUrl(
      value.url ||
      value.imageUrl ||
      value.src ||
      value.href ||
      value.publicUrl ||
      value.location ||
      value.key ||
      ''
    )
  }
  return ''
}

const parsePostImageString = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return []

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Fall back to line-based parsing when the payload is not valid JSON.
    }
  }

  return raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
}

const getPostImages = (post) => {
  const rawImages = post?.images
  if (!rawImages) return []
  const list = Array.isArray(rawImages)
    ? rawImages
    : typeof rawImages === 'string'
      ? parsePostImageString(rawImages)
      : [rawImages]

  return list
    .map(normalizePostImageValue)
    .filter(Boolean)
}
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
const upsertCommentInCollection = (comments = [], nextComment) => {
  if (!nextComment?.commentId) return comments
  return [nextComment, ...comments.filter((item) => item?.commentId !== nextComment.commentId)]
}
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

const getPostDisplayParts = (post = {}) => {
  const explicitTitle = String(post?.title || '').trim()
  const rawContent = String(post?.content || '').trim()

  if (explicitTitle) {
    return {
      title: explicitTitle,
      body: rawContent,
    }
  }

  if (!rawContent) {
    return {
      title: '',
      body: '',
    }
  }

  const paragraphs = rawContent
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (paragraphs.length >= 2) {
    const [title, ...rest] = paragraphs
    return {
      title,
      body: rest.join('\n\n'),
    }
  }

  const lines = rawContent
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length >= 2) {
    return {
      title: lines[0],
      body: lines.slice(1).join('\n'),
    }
  }

  return {
    title: '',
    body: rawContent,
  }
}

const PostImage = React.memo(({ url, compact, showOverlay, extraCount, styles }) => {
    const [failed, setFailed] = useState(false)
    const resolvedUrl = useMemo(() => resolveImageUrl(url), [url])

    useEffect(() => {
      setFailed(false)
      if (__DEV__) {
        console.log('[PostImage:source]', { originalUrl: url, resolvedUrl })
      }
    }, [url, resolvedUrl])

    if (failed || !resolvedUrl) return null

    return (
      <View style={[styles.imageFrame, compact && styles.imageFrameCompact]}>
        <Image
          source={{ uri: resolvedUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={(event) => {
            console.warn('[PostImage:error]', {
              originalUrl: url,
              resolvedUrl,
              error: event?.nativeEvent?.error || 'unknown',
            })
            setFailed(true)
          }}
        />
        {showOverlay ? (
          <View style={styles.imageMoreOverlay}>
            <Text style={styles.imageMoreText}>+{extraCount}</Text>
          </View>
        ) : null}
      </View>
    )
  })

const isRemoteImageUrl = (value) => {
  const url = String(value || '').trim()
  if (!url) return false
  return /^(?:https?:)?\/\//i.test(url)
}

const normalizePostImageInput = (value) => {
  const url = String(value || '').trim()
  if (!url) return ''
  if (isRemoteImageUrl(url)) return url
  if (url.startsWith('data:image/')) return url
  return ''
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
    imageUploading: false,
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
        formatLocationLabel(post?.location),
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
    const upsertComment = (payload) => {
      const postId = String(payload?.postId || '')
      const comment = payload?.comment
      if (!postId || !comment?.commentId) return

      if (selectedPost?.postId === postId) {
        setComments((current) => upsertCommentInCollection(current, comment))
      }

      if (!expandedComments[postId] && !commentsByPost[postId]) return

      setCommentsByPost((current) => ({
        ...current,
        [postId]: upsertCommentInCollection(current[postId] || [], comment),
      }))
    }
    socket.on('post:comment_created', upsertComment)
    socket.on('post:comment_reaction_updated', upsertComment)

    return () => {
      socket.off('post:created', upsertPost)
      socket.off('post:updated', upsertPost)
      socket.off('post:status_changed', upsertPost)
      socket.off('post:reaction_updated', upsertPost)
      socket.off('post:comment_created', upsertPost)
      socket.off('post:comment_created', upsertComment)
      socket.off('post:comment_reaction_updated', upsertComment)
    }
  }, [commentsByPost, expandedComments, feedRegion, selectedPost?.postId])

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

  const openMapMode = useCallback(async () => {
    setMapPreviewVisible(false)
    setFocusedMapPost(null)
    setMode('map')
  }, [])

  const handleMapLocateRequest = useCallback(async () => {
    try {
      return await getCurrentDeviceLocation({
        deniedMessage: 'Bạn cần cấp quyền định vị để dùng vị trí hiện tại trên bản đồ.',
      })
    } catch (error) {
      notify({
        title: 'Quyền vị trí',
        message: error?.message || 'Không thể lấy vị trí hiện tại',
        variant: 'warning',
      })
      return null
    }
  }, [notify])

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

  const uploadPostImage = async (asset, index) => {
    const normalized = normalizePostImageInput(asset?.uri || asset?.url || asset)
    if (!normalized) return ''

    const fileName = asset?.fileName || asset?.name || `incident-${Date.now()}-${index + 1}.jpg`
    const mimeType = asset?.mimeType || asset?.type || 'image/jpeg'

    const response = await postService.createUploadUrl({ fileName, contentType: mimeType })
    const uploadUrl = response?.data?.uploadUrl
    const publicUrl = response?.data?.url
    if (!uploadUrl || !publicUrl) {
      throw new Error('Không thể tạo link upload ảnh')
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: asset?.uri ? await (await fetch(asset.uri)).blob() : undefined,
    })

    if (!uploadResponse.ok) {
      throw new Error('Upload ảnh thất bại')
    }

    return publicUrl
  }

  const pickImagesForPost = async () => {
    try {
      await ensureMediaLibraryPermission({
        deniedMessage: 'Bạn cần cấp quyền thư viện ảnh để thêm ảnh vào bài đăng.',
      })

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsMultipleSelection: true,
        selectionLimit: 6,
      })

      if (result?.canceled) return
      const assets = Array.isArray(result.assets) ? result.assets : []
      if (!assets.length) return

      setForm((current) => ({ ...current, imageUploading: true }))
      const uploadedUrls = []
      for (const [index, asset] of assets.entries()) {
        const publicUrl = await uploadPostImage(asset, index)
        if (publicUrl) uploadedUrls.push(publicUrl)
      }

      if (uploadedUrls.length) {
        setForm((current) => ({
          ...current,
          imagesText: Array.from(new Set([...(current.imagesText ? current.imagesText.split('\n').map((item) => item.trim()).filter(Boolean) : []), ...uploadedUrls])).join('\n'),
        }))
      }
    } catch (error) {
      notify({ title: 'Lỗi', message: error?.message || 'Không thể chọn ảnh', variant: 'error' })
    } finally {
      setForm((current) => ({ ...current, imageUploading: false }))
    }
  }

  const createPost = async () => {
    if (!form.content.trim()) {
      notify({ title: 'Thiếu nội dung', message: 'Vui lòng mô tả sự cố', variant: 'warning' })
      return
    }

    setSubmittingCreate(true)
    try {
      const images = form.imagesText.split('\n').map((item) => normalizePostImageInput(item)).filter(Boolean)
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
      setForm({ title: '', content: '', category: 'other', severity: 'medium', address: '', lat: '', lng: '', imagesText: '', imageUploading: false })
      setShowCreateModal(false)
      await loadPosts()
    } catch (error) {
      notify({ title: 'Lỗi', message: error?.response?.data?.error || error?.message || 'Không thể tạo báo cáo', variant: 'error' })
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
          <PostImage
            key={`${url}-${index}`}
            url={url}
            compact={compact}
            showOverlay={index === preview.length - 1 && images.length > preview.length}
            extraCount={images.length - preview.length}
            styles={styles}
          />
        ))}
      </View>
    )
  }

  const renderPostLocation = (post) => {
    const coordinates = getPostCoordinates(post)
    const label = formatLocationLabel(post.location) || (coordinates ? 'Đã chọn vị trí trên bản đồ' : '')
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

  const renderPostCard = (post, compact = false) => {
    const postDisplayParts = getPostDisplayParts(post)
    const postTitle = postDisplayParts.title
    const postBody = postDisplayParts.body || String(post?.content || '').trim()

    return (
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
        {!!postTitle && <Text style={styles.postTitle}>{postTitle}</Text>}
        {!!postBody && <Text numberOfLines={compact ? 3 : undefined} style={styles.postContent}>{postBody}</Text>}
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
  }

  const renderFeed = () => (
    <ScrollView
      contentContainerStyle={styles.sectionWrap}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPosts} tintColor={c.primary} />}
    >
      {loading ? <ActivityIndicator color={c.primary} style={styles.loader} /> : null}
      {!loading && posts.length === 0 ? (
        <EmptyState icon="post-outline" title="Chưa có báo cáo" description="Kéo xuống để làm mới hoặc tạo báo cáo mới bằng nút ở góc dưới." />
      ) : null}
      {!loading ? posts.map((post) => renderPostCard(post, false)) : null}
    </ScrollView>
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
        setFocusedMapPost(null)
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
              onPress={() => {
                if (key === 'map') {
                  openMapMode()
                  return
                }
                setMapPreviewVisible(false)
                setFocusedMapPost(null)
                setMode(key)
              }}
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
        onLocateRequest={handleMapLocateRequest}
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
      />

      {mapPreviewVisible && focusedMapPost ? (
        <Animated.View style={[styles.mapPreviewPanel, { transform: [{ translateY: mapPreviewTranslateY }] }]} {...mapPreviewPanHandlers.panHandlers}>
          <View style={styles.mapPreviewHandle} />
          {renderPostCard(focusedMapPost, true)}
        </Animated.View>
      ) : null}
    </View>
  )

  const renderSearch = () => (
    <ScrollView
      contentContainerStyle={styles.searchScreen}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPosts} tintColor={c.primary} />}
    >
      <Input
        placeholder="Tìm bài viết, địa điểm, trạng thái..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <View style={styles.searchQuickWrap}>
        {quickSearchOptions.map((option) => (
          <Chip key={option.key} onPress={() => setSearchQuery(option.key)}>{option.label}</Chip>
        ))}
      </View>
      {searchedPosts.map((post) => renderPostCard(post, false))}
    </ScrollView>
  )

  const renderCreateModal = () => (
    <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tạo báo cáo</Text>
            <IconButton icon="close" onPress={() => setShowCreateModal(false)} />
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input
              value={form.title}
              onChangeText={(title) => setForm((current) => ({ ...current, title }))}
              placeholder="Tiêu đề (không bắt buộc)"
            />
            <Input
              multiline
              value={form.content}
              onChangeText={(content) => setForm((current) => ({ ...current, content }))}
              placeholder="Mô tả sự cố"
            />
            <Input
              value={form.address}
              onChangeText={(address) => setForm((current) => ({ ...current, address }))}
              placeholder={getLocationInputPlaceholder()}
            />
            <View style={styles.row2}>
              <Input
                style={styles.rowItem}
                value={form.lat}
                onChangeText={(lat) => setForm((current) => ({ ...current, lat }))}
                placeholder="Vĩ độ"
                keyboardType="decimal-pad"
              />
              <Input
                style={styles.rowItem}
                value={form.lng}
                onChangeText={(lng) => setForm((current) => ({ ...current, lng }))}
                placeholder="Kinh độ"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.pickerRow}>
              {categories.map(([key, label]) => (
                <Chip key={key} onPress={() => setForm((current) => ({ ...current, category: key }))} variant={form.category === key ? 'solid' : 'outline'}>
                  {label}
                </Chip>
              ))}
            </View>
            <View style={styles.pickerRow}>
              {severities.map(([key, label]) => (
                <Chip key={key} onPress={() => setForm((current) => ({ ...current, severity: key }))} variant={form.severity === key ? 'solid' : 'outline'}>
                  {label}
                </Chip>
              ))}
            </View>
            <View style={styles.createImageActions}>
              <Button
                variant="secondary"
                onPress={pickImagesForPost}
                loading={form.imageUploading}
              >
                Chọn ảnh & tải lên
              </Button>
            </View>
            <Input
              multiline
              value={form.imagesText}
              onChangeText={(imagesText) => setForm((current) => ({ ...current, imagesText }))}
              placeholder="Mỗi dòng 1 URL ảnh đã upload"
            />
            <Text style={styles.helperText}>
              Ảnh sẽ được upload lên S3 trước khi đăng để luôn hiển thị trên mobile.
            </Text>
            <Button loading={submittingCreate} onPress={createPost}>Đăng sự cố</Button>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )

  return (
    <Screen style={styles.screen}>
      {mode === 'feed' ? renderFeed() : null}
      {mode === 'map' ? renderMap() : null}
      {mode === 'search' ? renderSearch() : null}
      {renderTabs()}
      <MobileBottomTabBar
        active="Urban"
        badges={{ Friends: friendRequestCount }}
        onNavigate={{
          Chats: onOpenChats,
          Friends: onOpenFriends,
          Urban: () => setMode('feed'),
          Assistant: onOpenAssistant,
          Profile: onOpenProfile,
        }}
      />
      {mode !== 'map' ? (
        <Pressable style={styles.fab} onPress={() => setShowCreateModal(true)}>
          <MaterialCommunityIcons name="plus" style={styles.fabIcon} />
        </Pressable>
      ) : null}
      {renderCreateModal()}
      <Modal visible={Boolean(selectedPost)} transparent animationType="slide" onRequestClose={closePostDetail}>
        <View style={styles.detailBackdrop}>
          <View style={styles.detailCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết báo cáo</Text>
              <IconButton icon="close" onPress={closePostDetail} />
            </View>
            <ScrollView contentContainerStyle={styles.detailBody}>
              {selectedPost ? renderPostCard(selectedPost, false) : null}
              {selectedPost ? renderCommentTree(selectedPost.postId, groupComments(comments)) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const createStyles = (theme) => {
  const { colors, spacing, radius } = theme
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    sectionWrap: {
      padding: spacing[3],
      gap: spacing[3],
      paddingBottom: 176,
    },
    loader: {
      marginTop: spacing[3],
    },
    postCard: {
      gap: spacing[3],
    },
    postCardCompact: {
      marginBottom: 0,
    },
    postAuthorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    postAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    postAvatarImage: {
      width: '100%',
      height: '100%',
    },
    postAvatarText: {
      color: colors.textMuted,
      fontWeight: '700',
    },
    postAuthorCopy: {
      flex: 1,
    },
    postAuthor: {
      color: colors.text,
      fontWeight: '700',
    },
    postMeta: {
      color: colors.textMuted,
      fontSize: 12,
    },
    postAuthorTags: {
      flexDirection: 'row',
      gap: spacing[1],
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },
    postTitle: {
      color: colors.text,
      fontWeight: '700',
      marginBottom: spacing[1],
    },
    postContent: {
      color: colors.text,
      lineHeight: 20,
    },
    imageGrid: {
      marginTop: spacing[3],
      gap: spacing[2],
    },
    imageGridCompact: {
      gap: 0,
    },
    imageFrame: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      minHeight: 200,
    },
    imageFrameCompact: {
      minHeight: 150,
    },
    image: {
      width: '100%',
      height: 220,
      backgroundColor: colors.surfaceMuted,
    },
    imageMoreOverlay: {
      position: 'absolute',
      right: spacing[2],
      bottom: spacing[2],
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      borderRadius: radius.full,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
    },
    imageMoreText: {
      color: '#fff',
      fontWeight: '700',
    },
    postLocationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    postLocationButtonPressed: {
      opacity: 0.85,
    },
    postLocationIcon: {
      color: colors.primary,
      fontSize: 18,
    },
    postLocation: {
      color: colors.primary,
      flex: 1,
    },
    postStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    postStatsText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    postFooter: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    socialAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[1],
      paddingVertical: spacing[2],
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    socialActionActive: {
      backgroundColor: colors.primarySoft,
    },
    socialActionImportant: {},
    socialActionIcon: {
      fontSize: 18,
      color: colors.textMuted,
    },
    socialActionIconActive: {
      color: colors.primary,
    },
    socialActionText: {
      color: colors.textMuted,
      fontWeight: '600',
    },
    socialActionTextActive: {
      color: colors.primary,
    },
    inlineCommentsWrap: {
      gap: spacing[2],
    },
    inlineCommentComposer: {},
    inlineCommentLoader: {
      marginVertical: spacing[2],
    },
    inlineCommentEmpty: {
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    commentTreeItem: {
      marginTop: spacing[2],
      gap: spacing[1],
    },
    commentTreeReply: {
      marginLeft: spacing[4],
    },
    commentBubble: {
      padding: spacing[2],
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    commentRow: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    commentAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentAvatarImage: {
      width: '100%',
      height: '100%',
    },
    commentAvatarText: {
      color: colors.primary,
      fontWeight: '700',
    },
    commentBody: {
      flex: 1,
    },
    commentHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    commentAuthor: {
      color: colors.text,
      fontWeight: '700',
      flex: 1,
    },
    commentTimeInline: {
      color: colors.textMuted,
      fontSize: 12,
    },
    commentText: {
      color: colors.text,
      marginTop: spacing[1],
    },
    commentActionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    commentActionButton: {
      paddingVertical: spacing[1],
      paddingHorizontal: spacing[2],
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
    },
    commentActionText: {
      color: colors.primary,
      fontWeight: '600',
    },
    replyComposer: {
      gap: spacing[2],
    },
    replyComposerActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    inputWithSend: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing[2],
    },
    inputWithSendField: {
      flex: 1,
    },
    sendIconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendIcon: {
      color: '#fff',
      fontSize: 18,
    },
    stickyTabsWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 76,
      padding: spacing[3],
      zIndex: 35,
      elevation: 12,
    },
    stickyTabsWrapFloating: {},
    stickyTabs: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      borderRadius: radius.full,
      backgroundColor: colors.surface,
      padding: spacing[2],
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    stickyTabsFloating: {},
    stickyTab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    stickyTabActive: {
      backgroundColor: colors.primarySoft,
    },
    stickyTabIcon: {
      color: colors.textMuted,
      fontSize: 30,
    },
    stickyTabIconActive: {
      color: colors.primary,
    },
    fab: {
      position: 'absolute',
      right: spacing[4],
      bottom: 160,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5,
    },
    fabIcon: {
      color: '#fff',
      fontSize: 28,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      justifyContent: 'center',
      padding: spacing[3],
    },
    modalCard: {
      maxHeight: '90%',
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    modalBody: {
      padding: spacing[3],
      gap: spacing[3],
    },
    row2: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    rowItem: {
      flex: 1,
    },
    pickerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    createImageActions: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    detailBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      justifyContent: 'center',
      padding: spacing[3],
    },
    detailCard: {
      maxHeight: '90%',
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    detailBody: {
      padding: spacing[3],
      gap: spacing[3],
    },
    mapScreen: {
      flex: 1,
    },
    mapPreviewPanel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 152,
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing[3],
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
      zIndex: 20,
    },
    mapPreviewHandle: {
      alignSelf: 'center',
      width: 48,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginBottom: spacing[2],
    },
    searchScreen: {
      padding: spacing[3],
      gap: spacing[3],
      paddingBottom: 176,
    },
    searchQuickWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
  })
}
