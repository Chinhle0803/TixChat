import React, { useState } from 'react'
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

export default function AuthScreen({ onLogin, onSwitchToRegister, onSwitchToForgot, loading, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const submit = () => {
    onLogin(email.trim(), password)
  }

  const formContent = (
    <>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Địa chỉ Email</Text>
        <TextInput
          style={styles.input}
          placeholder="youremail@example.com"
          placeholderTextColor="#94A3B8"
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Mật khẩu</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={styles.passwordInput}
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            value={password}
            secureTextEntry={!showPassword}
            autoComplete="password"
            onChangeText={setPassword}
          />
          <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((prev) => !prev)}>
            <MaterialCommunityIcons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              style={styles.eyeIcon}
            />
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.forgotBtn} onPress={onSwitchToForgot}>
        <Text style={styles.forgotText}>Quên mật khẩu?</Text>
      </Pressable>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={submit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Đăng nhập</Text>
        )}
      </Pressable>

      <View style={styles.divider} />

      <Pressable style={styles.linkButton} onPress={onSwitchToRegister}>
        <Text style={styles.linkHint}>Chưa có tài khoản? </Text>
        <Text style={styles.linkText}>Tạo tài khoản</Text>
      </Pressable>
    </>
  )

  return (
    <AuthScaffold subtitle="Chào mừng bạn quay trở lại TixChat" icon="message">
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
    borderWidth: 2,
    borderColor: authPalette.border,
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
  forgotBtn: {
    alignSelf: 'center',
    marginVertical: 10,
  },
  forgotText: {
    color: authPalette.text,
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    backgroundColor: authPalette.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
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
    marginBottom: 12,
  },
  linkButton: {
    marginTop: 6,
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
