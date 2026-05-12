import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import AuthContainer from './pages/AuthContainer'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import { UrbanAssistantPage, UrbanFeedPage, UrbanMapPage, UrbanPostDetailPage } from './pages/UrbanPage'
import AssistantPage from './pages/AssistantPage'
import CallsPage from './pages/CallsPage'
import MainToolbar from './components/MainToolbar'
import { DialogProvider } from './context/DialogContext'
import './styles/App.css'

const TOOLBAR_COLLAPSED_STORAGE_KEY = 'tixchat.mainToolbarCollapsed.v1'

const readToolbarCollapsed = () => {
  try {
    return localStorage.getItem(TOOLBAR_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

const AuthenticatedLayout = ({ children }) => {
  const [toolbarCollapsed, setToolbarCollapsed] = useState(readToolbarCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(TOOLBAR_COLLAPSED_STORAGE_KEY, String(toolbarCollapsed))
    } catch {
      // Local persistence is optional; the toolbar still works without it.
    }
  }, [toolbarCollapsed])

  return (
    <div className={`authenticated-shell ${toolbarCollapsed ? 'toolbar-collapsed' : ''}`}>
      <MainToolbar
        collapsed={toolbarCollapsed}
        onToggleCollapsed={() => setToolbarCollapsed((current) => !current)}
      />
      <section className="authenticated-content">
        {children}
      </section>
    </div>
  )
}

function App() {
  const { isAuthenticated, hasInitialized, initialize } = useAuthStore()
  const { initializeTheme } = useThemeStore()

  useEffect(() => {
    initialize()
    initializeTheme()
  }, [initialize, initializeTheme])

  if (!hasInitialized) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <span className="app-loading-spinner" aria-hidden="true" />
        <span>Đang mở TixChat...</span>
      </div>
    )
  }

  const protectedPage = (page) => (
    isAuthenticated ? <AuthenticatedLayout>{page}</AuthenticatedLayout> : <Navigate to="/auth" />
  )

  return (
    <DialogProvider>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route 
            path="/auth/*" 
            element={!isAuthenticated ? <AuthContainer /> : <Navigate to="/chat" />} 
          />
          <Route 
            path="/chat" 
            element={protectedPage(<ChatPage />)} 
          />
          <Route
            path="/calls"
            element={protectedPage(<CallsPage />)}
          />
          <Route
            path="/assistant"
            element={protectedPage(<AssistantPage />)}
          />
          <Route 
            path="/profile" 
            element={protectedPage(<ProfilePage />)} 
          />
          <Route
            path="/urban"
            element={protectedPage(<UrbanFeedPage />)}
          />
          <Route
            path="/urban/posts/:postId"
            element={protectedPage(<UrbanPostDetailPage />)}
          />
          <Route
            path="/urban/map"
            element={protectedPage(<UrbanMapPage />)}
          />
          <Route
            path="/urban/assistant"
            element={protectedPage(<UrbanAssistantPage />)}
          />
          <Route 
            path="/" 
            element={isAuthenticated ? <Navigate to="/chat" /> : <Navigate to="/auth" />} 
          />
        </Routes>
      </Router>
    </DialogProvider>
  )
}

export default App
