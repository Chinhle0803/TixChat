import React, { useMemo, useState } from 'react'
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import AuthScaffold, { authPalette } from './AuthScaffold'

const initialForm = {
  username: '',
  email: '',
  fullName: '',
  password: '',
  confirmPassword: '',
}

const isEmail = (value) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(value)

export default function RegisterScreen({ onSubmit, onSwitchToLogin, loading, error }) {
  const [form, setForm] = useState(initialForm)
  const [localError, setLocalError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const canSubmit = useMemo(() => {
    return (
      form.username.trim().length >= 3 &&
      isEmail(form.email.trim()) &&
      form.fullName.trim().length >= 2 &&
      form.password.length >= 6 &&
      form.confirmPassword.length >= 6
    )
  }, [form])

  const submit = () => {
    const username = form.username.trim()
    const email = form.email.trim().toLowerCase()
    const fullName = form.fullName.trim()

    if (!username || username.length < 3) {
      setLocalError('Tên người dùng tối thiểu 3 ký tự')
      return
    }

    if (!isEmail(email)) {
      setLocalError('Email không hợp lệ')
      return
    }

    if (!fullName || fullName.length < 2) {
      setLocalError('Họ tên tối thiểu 2 ký tự')
      return
    }

    if (!form.password || form.password.length < 6) {
      setLocalError('Mật khẩu tối thiểu 6 ký tự')
      return
    }

    if (form.password !== form.confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp')
      return
    }

    setLocalError('')
    onSubmit({
      username,
      email,
      fullName,
      password: form.password,
      confirmPassword: form.confirmPassword,
    })
  }

  const formContent = (
    <>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Tên người dùng</Text>
        <TextInput
          style={styles.input}
          placeholder="john_doe"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          value={form.username}
          onChangeText={(value) => setForm((prev) => ({ ...prev, username: value }))}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Địa chỉ Email</Text>
        <TextInput
          style={styles.input}
          placeholder="youremail@example.com"
          placeholderTextColor="#94A3B8"
          keyboardType="email-address"
          autoCapitalize="none"
          value={form.email}
          onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Tên đầy đủ</Text>
        <TextInput
          style={styles.input}
          placeholder="John Doe"
          placeholderTextColor="#94A3B8"
          value={form.fullName}
          onChangeText={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Mật khẩu</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={styles.passwordInput}
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            value={form.password}
            onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))}
          />
          <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((prev) => !prev)}>
            <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} style={styles.eyeIcon} />
          </Pressable>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Xác nhận mật khẩu</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={styles.passwordInput}
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showConfirmPassword}
            autoComplete="new-password"
            value={form.confirmPassword}
            onChangeText={(value) => setForm((prev) => ({ ...prev, confirmPassword: value }))}
          />
          <Pressable style={styles.eyeBtn} onPress={() => setShowConfirmPassword((prev) => !prev)}>
            <MaterialCommunityIcons
              name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              style={styles.eyeIcon}
            />
          </Pressable>
        </View>
      </View>

      {!!(localError || error) && <Text style={styles.error}>{localError || error}</Text>}

      <Pressable
        style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
        onPress={submit}
        disabled={!canSubmit || loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Tạo tài khoản</Text>}
      </Pressable>

      <View style={styles.divider} />

      <Pressable style={styles.linkButton} onPress={onSwitchToLogin}>
        <Text style={styles.linkHint}>Đã có tài khoản? </Text>
        <Text style={styles.linkText}>Đăng nhập</Text>
      </Pressable>
    </>
  )

  return (
    <AuthScaffold subtitle="Tham gia TixChat ngay hôm nay" icon="chat-processing-outline">
      <View style={styles.form}>{formContent}</View>
    </AuthScaffold>
  )
}

const styles = StyleSheet.create({
  form: {
    width: '100%',
  },
  fieldGroup: {
    width: '100%',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    color: authPalette.text,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: authPalette.card,
    borderColor: authPalette.border,
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
    color: authPalette.text,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: authPalette.border,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: authPalette.card,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: authPalette.text,
  },
  eyeBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 22,
    color: authPalette.primary,
  },
  button: {
    backgroundColor: authPalette.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
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
})
