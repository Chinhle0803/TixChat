import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

const truncate = (value = '', maxLength = 110) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trim()}…`
}

export const getProjectId = () => {
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    Constants?.manifest2?.extra?.eas?.projectId ||
    ''

  return projectId === 'YOUR_EAS_PROJECT_ID' ? '' : projectId
}

export const getDisplayName = (participant) => {
  if (!participant || typeof participant === 'string') return 'TixChat'
  return (
    participant.nickname ||
    participant.displayName ||
    participant.fullName ||
    participant.name ||
    participant.username ||
    'TixChat'
  )
}

export const buildMessagePreview = (message = {}) => {
  const type = String(message?.type || '').toLowerCase()
  const content = String(message?.content || '').trim()
  const attachments = Array.isArray(message?.attachments) ? message.attachments : []

  if (type === 'system') return truncate(content || 'Có cập nhật mới')
  if (content) return truncate(content)
  if (attachments.length > 0) {
    const firstType = String(attachments[0]?.type || attachments[0]?.mimeType || '').toLowerCase()
    if (firstType.includes('image')) return 'Đã gửi một ảnh'
    if (firstType.includes('video')) return 'Đã gửi một video'
    return 'Đã gửi một tệp'
  }
  return 'Bạn có tin nhắn mới'
}

export const buildMessageNotification = ({ message, conversation, currentUserId }) => {
  const senderId = String(message?.senderId || '')
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : []
  const sender = participants.find((participant) => {
    const id = String(participant?._id || participant?.userId || participant?.id || participant || '')
    return id && id === senderId
  })
  const senderName = senderId === 'system' ? 'TixChat' : getDisplayName(sender)
  const isGroup = String(conversation?.type || '').toLowerCase() === 'group'
  const title = isGroup ? (conversation?.name || 'Nhóm chat') : senderName
  const preview = buildMessagePreview(message)

  return {
    title,
    body: isGroup && senderId !== 'system' ? `${senderName}: ${preview}` : preview,
    data: {
      type: 'message',
      conversationId: String(message?.conversationId || conversation?.conversationId || conversation?._id || ''),
      messageId: String(message?.messageId || message?._id || ''),
      currentUserId: String(currentUserId || ''),
    },
  }
}

export const registerForPushNotificationsAsync = async () => {
  if (!Device.isDevice) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Tin nhắn',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    })
  }

  const currentPermissions = await Notifications.getPermissionsAsync()
  let finalStatus = currentPermissions.status
  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync()
    finalStatus = requested.status
  }

  if (finalStatus !== 'granted') return null

  const projectId = getProjectId()
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  )

  return tokenResponse?.data || null
}

export const scheduleMessageNotification = async ({ message, conversation, currentUserId }) => {
  const notification = buildMessageNotification({ message, conversation, currentUserId })
  if (!notification?.data?.conversationId) return

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      data: notification.data,
      sound: 'default',
    },
    trigger: null,
  })
}

export const buildCallNotification = ({ call, conversation }) => {
  const callType = String(call?.callType || '').toLowerCase() === 'video' ? 'video' : 'thoại'
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : []
  const callerId = String(call?.callerId || '')
  const caller = participants.find((participant) => {
    const id = String(participant?._id || participant?.userId || participant?.id || participant || '')
    return id && id === callerId
  })
  const callerName = getDisplayName(caller)

  return {
    title: callerName === 'TixChat' ? 'Cuộc gọi đến' : callerName,
    body: `Cuộc gọi ${callType} đến`,
    data: {
      type: 'call',
      callId: String(call?.callId || ''),
      conversationId: String(call?.conversationId || conversation?.conversationId || conversation?._id || ''),
      callType,
    },
  }
}

export const scheduleCallNotification = async ({ call, conversation }) => {
  const notification = buildCallNotification({ call, conversation })
  if (!notification?.data?.callId || !notification?.data?.conversationId) return

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      data: notification.data,
      sound: 'default',
    },
    trigger: null,
  })
}

export const addNotificationResponseListener = (handler) =>
  Notifications.addNotificationResponseReceivedListener(handler)
