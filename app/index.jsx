import { Redirect } from 'expo-router'
import { useAuth } from '@/src/contexts/AuthContext'
import AccessState from '@/src/components/auth/AccessState'
import { useRecovery } from '@/src/contexts/RecoveryContext'

export default function Index() {
  const { session, role, loading, authError, refreshProfile, signOut } = useAuth()
  const { blocked, status } = useRecovery()
  if (status === 'checking') return <AccessState loading />
  if (blocked) return <Redirect href="/reset-password" />
  if (loading || authError || (session && !['admin', 'cashier'].includes(role))) {
    return <AccessState loading={loading} error={authError || 'Ask the owner to review your staff account.'}
      onRetry={refreshProfile} onSignOut={session ? signOut : null} />
  }
  return <Redirect href={session ? '/(pos)/order' : '/(auth)/login'} />
}
