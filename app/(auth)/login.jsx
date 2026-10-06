import React, { useState } from 'react'
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { useAuth } from '@/src/contexts/AuthContext'
import { useRecovery } from '@/src/contexts/RecoveryContext'
import { useRouter } from 'expo-router'
import { COLORS } from '@/src/constants/theme'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const { notice } = useRecovery()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password')
      return
    }

    setLoading(true)
    setError(null)

    const { error: signInError } = await signIn(email.trim(), password)
    if (signInError) {
      setError(signInError)
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        {/* Brand logo */}
        <Image
          source={require('@/assets/brand/patanos-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Login form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color={COLORS.textOnGold} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Forgot password"
            disabled={loading} onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.recoveryButton}>
            <Text style={styles.notice}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 160,
    height: 160,
    alignSelf: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  error: {
    color: COLORS.error,
    fontSize: 14,
    fontFamily: 'DMSans',
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.accentGold,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.textOnGold,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'DMSans',
  },
  notice: { color: COLORS.textSecondary, fontSize: 16, fontFamily: 'DMSans', textAlign: 'center' },
  recoveryButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
})
