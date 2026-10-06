import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS, FONTS, RADIUS, SPACING } from '@/src/constants/theme'

export default function AccessState({ loading, error, onRetry, onSignOut }) {
  const [busy, setBusy] = useState(false)
  const runAction = async (action) => {
    if (busy) return
    setBusy(true)
    try { await action() } finally { setBusy(false) }
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          {loading ? <>
            <ActivityIndicator color={COLORS.accentGold} accessibilityLabel="Verifying staff access" />
            <Text style={styles.title}>Checking staff access…</Text>
          </> : <>
            <Text style={styles.title}>Staff access unavailable</Text>
            <Text accessibilityRole="alert" style={styles.message}>{error}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry staff access"
              accessibilityState={{ disabled: busy }} disabled={busy} style={styles.button}
              onPress={() => runAction(onRetry)}>
              <Text style={styles.buttonText}>{busy ? 'Please wait…' : 'Retry'}</Text>
            </TouchableOpacity>
            {onSignOut && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign out of this account"
              accessibilityState={{ disabled: busy }} disabled={busy} style={styles.secondaryButton}
              onPress={() => runAction(onSignOut)}>
              <Text style={styles.message}>Sign out</Text>
            </TouchableOpacity>}
          </>}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  panel: { width: '100%', maxWidth: 480, gap: SPACING.md, alignItems: 'center' },
  title: { color: COLORS.textPrimary, fontFamily: FONTS.bodyBold, fontSize: 20, textAlign: 'center' },
  message: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 16, textAlign: 'center' },
  button: { minHeight: 48, width: '100%', backgroundColor: COLORS.accentGold, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center', padding: SPACING.md },
  buttonText: { color: COLORS.textOnGold, fontFamily: FONTS.bodyBold, fontSize: 16 },
  secondaryButton: { minHeight: 48, justifyContent: 'center', padding: SPACING.md },
})
