import React, { useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useRecovery } from '@/src/contexts/RecoveryContext'
import { COLORS, FONTS, RADIUS, SPACING } from '@/src/constants/theme'

export default function RecoveryForm({ reset = false }) {
  const recovery = useRecovery()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const submitting = useRef(false)
  const waiting = ['checking', 'processing', 'updating', 'completing'].includes(recovery.status)
  const ready = reset && recovery.status === 'ready'
  const requestUnavailable = !reset && recovery.requestAvailable === false

  const submit = async () => {
    if (submitting.current || waiting) return
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      const result = reset ? await recovery.updatePassword(password, confirmation) : await recovery.requestReset(email)
      setError(result.error || null)
      setMessage(result.message || null)
      if (result.saved) { setPassword(''); setConfirmation('') }
    } catch { setError('Unable to finish this action. Check your connection and retry.') }
    finally { submitting.current = false; setBusy(false) }
  }
  const returnToLogin = async () => {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    try {
      if (reset && recovery.blocked) {
        const result = await recovery.endRecovery()
        if (result.error) { setError(result.error); return }
      }
      router.replace('/(auth)/login')
    } catch { setError('Unable to return to login. Please retry.') }
    finally { submitting.current = false; setBusy(false) }
  }

  return <SafeAreaView style={styles.safeArea}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.form}>
          <Text accessibilityRole="header" style={styles.title}>{reset ? 'Reset password' : 'Forgot password?'}</Text>
          <Text style={styles.message}>{reset ? 'Recovery does not open POS. Set your new password, then sign in again.'
            : 'Use your staff email. Open the newest recovery email on this same phone and app. A newer request replaces the earlier link.'}</Text>
          {waiting && <ActivityIndicator color={COLORS.accentGold} accessibilityLabel="Verifying recovery or saving password" />}
          {!reset && <TextInput accessibilityLabel="Staff email" style={styles.input} placeholder="Staff email"
            placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            autoComplete="email" value={email} onChangeText={setEmail} editable={!busy} />}
          {ready && <>
            <Text style={styles.message}>Use 12–64 characters.</Text>
            <TextInput accessibilityLabel="New password" style={styles.input} placeholder="New password"
              placeholderTextColor={COLORS.textMuted} autoCapitalize="none" autoCorrect={false} secureTextEntry
              autoComplete="new-password" value={password} onChangeText={setPassword} editable={!busy} />
            <TextInput accessibilityLabel="Confirm new password" style={styles.input} placeholder="Confirm new password"
              placeholderTextColor={COLORS.textMuted} autoCapitalize="none" autoCorrect={false} secureTextEntry
              autoComplete="new-password" value={confirmation} onChangeText={setConfirmation} editable={!busy} onSubmitEditing={submit} />
          </>}
          {(error || recovery.error) && <Text accessibilityRole="alert" style={styles.error}>{error || recovery.error}</Text>}
          {reset && recovery.status === 'idle' && <Text style={styles.message}>Request a recovery email from login, then open its link here.</Text>}
          {message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
          {requestUnavailable && <Text accessibilityRole="alert" style={styles.message}>{recovery.requestUnavailableReason}</Text>}
          {(!reset || ready) && <TouchableOpacity accessibilityRole="button"
            accessibilityLabel={reset ? 'Save new password' : 'Request recovery email'}
            accessibilityState={{ disabled: busy || waiting || requestUnavailable }} disabled={busy || waiting || requestUnavailable} onPress={submit}
            style={[styles.button, (busy || waiting || requestUnavailable) && styles.disabled]}>
            <Text style={styles.buttonText}>{busy ? 'Please wait…' : reset ? 'Save new password' : 'Request recovery email'}</Text>
          </TouchableOpacity>}
          <Text style={styles.message}>{!reset ? 'At most two requests per hour on this installation; shared server limits may be stricter. If urgent, ask the owner.'
            : 'Returning to login signs out this app; pending orders are not deleted.'}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Return to login"
            accessibilityState={{ disabled: busy || waiting }} disabled={busy || waiting} style={styles.secondary} onPress={returnToLogin}>
            <Text style={styles.message}>Return to login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  form: { width: '100%', maxWidth: 480, gap: SPACING.md },
  title: { fontFamily: FONTS.bodyBold, color: COLORS.textPrimary, fontSize: 24 },
  message: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 16 },
  error: { fontFamily: FONTS.body, color: COLORS.error, fontSize: 16 },
  input: { minHeight: 48, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, backgroundColor: COLORS.bgCard, color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 16 },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: SPACING.md,
    borderRadius: RADIUS.md, backgroundColor: COLORS.accentGold },
  buttonText: { color: COLORS.textOnGold, fontFamily: FONTS.bodyBold, fontSize: 16 },
  secondary: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: SPACING.md },
  disabled: { opacity: 0.6 },
})
