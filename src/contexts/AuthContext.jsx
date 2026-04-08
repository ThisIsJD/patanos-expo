import React, { createContext, useContext, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { supabase } from '@/src/lib/supabase'

const AuthContext = createContext({
  session: null,
  profile: null,
  role: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        // Token refreshed successfully — update session
        setSession(session)
        if (session?.user) fetchProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setSession(session)
        if (session?.user) fetchProfile(session.user.id)
        else setProfile(null)
      } else {
        // Covers USER_UPDATED, PASSWORD_RECOVERY, etc.
        setSession(session)
        if (session?.user) fetchProfile(session.user.id)
        else setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Periodic session health check — catches expired tokens that auto-refresh missed
  useEffect(() => {
    if (!session) return
    const interval = setInterval(async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        setSession(null)
        setProfile(null)
        Alert.alert('Session Expired', 'Please log in again.')
      }
    }, 5 * 60 * 1000) // every 5 minutes
    return () => clearInterval(interval)
  }, [session])

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        role: profile?.role ?? null,
        loading,
        signIn,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
