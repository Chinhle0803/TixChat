import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import AuthScaffold, { authPalette } from './AuthScaffold'

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

  const stepHeader = (
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
          {index < 2 ? <View style={[styles.stepLine, step > s && styles.stepLineActive]} /> : null}
        </React.Fragment>
      ))}
    </View>
  )

  return (
    <AuthScaffold subtitle="Đặt lại mật khẩu của bạn" icon="message" headerExtra={stepHeader}>
      {step === 1 && (
        <>
          <Text style={styles.label}>Địa chỉ Email</Text>
          <TextInput
            style={styles.input}
            placeholder="youremail@example.com"
            placeholderTextColor="#94A3B8"
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
            placeholderTextColor="#94A3B8"
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
            placeholderTextColor="#94A3B8"
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
            placeholderTextColor="#94A3B8"
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
          <ActivityIndicator color="#1A1A1A" />
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
    </AuthScaffold>
  )
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  stepWrap: {
    alignItems: 'center',
  },
  stepItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: authPalette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: authPalette.surfaceTint,
  },
  stepItemActive: {
    borderColor: authPalette.primary,
    backgroundColor: authPalette.primary,
    shadowColor: authPalette.primary,
    shadowOpacity: 0.3,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  stepText: {
    color: authPalette.textMuted,
    fontWeight: '700',
  },
  stepTextActive: {
    color: authPalette.card,
  },
  stepLabel: {
    marginTop: 6,
    fontSize: 12,
    color: authPalette.textMuted,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: authPalette.primary,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: authPalette.border,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: authPalette.primary,
  },
  label: {
    fontSize: 14,
    color: authPalette.text,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: authPalette.card,
    borderColor: authPalette.border,
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    color: authPalette.text,
    fontSize: 16,
  },
  inputDisabled: {
    opacity: 0.72,
    backgroundColor: authPalette.surfaceTint,
  },
  noteBox: {
    backgroundColor: authPalette.primarySoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  noteText: {
    color: authPalette.textMuted,
    fontSize: 13,
  },
  button: {
    backgroundColor: authPalette.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: authPalette.primary,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#1A1A1A',
    fontWeight: '700',
    fontSize: 16,
  },
  error: {
    color: authPalette.danger,
    marginBottom: 8,
    marginTop: 8,
    textAlign: 'center',
    backgroundColor: authPalette.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.22)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  success: {
    color: authPalette.success,
    marginBottom: 8,
    marginTop: 8,
    textAlign: 'center',
    backgroundColor: authPalette.successSoft,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.22)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  minorLinkButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  minorLinkText: {
    color: authPalette.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: authPalette.border,
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
    color: authPalette.textMuted,
    fontSize: 14,
  },
  linkText: {
    color: authPalette.text,
    fontWeight: '700',
    fontSize: 14,
  },
})
