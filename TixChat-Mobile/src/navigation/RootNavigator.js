import React from 'react'
import { StatusBar } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import AuthScreen from '../components/AuthScreen'
import RegisterScreen from '../components/RegisterScreen'
import VerifyOtpScreen from '../components/VerifyOtpScreen'
import ForgotPasswordScreen from '../components/ForgotPasswordScreen'
import ConversationListScreen from '../components/ConversationListScreen'
import ChatScreen from '../components/ChatScreen'
import MobileCallOverlay from '../components/MobileCallOverlay'
import MobileInAppBannerHost from '../components/MobileInAppBannerHost'
import ProfileScreen from '../components/ProfileScreen'
import FriendHubScreen from '../components/FriendHubScreen'
import CreateGroupScreen from '../components/CreateGroupScreen'
import DiscoverScreen from '../components/DiscoverScreen'
import DiaryScreen from '../components/DiaryScreen'
import UrbanIncidentScreen from '../components/UrbanIncidentScreen'
import AssistantScreen from '../components/AssistantScreen'
import CallsScreen from '../components/CallsScreen'
import AppDialogModal from '../components/AppDialogModal'
import { useAppTheme } from '../theme'
import { DEFAULT_STACK_SCREEN_OPTIONS, PRIMARY_SECTION_SCREEN_OPTIONS, ROUTES } from './routes'

const Stack = createNativeStackNavigator()

export default function RootNavigator({
  navigationRef,
  authenticated,
  authLoading,
  authError,
  pendingVerificationEmail,
  setPendingVerificationEmail,
  handleLogin,
  requestForgotPassword,
  verifyForgotToken,
  resetForgotPassword,
  handleRegister,
  verifyOtp,
  resendOtp,
  user,
  visibleConversations,
  unreadByConversation,
  loadingConversations,
  startConversationWithUser,
  openConversation,
  loadConversations,
  handleLogout,
  openProfileLocationPicker,
  showAppDialog,
  createGroupConversation,
  profileLocationPromptToken,
  updateAvatar,
  updateProfile,
  updatePassword,
  currentConversation,
  messages,
  loadingOlderMessages,
  hasMoreMessages,
  loadOlderMessages,
  chatScrollRequestKey,
  loadingMessages,
  closeConversation,
  renameCurrentGroup,
  updateCurrentGroupAvatar,
  addMemberToCurrentGroup,
  removeMemberFromCurrentGroup,
  updateCurrentParticipantRole,
  searchUsersForGroupMember,
  updateCurrentGroupSettings,
  sendTextMessage,
  pickImageAndSend,
  pickFileAndSend,
  editCurrentMessage,
  deleteCurrentMessage,
  deleteMessageForAll,
  toggleMessageReaction,
  forwardMessageToConversations,
  handleStartTyping,
  handleStopTyping,
  typingUsersForCurrentConversation,
  currentConversationPreference,
  updateConversationPreference,
  activeConversationIdRef,
  deleteCurrentConversation,
  refreshCurrentConversationData,
  startMobileCall,
  joinAvailableMobileCall,
  inAppBanners,
  dismissInAppBanner,
  openConversationFromBanner,
  acceptMobileCall,
  declineMobileCall,
  mobileCallState,
  endMobileCall,
  toggleMobileMute,
  toggleMobileCamera,
  switchMobileCamera,
  selectMobileAudioRoute,
  appDialog,
  closeAppDialog,
}) {
  const appTheme = useAppTheme()

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar barStyle={appTheme.isDark ? 'light-content' : 'dark-content'} />
      <Stack.Navigator
        initialRouteName={authenticated ? ROUTES.CONVERSATIONS : ROUTES.LOGIN}
        screenOptions={DEFAULT_STACK_SCREEN_OPTIONS}
      >
        {!authenticated ? (
          <>
            <Stack.Screen name={ROUTES.LOGIN} options={{ headerShown: false }}>
              {({ navigation }) => (
                <AuthScreen
                  onLogin={async (email, password) => {
                    const success = await handleLogin(email, password)
                    if (success) {
                      navigation.reset({ index: 0, routes: [{ name: ROUTES.CONVERSATIONS }] })
                    }
                  }}
                  onSwitchToRegister={() => navigation.navigate(ROUTES.REGISTER)}
                  onSwitchToForgot={() => navigation.navigate(ROUTES.FORGOT_PASSWORD)}
                  loading={authLoading}
                  error={authError}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name={ROUTES.FORGOT_PASSWORD} options={{ headerShown: false }}>
              {({ navigation }) => (
                <ForgotPasswordScreen
                  loading={authLoading}
                  error={authError}
                  onRequestReset={requestForgotPassword}
                  onVerifyToken={verifyForgotToken}
                  onResetPassword={resetForgotPassword}
                  onSwitchToLogin={() => navigation.goBack()}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name={ROUTES.REGISTER} options={{ headerShown: false }}>
              {({ navigation }) => (
                <RegisterScreen
                  loading={authLoading}
                  error={authError}
                  onSubmit={async (payload) => {
                    const result = await handleRegister(payload)
                    if (result.ok) {
                      navigation.navigate(ROUTES.VERIFY_OTP)
                    }
                  }}
                  onSwitchToLogin={() => navigation.goBack()}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name={ROUTES.VERIFY_OTP} options={{ title: 'Xác thực OTP' }}>
              {({ navigation }) => (
                <VerifyOtpScreen
                  email={pendingVerificationEmail}
                  loading={authLoading}
                  error={authError}
                  onVerify={async (otp) => {
                    const success = await verifyOtp(otp)
                    if (success) {
                      navigation.reset({ index: 0, routes: [{ name: ROUTES.CONVERSATIONS }] })
                    }
                  }}
                  onResend={resendOtp}
                  onBackToLogin={() => {
                    setPendingVerificationEmail('')
                    navigation.popToTop()
                  }}
                />
              )}
            </Stack.Screen>
          </>
        ) : (
          <>
            <Stack.Screen name={ROUTES.CONVERSATIONS} options={PRIMARY_SECTION_SCREEN_OPTIONS}>
              {({ navigation }) => (
                <ConversationListScreen
                  user={user}
                  conversations={visibleConversations}
                  unreadByConversation={unreadByConversation}
                  loading={loadingConversations}
                  friendRequestCount={0}
                  onOpenProfile={() => navigation.navigate(ROUTES.PROFILE)}
                  onOpenFriends={() => navigation.navigate(ROUTES.FRIEND_HUB)}
                  onOpenDiscover={() => navigation.navigate(ROUTES.DISCOVER)}
                  onOpenDiary={() => navigation.navigate(ROUTES.DIARY)}
                  onOpenUrban={() => navigation.navigate(ROUTES.URBAN_INCIDENTS)}
                  onOpenCalls={() => navigation.navigate(ROUTES.CALLS)}
                  onOpenAssistant={() => navigation.navigate(ROUTES.ASSISTANT)}
                  onOpenCreateGroup={() => navigation.navigate(ROUTES.CREATE_GROUP)}
                  onStartConversation={async (targetUserId) => {
                    const opened = await startConversationWithUser(targetUserId)
                    if (opened) {
                      navigation.navigate(ROUTES.CHAT)
                    }
                  }}
                  onOpenConversation={async (conversation) => {
                    const opened = await openConversation(conversation)
                    if (opened) {
                      navigation.navigate(ROUTES.CHAT)
                    }
                  }}
                  onRefresh={loadConversations}
                  onLogout={async () => {
                    await handleLogout()
                    navigation.reset({ index: 0, routes: [{ name: ROUTES.LOGIN }] })
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name={ROUTES.CALLS} options={PRIMARY_SECTION_SCREEN_OPTIONS}>
              {({ navigation }) => (
                <CallsScreen
                  onOpenChats={() => navigation.navigate(ROUTES.CONVERSATIONS)}
                  onOpenUrban={() => navigation.navigate(ROUTES.URBAN_INCIDENTS)}
                  onOpenAssistant={() => navigation.navigate(ROUTES.ASSISTANT)}
                  onOpenProfile={() => navigation.navigate(ROUTES.PROFILE)}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name={ROUTES.ASSISTANT} options={PRIMARY_SECTION_SCREEN_OPTIONS}>
              {({ navigation }) => (
                <AssistantScreen
                  onOpenChats={() => navigation.navigate(ROUTES.CONVERSATIONS)}
                  onOpenFriends={() => navigation.navigate(ROUTES.FRIEND_HUB)}
                  onOpenUrban={() => navigation.navigate(ROUTES.URBAN_INCIDENTS)}
                  onOpenProfile={() => navigation.navigate(ROUTES.PROFILE)}
                  onOpenProfileLocation={() => openProfileLocationPicker(navigation)}
                  friendRequestCount={0}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name={ROUTES.FRIEND_HUB} options={PRIMARY_SECTION_SCREEN_OPTIONS}>
              {({ navigation }) => (
                <FriendHubScreen
                  currentUserId={user?._id || user?.userId}
                  onBack={() => navigation.goBack()}
                  onOpenConversations={() => navigation.navigate(ROUTES.CONVERSATIONS)}
                  onOpenUrban={() => navigation.navigate(ROUTES.URBAN_INCIDENTS)}
                  onOpenAssistant={() => navigation.navigate(ROUTES.ASSISTANT)}
                  onOpenProfile={() => navigation.navigate(ROUTES.PROFILE)}
                  onOpenCreateGroup={() => navigation.navigate(ROUTES.CREATE_GROUP)}
                  onStartConversation={async (targetUserId) => {
                    const opened = await startConversationWithUser(targetUserId)
                    if (opened) {
                      navigation.navigate(ROUTES.CHAT)
                    }
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name={ROUTES.DISCOVER} options={PRIMARY_SECTION_SCREEN_OPTIONS}>
              {({ navigation }) => (
                <DiscoverScreen
                  currentUserId={user?._id || user?.userId}
                  onBack={() => navigation.goBack()}
                  onOpenConversations={() => navigation.navigate(ROUTES.CONVERSATIONS)}
                  onOpenProfile={() => navigation.navigate(ROUTES.PROFILE)}
                  onOpenFriends={() => navigation.navigate(ROUTES.FRIEND_HUB)}
                  onStartConversation={async (targetUserId) => {
                    const opened = await startConversationWithUser(targetUserId)
                    if (opened) {
                      navigation.navigate(ROUTES.CHAT)
                    }
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name={ROUTES.DIARY} options={PRIMARY_SECTION_SCREEN_OPTIONS}>
              {({ navigation }) => (
                <DiaryScreen
                  onBack={() => navigation.goBack()}
                  onOpenConversations={() => navigation.navigate(ROUTES.CONVERSATIONS)}
                  onOpenProfile={() => navigation.navigate(ROUTES.PROFILE)}
                  onOpenFriends={() => navigation.navigate(ROUTES.FRIEND_HUB)}
                  onOpenDiscover={() => navigation.navigate(ROUTES.DISCOVER)}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name={ROUTES.URBAN_INCIDENTS} options={PRIMARY_SECTION_SCREEN_OPTIONS}>
              {({ navigation }) => (
                <UrbanIncidentScreen
                  onBack={() => navigation.goBack()}
                  onOpenChats={() => navigation.navigate(ROUTES.CONVERSATIONS)}
                  onOpenFriends={() => navigation.navigate(ROUTES.FRIEND_HUB)}
                  onOpenAssistant={() => navigation.navigate(ROUTES.ASSISTANT)}
                  onOpenProfile={() => navigation.navigate(ROUTES.PROFILE)}
                  friendRequestCount={0}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name={ROUTES.CREATE_GROUP} options={{ title: 'Tạo nhóm' }}>
              {({ navigation }) => (
                <CreateGroupScreen
                  currentUserId={user?._id || user?.userId}
                  onBack={() => navigation.goBack()}
                  onShowDialog={showAppDialog}
                  onCreateGroup={async (participantIds, groupName) => {
                    const result = await createGroupConversation(participantIds, groupName)
                    if (result?.opened) {
                      navigation.replace(ROUTES.CHAT)
                    }

                    return result
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name={ROUTES.PROFILE} options={PRIMARY_SECTION_SCREEN_OPTIONS}>
              {({ navigation }) => (
                <ProfileScreen
                  user={user}
                  loading={authLoading}
                  error={authError}
                  openLocationPickerToken={profileLocationPromptToken}
                  onBack={() => navigation.goBack()}
                  onUpdateAvatar={updateAvatar}
                  onUpdateProfile={updateProfile}
                  onChangePassword={updatePassword}
                  onOpenConversations={() => navigation.navigate(ROUTES.CONVERSATIONS)}
                  onOpenCalls={() => navigation.navigate(ROUTES.CALLS)}
                  onOpenUrban={() => navigation.navigate(ROUTES.URBAN_INCIDENTS)}
                  onOpenAssistant={() => navigation.navigate(ROUTES.ASSISTANT)}
                  onOpenFriends={() => navigation.navigate(ROUTES.FRIEND_HUB)}
                  onOpenDiscover={() => navigation.navigate(ROUTES.DISCOVER)}
                  onOpenDiary={() => navigation.navigate(ROUTES.DIARY)}
                  onLogout={async () => {
                    await handleLogout()
                    navigation.reset({ index: 0, routes: [{ name: ROUTES.LOGIN }] })
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name={ROUTES.CHAT}
              options={{
                headerShown: false,
              }}
            >
              {({ navigation }) => (
                <ChatScreen
                  conversation={currentConversation}
                  conversations={visibleConversations}
                  messages={messages}
                  loadingOlderMessages={loadingOlderMessages}
                  hasMoreOlderMessages={hasMoreMessages}
                  onLoadOlderMessages={loadOlderMessages}
                  scrollRequestKey={chatScrollRequestKey}
                  currentUserId={user?._id || user?.userId}
                  loading={loadingMessages}
                  onBack={async () => {
                    await closeConversation()
                    navigation.goBack()
                  }}
                  onRenameGroup={renameCurrentGroup}
                  onUpdateGroupAvatar={updateCurrentGroupAvatar}
                  onAddGroupMember={addMemberToCurrentGroup}
                  onRemoveGroupMember={removeMemberFromCurrentGroup}
                  onUpdateParticipantRole={updateCurrentParticipantRole}
                  onSearchUsers={searchUsersForGroupMember}
                  onUpdateGroupSettings={updateCurrentGroupSettings}
                  onShowDialog={showAppDialog}
                  onSend={sendTextMessage}
                  onPickImage={pickImageAndSend}
                  onPickFile={pickFileAndSend}
                  onEditMessage={editCurrentMessage}
                  onDeleteMessage={deleteCurrentMessage}
                  onDeleteMessageForAll={deleteMessageForAll}
                  onReactMessage={toggleMessageReaction}
                  onForwardMessage={forwardMessageToConversations}
                  onTypingStart={handleStartTyping}
                  onTypingStop={handleStopTyping}
                  typingUsers={typingUsersForCurrentConversation}
                  preference={currentConversationPreference}
                  onUpdateConversationPreference={(patch) =>
                    updateConversationPreference(activeConversationIdRef.current, patch)
                  }
                  onDeleteConversation={deleteCurrentConversation}
                  onRefreshConversationData={refreshCurrentConversationData}
                  onStartCall={startMobileCall}
                  onJoinCall={joinAvailableMobileCall}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
      <MobileInAppBannerHost
        banners={inAppBanners}
        onDismiss={dismissInAppBanner}
        onOpenBanner={(banner) => {
          if (banner?.type === 'call') {
            openConversationFromBanner(banner?.data?.conversationId).catch(() => {})
            return
          }

          openConversationFromBanner(banner?.data?.conversationId)
            .then((opened) => {
              if (opened) {
                dismissInAppBanner(banner?.id)
              }
            })
            .catch(() => {})
        }}
        onAcceptCall={(banner) => {
          openConversationFromBanner(banner?.data?.conversationId).catch(() => {})
          if (banner?.data?.action === 'join') {
            joinAvailableMobileCall(banner?.data?.call || banner?.data?.callId || null).catch(() => {})
          } else {
            acceptMobileCall(banner?.data?.call || null).catch(() => {})
          }
          dismissInAppBanner(banner?.id)
        }}
        onDeclineCall={(banner) => {
          if (banner?.data?.action === 'join') {
            dismissInAppBanner(banner?.id)
            return
          }
          declineMobileCall(banner?.data?.call || null).catch(() => {})
          dismissInAppBanner(banner?.id)
        }}
      />
      <MobileCallOverlay
        visible={mobileCallState.visible}
        call={mobileCallState.call}
        phase={mobileCallState.phase}
        error={mobileCallState.error}
        isMuted={mobileCallState.isMuted}
        isCameraEnabled={mobileCallState.isCameraEnabled}
        videoTiles={mobileCallState.videoTiles}
        activeSpeakerId={mobileCallState.activeSpeakerId}
        audioRoute={mobileCallState.audioRoute}
        availableAudioRoutes={mobileCallState.availableAudioRoutes}
        onAccept={() => acceptMobileCall()}
        onDecline={() => declineMobileCall()}
        onEnd={endMobileCall}
        onToggleMute={toggleMobileMute}
        onToggleCamera={toggleMobileCamera}
        onSwitchCamera={switchMobileCamera}
        onSelectAudioRoute={selectMobileAudioRoute}
      />
      <AppDialogModal
        visible={appDialog.visible}
        title={appDialog.title}
        message={appDialog.message}
        actions={appDialog.actions}
        onClose={closeAppDialog}
      />
      <ExpoStatusBar style={appTheme.isDark ? 'light' : 'dark'} />
    </NavigationContainer>
  )
}
