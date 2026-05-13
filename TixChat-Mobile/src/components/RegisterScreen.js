import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

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
          placeholderTextColor="#87919d"
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
          placeholderTextColor="#87919d"
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
          placeholderTextColor="#87919d"
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
            placeholderTextColor="#87919d"
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
            placeholderTextColor="#87919d"
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
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.brandRow}>
            <MaterialCommunityIcons name="chat-processing-outline" style={styles.brandIcon} />
            <Text style={styles.title}>Chat TixChat</Text>
          </View>
          <Text style={styles.subtitle}>Tham gia TixChat ngay hôm nay</Text>

          {Platform.OS === 'web' ? (
            <form
              style={styles.form}
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              {formContent}
            </form>
          ) : (
            <View style={styles.form}>{formContent}</View>
          )}
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
    maxWidth: 430,
    backgroundColor: '#f4f5f7',
    borderRadius: 16,
    padding: 22,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  brandIcon: {
    fontSize: 30,
    color: '#a1a1aa',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#7b8794',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  form: {
    width: '100%',
  },
  fieldGroup: {
    width: '100%',
    marginBottom: 2,
  },
  label: {
    fontSize: 17,
    color: '#4b5563',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#f4f5f7',
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#334155',
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#f4f5f7',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#334155',
  },
  eyeBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 22,
    color: '#6b3f87',
  },
  button: {
    backgroundColor: '#6178e4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
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
  error: {
    color: '#dc2626',
    marginBottom: 8,
    textAlign: 'center',
  },
})
