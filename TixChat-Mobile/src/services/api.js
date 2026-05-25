import axios from 'axios'
import { API_URL } from '../config/env'
import { storage } from './storage'
import { createChatApiServices } from './apiContracts.js'
import { getInMemoryAuth, setInMemoryAuth } from './authState'
import { syncSocketAuthToken } from './socket'
import { useAuthStore } from '../stores/authStore'

const isNgrokUrl = (value) => /(?:\.ngrok-free\.dev|\.ngrok\.app|\.ngrok\.io)/i.test(String(value || ''))
const apiDiagnosticsEnabled = String(process.env.EXPO_PUBLIC_API_DIAGNOSTICS || '').toLowerCase() === 'true'
const protectedEndpointPattern = /^\/(?:assistant|calls|conversations|messages|notifications|posts|users)(?:\/|$)/

const getNgrokBypassHeaders = () => (
  isNgrokUrl(API_URL)
    ? { 'ngrok-skip-browser-warning': 'true' }
    : {}
)

const isAuthRefreshRequest = (config = {}) => {
  const url = String(config?.url || '')
  return url.includes('/auth/refresh-token')
}

const isAuthBootstrapRequest = (config = {}) => {
  const url = String(config?.url || '')
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/send-email-verification-otp') ||
    url.includes('/auth/verify-email-otp') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/verify-reset-token') ||
    url.includes('/auth/reset-password') ||
    isAuthRefreshRequest(config)
  )
}

const getRequestPath = (config = {}) => {
  const url = String(config?.url || '')
  if (!url) return ''

  try {
    const parsed = new URL(url, config?.baseURL || API_URL)
    return parsed.pathname.replace(/^\/api(?=\/|$)/, '') || parsed.pathname
  } catch (_) {
    return url.split('?')[0]
  }
}

const isProtectedApiRequest = (config = {}) => protectedEndpointPattern.test(getRequestPath(config))

const getAuthDiagnostics = () => {
  const auth = getInMemoryAuth()

  return {
    hasAccessToken: Boolean(auth.accessToken),
    accessTokenLength: auth.accessToken ? String(auth.accessToken).length : 0,
    hasRefreshToken: Boolean(auth.refreshToken),
  }
}

const getRequestDiagnostics = (config = {}) => ({
  method: String(config?.method || 'get').toUpperCase(),
  path: getRequestPath(config),
  baseURL: String(config?.baseURL || API_URL || ''),
})

const summarizeResponseData = (data) => {
  if (Array.isArray(data)) {
    return { responseType: 'array', itemCount: data.length }
  }

  if (!data || typeof data !== 'object') {
    return { responseType: typeof data }
  }

  const summary = {
    responseType: 'object',
    responseKeys: Object.keys(data).slice(0, 8),
  }

  for (const key of ['conversations', 'messages', 'posts', 'users', 'participants', 'notifications']) {
    if (Array.isArray(data[key])) {
      summary[`${key}Count`] = data[key].length
    }
  }

  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    summary.nestedDataKeys = Object.keys(data.data).slice(0, 8)
    for (const key of ['conversations', 'messages', 'posts', 'users', 'participants', 'notifications']) {
      if (Array.isArray(data.data[key])) {
        summary[`nested${key.charAt(0).toUpperCase()}${key.slice(1)}Count`] = data.data[key].length
      }
    }
  }

  return summary
}

const logApiDiagnostic = (type, config = {}, details = {}, force = false) => {
  if (!force && !apiDiagnosticsEnabled) return
  if (!isProtectedApiRequest(config)) return

  const payload = {
    ...getRequestDiagnostics(config),
    ...details,
    ...getAuthDiagnostics(),
  }

  const logger = type === 'error' || type === 'refresh_failed' ? console.warn : console.log
  logger(`[api:${type}]`, payload)
}

export { getInMemoryAuth, setInMemoryAuth }

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    ...getNgrokBypassHeaders(),
  },
})

apiClient.interceptors.request.use(async (config) => {
  config.headers = config.headers || {}
  Object.assign(config.headers, getNgrokBypassHeaders())

  let auth = getInMemoryAuth()
  if (!auth.accessToken) {
    const storedAuth = await storage.getAuth()
    setInMemoryAuth(storedAuth)
    auth = getInMemoryAuth()
  }

  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`
  }

  logApiDiagnostic('request', config)
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    logApiDiagnostic('success', response.config, {
      status: response.status,
      ...summarizeResponseData(response.data),
    })
    return response
  },
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Request failed'
    logApiDiagnostic('error', originalRequest, { status, message: errorMessage }, true)

    if (![401, 403].includes(status) || originalRequest?._retry || isAuthBootstrapRequest(originalRequest)) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const auth = getInMemoryAuth()
      const refreshToken = auth.refreshToken || (await storage.getAuth()).refreshToken

      if (!refreshToken) {
        throw new Error('No refresh token')
      }

      const refreshResponse = await axios.post(
        `${API_URL}/auth/refresh-token`,
        { refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
            ...getNgrokBypassHeaders(),
          },
        }
      )

      const newAccessToken = refreshResponse?.data?.accessToken || refreshResponse?.data?.data?.accessToken
      if (!newAccessToken) {
        throw new Error('Refresh token response invalid')
      }

      setInMemoryAuth({ accessToken: newAccessToken })
      useAuthStore.setState((state) => ({
        accessToken: newAccessToken,
        isAuthenticated: Boolean(state.user && newAccessToken),
        authLoading: false,
        authError: '',
      }))
      const currentAuth = await storage.getAuth()
      await storage.setAuth({ ...currentAuth, accessToken: newAccessToken })
      syncSocketAuthToken(newAccessToken)
      logApiDiagnostic('refresh_success', originalRequest, { status })

      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      logApiDiagnostic(
        'refresh_failed',
        originalRequest,
        {
          status: refreshError.response?.status,
          message: refreshError.response?.data?.error || refreshError.response?.data?.message || refreshError.message || 'Refresh failed',
        },
        true
      )
      await storage.clearAuth()
      setInMemoryAuth({ user: null, accessToken: null, refreshToken: null })
      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        authLoading: false,
        authError: '',
      })
      return Promise.reject(refreshError)
    }
  }
)

const { authApi, userApi, conversationApi, messageApi, notificationApi, callApi, postApi, assistantApi } = createChatApiServices(apiClient)

export { authApi, userApi, conversationApi, messageApi, notificationApi, callApi, postApi, assistantApi }

export const authService = {
  register: authApi.register,
  login: authApi.login,
  logout: authApi.logout,
  getMe: authApi.getMe,
}

export const userService = userApi
export const conversationService = conversationApi
export const messageService = messageApi
export const notificationService = notificationApi
export const callService = callApi
export const postService = postApi
export const assistantService = assistantApi

export default apiClient
