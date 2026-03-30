import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, Radius } from '@/constants/theme';

export default function SettingsScreen() {
  const { profile, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
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

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.bgPrimary,
    padding: Spacing.md,
  },
  section: {
    backgroundColor: Colors.dark.bgSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.dark.accentGold,
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
    color: Colors.dark.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  value: {
    color: Colors.dark.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  roleBadge: {
    color: Colors.dark.accentGold,
    fontWeight: '700',
  },
  signOutButton: {
    backgroundColor: Colors.dark.bgSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.error,
  },
  signOutText: {
    color: Colors.dark.error,
    fontFamily: 'DMSans',
    fontSize: 16,
    fontWeight: '700',
  },
});
