import { useState, useEffect, useRef, useCallback } from 'react'
import NetInfo from '@react-native-community/netinfo'

/**
 * Hook that tracks network connectivity.
 * Returns { isOnline, isInternetReachable }.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const listeners = useRef([])

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = !!(state.isConnected && state.isInternetReachable !== false)
      setIsOnline(prev => {
        if (prev !== online) {
          listeners.current.forEach(fn => fn(online))
        }
        return online
      })
    })

    // Check immediately
    NetInfo.fetch().then(state => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable !== false))
    })

    return () => unsubscribe()
  }, [])

  const onStatusChange = useCallback((fn) => {
    listeners.current.push(fn)
    return () => {
      listeners.current = listeners.current.filter(l => l !== fn)
    }
  }, [])

  return { isOnline, onStatusChange }
}
