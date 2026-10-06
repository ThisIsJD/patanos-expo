import React from 'react'
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/src/contexts/AuthContext'
import StaffAdministration from '@/src/components/auth/StaffAdministration'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'

export default function SettingsScreen() {
  const { profile, signOut } = useAuth()

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
    <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
    <View style={styles.content}>
      {/* Profile info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile?.email ?? '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{profile?.full_name || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Role</Text>
          <Text style={[styles.value, styles.roleBadge]}>
            {profile?.role?.toUpperCase() ?? '—'}
          </Text>
        </View>
      </View>

      {profile?.role === 'admin' && <StaffAdministration />}

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign out" style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
    </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { width: '100%', maxWidth: 760 },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: COLORS.bgPrimary,
    padding: SPACING.md,
  },
  section: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  value: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  roleBadge: {
    color: COLORS.accentGold,
    fontWeight: '700',
  },
  signOutButton: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  signOutText: {
    color: COLORS.error,
    fontFamily: 'DMSans',
    fontSize: 16,
    fontWeight: '700',
  },
})
