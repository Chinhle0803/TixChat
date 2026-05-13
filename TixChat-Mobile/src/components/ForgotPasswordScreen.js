import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

const isValidEmail = (value) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(value)

export default function ForgotPasswordScreen({
  loading,
  error,
  onRequestReset,
  onVerifyToken,
  onResetPassword,
  onSwitchToLogin,
}) {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [localError, setLocalError] = useState('')

  const canSubmit = useMemo(() => {
    if (step === 1) return isValidEmail(email.trim())
    if (step === 2) return token.trim().length >= 4
    return newPassword.length >= 6 && confirmPassword.length >= 6
  }, [step, email, token, newPassword, confirmPassword])

  const submit = async () => {
    setLocalError('')
    setMessage('')

    const normalizedEmail = email.trim().toLowerCase()

    if (step === 1) {
      if (!isValidEmail(normalizedEmail)) {
        setLocalError('Vui lòng nhập email hợp lệ')
        return
      }

      const result = await onRequestReset(normalizedEmail)
      if (result?.ok) {
        setMessage('Mã xác minh đã được gửi đến email của bạn')
        setStep(2)
      } else if (result?.error) {
        setLocalError(result.error)
      }

      return
    }

    if (step === 2) {
      const normalizedToken = token.trim().toUpperCase()
      if (!normalizedToken) {
        setLocalError('Vui lòng nhập mã xác minh')
        return
      }

      const result = await onVerifyToken(normalizedEmail, normalizedToken)
      if (result?.ok) {
        setMessage('Xác minh thành công, vui lòng nhập mật khẩu mới')
        setStep(3)
      } else if (result?.error) {
        setLocalError(result.error)
      }

      return
    }

    if (newPassword.length < 6) {
      setLocalError('Mật khẩu mới tối thiểu 6 ký tự')
      return
    }

    if (newPassword !== confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp')
      return
    }

    const result = await onResetPassword(normalizedEmail, token.trim().toUpperCase(), newPassword, confirmPassword)
    if (result?.ok) {
      setMessage('Đặt lại mật khẩu thành công, hãy đăng nhập lại')
      onSwitchToLogin()
    } else if (result?.error) {
      setLocalError(result.error)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.brandRow}>
            <MaterialCommunityIcons name="message" style={styles.brandIcon} />
            <Text style={styles.title}>TixChat</Text>
          </View>
          <Text style={styles.subtitle}>Đặt lại mật khẩu của bạn</Text>

          <View style={styles.stepRow}>
            {[1, 2, 3].map((s, index) => (
              <React.Fragment key={s}>
                <View style={styles.stepWrap}>
                  <View style={[styles.stepItem, step >= s && styles.stepItemActive]}>
                    <Text style={[styles.stepText, step >= s && styles.stepTextActive]}>{s}</Text>
                  </View>
                  <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>
                    {s === 1 ? 'Email' : s === 2 ? 'Xác minh' : 'Đặt lại'}
                  </Text>
                </View>
                {index < 2 ? <View style={styles.stepLine} /> : null}
              </React.Fragment>
            ))}
          </View>

          {step === 1 && (
            <>
              <Text style={styles.label}>Địa chỉ Email</Text>
              <TextInput
                style={styles.input}
                placeholder="youremail@example.com"
                placeholderTextColor="#87919d"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(value) => {
                  setEmail(value)
                  setLocalError('')
                }}
              />
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>Chúng tôi sẽ gửi mã xác minh đến email này</Text>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.label}>Địa chỉ Email</Text>
              <TextInput style={[styles.input, styles.inputDisabled]} value={email} editable={false} />
              <Text style={styles.label}>Mã xác minh</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập mã xác minh"
                placeholderTextColor="#87919d"
                autoCapitalize="characters"
                value={token}
                onChangeText={(value) => {
                  setToken(value.replace(/\s/g, '').toUpperCase())
                  setLocalError('')
                }}
              />
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.label}>Địa chỉ Email</Text>
              <TextInput style={[styles.input, styles.inputDisabled]} value={email} editable={false} />

              <Text style={styles.label}>Mật khẩu mới</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#87919d"
                secureTextEntry
                autoComplete="new-password"
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value)
                  setLocalError('')
                }}
              />

              <Text style={styles.label}>Xác nhận mật khẩu</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#87919d"
                secureTextEntry
                autoComplete="new-password"
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value)
                  setLocalError('')
                }}
              />
            </>
          )}

          {!!(localError || error) && <Text style={styles.error}>{localError || error}</Text>}
          {!!message && <Text style={styles.success}>{message}</Text>}

          <Pressable
            style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
            onPress={submit}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {step === 1 ? 'Gửi mã' : step === 2 ? 'Xác minh mã' : 'Đặt lại mật khẩu'}
              </Text>
            )}
          </Pressable>

          {step > 1 ? (
            <Pressable style={styles.minorLinkButton} onPress={() => setStep((prev) => Math.max(1, prev - 1))}>
              <Text style={styles.minorLinkText}>Quay lại bước trước</Text>
            </Pressable>
          ) : null}

          <View style={styles.divider} />

          <Pressable style={styles.linkButton} onPress={onSwitchToLogin}>
            <Text style={styles.linkHint}>Nhớ mật khẩu của bạn? </Text>
            <Text style={styles.linkText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#231f4e',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#f4f5f7',
    borderRadius: 16,
    padding: 24,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    fontSize: 30,
    color: '#ad9bf0',
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#334155',
  },
  subtitle: {
    fontSize: 16,
    color: '#7b8794',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stepWrap: {
    alignItems: 'center',
  },
  stepItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cfd8e3',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  stepItemActive: {
    borderColor: '#6178e4',
    backgroundColor: '#6178e4',
    shadowColor: '#6178e4',
    shadowOpacity: 0.3,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  stepText: {
    color: '#7b8794',
    fontWeight: '700',
  },
  stepTextActive: {
    color: '#fff',
  },
  stepLabel: {
    marginTop: 6,
    fontSize: 12,
    color: '#7b8794',
    fontWeight: '600',
  },
  stepLabelActive: {
    color: '#6178e4',
  },
  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#cfd8e3',
    marginHorizontal: 8,
  },
  label: {
    fontSize: 17,
    color: '#4b5563',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f4f5f7',
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    color: '#334155',
    fontSize: 16,
  },
  inputDisabled: {
    opacity: 0.75,
  },
  noteBox: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  noteText: {
    color: '#7b8794',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#6178e4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#6178e4',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 16,
  },
  error: {
    color: '#dc2626',
    marginBottom: 8,
    marginTop: 8,
    textAlign: 'center',
  },
  success: {
    color: '#0f766e',
    marginBottom: 8,
    marginTop: 8,
    textAlign: 'center',
  },
  minorLinkButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  minorLinkText: {
    color: '#4b5563',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#d1d5db',
    marginTop: 18,
    marginBottom: 10,
  },
  linkButton: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  linkHint: {
    color: '#7b8794',
    fontSize: 16,
  },
  linkText: {
    color: '#1f2937',
    fontWeight: '700',
    fontSize: 16,
  },
})
