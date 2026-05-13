import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'

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
    <View style={styles.container}>
      <Text style={styles.title}>Xác thực OTP</Text>
      <Text style={styles.subtitle}>Mã xác thực đã gửi tới {email}</Text>

      <TextInput
        style={styles.input}
        placeholder="000000"
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
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Xác thực</Text>}
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    letterSpacing: 6,
    fontSize: 20,
    textAlign: 'center',
  },
  timerLabel: {
    color: '#0f766e',
    marginBottom: 10,
  },
  error: {
    color: '#dc2626',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#0891b2',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#ecfeff',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0f766e',
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  linkText: {
    color: '#334155',
    fontWeight: '600',
  },
})
