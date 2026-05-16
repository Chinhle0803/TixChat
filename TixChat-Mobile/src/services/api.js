import axios from 'axios'
import { API_URL } from '../config/env'
import { storage } from './storage'
import { createChatApiServices } from './apiContracts.js'

let inMemoryAuth = {
  user: null,
  accessToken: null,
  refreshToken: null,
}

export const setInMemoryAuth = (auth) => {
  inMemoryAuth = {
    ...inMemoryAuth,
    ...auth,
  }
}

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(async (config) => {
  if (!inMemoryAuth.accessToken) {
    const auth = await storage.getAuth()
    setInMemoryAuth(auth)
  }

  if (inMemoryAuth.accessToken) {
    config.headers.Authorization = `Bearer ${inMemoryAuth.accessToken}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 403 || originalRequest?._retry) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const refreshToken = inMemoryAuth.refreshToken || (await storage.getAuth()).refreshToken

      if (!refreshToken) {
        throw new Error('No refresh token')
      }

      const refreshResponse = await axios.post(`${API_URL}/auth/refresh-token`, {
        refreshToken,
      })

      const newAccessToken = refreshResponse?.data?.accessToken
      if (!newAccessToken) {
        throw new Error('Refresh token response invalid')
      }

      setInMemoryAuth({ accessToken: newAccessToken })
      const currentAuth = await storage.getAuth()
      await storage.setAuth({ ...currentAuth, accessToken: newAccessToken })

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      await storage.clearAuth()
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
