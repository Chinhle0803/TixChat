import React, { useState } from 'react'
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
          placeholderTextColor="#87919d"
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
            placeholderTextColor="#87919d"
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
          <Text style={styles.subtitle}>Chào mừng bạn quay trở lại TixChat</Text>

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
    maxWidth: 420,
    backgroundColor: '#f4f5f7',
    borderRadius: 16,
    padding: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
    color: '#7b8794',
    marginTop: 8,
    marginBottom: 24,
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
    borderWidth: 1,
    borderColor: '#d1d5db',
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
  forgotBtn: {
    alignSelf: 'center',
    marginVertical: 10,
  },
  forgotText: {
    color: '#1f2937',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#6178e4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
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
    marginBottom: 12,
  },
  linkButton: {
    marginTop: 6,
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
