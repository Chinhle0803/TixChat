import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import AuthScaffold, { authPalette } from './AuthScaffold'

export default function VerifyOtpScreen({
  email,
  loading,
  error,
  onVerify,
  onResend,
  onBackToLogin,
}) {
  const [otp, setOtp] = useState('')
  const [countdown, setCountdown] = useState(600)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [resending, setResending] = useState(false)
  const [localError, setLocalError] = useState('')

  const canVerify = useMemo(() => otp.length === 6 && countdown > 0 && !loading, [otp, countdown, loading])

  useEffect(() => {
    if (countdown <= 0) return

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown])

  useEffect(() => {
    if (resendCountdown <= 0) return

    const timer = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [resendCountdown])

  const formatClock = (seconds) => {
    const min = Math.floor(seconds / 60)
    const sec = seconds % 60
    return `${min}:${String(sec).padStart(2, '0')}`
  }

  const submit = () => {
    if (otp.length !== 6) {
      setLocalError('Vui lòng nhập mã OTP 6 chữ số')
      return
    }

    setLocalError('')
    onVerify(otp)
  }

  const resend = async () => {
    try {
      setResending(true)
      setLocalError('')
      await onResend()
      setCountdown(600)
      setResendCountdown(60)
      setOtp('')
    } catch (resendError) {
      setLocalError(resendError?.message || 'Không thể gửi lại mã OTP')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthScaffold
      title="TixChat"
      subtitle={`Mã xác thực đã gửi tới ${email || 'email của bạn'}`}
      icon="shield-check-outline"
    >
      <View style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="000000"
          placeholderTextColor="#94A3B8"
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={(value) => {
            setOtp(value.replace(/\D/g, '').slice(0, 6))
            setLocalError('')
          }}
        />

        <Text style={styles.timerLabel}>
          {countdown > 0 ? `Mã hết hạn sau: ${formatClock(countdown)}` : 'Mã OTP đã hết hạn'}
        </Text>

        {!!(localError || error) && <Text style={styles.error}>{localError || error}</Text>}

        <Pressable style={[styles.button, !canVerify && styles.buttonDisabled]} onPress={submit} disabled={!canVerify}>
          {loading ? <ActivityIndicator color="#1A1A1A" /> : <Text style={styles.buttonText}>Xác thực</Text>}
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, (resendCountdown > 0 || resending) && styles.buttonDisabled]}
          onPress={resend}
          disabled={resendCountdown > 0 || resending}
        >
          <Text style={styles.secondaryButtonText}>
            {resendCountdown > 0 ? `Gửi lại sau ${resendCountdown}s` : resending ? 'Đang gửi...' : 'Gửi lại OTP'}
          </Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={onBackToLogin}>
          <Text style={styles.linkText}>Quay lại đăng nhập</Text>
        </Pressable>
      </View>
    </AuthScaffold>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  input: {
    backgroundColor: authPalette.card,
    borderColor: authPalette.border,
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    letterSpacing: 6,
    fontSize: 20,
    textAlign: 'center',
    color: authPalette.text,
  },
  timerLabel: {
    color: authPalette.success,
    marginBottom: 4,
    textAlign: 'center',
    backgroundColor: authPalette.successSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    color: authPalette.danger,
    marginBottom: 8,
    textAlign: 'center',
    backgroundColor: authPalette.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.22)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: authPalette.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: authPalette.primary,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.18)',
    backgroundColor: authPalette.primarySoft,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: authPalette.primaryDark,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 8,
    alignItems: 'center',
  },
  linkText: {
    color: authPalette.text,
    fontWeight: '600',
  },
})
