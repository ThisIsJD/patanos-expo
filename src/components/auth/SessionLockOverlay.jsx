import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/src/contexts/AuthContext'
import { useRecovery } from '@/src/contexts/RecoveryContext'
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus'
import { COLORS, FONTS, RADIUS, SPACING } from '@/src/constants/theme'

export default function SessionLockOverlay() {
  const { session, profile, lockState, signIn, signOut } = useAuth()
  const { blocked } = useRecovery()
  const { isOnline } = useNetworkStatus()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const email = session?.user?.email || profile?.email
  const visible = Boolean(session && lockState?.locked && !blocked)
  const disabled = busy || !isOnline || !lockState?.foreground

  useEffect(() => { setPassword(''); setError(null) }, [session?.user?.id, lockState?.foreground, visible])
  const run = async switchAccount => {
    if (submitting.current || !lockState?.foreground) return
    if (!switchAccount && (!email || !password || !isOnline)) { setError('Connect to the internet and enter this account’s password.'); return }
    submitting.current = true; setBusy(true); setError(null)
    const submittedPassword = password
    setPassword('')
    try {
      const result = switchAccount ? await signOut() : await signIn(email, submittedPassword)
      if (result.error) setError(result.error)
    } catch { setError('Unable to confirm this account action. Keep the app open and retry.') }
    finally { submitting.current = false; setBusy(false) }
  }
  const switchAccount = () => {
    if (submitting.current) return
    Alert.alert('Sign out / switch account?', 'Pending and held orders stay on this installation. An unsaved draft is not durable yet and may be lost on sign-out.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => run(true) }])
  }
  return <Modal visible={visible} transparent={false} animationType="none" onRequestClose={() => {}}
    statusBarTranslucent navigationBarTranslucent>
    <SafeAreaView style={styles.safeArea} accessibilityViewIsModal>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.panel}>
            <Text accessibilityRole="header" style={styles.title}>Register locked</Text>
            <Text style={styles.text}>Unlock the same staff account to continue. Locking keeps the current draft mounted; signing out does not delete pending orders.</Text>
            <Text style={styles.text}>{email || 'Staff account could not be identified. Sign out, then sign in again.'}</Text>
            {!isOnline && <Text accessibilityRole="alert" style={styles.text}>Offline: password unlock currently needs an internet connection. Bounded offline unlock is not implemented yet.</Text>}
            <TextInput accessibilityLabel="Password to unlock register" style={styles.input} secureTextEntry
              autoCapitalize="none" autoCorrect={false} autoComplete="current-password" value={password}
              onChangeText={setPassword} editable={!disabled} placeholder="Staff password" placeholderTextColor={COLORS.textSecondary} />
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {lockState?.operations > 0 && <Text style={styles.text}>An order action is still finishing. Account changes wait for it; do not repeat payment.</Text>}
            {busy && <ActivityIndicator color={COLORS.accentGold} accessibilityLabel="Verifying staff account action" />}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Unlock register"
              accessibilityState={{ disabled: disabled || !email }} disabled={disabled || !email}
              style={[styles.button, (disabled || !email) && styles.disabled]} onPress={() => run(false)}>
              <Text style={styles.buttonText}>Unlock register</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign out or switch account"
              accessibilityState={{ disabled: busy || !lockState?.foreground }} disabled={busy || !lockState?.foreground}
              style={styles.secondary} onPress={switchAccount}>
              <Text style={styles.text}>Sign out / switch account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  panel: { width: '100%', maxWidth: 480, gap: SPACING.md },
  title: { color: COLORS.accentGold, fontFamily: FONTS.bodyBold, fontSize: 24 },
  text: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 16 },
  error: { color: COLORS.error, fontFamily: FONTS.body, fontSize: 16 },
  input: { minHeight: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md,
    color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 16 },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.accentGold, padding: SPACING.md, borderRadius: RADIUS.md },
  buttonText: { color: COLORS.textOnGold, fontFamily: FONTS.bodyBold, fontSize: 16 },
  secondary: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: SPACING.md },
  disabled: { opacity: 0.5 },
})
