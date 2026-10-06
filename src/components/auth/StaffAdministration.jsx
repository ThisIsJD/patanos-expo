import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useStaffAdministration } from '@/src/hooks/useStaffAdministration'
import { COLORS, FONTS, RADIUS, SPACING } from '@/src/constants/theme'

function Action({ label, onPress, disabled, selected = false, destructive = false }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={[styles.action, selected && styles.selected, disabled && styles.disabled]}>
    <Text style={[styles.actionText, destructive && styles.danger]}>{label}</Text>
  </TouchableOpacity>
}

export default function StaffAdministration() {
  const administration = useStaffAdministration()
  const [selectedId, setSelectedId] = useState(null)
  const [staffRole, setStaffRole] = useState('cashier')
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const selected = administration.staff.find(staff => staff.id === selectedId)
  const disabled = administration.busy || administration.loading || !administration.isOnline || Boolean(administration.error)

  useEffect(() => {
    setSelectedId(null); setReason(''); setError(null); setMessage(null)
  }, [administration.ownerId])

  const choose = staff => {
    if (disabled) return
    setSelectedId(staff.id); setStaffRole(staff.role); setReason(''); setError(null); setMessage(null)
  }
  const confirm = enabled => {
    if (!selected || disabled) return
    if (reason.trim().length < 3 || reason.trim().length > 240) {
      setError('Enter a reason of 3–240 characters. Do not include passwords or payment details.')
      return
    }
    const request = { userId: selected.id, enabled, staffRole, reason }
    Alert.alert(enabled ? 'Approve staff access?' : 'Disable staff access?',
      `${selected.email}\n${enabled ? `Allow ${staffRole === 'admin' ? 'owner (POS and administration)' : 'cashier (POS only)'} access.`
        : 'Block new server requests. This does not erase pending orders or revoke offline access already granted.'}`,
      [{ text: 'Cancel', style: 'cancel' }, { text: enabled ? 'Approve' : 'Disable', style: enabled ? 'default' : 'destructive',
        onPress: async () => {
          setError(null); setMessage(null)
          const result = await administration.save(request)
          if (result.error) { setError(result.error); return }
          if (result.saved) { setSelectedId(null); setReason(''); setMessage('Staff change confirmed by the server.') }
        } }])
  }

  if (!administration.ownerId) return null
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>Staff access</Text>
    <Text style={styles.text}>Create and confirm each login in Supabase → Authentication → Users first. Then approve it here. Do not share logins or enter passwords in this form.</Text>
    {!administration.isOnline && <Text accessibilityRole="alert" style={styles.text}>Offline: staff changes require a connection. No account changes are queued.</Text>}
    {administration.loading && <ActivityIndicator accessibilityLabel="Loading staff accounts" color={COLORS.accentGold} />}
    {(error || administration.error) && <Text accessibilityRole="alert" style={styles.danger}>{error || administration.error}</Text>}
    {message && <Text accessibilityRole="alert" style={styles.text}>{message}</Text>}
    <Action label="Refresh staff accounts" disabled={administration.busy || administration.loading || !administration.isOnline}
      onPress={() => { setError(null); setMessage(null); setSelectedId(null); void administration.refresh() }} />
    {!administration.loading && administration.isOnline && !administration.error && administration.staff.length === 0
      && <Text style={styles.text}>No staff accounts returned. Verify owner access, then refresh.</Text>}
    {administration.staff.map(staff => <View key={staff.id} style={styles.card}>
      <Text style={styles.email}>{staff.email}</Text>
      <Text style={styles.text}>{staff.full_name || 'No name'} · {staff.role === 'admin' ? 'Owner' : 'Cashier'} · {staff.is_enabled ? 'Enabled' : 'Not approved / disabled'}</Text>
      {staff.id === administration.ownerId ? <Text style={styles.text}>Your account. Another owner must change your access.</Text>
        : <Action label={`Manage ${staff.email}`} selected={staff.id === selectedId} disabled={disabled} onPress={() => choose(staff)} />}
      {staff.id === selectedId && <View style={styles.form}>
        <Text style={styles.text}>Access level</Text>
        <View style={styles.roles}>
          <Action label="Cashier: POS only" selected={staffRole === 'cashier'} disabled={disabled} onPress={() => setStaffRole('cashier')} />
          <Action label="Owner: POS and admin" selected={staffRole === 'admin'} disabled={disabled} onPress={() => setStaffRole('admin')} />
        </View>
        <TextInput accessibilityLabel="Reason for staff access change" value={reason} onChangeText={setReason}
          placeholder="Reason (3–240 characters)" placeholderTextColor={COLORS.textSecondary} maxLength={240}
          editable={!disabled} style={styles.input} multiline />
        <Action label={staff.is_enabled ? 'Save role / keep enabled' : 'Approve / re-enable'} disabled={disabled} onPress={() => confirm(true)} />
        {staff.is_enabled && <Action label="Disable staff access" disabled={disabled} destructive onPress={() => confirm(false)} />}
      </View>}
    </View>)}
    {administration.busy && <ActivityIndicator accessibilityLabel="Saving staff access" color={COLORS.accentGold} />}
  </View>
}

const styles = StyleSheet.create({
  section: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.md, marginBottom: SPACING.lg },
  title: { color: COLORS.accentGold, fontFamily: FONTS.bodyBold, fontSize: 18 },
  text: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 16 },
  email: { color: COLORS.textPrimary, fontFamily: FONTS.bodyBold, fontSize: 16, flexShrink: 1 },
  danger: { color: COLORS.error, fontFamily: FONTS.body, fontSize: 16 },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.sm },
  form: { gap: SPACING.md },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  action: { minHeight: 48, justifyContent: 'center', padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  selected: { borderColor: COLORS.accentGold, backgroundColor: COLORS.accentGoldSoft },
  actionText: { color: COLORS.accentGold, fontFamily: FONTS.bodyBold, fontSize: 16, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  input: { minHeight: 64, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 16, textAlignVertical: 'top' },
})
